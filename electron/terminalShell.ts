import path from 'path';

/** Pick the best interactive shell inside a container/pod. */
export const REMOTE_INTERACTIVE_SHELL = [
    'export TERM=xterm-256color',
    'export COLORTERM=truecolor',
    'export LANG=${LANG:-C.UTF-8}',
    'for s in /bin/zsh /usr/bin/zsh /bin/bash /usr/bin/bash /bin/ash /bin/sh; do',
    '  if [ -x "$s" ]; then',
    '    exec "$s" -il 2>/dev/null || exec "$s" -i',
    '  fi',
    'done',
    'exec sh -i',
].join('\n');

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

export function remoteExecCommand(customShell?: string): { file: string; args: string[] } {
    if (customShell) {
        return { file: customShell, args: ['-il'] };
    }
    return { file: 'sh', args: ['-c', REMOTE_INTERACTIVE_SHELL] };
}
