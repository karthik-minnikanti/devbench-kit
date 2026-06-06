import { Icon } from "../Icon";

interface TerminalHistoryPanelProps {
    commands: { command: string; timestamp: string }[];
    sessions: {
        id: string;
        title: string;
        scope: string;
        lastActiveAt: string;
        closedAt?: string;
    }[];
    activeTab: "commands" | "sessions";
    onTabChange: (tab: "commands" | "sessions") => void;
    onRunCommand: (command: string) => void;
    onRestoreSession: (sessionId: string) => void;
    onClearCommands: () => void;
    onRemoveSession: (sessionId: string) => void;
}

export function TerminalHistoryPanel({
    commands,
    sessions,
    activeTab,
    onTabChange,
    onRunCommand,
    onRestoreSession,
    onClearCommands,
    onRemoveSession,
}: TerminalHistoryPanelProps) {
    return (
        <aside className="tool-sidebar tool-sidebar--wide flex flex-col border-r border-[var(--color-border)] bg-[var(--color-background-soft)]">
            <div className="tool-sidebar-header">
                <div className="flex gap-2 border-b border-[var(--color-border)] -mx-3 px-3 pb-2 mb-1">
                    <button
                        type="button"
                        onClick={() => onTabChange("commands")}
                        className={`text-[10px] font-medium uppercase tracking-wide pb-1 border-b-2 -mb-px ${
                            activeTab === "commands"
                                ? "border-[var(--color-primary)] text-[var(--color-text-primary)]"
                                : "border-transparent text-[var(--color-text-tertiary)]"
                        }`}
                    >
                        Commands
                    </button>
                    <button
                        type="button"
                        onClick={() => onTabChange("sessions")}
                        className={`text-[10px] font-medium uppercase tracking-wide pb-1 border-b-2 -mb-px ${
                            activeTab === "sessions"
                                ? "border-[var(--color-primary)] text-[var(--color-text-primary)]"
                                : "border-transparent text-[var(--color-text-tertiary)]"
                        }`}
                    >
                        Sessions
                    </button>
                </div>
                {activeTab === "commands" && commands.length > 0 && (
                    <button
                        type="button"
                        onClick={onClearCommands}
                        className="text-[10px] text-[var(--color-text-tertiary)] hover:text-[var(--color-semantic-error)]"
                    >
                        Clear scope
                    </button>
                )}
            </div>

            <div className="tool-sidebar-body px-1">
                {activeTab === "commands" ? (
                    commands.length === 0 ? (
                        <p className="px-2 py-4 text-xs text-[var(--color-text-tertiary)]">
                            Commands you run appear here for quick reuse.
                        </p>
                    ) : (
                        <ul>
                            {commands.map((entry) => (
                                <li key={`${entry.timestamp}-${entry.command}`}>
                                    <button
                                        type="button"
                                        onClick={() => onRunCommand(entry.command)}
                                        className="tool-sidebar-item w-full text-left font-mono text-[11px] truncate group"
                                        title={entry.command}
                                    >
                                        <span className="block truncate">{entry.command}</span>
                                        <span className="block text-[10px] text-[var(--color-text-tertiary)] mt-0.5">
                                            {new Date(entry.timestamp).toLocaleString([], {
                                                month: "short",
                                                day: "numeric",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )
                ) : sessions.length === 0 ? (
                    <p className="px-2 py-4 text-xs text-[var(--color-text-tertiary)]">
                        Past terminal sessions are saved here. Click to reopen.
                    </p>
                ) : (
                    <ul>
                        {sessions.map((session) => (
                            <li key={session.id} className="group relative">
                                <button
                                    type="button"
                                    onClick={() => onRestoreSession(session.id)}
                                    className="tool-sidebar-item w-full text-left pr-8"
                                >
                                    <span className="block text-xs font-medium truncate">
                                        {session.title}
                                    </span>
                                    <span className="block text-[10px] text-[var(--color-text-tertiary)] truncate mt-0.5">
                                        {session.scope}
                                    </span>
                                    <span className="block text-[10px] text-[var(--color-text-tertiary)] mt-0.5">
                                        {new Date(session.lastActiveAt).toLocaleString([], {
                                            month: "short",
                                            day: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                        {session.closedAt ? " · closed" : ""}
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onRemoveSession(session.id)}
                                    className="absolute right-1 top-1/2 -translate-y-1/2 p-1 opacity-0 group-hover:opacity-100 text-[var(--color-text-tertiary)] hover:text-[var(--color-semantic-error)]"
                                    title="Remove from history"
                                >
                                    <Icon name="X" className="w-3 h-3" />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </aside>
    );
}
