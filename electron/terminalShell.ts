import path from 'path';
import { execSync } from 'child_process';

/** One-liner: pick an interactive shell; kubectl/docker `-it` already allocates the TTY. */
export const REMOTE_SHELL_BOOTSTRAP =
    'export TERM="${TERM:-xterm-256color}"; ' +
    'export COLORTERM="${COLORTERM:-truecolor}"; ' +
    'if command -v bash >/dev/null 2>&1; then exec bash -i; ' +
    'elif command -v ash >/dev/null 2>&1; then exec ash -i; ' +
    'else exec sh -i; fi';

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
        return { file: customShell, args: ['-i'] };
    }

    return { file: 'sh', args: ['-c', REMOTE_SHELL_BOOTSTRAP] };
}

/** @deprecated Use REMOTE_SHELL_BOOTSTRAP */
export const REMOTE_INTERACTIVE_SHELL = REMOTE_SHELL_BOOTSTRAP;
