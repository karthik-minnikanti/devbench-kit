import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import os from 'os';

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
    return resolveLocalShell();
}

/** Pick the first shell that exists and is executable (GUI apps often lack a valid $SHELL). */
export function resolveLocalShell(preferred?: string): string {
    const candidates = [
        preferred,
        process.env.SHELL,
        '/bin/zsh',
        '/bin/bash',
        '/bin/sh',
    ].filter((value): value is string => Boolean(value));

    const seen = new Set<string>();
    for (const candidate of candidates) {
        const shellPath = path.isAbsolute(candidate)
            ? candidate
            : resolveExecutable(candidate);
        if (seen.has(shellPath)) {
            continue;
        }
        seen.add(shellPath);
        try {
            fs.accessSync(shellPath, fs.constants.X_OK);
            return shellPath;
        } catch {
            /* try next */
        }
    }

    return '/bin/sh';
}

/** GUI-launched apps may have no $HOME; fall back to os.homedir() or /tmp. */
export function resolveTerminalCwd(cwd?: string): string {
    const candidates = [cwd, process.env.HOME, os.homedir(), '/tmp', '/'].filter(
        (value): value is string => Boolean(value),
    );

    for (const dir of candidates) {
        try {
            fs.accessSync(dir, fs.constants.R_OK | fs.constants.W_OK | fs.constants.X_OK);
            return dir;
        } catch {
            /* try next */
        }
    }

    return '/';
}

export function localShellInvocation(shellPath?: string): { file: string; args: string[] } {
    const file = resolveLocalShell(shellPath);
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
