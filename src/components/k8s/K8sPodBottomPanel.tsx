import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Editor } from "@monaco-editor/react";
import { getMonacoTheme, onMonacoBeforeMount } from "../../utils/theme";
import * as monaco from "monaco-editor";
import { Icon } from "../Icon";
import { openDevShell } from "../../utils/devShell";

export type PodDockTab = "logs" | "terminal";

interface K8sPodBottomPanelProps {
  name: string;
  namespace: string;
  activeTab: PodDockTab;
  onTabChange: (tab: PodDockTab) => void;
  onClose: () => void;
  rawPod?: unknown;
}

function scrollLogsToBottom(editor: monaco.editor.IStandaloneCodeEditor | null) {
  if (!editor) return;
  const model = editor.getModel();
  if (!model) return;
  const lineCount = model.getLineCount();
  if (lineCount > 0) {
    editor.revealLine(lineCount);
    editor.setScrollTop(Number.MAX_SAFE_INTEGER);
  }
}

const DOCK_TABS: { id: PodDockTab; label: string; icon: React.ComponentProps<typeof Icon>["name"] }[] = [
  { id: "logs", label: "Logs", icon: "FileText" },
  { id: "terminal", label: "DevShell", icon: "Terminal" },
];

export function K8sPodBottomPanel({
  name,
  namespace,
  activeTab,
  onTabChange,
  onClose,
  rawPod,
}: K8sPodBottomPanelProps) {
  const [logs, setLogs] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [logContainer, setLogContainer] = useState<string | undefined>(undefined);
  const [terminalContainer, setTerminalContainer] = useState<string | undefined>(undefined);
  const logsEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const previousLogLengthRef = useRef(0);
  const isStreamingRef = useRef(false);
  const activeTabRef = useRef(activeTab);
  const followLogsRef = useRef(true);

  const containerNames =
    (rawPod as { spec?: { containers?: { name: string }[] } })?.spec?.containers?.map((c) => c.name) ||
    [];

  const shellSession = useMemo(
    () => ({
      kind: "k8s" as const,
      podName: name,
      namespace,
      ...(terminalContainer ? { container: terminalContainer } : {}),
    }),
    [name, namespace, terminalContainer],
  );

  const launchDevShell = useCallback(() => {
    openDevShell(shellSession);
  }, [shellSession]);

  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  useEffect(() => {
    activeTabRef.current = activeTab;
    if (activeTab === "logs") {
      followLogsRef.current = true;
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "terminal") {
      launchDevShell();
    }
  }, [activeTab, launchDevShell]);

  useEffect(() => {
    return () => {
      if (logsEditorRef.current && (logsEditorRef.current as any).__logDisposable) {
        (logsEditorRef.current as any).__logDisposable.dispose();
      }
    };
  }, []);

  const mountLogsEditor = (editor: monaco.editor.IStandaloneCodeEditor) => {
    logsEditorRef.current = editor;
    if ((editor as any).__logDisposable) {
      (editor as any).__logDisposable.dispose();
    }
    const scrollIfFollowing = () => {
      if (!followLogsRef.current || activeTabRef.current !== "logs") return;
      scrollLogsToBottom(editor);
    };
    const model = editor.getModel();
    if (model) {
      (editor as any).__logDisposable = model.onDidChangeContent(() => {
        if (isStreamingRef.current && activeTabRef.current === "logs") {
          requestAnimationFrame(scrollIfFollowing);
        }
      });
      requestAnimationFrame(scrollIfFollowing);
    }
  };

  const stopLogs = useCallback(async () => {
    if (!window.electronAPI) return;
    try {
      await window.electronAPI.k8s.stopLogs(name, namespace);
    } catch {
      /* ignore */
    }
    setIsStreaming(false);
  }, [name, namespace]);

  const startLogs = useCallback(async () => {
    if (!window.electronAPI) return;
    setLoading(true);
    setError(null);
    try {
      await stopLogs();
      setLogs("");
      previousLogLengthRef.current = 0;
      const result = await window.electronAPI.k8s.logs(name, namespace, 200, logContainer);
      if (result.success) setIsStreaming(true);
      else setError(result.error || "Failed to stream logs");
    } finally {
      setLoading(false);
    }
  }, [name, namespace, logContainer, stopLogs]);

  useEffect(() => {
    setLogs("");
    setError(null);
    setIsStreaming(false);
    setLogContainer(undefined);
    setTerminalContainer(containerNames[0]);
    return () => {
      stopLogs();
    };
  }, [name, namespace, containerNames.join("|"), stopLogs]);

  useEffect(() => {
    if (!window.electronAPI) return;
    const handleLog = (data: { podName: string; namespace: string; line: string }) => {
      if (data.podName === name && data.namespace === namespace) {
        setLogs((prev) => prev + data.line + "\n");
      }
    };
    window.electronAPI.onK8sLog(handleLog);
  }, [name, namespace]);

  useEffect(() => {
    if (activeTab === "logs") startLogs();
    else stopLogs();
  }, [activeTab, logContainer, startLogs, stopLogs]);

  useEffect(() => {
    if (activeTab !== "logs") return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => scrollLogsToBottom(logsEditorRef.current));
    });
  }, [activeTab]);

  useEffect(() => {
    if (logsEditorRef.current && activeTab === "logs" && isStreaming && logs) {
      const currentLength = logs.length;
      if (currentLength !== previousLogLengthRef.current) {
        previousLogLengthRef.current = currentLength;
        requestAnimationFrame(() => scrollLogsToBottom(logsEditorRef.current));
      }
    }
  }, [logs, activeTab, isStreaming]);

  return (
    <div className="w-full h-[min(50vh,520px)] min-h-[260px] flex-shrink-0 border-t border-[var(--color-border)] bg-[var(--color-card)] flex flex-col overflow-hidden">
      <div className="px-3 py-1.5 border-b border-[var(--color-border)] flex items-center gap-2 text-xs">
        <span className="font-mono font-medium truncate max-w-[180px]">{name}</span>
        <span className="text-[var(--color-text-tertiary)] font-mono">{namespace}</span>

        <div className="flex gap-2 ml-2">
          {DOCK_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => onTabChange(t.id)}
              className={`py-1 border-b-2 -mb-px text-xs font-medium transition-colors ${
                activeTab === t.id
                  ? "border-[var(--color-primary)] text-[var(--color-text-primary)]"
                  : "border-transparent text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {activeTab === "logs" && (
            <>
              {containerNames.length > 1 && (
                <select
                  value={logContainer ?? ""}
                  onChange={(e) => setLogContainer(e.target.value || undefined)}
                  className="h-7 px-2 rounded-md border border-[var(--color-border)] bg-[var(--color-background)] text-xs"
                >
                  <option value="">All containers</option>
                  {containerNames.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}
              <span className="inline-flex items-center gap-1.5 text-xs">
                {isStreaming ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-semantic-success)] animate-pulse" />
                    <span className="text-[var(--color-semantic-success)] font-medium">Live</span>
                  </>
                ) : loading ? (
                  <>
                    <Icon name="RefreshCw" className="w-3 h-3 animate-spin text-[var(--color-text-tertiary)]" />
                    <span className="text-[var(--color-text-tertiary)]">Connecting</span>
                  </>
                ) : null}
              </span>
            </>
          )}
          {activeTab === "terminal" && containerNames.length > 0 && (
            <select
              value={terminalContainer ?? containerNames[0] ?? ""}
              onChange={(e) => setTerminalContainer(e.target.value)}
              className="h-7 px-2 rounded-md border border-[var(--color-border)] bg-[var(--color-background)] text-xs"
            >
              {containerNames.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={onClose}
            className="btn-secondary !h-7 !py-1 !px-2 !text-xs inline-flex items-center gap-1"
            title="Close panel"
          >
            <Icon name="ChevronDown" className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {error && activeTab === "logs" && (
        <div className="px-3 py-1.5 text-xs text-[var(--color-semantic-error)] border-b border-[var(--color-border)]">
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0">
        {activeTab === "logs" ? (
          <Editor
            height="100%"
            defaultLanguage="plaintext"
            value={logs || (loading ? "Loading logs..." : "// Waiting for logs...")}
            theme={getMonacoTheme()}
            beforeMount={onMonacoBeforeMount}
            onChange={() => {
              if (
                logsEditorRef.current &&
                isStreamingRef.current &&
                activeTabRef.current === "logs" &&
                followLogsRef.current
              ) {
                requestAnimationFrame(() => scrollLogsToBottom(logsEditorRef.current));
              }
            }}
            onMount={mountLogsEditor}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 12,
              wordWrap: "on",
              automaticLayout: true,
              scrollBeyondLastLine: false,
            }}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
            <div className="w-10 h-10 rounded-full bg-[var(--color-muted)] flex items-center justify-center">
              <Icon name="Terminal" className="w-5 h-5 text-[var(--color-primary)]" />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                Pod shell opened in DevShell
              </p>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-1 max-w-sm">
                Switch containers above or focus DevShell to keep working across local, K8s, and Docker sessions.
              </p>
            </div>
            <button type="button" onClick={launchDevShell} className="btn-primary !h-8 !text-xs">
              Focus DevShell
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
