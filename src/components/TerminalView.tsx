import {
    forwardRef,
    useCallback,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
} from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import {
    getTerminalBackgroundColor,
    getTerminalFontSize,
    getTerminalTheme,
    subscribeToTerminalTheme,
    terminalFontFamily,
} from "../utils/terminalTheme";
import {
    buildInsertPayload,
    buildRunCommandPayload,
    TerminalInputTracker,
} from "../utils/terminalInputTracker";
import { getTerminalScope } from "../utils/terminalScope";
import { TerminalSuggestBar } from "./terminal/TerminalSuggestBar";

export interface TerminalSessionConfig {
    kind: "local" | "k8s" | "docker";
    shell?: string;
    cwd?: string;
    podName?: string;
    namespace?: string;
    container?: string;
    containerId?: string;
    initialCommand?: string;
}

export interface TerminalViewHandle {
    runCommand: (command: string) => void;
    insertText: (text: string) => void;
    focus: () => void;
}

interface TerminalViewProps {
    session: TerminalSessionConfig;
    active?: boolean;
    className?: string;
    sessionRecordId?: string;
    onExit?: (exitCode: number) => void;
    onReady?: () => void;
    onLineChange?: (line: string) => void;
    onCommandSubmitted?: (command: string) => void;
}

const MAX_SUGGESTIONS = 8;

