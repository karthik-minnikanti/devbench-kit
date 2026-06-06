import { useCallback, useEffect, useRef, useState } from "react";
import {
    TerminalView,
    TerminalSessionConfig,
    TerminalViewHandle,
} from "./TerminalView";
import { ToolToolbar } from "./ui/ToolChrome";
import { TerminalHistoryPanel } from "./terminal/TerminalHistoryPanel";
import {
    getTerminalScope,
    getTerminalTitle,
    sessionConfigKey,
} from "../utils/terminalScope";

interface ActiveSession {
    id: string;
    title: string;
    scope: string;
    config: TerminalSessionConfig;
    mountKey: number;
}

function createSession(config: TerminalSessionConfig = { kind: "local" }): ActiveSession {
    const id = crypto.randomUUID();
    return {
        id,
        title: getTerminalTitle(config),
        scope: getTerminalScope(config),
        config,
        mountKey: 0,
    };
}

export function LocalTerminal() {
    const [showHistory, setShowHistory] = useState(true);
    const [historyTab, setHistoryTab] = useState<"commands" | "sessions">("commands");
    const [activeSession, setActiveSession] = useState<ActiveSession>(() => createSession());
    const [commands, setCommands] = useState<{ command: string; timestamp: string }[]>([]);
    const [sessions, setSessions] = useState<
        {
            id: string;
            title: string;
            scope: string;
            lastActiveAt: string;
            closedAt?: string;
            config: TerminalSessionConfig;
        }[]
    >([]);
    const terminalRef = useRef<TerminalViewHandle>(null);
    const sessionRegisteredRef = useRef<string | null>(null);

    const refreshCommands = useCallback(async (scope: string) => {
        if (!window.electronAPI?.terminal?.getCommands) return;
        const entries = await window.electronAPI.terminal.getCommands(scope, "", 100);
        setCommands(
            (entries.commands ?? []).map((e) => ({
                command: e.command,
                timestamp: e.timestamp,
            })),
        );
    }, []);

    const refreshSessions = useCallback(async () => {
        if (!window.electronAPI?.terminal?.listSessions) return;
        const result = await window.electronAPI.terminal.listSessions(30);
        setSessions(
            (result.sessions ?? []).map((entry) => ({
                id: entry.id,
                title: entry.title,
                scope: entry.scope,
                lastActiveAt: entry.lastActiveAt,
                closedAt: entry.closedAt,
                config: entry.config as unknown as TerminalSessionConfig,
            })),
        );
    }, []);

    const registerSession = useCallback(async (session: ActiveSession) => {
        if (!window.electronAPI?.terminal?.addSession) return session.id;
        const result = await window.electronAPI.terminal.addSession({
            id: session.id,
            title: session.title,
            scope: session.scope,
            kind: session.config.kind,
            config: session.config as unknown as Record<string, unknown>,
        });
        return result.session?.id ?? session.id;
    }, []);

    useEffect(() => {
        void refreshCommands(activeSession.scope);
        void refreshSessions();
    }, [activeSession.scope, refreshCommands, refreshSessions]);

    useEffect(() => {
        if (sessionRegisteredRef.current === activeSession.id) return;
        sessionRegisteredRef.current = activeSession.id;
        void registerSession(activeSession);
    }, [activeSession, registerSession]);

    const startNewSession = () => {
        const next = createSession();
        sessionRegisteredRef.current = null;
        setActiveSession(next);
        void refreshSessions();
    };

    const restartSession = () => {
        setActiveSession((prev) => ({
            ...prev,
            mountKey: prev.mountKey + 1,
        }));
    };

    const restoreSession = (sessionId: string) => {
        const match = sessions.find((s) => s.id === sessionId);
        if (!match) return;
        sessionRegisteredRef.current = null;
        setActiveSession({
            id: match.id,
            title: match.title,
            scope: match.scope,
            config: match.config,
            mountKey: Date.now(),
        });
        if (window.electronAPI?.terminal?.touchSession) {
            void window.electronAPI.terminal.touchSession(match.id);
        }
    };

    return (
        <div className="h-full flex flex-col bg-[var(--color-background)]">
            <ToolToolbar
                title="Terminal"
                actions={
                    <>
                        <button
                            type="button"
                            onClick={() => setShowHistory((v) => !v)}
                            className="btn-secondary !h-7 !text-xs"
                        >
                            {showHistory ? "Hide history" : "History"}
                        </button>
                        <button
                            type="button"
                            onClick={restartSession}
                            className="btn-secondary !h-7 !text-xs"
                        >
                            Restart
                        </button>
                        <button
                            type="button"
                            onClick={startNewSession}
                            className="btn-secondary !h-7 !text-xs"
                        >
                            New session
                        </button>
                    </>
                }
            >
                <span className="text-[10px] text-[var(--color-text-tertiary)] truncate max-w-[240px]">
                    {activeSession.title}
                </span>
            </ToolToolbar>

            <div className="flex-1 min-h-0 flex overflow-hidden">
                {showHistory && (
                    <TerminalHistoryPanel
                        commands={commands}
                        sessions={sessions}
                        activeTab={historyTab}
                        onTabChange={setHistoryTab}
                        onRunCommand={(command) => terminalRef.current?.runCommand(command)}
                        onRestoreSession={restoreSession}
                        onClearCommands={() => {
                            if (window.electronAPI?.terminal?.clearCommands) {
                                void window.electronAPI.terminal
                                    .clearCommands(activeSession.scope)
                                    .then(() => refreshCommands(activeSession.scope));
                            }
                        }}
                        onRemoveSession={(sessionId) => {
                            if (window.electronAPI?.terminal?.removeSession) {
                                void window.electronAPI.terminal
                                    .removeSession(sessionId)
                                    .then(refreshSessions);
                            }
                        }}
                    />
                )}

                <div className="flex-1 min-h-0 min-w-0">
                    <TerminalView
                        ref={terminalRef}
                        key={`${activeSession.id}-${activeSession.mountKey}-${sessionConfigKey(activeSession.config)}`}
                        active
                        session={activeSession.config}
                        sessionRecordId={activeSession.id}
                        onCommandSubmitted={() => refreshCommands(activeSession.scope)}
                        onExit={() => {
                            void refreshSessions();
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
