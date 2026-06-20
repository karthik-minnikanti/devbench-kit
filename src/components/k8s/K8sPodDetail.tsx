import { useEffect, useState } from "react";
import { Editor } from "@monaco-editor/react";
import { getMonacoTheme, onMonacoBeforeMount } from "../../utils/theme";
import { Icon } from "../Icon";
import { K8sPodOverview } from "./K8sPodOverview";
import { PodDockTab } from "./K8sPodBottomPanel";
import {
  buildPodSummary,
  podCanRestart,
  podPhaseBadgeClass,
  PodPortInfo,
  PodSummary,
  resolvePodSummaryEnv,
  suggestLocalPort,
  isPrivilegedLocalPort,
} from "./podDetailUtils";

interface RestartPodResult {
  deletedPodName: string;
  replacementPodName?: string;
  ownerKind?: string;
  message: string;
}

interface K8sPodDetailProps {
  name: string;
  namespace: string;
  onClose: () => void;
  onPodRestarted?: (result: RestartPodResult) => void | Promise<void>;
  onOpenDockPanel?: (tab: PodDockTab) => void;
  activeDockTab?: PodDockTab | null;
}

type PodTab = "overview" | "events" | "diagnose" | "yaml";

const POD_TABS: { id: PodTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "events", label: "Events" },
  { id: "diagnose", label: "Diagnose" },
  { id: "yaml", label: "YAML" },
];

interface ActiveForward {
  forwardId: string;
  localPort: number;
  remotePort: number;
  portKey: string;
  status: "active" | "error";
  message?: string;
}

function formatEventTime(value: unknown): string {
  if (!value) return "—";
  if (value instanceof Date) return value.toLocaleString();
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
  }
  return String(value);
}

async function stopPodPortForwardsSafe(podName: string, podNamespace: string) {
  if (!window.electronAPI?.k8s.stopPodPortForwards) return;
  try {
    await window.electronAPI.k8s.stopPodPortForwards(podName, podNamespace);
  } catch {
    /* main process may not have handler until electron rebuild */
  }
}

