import { useEffect, useRef, useState } from "react";
import { Editor } from "@monaco-editor/react";
import { getMonacoTheme, onMonacoBeforeMount } from "../../utils/theme";
import * as monaco from "monaco-editor";

interface K8sPodDetailProps {
  name: string;
  namespace: string;
  onClose: () => void;
}

export function K8sPodDetail({ name, namespace, onClose }: K8sPodDetailProps) {
  const [tab, setTab] = useState<"logs" | "shell" | "exec" | "diagnose" | "yaml">("logs");
  const [logs, setLogs] = useState("");
  const [shellOutput, setShellOutput] = useState("");
  const [shellInput, setShellInput] = useState("");
  const [execOutput, setExecOutput] = useState("");
  const [execInput, setExecInput] = useState("");
  const [execCommand, setExecCommand] = useState("");
  const [diagnostic, setDiagnostic] = useState<any>(null);
  const [rawPod, setRawPod] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isShellActive, setIsShellActive] = useState(false);
  const [isExecActive, setIsExecActive] = useState(false);
  const shellOutputRef = useRef<HTMLDivElement>(null);
  const execOutputRef = useRef<HTMLDivElement>(null);
  const logsEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  useEffect(() => {
    setLogs("");
    setShellOutput("");
    setExecOutput("");
    setDiagnostic(null);
    setError(null);
    setIsStreaming(false);
    setIsShellActive(false);
    setIsExecActive(false);
    setTab("logs");

    const load = async () => {
      if (!window.electronAPI) return;
      const diag = await window.electronAPI.k8s.diagnose(name, namespace);
      if (diag.success) setDiagnostic(diag.diagnostic);
      const ns = namespace === "__all__" ? undefined : namespace;
      const pods = await window.electronAPI.k8s.pods(ns || namespace);
      if (pods.success) {
        const pod = (pods.pods || []).find(
          (p: any) => p.metadata?.name === name && p.metadata?.namespace === namespace,
        );
        setRawPod(pod || null);
      }
      startLogs();
    };
    load();

    return () => {
      stopLogs();
      stopShell();
      stopExec();
    };
  }, [name, namespace]);

  useEffect(() => {
    if (!window.electronAPI) return;
    const handleLog = (data: { podName: string; namespace: string; line: string }) => {
      if (data.podName === name && data.namespace === namespace) {
        setLogs((prev) => prev + data.line + "\n");
      }
    };
    const handleShell = (data: { podName: string; namespace: string; data: string }) => {
      if (data.podName === name && data.namespace === namespace) {
        setShellOutput((prev) => prev + data.data);
      }
    };
    const handleExec = (data: { podName: string; namespace: string; data: string }) => {
      if (data.podName === name && data.namespace === namespace) {
        setExecOutput((prev) => prev + data.data);
      }
    };
    const handleExecExit = (data: { podName: string; namespace: string }) => {
      if (data.podName === name && data.namespace === namespace) setIsExecActive(false);
    };
    window.electronAPI.onK8sLog(handleLog);
    window.electronAPI.onK8sShellOutput(handleShell);
    window.electronAPI.onK8sExecOutput(handleExec);
    window.electronAPI.onK8sExecExit(handleExecExit);
  }, [name, namespace]);

  const startLogs = async () => {
    if (!window.electronAPI) return;
    setLoading(true);
    try {
      const result = await window.electronAPI.k8s.logs(name, namespace, 200);
      if (result.success) setIsStreaming(true);
      else setError(result.error || "Failed to stream logs");
    } finally {
      setLoading(false);
    }
  };

  const stopLogs = async () => {
    if (!window.electronAPI) return;
    try {
      await window.electronAPI.k8s.stopLogs(name, namespace);
    } catch {
      /* ignore */
    }
    setIsStreaming(false);
  };

  const stopShell = async () => {
    if (!window.electronAPI || !isShellActive) return;
    await window.electronAPI.k8s.shellStop(name, namespace);
    setIsShellActive(false);
  };

  const stopExec = async () => {
    if (!window.electronAPI || !isExecActive) return;
    await window.electronAPI.k8s.execStop(name, namespace);
    setIsExecActive(false);
  };

  const startShell = async () => {
    if (!window.electronAPI) return;
    setTab("shell");
    setShellOutput("");
    const result = await window.electronAPI.k8s.shell(name, namespace, "/bin/sh");
    if (result.success) setIsShellActive(true);
    else setError(result.error || "Failed to start shell");
  };

  const startExec = async () => {
    if (!window.electronAPI) return;
    setTab("exec");
    setExecOutput("");
    const result = await window.electronAPI.k8s.exec(name, namespace, execCommand.trim());
    if (result.success) setIsExecActive(true);
    else setError(result.error || "Failed to start exec");
  };

  const tabs = ["logs", "shell", "exec", "diagnose", "yaml"] as const;

  return (
    <div className="w-[480px] flex-shrink-0 border-l border-[var(--color-border)] bg-[var(--color-card)] flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="title-sm truncate">{name}</div>
          <div className="text-xs text-[var(--color-text-tertiary)]">{namespace}</div>
        </div>
        <button onClick={onClose} className="btn-secondary !h-8 !py-1 !px-2 !text-xs">
          Close
        </button>
      </div>

      <div className="px-3 py-2 border-b border-[var(--color-border)] flex flex-wrap gap-1">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize ${
              tab === t
                ? "bg-[var(--color-primary)] text-white"
                : "bg-[var(--color-muted)] text-[var(--color-text-secondary)]"
            }`}
          >
            {t}
          </button>
        ))}
        {isStreaming && tab === "logs" && (
          <span className="ml-auto text-xs text-[var(--color-semantic-success)] self-center">● Live</span>
        )}
      </div>

      {error && (
        <div className="px-4 py-2 text-xs text-[var(--color-semantic-error)] border-b border-[var(--color-border)]">
          {error}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === "logs" && (
          <Editor
            height="100%"
            defaultLanguage="plaintext"
            value={logs || (loading ? "Loading logs..." : "")}
            theme={getMonacoTheme()}
          beforeMount={onMonacoBeforeMount}
            onMount={(editor) => {
              logsEditorRef.current = editor;
            }}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 12,
              wordWrap: "on",
              automaticLayout: true,
            }}
          />
        )}

        {tab === "shell" && (
          <div className="h-full flex flex-col bg-[#1a1917]">
            {!isShellActive && (
              <div className="p-3 border-b border-[var(--color-border)]">
                <button onClick={startShell} className="btn-primary !h-8 !text-xs">
                  Start Shell
                </button>
              </div>
            )}
            <div ref={shellOutputRef} className="flex-1 overflow-auto p-3 font-mono text-xs text-[#a8e6cf]">
              <pre className="whitespace-pre-wrap m-0">{shellOutput || "Shell output..."}</pre>
            </div>
            {isShellActive && (
              <div className="border-t border-[var(--color-border)] p-2 flex gap-2">
                <input
                  value={shellInput}
                  onChange={(e) => setShellInput(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter" && window.electronAPI) {
                      await window.electronAPI.k8s.shellInput(name, namespace, shellInput + "\n");
                      setShellOutput((p) => p + shellInput + "\n");
                      setShellInput("");
                    }
                  }}
                  className="flex-1 bg-transparent text-white outline-none font-mono text-xs"
                  placeholder="Command..."
                />
                <button onClick={stopShell} className="btn-secondary !h-8 !text-xs">
                  Stop
                </button>
              </div>
            )}
          </div>
        )}

        {tab === "exec" && (
          <div className="h-full flex flex-col bg-[#1a1917]">
            {!isExecActive && (
              <div className="p-3 border-b border-[var(--color-border)] flex gap-2">
                <input
                  value={execCommand}
                  onChange={(e) => setExecCommand(e.target.value)}
                  placeholder="Initial command (optional)"
                  className="input-field flex-1 !h-8 !text-xs !bg-[#242320] !text-white"
                />
                <button onClick={startExec} className="btn-primary !h-8 !text-xs">
                  Start
                </button>
              </div>
            )}
            <div ref={execOutputRef} className="flex-1 overflow-auto p-3 font-mono text-xs text-[#a8e6cf]">
              <pre className="whitespace-pre-wrap m-0">{execOutput}</pre>
            </div>
            {isExecActive && (
              <div className="border-t border-[var(--color-border)] p-2 flex gap-2">
                <input
                  value={execInput}
                  onChange={(e) => setExecInput(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter" && window.electronAPI) {
                      await window.electronAPI.k8s.execInput(name, namespace, execInput + "\n");
                      setExecOutput((p) => p + execInput + "\n");
                      setExecInput("");
                    }
                  }}
                  className="flex-1 bg-transparent text-white outline-none font-mono text-xs"
                />
                <button onClick={stopExec} className="btn-secondary !h-8 !text-xs">
                  Stop
                </button>
              </div>
            )}
          </div>
        )}

        {tab === "diagnose" && (
          <div className="h-full overflow-y-auto p-4 text-sm space-y-3">
            {diagnostic ? (
              <>
                <div className="font-medium">Status: {diagnostic.status}</div>
                {diagnostic.rootCause && <div>{diagnostic.rootCause}</div>}
                {(diagnostic.evidence || []).map((ev: string, i: number) => (
                  <div key={i} className="text-[var(--color-text-secondary)]">
                    • {ev}
                  </div>
                ))}
                {(diagnostic.suggestedFixes || []).map((fix: string, i: number) => (
                  <div key={i} className="text-[var(--color-semantic-success)]">
                    ✓ {fix}
                  </div>
                ))}
              </>
            ) : (
              <div className="text-[var(--color-text-secondary)]">Loading diagnostics...</div>
            )}
          </div>
        )}

        {tab === "yaml" && (
          <Editor
            height="100%"
            defaultLanguage="json"
            value={JSON.stringify(rawPod, null, 2)}
            theme={getMonacoTheme()}
          beforeMount={onMonacoBeforeMount}
            options={{ readOnly: true, minimap: { enabled: false }, fontSize: 12, wordWrap: "on", automaticLayout: true }}
          />
        )}
      </div>
    </div>
  );
}
