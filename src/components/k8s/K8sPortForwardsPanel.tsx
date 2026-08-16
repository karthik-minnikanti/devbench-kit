import { useEffect, useMemo } from "react";
import { Icon } from "../Icon";
import {
  K8sPortForward,
  useK8sPortForwardStore,
} from "../../state/k8sPortForwardStore";

function statusBadgeClass(status: K8sPortForward["status"]): string {
  if (status === "active") {
    return "border-[var(--color-semantic-success)]/40 text-[var(--color-semantic-success)] bg-[var(--color-semantic-success)]/10";
  }
  if (status === "paused") {
    return "border-[var(--color-semantic-warning)]/40 text-[var(--color-semantic-warning)] bg-[var(--color-semantic-warning)]/10";
  }
  return "border-[var(--color-semantic-error)]/40 text-[var(--color-semantic-error)] bg-[var(--color-semantic-error)]/10";
}

function formatStartedAt(startedAt: number): string {
  try {
    return new Date(startedAt).toLocaleString();
  } catch {
    return "—";
  }
}

export function K8sPortForwardsPanel() {
  const forwards = useK8sPortForwardStore((state) => state.forwards);
  const busyIds = useK8sPortForwardStore((state) => state.busyIds);
  const hydrated = useK8sPortForwardStore((state) => state.hydrated);
  const refresh = useK8sPortForwardStore((state) => state.refresh);
  const pause = useK8sPortForwardStore((state) => state.pause);
  const resume = useK8sPortForwardStore((state) => state.resume);
  const stop = useK8sPortForwardStore((state) => state.stop);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const counts = useMemo(() => {
    return forwards.reduce(
      (acc, forward) => {
        acc.total += 1;
        acc[forward.status] += 1;
        return acc;
      },
      { total: 0, active: 0, paused: 0, error: 0 },
    );
  }, [forwards]);

  return (
    <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-medium text-[var(--color-text-primary)]">
            Port Forwards
          </h2>
          <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">
            {counts.total === 0
              ? "No port forwards yet — start one from a pod overview."
              : `${counts.active} active · ${counts.paused} paused · ${counts.error} error`}
          </p>
        </div>
        <button
          onClick={() => void refresh()}
          className="btn-secondary !h-7 !px-2 !text-xs inline-flex items-center gap-1.5"
          title="Refresh"
        >
          <Icon name="RefreshCw" className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar">
        {!hydrated ? (
          <div className="p-6 text-sm text-[var(--color-text-tertiary)]">Loading…</div>
        ) : forwards.length === 0 ? (
          <div className="p-6 text-sm text-[var(--color-text-tertiary)] max-w-md">
            Open a pod, use the Port Forward section, then manage all sessions here.
            Pause keeps the mapping so you can start it again later.
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[var(--color-card)] border-b border-[var(--color-border)] text-[10px] uppercase tracking-wide text-[var(--color-text-tertiary)]">
              <tr>
                <th className="text-left font-medium px-4 py-2">Status</th>
                <th className="text-left font-medium px-4 py-2">Pod</th>
                <th className="text-left font-medium px-4 py-2">Local → Remote</th>
                <th className="text-left font-medium px-4 py-2">Started</th>
                <th className="text-right font-medium px-4 py-2">Controls</th>
              </tr>
            </thead>
            <tbody>
              {forwards.map((forward) => {
                const busy = Boolean(busyIds[forward.forwardId]);
                return (
                  <tr
                    key={forward.forwardId}
                    className="border-b border-[var(--color-border)]/70 hover:bg-[var(--color-muted)]/40"
                  >
                    <td className="px-4 py-2.5 align-top">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] capitalize ${statusBadgeClass(forward.status)}`}
                      >
                        {forward.status}
                      </span>
                      {forward.message && (
                        <div
                          className="mt-1 text-[10px] text-[var(--color-text-tertiary)] max-w-[220px] truncate"
                          title={forward.message}
                        >
                          {forward.message}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      <div className="font-mono text-[var(--color-text-primary)]">
                        {forward.podName}
                      </div>
                      <div className="font-mono text-[10px] text-[var(--color-text-tertiary)]">
                        {forward.namespace}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 align-top font-mono">
                      <span className="text-[var(--color-text-primary)]">
                        {forward.address}:{forward.localPort}
                      </span>
                      <span className="text-[var(--color-text-tertiary)]"> → </span>
                      <span className="text-[var(--color-text-secondary)]">
                        :{forward.remotePort}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 align-top text-[var(--color-text-tertiary)] whitespace-nowrap">
                      {formatStartedAt(forward.startedAt)}
                    </td>
                    <td className="px-4 py-2.5 align-top">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        {forward.status === "active" ? (
                          <button
                            disabled={busy}
                            onClick={() => void pause(forward.forwardId)}
                            className="btn-secondary !h-7 !px-2 !text-[10px]"
                          >
                            Pause
                          </button>
                        ) : (
                          <button
                            disabled={busy}
                            onClick={() => void resume(forward.forwardId)}
                            className="btn-primary !h-7 !px-2 !text-[10px] inline-flex items-center gap-1"
                          >
                            <Icon name="Play" className="w-3 h-3" />
                            Start
                          </button>
                        )}
                        <button
                          disabled={busy}
                          onClick={() => void stop(forward.forwardId)}
                          className="btn-secondary !h-7 !px-2 !text-[10px]"
                        >
                          Stop
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
