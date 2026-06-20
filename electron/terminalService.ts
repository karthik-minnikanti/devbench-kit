import { randomUUID } from 'crypto';
import type { WebContents } from 'electron';
import * as pty from 'node-pty';
import {
    defaultLocalShell,
    enhancedPath,
    localShellInvocation,
    remoteExecCommand,
    resolveExecutable,
} from './terminalShell';

export type TerminalKind = 'local' | 'k8s' | 'docker';

export interface TerminalCreateOptions {
    kind: TerminalKind;
    shell?: string;
    cwd?: string;
    podName?: string;
    namespace?: string;
    container?: string;
    containerId?: string;
    cols?: number;
    rows?: number;
    kubectlContextArgs?: string[];
    kubeconfigPath?: string;
}

interface TerminalSession {
    pty: pty.IPty;
    webContents: WebContents;
}

function buildSpawn(options: TerminalCreateOptions): { file: string; args: string[] } {
    switch (options.kind) {
        case 'k8s': {
            if (!options.podName || !options.namespace) {
                throw new Error('podName and namespace are required for Kubernetes terminals');
            }
            const remote = remoteExecCommand(options.shell);
            const args = [
                ...(options.kubectlContextArgs || []),
                'exec',
                '-it',
                options.podName,
                '-n',
                options.namespace,
            ];
            if (options.container) {
                args.push('-c', options.container);
            }
            args.push('--', remote.file, ...remote.args);
            return { file: resolveExecutable('kubectl'), args };
        }
        case 'docker': {
            if (!options.containerId) {
                throw new Error('containerId is required for Docker terminals');
            }
            const remote = remoteExecCommand(options.shell);
            return {
                file: resolveExecutable('docker'),
                args: ['exec', '-it', options.containerId, remote.file, ...remote.args],
            };
        }
        case 'local':
        default:
            return localShellInvocation(options.shell || defaultLocalShell());
    }
}

function buildEnv(options: TerminalCreateOptions): Record<string, string> {
    const env = {
        ...process.env,
        PATH: enhancedPath(),
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
    } as Record<string, string>;

    if (options.kubeconfigPath) {
        env.KUBECONFIG = options.kubeconfigPath;
    }

    if (options.kind === 'local') {
        if (!env.LANG) {
            env.LANG = 'en_US.UTF-8';
        }
    }

    return env;
}

class TerminalService {
    private sessions = new Map<string, TerminalSession>();

    create(
        webContents: WebContents,
        options: TerminalCreateOptions,
    ): { success: boolean; sessionId?: string; error?: string } {
        try {
            const cols = Math.max(options.cols ?? 80, 2);
            const rows = Math.max(options.rows ?? 24, 2);
            const { file, args } = buildSpawn(options);
            const cwd =
                options.kind === 'local'
                    ? options.cwd || process.env.HOME || process.cwd()
                    : process.env.HOME || process.cwd();

            const ptyProcess = pty.spawn(file, args, {
                name: 'xterm-256color',
                cols,
                rows,
                cwd,
                env: buildEnv(options),
                useConpty: process.platform === 'win32',
            });

            const sessionId = randomUUID();

            ptyProcess.onData((data) => {
                if (!webContents.isDestroyed()) {
                    webContents.send('terminal:data', { sessionId, data });
                }
            });

            ptyProcess.onExit(({ exitCode }) => {
                if (!webContents.isDestroyed()) {
                    webContents.send('terminal:exit', { sessionId, exitCode });
                }
                this.sessions.delete(sessionId);
            });

            this.sessions.set(sessionId, { pty: ptyProcess, webContents });
            return { success: true, sessionId };
        } catch (error: any) {
            return { success: false, error: error.message || String(error) };
        }
    }

    write(sessionId: string, data: string): { success: boolean; error?: string } {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return { success: false, error: 'Terminal session not found' };
        }
        session.pty.write(data);
        return { success: true };
    }

    resize(
        sessionId: string,
        cols: number,
        rows: number,
    ): { success: boolean; error?: string } {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return { success: false, error: 'Terminal session not found' };
        }
        session.pty.resize(Math.max(cols, 2), Math.max(rows, 2));
        return { success: true };
    }

    destroy(sessionId: string): { success: boolean; error?: string } {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return { success: false, error: 'Terminal session not found' };
        }
        try {
            session.pty.kill();
        } catch {
            /* ignore */
        }
        this.sessions.delete(sessionId);
        return { success: true };
    }

    destroyAllForWebContents(webContents: WebContents): void {
        for (const [id, session] of this.sessions) {
            if (session.webContents === webContents) {
                try {
                    session.pty.kill();
                } catch {
                    /* ignore */
                }
                this.sessions.delete(id);
            }
        }
    }
}

export const terminalService = new TerminalService();
