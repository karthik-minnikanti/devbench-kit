import * as k8s from '@kubernetes/client-node';
import { spawn } from 'child_process';
import fs from 'fs';
import { enhancedPath, resolveExecutable } from './terminalShell';

export interface K8sAuthResult {
    success: boolean;
    required: boolean;
    authType?: 'exec' | 'oidc' | 'none';
    error?: string;
}

export interface K8sAuthOptions {
    kubeconfigPath?: string;
}

const AUTH_TIMEOUT_MS = 5 * 60 * 1000;

const OIDC_LOGIN_INSTALL_HINT =
    'kubectl oidc-login plugin not found. Install kubelogin: brew install int128/kubelogin/kubelogin ' +
    '(or: kubectl krew install oidc-login)';

function isOidcLoginMissingError(text: string): boolean {
    const lower = text.toLowerCase();
    return lower.includes('oidc-login') && lower.includes('unknown command');
}

function formatAuthError(stderr: string): string {
    const trimmed = stderr.trim();
    if (isOidcLoginMissingError(trimmed)) {
        return OIDC_LOGIN_INSTALL_HINT;
    }
    return trimmed || 'Authentication failed';
}

function resolveKubelogin(): string | null {
    const resolved = resolveExecutable('kubelogin');
    if (resolved === 'kubelogin') {
        return null;
    }
    try {
        fs.accessSync(resolved, fs.constants.X_OK);
        return resolved;
    } catch {
        return null;
    }
}

/** Env kubectl expects: KUBECONFIG points at the cluster kubeconfig copy in DevBench. */
function buildAuthEnv(kubeconfigPath?: string): NodeJS.ProcessEnv {
    const env: NodeJS.ProcessEnv = { ...process.env, PATH: enhancedPath() };
    if (kubeconfigPath) {
        env.KUBECONFIG = kubeconfigPath;
    }
    return env;
}

export function getUserAuthType(user: k8s.User | null | undefined): 'exec' | 'oidc' | 'none' {
    if (!user) {
        return 'none';
    }
    if (user.exec) {
        return 'exec';
    }
    if (user.authProvider?.name === 'exec' || user.authProvider?.config?.exec) {
        return 'exec';
    }
    if (user.authProvider?.name === 'oidc') {
        return 'oidc';
    }
    return 'none';
}

export function requiresInteractiveAuth(user: k8s.User | null | undefined): boolean {
    const type = getUserAuthType(user);
    if (type === 'exec') {
        return true;
    }
    if (type === 'oidc') {
        const config = user?.authProvider?.config || {};
        return !config['id-token'];
    }
    return false;
}

interface SpawnAuthResult {
    success: boolean;
    error?: string;
    spawnError?: NodeJS.ErrnoException;
}

function runSpawnAuth(
    command: string,
    args: string[],
    env: NodeJS.ProcessEnv,
    timeoutMs = AUTH_TIMEOUT_MS,
): Promise<SpawnAuthResult> {
    return new Promise((resolve) => {
        let stderrData = '';
        let settled = false;

        const subprocess = spawn(command, args, {
            env,
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        subprocess.stderr?.on('data', (data: Buffer) => {
            stderrData += data.toString('utf8');
        });

        const finish = (result: SpawnAuthResult) => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timer);
            resolve(result);
        };

        subprocess.on('error', (error: NodeJS.ErrnoException) => {
            finish({ success: false, error: error.message, spawnError: error });
        });

        subprocess.on('close', (code) => {
            if (code !== 0) {
                finish({
                    success: false,
                    error: stderrData.trim() || `kubectl exited with code ${code}`,
                });
                return;
            }
            finish({ success: true });
        });

        const timer = setTimeout(() => {
            subprocess.kill('SIGTERM');
            finish({
                success: false,
                error: 'OIDC authentication timed out. Complete sign-in in your browser and try again.',
            });
        }, timeoutMs);
    });
}

/**
 * Run a lightweight kubectl API call with KUBECONFIG set so kubectl invokes the
 * kubeconfig's exec/OIDC credential plugin (same as running kubectl in a terminal).
 * kubelogin opens the browser itself — no need for DevBench to handle URLs.
 */
async function runKubectlAuth(
    kc: k8s.KubeConfig,
    kubeconfigPath?: string,
): Promise<SpawnAuthResult> {
    const kubectl = resolveExecutable('kubectl');
    const args: string[] = [];
    if (kubeconfigPath) {
        args.push('--kubeconfig', kubeconfigPath);
    }
    const context = kc.getCurrentContext();
    if (context) {
        args.push('--context', context);
    }
    args.push('get', 'ns', '--request-timeout=2m');

    return runSpawnAuth(kubectl, args, buildAuthEnv(kubeconfigPath));
}

