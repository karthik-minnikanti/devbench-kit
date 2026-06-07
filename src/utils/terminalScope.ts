import type { TerminalSessionConfig } from "../components/TerminalView";

export function getTerminalScope(session: TerminalSessionConfig): string {
    switch (session.kind) {
        case "local":
            return `local:${session.cwd || "~"}`;
        case "k8s":
            return `k8s:${session.namespace || "default"}/${session.podName || "pod"}${session.container ? `/${session.container}` : ""}`;
        case "docker":
            return `docker:${session.containerId || "container"}`;
        default:
            return "unknown";
    }
}

export function getTerminalTitle(session: TerminalSessionConfig): string {
    switch (session.kind) {
        case "local":
            return session.cwd ? `Local · ${session.cwd}` : "Local shell";
        case "k8s": {
            const ns = session.namespace || "default";
            const pod = session.podName || "pod";
            return session.container
                ? `${ns}/${pod} (${session.container})`
                : `${ns}/${pod}`;
        }
        case "docker":
            return session.containerId
                ? `Container · ${session.containerId.slice(0, 12)}`
                : "Docker shell";
        default:
            return "Terminal";
    }
}

export function sessionConfigKey(session: TerminalSessionConfig): string {
    return JSON.stringify({
        kind: session.kind,
        shell: session.shell ?? null,
        cwd: session.cwd ?? null,
        podName: session.podName ?? null,
        namespace: session.namespace ?? null,
        container: session.container ?? null,
        containerId: session.containerId ?? null,
    });
}

export function formatDevShellTabTitle(command: string, maxLength = 48): string {
    const trimmed = command.trim().replace(/\s+/g, " ");
    if (!trimmed) {
        return "Shell";
    }
    if (trimmed.length <= maxLength) {
        return trimmed;
    }
    return `${trimmed.slice(0, maxLength - 1)}…`;
}

export interface TerminalSessionDetail {
    label: string;
    value: string;
    copyValue?: string;
}

export function getTerminalSessionDetails(
    config: TerminalSessionConfig,
): TerminalSessionDetail[] {
    switch (config.kind) {
        case "local":
            return [
                {
                    label: "Scope",
                    value: getTerminalScope(config),
                    copyValue: getTerminalScope(config),
                },
                ...(config.cwd
                    ? [{ label: "Directory", value: config.cwd, copyValue: config.cwd }]
                    : []),
                ...(config.shell
                    ? [{ label: "Shell", value: config.shell, copyValue: config.shell }]
                    : []),
            ];
        case "k8s":
            return [
                {
                    label: "Namespace",
                    value: config.namespace || "default",
                    copyValue: config.namespace || "default",
                },
                {
                    label: "Pod",
                    value: config.podName || "—",
                    copyValue: config.podName,
                },
                ...(config.container
                    ? [
                          {
                              label: "Container",
                              value: config.container,
                              copyValue: config.container,
                          },
                      ]
                    : []),
                {
                    label: "Scope",
                    value: getTerminalScope(config),
                    copyValue: getTerminalScope(config),
                },
            ];
        case "docker":
            return [
                {
                    label: "Container ID",
                    value: config.containerId
                        ? `${config.containerId.slice(0, 12)}…`
                        : "—",
                    copyValue: config.containerId,
                },
                {
                    label: "Scope",
                    value: getTerminalScope(config),
                    copyValue: getTerminalScope(config),
                },
            ];
        default:
            return [];
    }
}