export const TerminalView = forwardRef<TerminalViewHandle, TerminalViewProps>(
    function TerminalView(
        {
            session,
            active = true,
            className = "",
            sessionRecordId,
            onExit,
            onReady,
            onLineChange,
            onCommandSubmitted,
        },
        ref,
    ) {
        const containerRef = useRef<HTMLDivElement>(null);
        const termRef = useRef<Terminal | null>(null);
        const sessionIdRef = useRef<string | null>(null);
        const trackerRef = useRef(new TerminalInputTracker());
        const historyRef = useRef<string[]>([]);
        const historyBrowseIndexRef = useRef<number | null>(null);
        const suggestionsRef = useRef<string[]>([]);
        const selectedSuggestionRef = useRef(0);
        const persistCommandRef = useRef<(command: string) => void>(() => {});
        const writeToTerminalRef = useRef<(data: string) => void>(() => {});
        const onExitRef = useRef(onExit);
        const onReadyRef = useRef(onReady);
        const onLineChangeRef = useRef(onLineChange);
        const onCommandSubmittedRef = useRef(onCommandSubmitted);

        const [error, setError] = useState<string | null>(null);
        const [lineBuffer, setLineBuffer] = useState("");
        const [suggestions, setSuggestions] = useState<string[]>([]);
        const [selectedSuggestion, setSelectedSuggestion] = useState(0);

        const scope = useMemo(() => getTerminalScope(session), [session]);
        const isRemoteSession = session.kind === "k8s" || session.kind === "docker";

        const loadHistory = useCallback(async () => {
            if (!window.electronAPI?.terminal?.getCommands) {
                return;
            }
            const result = await window.electronAPI.terminal.getCommands(scope, "", 200);
            historyRef.current = (result.commands ?? []).map((entry) => entry.command);
        }, [scope]);

        const persistCommand = useCallback(
            async (command: string) => {
                onCommandSubmittedRef.current?.(command);
                if (window.electronAPI?.terminal?.addCommand) {
                    await window.electronAPI.terminal.addCommand(scope, command);
                }
                await loadHistory();
            },
            [scope, loadHistory],
        );

        const writeToTerminal = useCallback((data: string) => {
            if (sessionIdRef.current) {
                window.electronAPI?.terminal.write(sessionIdRef.current, data);
            }
        }, []);

        const replaceLine = useCallback(
            (command: string) => {
                writeToTerminal(`\x15${command}`);
                trackerRef.current.setLine(command);
                setLineBuffer(command);
            },
            [writeToTerminal],
        );

        const runCommand = useCallback(
            (command: string) => {
                writeToTerminal(buildRunCommandPayload(command));
                trackerRef.current.reset();
                setLineBuffer("");
                setSuggestions([]);
                suggestionsRef.current = [];
                historyBrowseIndexRef.current = null;
            },
            [writeToTerminal],
        );

        const insertText = useCallback(
            (text: string) => {
                writeToTerminal(buildInsertPayload(text));
                trackerRef.current.setLine(trackerRef.current.getLine() + text);
                setLineBuffer(trackerRef.current.getLine());
            },
            [writeToTerminal],
        );

        useImperativeHandle(ref, () => ({
            runCommand,
            insertText,
            focus: () => termRef.current?.focus(),
        }));

        useEffect(() => {
            persistCommandRef.current = (command) => {
                void persistCommand(command);
            };
            writeToTerminalRef.current = writeToTerminal;
            onExitRef.current = onExit;
            onReadyRef.current = onReady;
            onLineChangeRef.current = onLineChange;
            onCommandSubmittedRef.current = onCommandSubmitted;
        }, [persistCommand, writeToTerminal, onExit, onReady, onLineChange, onCommandSubmitted]);

        useEffect(() => {
            void loadHistory();
        }, [loadHistory]);

        useEffect(() => {
            const prefix = lineBuffer.trim().toLowerCase();
            if (!prefix) {
                setSuggestions([]);
                setSelectedSuggestion(0);
                suggestionsRef.current = [];
                selectedSuggestionRef.current = 0;
                return;
            }
            const matches = historyRef.current
                .filter(
                    (cmd) =>
                        cmd.toLowerCase().startsWith(prefix) &&
                        cmd !== lineBuffer.trim(),
                )
                .slice(0, MAX_SUGGESTIONS);
            setSuggestions(matches);
            setSelectedSuggestion(0);
            suggestionsRef.current = matches;
            selectedSuggestionRef.current = 0;
        }, [lineBuffer]);

        useEffect(() => {
            onLineChangeRef.current?.(lineBuffer);
        }, [lineBuffer]);

        useEffect(() => {
            if (!active || !containerRef.current || !window.electronAPI?.terminal) {
                return;
            }

            const term = new Terminal({
                cursorBlink: true,
                fontSize: getTerminalFontSize(),
                lineHeight: 1,
                fontFamily: terminalFontFamily,
                theme: getTerminalTheme(),
                scrollback: 10000,
                scrollOnUserInput: true,
                allowProposedApi: true,
                drawBoldTextInBrightColors: true,
            });
            const fitAddon = new FitAddon();
            term.loadAddon(fitAddon);
            term.open(containerRef.current);
            fitAddon.fit();
            termRef.current = term;
            trackerRef.current.reset();

            const applyTheme = () => {
                const theme = getTerminalTheme();
                term.options.theme = theme;
                term.options.fontSize = getTerminalFontSize();
                term.options.lineHeight = 1;
                const bg = theme.background || getTerminalBackgroundColor();
                containerRef.current?.style.setProperty("--terminal-bg", bg);
                containerRef.current?.parentElement?.style.setProperty(
                    "--terminal-bg",
                    bg,
                );
                fitAddon.fit();
                const sessionId = sessionIdRef.current;
                if (sessionId) {
                    window.electronAPI?.terminal.resize(sessionId, term.cols, term.rows);
                }
            };
            applyTheme();
            const unsubscribeTheme = subscribeToTerminalTheme(applyTheme);

            let disposed = false;
            let resizeObserver: ResizeObserver | null = null;
            let removeDataListener: (() => void) | undefined;
            let removeExitListener: (() => void) | undefined;

            const syncSize = () => {
                if (!containerRef.current) return;
                requestAnimationFrame(() => {
                    if (disposed || !termRef.current) return;
                    fitAddon.fit();
                    const sessionId = sessionIdRef.current;
                    if (sessionId) {
                        window.electronAPI?.terminal.resize(
                            sessionId,
                            term.cols,
                            term.rows,
                        );
                    }
                    term.scrollToBottom();
                });
            };

            const completeSuggestion = (command: string) => {
                const suffix = command.slice(trackerRef.current.getLine().length);
                if (suffix) {
                    writeToTerminalRef.current(suffix);
                    trackerRef.current.setLine(command);
                    setLineBuffer(command);
                }
            };

            const handleInput = (data: string) => {
                const activeSuggestions = suggestionsRef.current;
                if (data === "\t" && activeSuggestions.length > 0) {
                    const pick =
                        activeSuggestions[selectedSuggestionRef.current] ??
                        activeSuggestions[0];
                    completeSuggestion(pick);
                    return;
                }

                if (data !== "\x1b") {
                    historyBrowseIndexRef.current = null;
                }

                const submitted = trackerRef.current.feed(data);
                setLineBuffer(trackerRef.current.getLine());
                if (submitted) {
                    persistCommandRef.current(submitted);
                    historyBrowseIndexRef.current = null;
                }

                writeToTerminalRef.current(data);
            };

            const start = async () => {
                syncSize();
                const result = await window.electronAPI!.terminal.create({
                    kind: session.kind,
                    shell: session.shell,
                    cwd: session.cwd,
                    podName: session.podName,
                    namespace: session.namespace,
                    container: session.container,
                    containerId: session.containerId,
                    cols: term.cols,
                    rows: term.rows,
                });

                if (disposed) {
                    if (result.sessionId) {
                        await window.electronAPI?.terminal.destroy(result.sessionId);
                    }
                    return;
                }

                if (!result.success || !result.sessionId) {
                    setError(result.error || "Failed to start terminal");
                    term.writeln("\x1b[31mFailed to start terminal\x1b[0m");
                    if (result.error) {
                        term.writeln(result.error);
                    }
                    return;
                }

                sessionIdRef.current = result.sessionId;
                onReadyRef.current?.();

                if (sessionRecordId && window.electronAPI.terminal.touchSession) {
                    void window.electronAPI.terminal.touchSession(sessionRecordId);
                }

                if (isRemoteSession) {
                    // Ensure kubectl/docker exec receives final terminal dimensions.
                    syncSize();
                    window.setTimeout(() => syncSize(), 150);
                }

                if (session.initialCommand?.trim()) {
                    writeToTerminalRef.current(
                        buildRunCommandPayload(session.initialCommand.trim()),
                    );
                }

                term.onData(handleInput);
                term.focus();
            };

            removeDataListener = window.electronAPI.onTerminalData(
                ({ sessionId, data }) => {
                    if (sessionId !== sessionIdRef.current) return;

                    const buffer = term.buffer.active;
                    const atBottom =
                        buffer.baseY + buffer.cursorY >=
                        buffer.viewportY + term.rows - 1;

                    term.write(data, () => {
                        if (atBottom) {
                            term.scrollToBottom();
                        }
                    });
                },
            );

            removeExitListener = window.electronAPI.onTerminalExit(
                ({ sessionId, exitCode }) => {
                    if (sessionId === sessionIdRef.current) {
                        term.writeln(
                            `\r\n\x1b[33m[Process exited with code ${exitCode}]\x1b[0m`,
                        );
                        if (exitCode !== 0 && session.kind !== "local") {
                            const hint =
                                session.kind === "k8s"
                                    ? "Check that the pod is Running, pick the correct container, and that it includes a shell (sh/bash)."
                                    : "Check that the container is running and includes a shell (sh/bash).";
                            term.writeln(`\x1b[90m${hint}\x1b[0m`);
                        }
                        if (sessionRecordId && window.electronAPI.terminal.closeSession) {
                            void window.electronAPI.terminal.closeSession(sessionRecordId);
                        }
                        onExitRef.current?.(exitCode);
                    }
                },
            );

            resizeObserver = new ResizeObserver(() => {
                syncSize();
            });
            resizeObserver.observe(containerRef.current);
            void start();

            return () => {
                disposed = true;
                unsubscribeTheme();
                resizeObserver?.disconnect();
                removeDataListener?.();
                removeExitListener?.();
                const sessionId = sessionIdRef.current;
                if (sessionId) {
                    window.electronAPI?.terminal.destroy(sessionId);
                }
                sessionIdRef.current = null;
                termRef.current = null;
                term.dispose();
            };
        }, [
            active,
            session.kind,
            session.shell,
            session.cwd,
            session.podName,
            session.namespace,
            session.container,
            session.containerId,
            session.initialCommand,
            sessionRecordId,
            isRemoteSession,
        ]);

        if (!window.electronAPI) {
            return (
                <div className="p-4 text-sm text-[var(--color-text-secondary)]">
                    Terminal is only available in the Electron desktop app.
                </div>
            );
        }

        return (
            <div
                className={`terminal-shell h-full flex flex-col ${className}`}
                style={{ backgroundColor: getTerminalBackgroundColor() }}
            >
                {error && (
                    <div className="px-3 py-2 text-xs text-[var(--color-semantic-error)] border-b border-[var(--color-border)] bg-[var(--color-card)]">
                        {error}
                    </div>
                )}
                <div
                    ref={containerRef}
                    className="terminal-host flex-1 min-h-0"
                    onClick={() => termRef.current?.focus()}
                />
                <TerminalSuggestBar
                    line={isRemoteSession ? "" : lineBuffer}
                    suggestions={isRemoteSession ? [] : suggestions}
                    selectedIndex={selectedSuggestion}
                    onSelect={replaceLine}
                    onHover={(index) => {
                        setSelectedSuggestion(index);
                        selectedSuggestionRef.current = index;
                    }}
                />
            </div>
        );
    },
);
