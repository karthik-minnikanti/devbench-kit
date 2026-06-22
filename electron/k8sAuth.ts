import * as k8s from '@kubernetes/client-node';
import { spawn } from 'child_process';
import { shell } from 'electron';
import { enhancedPath, resolveExecutable } from './terminalShell';

export interface K8sAuthResult {
    success: boolean;
    required: boolean;
    authType?: 'exec' | 'oidc' | 'none';
    openedUrls?: string[];
    error?: string;
}

const AUTH_URL_REGEX = /https?:\/\/[^\s"'<>)\]]+/g;
const AUTH_TIMEOUT_MS = 5 * 60 * 1000;

function extractUrls(text: string): string[] {
    const matches = text.match(AUTH_URL_REGEX) || [];
    return matches.map((url) => url.replace(/[.,;:!?)]+$/, ''));
}

async function openAuthUrls(text: string, opened: Set<string>): Promise<string[]> {
    const newlyOpened: string[] = [];
    for (const url of extractUrls(text)) {
        if (opened.has(url)) {
            continue;
        }
        opened.add(url);
        try {
            await shell.openExternal(url);
            newlyOpened.push(url);
        } catch {
            // ignore browser open failures
        }
    }
    return newlyOpened;
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

function getExecConfig(user: k8s.User): { command: string; args: string[]; env: NodeJS.ProcessEnv } | null {
    let exec = user.exec;
    if (!exec && user.authProvider?.config?.exec) {
        exec = user.authProvider.config.exec;
    }
    if (!exec?.command) {
        return null;
    }

    // Packaged Electron apps often have a minimal PATH; ensure common locations.
    const env: NodeJS.ProcessEnv = { ...process.env, PATH: enhancedPath() };
    if (exec.env) {
        for (const elt of exec.env) {
            env[elt.name] = elt.value;
        }
    }

    return {
        command: resolveExecutable(exec.command),
        args: exec.args || [],
        env,
    };
}

function runExecCredentialPlugin(
    user: k8s.User,
    timeoutMs = AUTH_TIMEOUT_MS,
): Promise<{ credential?: unknown; openedUrls: string[]; error?: string }> {
    const exec = getExecConfig(user);
    if (!exec) {
        return Promise.resolve({ openedUrls: [], error: 'No exec auth config found' });
    }

    return new Promise((resolve) => {
        const opened = new Set<string>();
        const openedUrls: string[] = [];
        let stdoutData = '';
        let stderrData = '';
        let settled = false;

        const subprocess = spawn(exec.command, exec.args, {
            env: exec.env,
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        const handleOutput = async (text: string) => {
            const urls = await openAuthUrls(text, opened);
            openedUrls.push(...urls);
        };

        subprocess.stdout?.on('data', (data: Buffer) => {
            const text = data.toString('utf8');
            stdoutData += text;
            void handleOutput(text);
        });

        subprocess.stderr?.on('data', (data: Buffer) => {
            const text = data.toString('utf8');
            stderrData += text;
            void handleOutput(text);
        });

        const finish = (result: { credential?: unknown; openedUrls: string[]; error?: string }) => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timer);
            resolve({ ...result, openedUrls });
        };

        subprocess.on('error', (error) => {
            finish({ error: error.message, openedUrls });
        });

        subprocess.on('close', (code) => {
            if (code !== 0) {
                finish({
                    error: stderrData.trim() || `Exec auth exited with code ${code}`,
                    openedUrls,
                });
                return;
            }

            try {
                const obj = JSON.parse(stdoutData);
                finish({ credential: obj, openedUrls });
            } catch {
                finish({ error: 'Failed to parse exec auth response', openedUrls });
            }
        });

        const timer = setTimeout(() => {
            subprocess.kill('SIGTERM');
            finish({
                error: 'OIDC authentication timed out. Complete sign-in in your browser and try again.',
                openedUrls,
            });
        }, timeoutMs);
    });
}

async function runOidcLogin(kc: k8s.KubeConfig): Promise<K8sAuthResult> {
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

    const args = [
        'oidc-login',
        'login',
        `--oidc-issuer-url=${issuer}`,
        `--oidc-client-id=${clientId}`,
        `--context=${kc.getCurrentContext()}`,
    ];
    if (config['client-secret']) {
        args.push(`--oidc-client-secret=${config['client-secret']}`);
    }

    return new Promise((resolve) => {
        const opened = new Set<string>();
        const openedUrls: string[] = [];
        let settled = false;

        const subprocess = spawn(resolveExecutable('kubectl'), args, {
            env: { ...process.env, PATH: enhancedPath() },
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        const onData = async (data: Buffer) => {
            const urls = await openAuthUrls(data.toString('utf8'), opened);
            openedUrls.push(...urls);
        };

        subprocess.stdout?.on('data', onData);
        subprocess.stderr?.on('data', onData);

        const finish = (result: K8sAuthResult) => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timer);
            resolve({ ...result, openedUrls });
        };

        subprocess.on('close', (code) => {
            if (code === 0) {
                finish({ success: true, required: true, authType: 'oidc', openedUrls });
                return;
            }
            finish({
                success: false,
                required: true,
                authType: 'oidc',
                openedUrls,
                error:
                    openedUrls.length > 0
                        ? 'Sign-in did not complete. Finish authentication in your browser and try again.'
                        : 'kubectl oidc-login failed. Install the kubectl oidc-login plugin.',
            });
        });

        subprocess.on('error', (error: any) => {
            finish({
                success: false,
                required: true,
                authType: 'oidc',
                error:
                    (error?.code === 'ENOENT'
                        ? 'kubectl not found (ENOENT). Install kubectl and ensure it is on PATH.'
                        : `kubectl failed to start: ${error?.message || String(error)}`) +
                    ' DevBench uses your system kubectl for OIDC login.',
            });
        });

        const timer = setTimeout(() => {
            subprocess.kill('SIGTERM');
            finish({
                success: false,
                required: true,
                authType: 'oidc',
                openedUrls,
                error: 'OIDC login timed out. Complete sign-in in your browser and try again.',
            });
        }, AUTH_TIMEOUT_MS);
    });
}

export async function ensureK8sAuthentication(kc: k8s.KubeConfig): Promise<K8sAuthResult> {
    const user = kc.getCurrentUser();
    if (!user || !requiresInteractiveAuth(user)) {
        return { success: true, required: false, authType: 'none' };
    }

    const authType = getUserAuthType(user);
    if (authType === 'exec') {
        const result = await runExecCredentialPlugin(user);
        if (result.credential) {
            return { success: true, required: true, authType: 'exec', openedUrls: result.openedUrls };
        }
        return {
            success: false,
            required: true,
            authType: 'exec',
            openedUrls: result.openedUrls,
            error:
                result.error ||
                (result.openedUrls.length > 0
                    ? 'Complete sign-in in your browser, then switch context again.'
                    : 'Exec authentication failed'),
        };
    }

    if (authType === 'oidc') {
        return runOidcLogin(kc);
    }

    return { success: true, required: false, authType: 'none' };
}