export function K8sPodDetail({
  name,
  namespace,
  onClose,
  onPodRestarted,
  onOpenDockPanel,
  activeDockTab,
}: K8sPodDetailProps) {
  const [tab, setTab] = useState<PodTab>("overview");
  const [diagnostic, setDiagnostic] = useState<any>(null);
  const [rawPod, setRawPod] = useState<any>(null);
  const [summary, setSummary] = useState<PodSummary | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [forwards, setForwards] = useState<Record<string, ActiveForward>>({});
  const [localPorts, setLocalPorts] = useState<Record<string, string>>({});

  const loadEvents = async () => {
    if (!window.electronAPI) return;
    setEventsLoading(true);
    try {
      const result = await window.electronAPI.k8s.events(
        namespace,
        `involvedObject.name=${name}`,
      );
      if (result.success) {
        const sorted = [...(result.events || [])].sort(
          (a, b) =>
            new Date(b.lastTimestamp || b.eventTime || 0).getTime() -
            new Date(a.lastTimestamp || a.eventTime || 0).getTime(),
        );
        setEvents(sorted);
      }
    } finally {
      setEventsLoading(false);
    }
  };

  useEffect(() => {
    setDiagnostic(null);
    setRawPod(null);
    setSummary(null);
    setEvents([]);
    setActionMsg(null);
    setTab("overview");
    setForwards({});
    setLocalPorts({});

    const load = async () => {
      if (!window.electronAPI) return;
      const [diag, pods, services, configMapsResult] = await Promise.all([
        window.electronAPI.k8s.diagnose(name, namespace),
        window.electronAPI.k8s.pods(namespace),
        window.electronAPI.k8s.services(namespace),
        window.electronAPI.k8s.configMaps(namespace),
      ]);
      if (diag.success) setDiagnostic(diag.diagnostic);
      if (pods.success) {
        const pod = (pods.pods || []).find(
          (p: any) =>
            p.metadata?.name === name && p.metadata?.namespace === namespace,
        );
        const serviceList = services.success ? services.services || [] : [];
        setRawPod(pod || null);
        let podSummary = buildPodSummary(pod, serviceList);
        if (podSummary && pod && window.electronAPI.k8s.secretData) {
          const cmList = configMapsResult.success ? configMapsResult.configMaps || [] : [];
          podSummary = await resolvePodSummaryEnv(
            podSummary,
            pod,
            namespace,
            cmList,
            async (ns, secretName) => {
              const result = await window.electronAPI!.k8s.secretData(ns, secretName);
              return result.success ? result.data || {} : {};
            },
          );
        }
        setSummary(podSummary);
        const defaults: Record<string, string> = {};
        for (const port of podSummary?.ports || []) {
          defaults[port.key] = String(suggestLocalPort(port.containerPort));
        }
        setLocalPorts(defaults);
      }
    };
    load();

    return () => {
      void stopPodPortForwardsSafe(name, namespace);
    };
  }, [name, namespace]);

  useEffect(() => {
    if (!window.electronAPI) return;
    const unsubExit = window.electronAPI.onK8sPortForwardExit(({ forwardId, error: exitError, exitCode }) => {
      setForwards((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          if (next[key].forwardId === forwardId) {
            if (exitError || (exitCode !== undefined && exitCode !== 0)) {
              next[key] = {
                ...next[key],
                status: "error",
                message: exitError || `Port forward stopped (code ${exitCode})`,
              };
            } else {
              delete next[key];
            }
          }
        }
        return next;
      });
      if (exitError || (exitCode !== undefined && exitCode !== 0)) {
        setActionMsg(exitError || `Port forward stopped (code ${exitCode})`);
      }
    });
    const unsubMsg = window.electronAPI.onK8sPortForwardMessage(({ forwardId, message }) => {
      setForwards((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          if (next[key].forwardId === forwardId) {
            next[key] = { ...next[key], message };
          }
        }
        return next;
      });
    });
    return () => {
      unsubExit();
      unsubMsg();
    };
  }, []);

  useEffect(() => {
    if (tab === "events") loadEvents();
  }, [tab, name, namespace]);

  const handleRestartPod = async () => {
    if (!window.electronAPI) return;
    const restartCheck = podCanRestart(rawPod);
    if (!restartCheck.ok) {
      setActionMsg(restartCheck.reason || "This pod cannot be restarted.");
      return;
    }
    setActionMsg("Restarting pod...");
    const result = await window.electronAPI.k8s.restartPod(name, namespace);
    if (result.success) {
      setActionMsg(result.message || "Pod restart triggered");
      await onPodRestarted?.({
        deletedPodName: result.deletedPodName || name,
        replacementPodName: result.replacementPodName,
        ownerKind: result.ownerKind,
        message: result.message || "Pod restart triggered",
      });
    } else {
      setActionMsg(result.error || "Restart failed");
    }
  };

  const handlePortForward = async (port: PodPortInfo) => {
    if (!window.electronAPI) return;
    setForwards((prev) => {
      const next = { ...prev };
      delete next[port.key];
      return next;
    });
    const defaultLocal = suggestLocalPort(port.containerPort);
    const localPort = parseInt(localPorts[port.key] || String(defaultLocal), 10);
    if (Number.isNaN(localPort) || localPort < 1 || localPort > 65535) {
      setActionMsg("Enter a valid local port (1–65535)");
      return;
    }
    if (isPrivilegedLocalPort(localPort)) {
      setActionMsg(
        `Port ${localPort} requires admin rights on macOS. Use ${defaultLocal} or another port ≥ 1024.`,
      );
      return;
    }
    setActionMsg(`Starting port forward on localhost:${localPort}...`);
    const result = await window.electronAPI.k8s.portForward(
      name,
      namespace,
      localPort,
      port.containerPort,
    );
    if (result.success && result.forwardId) {
      setForwards((prev) => ({
        ...prev,
        [port.key]: {
          forwardId: result.forwardId!,
          localPort,
          remotePort: port.containerPort,
          portKey: port.key,
          status: "active",
        },
      }));
      setActionMsg(`Forwarding localhost:${localPort} → pod:${port.containerPort}`);
    } else {
      setActionMsg(result.error || "Port forward failed");
    }
  };

  const handleStopPortForward = async (portKey: string) => {
    const forward = forwards[portKey];
    if (!forward || !window.electronAPI) return;
    await window.electronAPI.k8s.stopPortForward(forward.forwardId);
    setForwards((prev) => {
      const next = { ...prev };
      delete next[portKey];
      return next;
    });
  };

  return (
    <div className="w-[min(400px,36vw)] min-w-[320px] flex-shrink-0 border-l border-[var(--color-border)] bg-[var(--color-card)] flex flex-col overflow-hidden">
      <div className="px-3 py-2 border-b border-[var(--color-border)] flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-sm font-medium truncate">{name}</span>
            {summary && (
              <span
                className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded border ${podPhaseBadgeClass(summary.phase)}`}
              >
                {summary.phase}
              </span>
            )}
          </div>
          <div className="text-[10px] text-[var(--color-text-tertiary)] font-mono truncate">
            {namespace}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {onOpenDockPanel && (
            <>
              <button
                onClick={() => onOpenDockPanel("logs")}
                title="Logs"
                className={`p-1.5 rounded transition-colors ${
                  activeDockTab === "logs"
                    ? "text-[var(--color-primary)] bg-[var(--color-primary)]/10"
                    : "text-[var(--color-text-tertiary)] hover:bg-[var(--color-muted)]"
                }`}
              >
                <Icon name="FileText" className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onOpenDockPanel("terminal")}
                title="Shell"
                className={`p-1.5 rounded transition-colors ${
                  activeDockTab === "terminal"
                    ? "text-[var(--color-primary)] bg-[var(--color-primary)]/10"
                    : "text-[var(--color-text-tertiary)] hover:bg-[var(--color-muted)]"
                }`}
              >
                <Icon name="Terminal" className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          <button
            onClick={onClose}
            title="Close"
            className="p-1.5 rounded text-[var(--color-text-tertiary)] hover:bg-[var(--color-muted)]"
          >
            <Icon name="X" className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="px-3 border-b border-[var(--color-border)] flex gap-3">
        {POD_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? "border-[var(--color-primary)] text-[var(--color-text-primary)]"
                : "border-transparent text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {actionMsg && (
        <div className="px-4 py-2 text-xs text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">
          {actionMsg}
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-hidden">
        {tab === "overview" &&
          (summary && rawPod ? (
            <K8sPodOverview
              key={`${namespace}/${name}`}
              summary={summary}
              rawPod={rawPod}
              forwards={forwards}
              localPorts={localPorts}
              onLocalPortChange={(key, value) =>
                setLocalPorts((prev) => ({ ...prev, [key]: value }))
              }
              onPortForward={handlePortForward}
              onStopPortForward={handleStopPortForward}
              onRestartPod={handleRestartPod}
            />
          ) : (
            <div className="h-full flex items-center justify-center gap-2 text-sm text-[var(--color-text-secondary)]">
              <Icon name="RefreshCw" className="w-4 h-4 animate-spin opacity-50" />
              Loading pod details...
            </div>
          ))}

        {tab === "events" && (
          <div className="h-full overflow-y-auto custom-scrollbar p-3 space-y-2">
            {eventsLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-[var(--color-text-secondary)]">
                <Icon name="RefreshCw" className="w-4 h-4 animate-spin opacity-50" />
                Loading events...
              </div>
            ) : events.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Icon name="Bell" className="w-10 h-10 text-[var(--color-text-tertiary)] opacity-40 mb-2" />
                <div className="text-sm text-[var(--color-text-secondary)]">No events for this pod</div>
              </div>
            ) : (
              events.map((ev, i) => (
                <div
                  key={ev.metadata?.uid || ev.reason || i}
                  className={`rounded-xl border border-[var(--color-border)] border-l-[3px] p-3 space-y-1.5 ${
                    ev.type === "Warning"
                      ? "border-l-[var(--color-timeline-done)] bg-[var(--color-timeline-done)]/5"
                      : "border-l-[var(--color-primary)]/50 bg-[var(--color-background)]/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon
                        name={ev.type === "Warning" ? "AlertTriangle" : "Info"}
                        className={`w-4 h-4 shrink-0 ${
                          ev.type === "Warning"
                            ? "text-[var(--color-timeline-done)]"
                            : "text-[var(--color-primary)]"
                        }`}
                      />
                      <span className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
                        {ev.reason}
                      </span>
                    </div>
                    <span
                      className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full border ${
                        ev.type === "Warning"
                          ? "text-[var(--color-timeline-done)] border-[var(--color-timeline-done)]/30 bg-[var(--color-timeline-done)]/10"
                          : "text-[var(--color-text-tertiary)] border-[var(--color-border)] bg-[var(--color-muted)]"
                      }`}
                    >
                      {ev.type}
                    </span>
                  </div>
                  <div className="text-xs text-[var(--color-text-secondary)] pl-6">{ev.message}</div>
                  <div className="flex items-center gap-1 text-[10px] text-[var(--color-text-tertiary)] pl-6">
                    <Icon name="Clock" className="w-3 h-3" />
                    {formatEventTime(ev.lastTimestamp || ev.timestamp || ev.metadata?.creationTimestamp)}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "diagnose" && (
          <div className="h-full overflow-y-auto custom-scrollbar p-4 space-y-4">
            {diagnostic ? (
              <>
                <div
                  className={`rounded-xl border p-4 flex items-start gap-3 ${
                    diagnostic.status === "critical"
                      ? "border-[var(--color-semantic-error)]/30 bg-[var(--color-semantic-error)]/8"
                      : diagnostic.status === "warning"
                        ? "border-[var(--color-timeline-done)]/30 bg-[var(--color-timeline-done)]/8"
                        : "border-[var(--color-semantic-success)]/30 bg-[var(--color-semantic-success)]/8"
                  }`}
                >
                  <Icon
                    name={
                      diagnostic.status === "critical"
                        ? "AlertTriangle"
                        : diagnostic.status === "warning"
                          ? "AlertCircle"
                          : "CheckCircle"
                    }
                    className={`w-5 h-5 shrink-0 ${
                      diagnostic.status === "critical"
                        ? "text-[var(--color-semantic-error)]"
                        : diagnostic.status === "warning"
                          ? "text-[var(--color-timeline-done)]"
                          : "text-[var(--color-semantic-success)]"
                    }`}
                  />
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)]">
                      Health
                    </div>
                    <div className="text-sm font-semibold text-[var(--color-text-primary)] capitalize mt-0.5">
                      {diagnostic.status}
                    </div>
                    {diagnostic.rootCause && (
                      <div className="text-xs text-[var(--color-text-secondary)] mt-1">{diagnostic.rootCause}</div>
                    )}
                  </div>
                </div>
                {(diagnostic.evidence || []).length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-[var(--color-text-primary)] flex items-center gap-1.5">
                      <Icon name="Search" className="w-3.5 h-3.5" />
                      Evidence
                    </div>
                    {(diagnostic.evidence || []).map((ev: string, i: number) => (
                      <div
                        key={i}
                        className="flex gap-2 text-xs text-[var(--color-text-secondary)] rounded-lg bg-[var(--color-muted)]/50 px-3 py-2"
                      >
                        <Icon name="AlertCircle" className="w-3.5 h-3.5 shrink-0 text-[var(--color-text-tertiary)]" />
                        {ev}
                      </div>
                    ))}
                  </div>
                )}
                {(diagnostic.suggestedFixes || []).length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-[var(--color-text-primary)] flex items-center gap-1.5">
                      <Icon name="Lightbulb" className="w-3.5 h-3.5" />
                      Suggested fixes
                    </div>
                    {(diagnostic.suggestedFixes || []).map((fix: string, i: number) => (
                      <div
                        key={i}
                        className="flex gap-2 text-xs text-[var(--color-semantic-success)] rounded-lg bg-[var(--color-semantic-success)]/8 border border-[var(--color-semantic-success)]/20 px-3 py-2"
                      >
                        <Icon name="CheckCircle" className="w-3.5 h-3.5 shrink-0" />
                        {fix}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-[var(--color-text-secondary)]">
                <Icon name="RefreshCw" className="w-4 h-4 animate-spin opacity-50" />
                Loading diagnostics...
              </div>
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
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 12,
              wordWrap: "on",
              automaticLayout: true,
            }}
          />
        )}
      </div>
    </div>
  );
}
