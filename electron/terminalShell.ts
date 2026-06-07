import path from 'path';
import { execSync } from 'child_process';

/**
 * Bootstraps an interactive shell inside a pod/container.
 * Uses `script` when available so kubectl/docker exec gets a real TTY on the remote side.
 */
export const REMOTE_SHELL_BOOTSTRAP = [
    'export TERM=${TERM:-xterm-256color}',
    'export COLORTERM=truecolor',
    'export LANG=${LANG:-C.UTF-8}',
    'if command -v script >/dev/null 2>&1; then',
    '  if command -v bash >/dev/null 2>&1; then',
    '    exec script -q -c "bash -il" /dev/null',
    '  fi',
    '  exec script -q -c "sh -i" /dev/null',
    'fi',
    'if command -v bash >/dev/null 2>&1; then',
    '  exec bash -il',
    'fi',
    'exec sh -il 2>/dev/null || exec sh -i',
].join('\n');

const PATH_PREFIXES = [
    '/opt/homebrew/bin',
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
    `${process.env.HOME || ''}/.local/bin`,
].filter(Boolean);

export function enhancedPath(): string {
    const current = process.env.PATH || '';
    const parts = [...PATH_PREFIXES, ...current.split(path.delimiter)];
    return [...new Set(parts.filter(Boolean))].join(path.delimiter);
}

export function resolveExecutable(name: string): string {
    if (path.isAbsolute(name)) {
        return name;
    }

    try {
        const resolved = execSync(`command -v ${name}`, {
            encoding: 'utf8',
            env: { ...process.env, PATH: enhancedPath() },
            stdio: ['ignore', 'pipe', 'ignore'],
        }).trim();
        if (resolved) {
            return resolved;
        }
    } catch {
        /* fall through */
    }

    return name;
}

export function defaultLocalShell(): string {
    if (process.platform === 'win32') {
        return process.env.COMSPEC || 'powershell.exe';
    }
    return process.env.SHELL || '/bin/zsh';
}

export function localShellInvocation(shellPath?: string): { file: string; args: string[] } {
    const file = shellPath || defaultLocalShell();
    const base = path.basename(file).toLowerCase();

    if (process.platform === 'win32') {
        if (base.includes('powershell') || base.includes('pwsh')) {
            return { file, args: ['-NoLogo'] };
        }
        return { file, args: [] };
    }

    if (base.includes('zsh') || base.includes('bash')) {
        return { file, args: ['-il'] };
    }

    return { file, args: ['-i'] };
}

/** Remote exec argv after `--` for kubectl/docker (interactive shell). */
export function remoteExecCommand(customShell?: string): { file: string; args: string[] } {
    if (customShell) {
        const escaped = customShell.replace(/'/g, `'\\''`);
        return {
            file: 'env',
            args: [
                'TERM=xterm-256color',
                'COLORTERM=truecolor',
                'sh',
                '-c',
                `if [ -x '${escaped}' ]; then exec '${escaped}' -il 2>/dev/null || exec '${escaped}' -i; fi; ${REMOTE_SHELL_BOOTSTRAP}`,
            ],
        };
    }

    return {
        file: 'env',
        args: ['TERM=xterm-256color', 'COLORTERM=truecolor', 'sh', '-c', REMOTE_SHELL_BOOTSTRAP],
    };
}

/** @deprecated Use REMOTE_SHELL_BOOTSTRAP */
export const REMOTE_INTERACTIVE_SHELL = REMOTE_SHELL_BOOTSTRAP;