function buildOidcLoginArgs(kc: k8s.KubeConfig, kubeconfigPath?: string): string[] {
    const user = kc.getCurrentUser();
    const config = user?.authProvider?.config || {};
    const issuer = config['idp-issuer-url'];
    const clientId = config['client-id'];

    const args = [
        `--oidc-issuer-url=${issuer}`,
        `--oidc-client-id=${clientId}`,
        `--context=${kc.getCurrentContext()}`,
    ];
    if (config['client-secret']) {
        args.push(`--oidc-client-secret=${config['client-secret']}`);
    }
    if (kubeconfigPath) {
        args.push(`--kubeconfig=${kubeconfigPath}`);
    }
    return args;
}

function getOidcLoginAttempts(
    kc: k8s.KubeConfig,
    kubeconfigPath?: string,
): Array<{ command: string; args: string[]; env: NodeJS.ProcessEnv }> {
    const loginArgs = buildOidcLoginArgs(kc, kubeconfigPath);
    const env = buildAuthEnv(kubeconfigPath);
    const attempts: Array<{ command: string; args: string[]; env: NodeJS.ProcessEnv }> = [
        {
            command: resolveExecutable('kubectl'),
            args: ['oidc-login', 'login', ...loginArgs],
            env,
        },
    ];

    const kubelogin = resolveKubelogin();
    if (kubelogin) {
        attempts.push({
            command: kubelogin,
            args: ['login', ...loginArgs],
            env,
        });
    }

    return attempts;
}

/** Fallback for legacy auth-provider: oidc blocks that lack an exec plugin. */
async function runOidcLogin(kc: k8s.KubeConfig, kubeconfigPath?: string): Promise<K8sAuthResult> {
    const user = kc.getCurrentUser();
    if (!user?.authProvider?.config) {
        return { success: false, required: true, authType: 'oidc', error: 'Missing OIDC config' };
    }

    const config = user.authProvider.config;
    const issuer = config['idp-issuer-url'];
    const clientId = config['client-id'];
    if (!issuer || !clientId) {
        return {
            success: false,
            required: true,
            authType: 'oidc',
            error: 'Missing idp-issuer-url or client-id in kubeconfig',
        };
    }

    const attempts = getOidcLoginAttempts(kc, kubeconfigPath);
    let lastResult: SpawnAuthResult = { success: false };

    for (let i = 0; i < attempts.length; i++) {
        const attempt = attempts[i];
        lastResult = await runSpawnAuth(attempt.command, attempt.args, attempt.env);

        if (lastResult.success) {
            return { success: true, required: true, authType: 'oidc' };
        }

        const canRetry =
            i < attempts.length - 1 &&
            lastResult.error &&
            isOidcLoginMissingError(lastResult.error);
        if (!canRetry) {
            break;
        }
    }

    if (lastResult.spawnError?.code === 'ENOENT') {
        return {
            success: false,
            required: true,
            authType: 'oidc',
            error:
                'kubectl not found. Install kubectl and kubelogin for OIDC sign-in. ' +
                'DevBench uses your system kubectl/kubelogin.',
        };
    }

    return {
        success: false,
        required: true,
        authType: 'oidc',
        error: formatAuthError(lastResult.error || ''),
    };
}

function kubectlAuthFailure(authType: 'exec' | 'oidc', result: SpawnAuthResult): K8sAuthResult {
    if (result.spawnError?.code === 'ENOENT') {
        return {
            success: false,
            required: true,
            authType,
            error: 'kubectl not found. Install kubectl and ensure it is on PATH.',
        };
    }

    return {
        success: false,
        required: true,
        authType,
        error: formatAuthError(result.error || '') || 'kubectl authentication failed',
    };
}

export async function ensureK8sAuthentication(
    kc: k8s.KubeConfig,
    options: K8sAuthOptions = {},
): Promise<K8sAuthResult> {
    const { kubeconfigPath } = options;
    const user = kc.getCurrentUser();
    if (!user || !requiresInteractiveAuth(user)) {
        return { success: true, required: false, authType: 'none' };
    }

    const authType = getUserAuthType(user);

    // Primary: KUBECONFIG + kubectl API call lets kubectl run the exec credential plugin.
    const kubectlResult = await runKubectlAuth(kc, kubeconfigPath);
    if (kubectlResult.success) {
        return { success: true, required: true, authType };
    }

    // Legacy kubeconfigs with auth-provider: oidc (no exec block) need explicit login.
    if (authType === 'oidc') {
        return runOidcLogin(kc, kubeconfigPath);
    }

    return kubectlAuthFailure(authType, kubectlResult);
}
