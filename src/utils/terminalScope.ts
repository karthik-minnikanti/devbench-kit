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
