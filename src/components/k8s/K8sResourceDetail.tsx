import { useState } from "react";
import { Editor } from "@monaco-editor/react";
import { getMonacoTheme, onMonacoBeforeMount } from "../../utils/theme";
import { K8sResourceRow } from "./types";

interface K8sResourceDetailProps {
  row: K8sResourceRow;
  onClose: () => void;
  onRefresh: () => void;
}

export function K8sResourceDetail({ row, onClose, onRefresh }: K8sResourceDetailProps) {
  const [tab, setTab] = useState<"overview" | "yaml">("overview");
  const [scaleReplicas, setScaleReplicas] = useState("");
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const yaml = JSON.stringify(row.raw, null, 2);
  const isDeployment = row.kind === "deployments";

  const handleScale = async () => {
    if (!window.electronAPI || !row.namespace) return;
    const replicas = parseInt(scaleReplicas, 10);
    if (Number.isNaN(replicas)) return;
    const result = await window.electronAPI.k8s.scale(row.name, row.namespace, replicas);
    setActionMsg(result.success ? `Scaled to ${replicas} replicas` : result.error || "Scale failed");
    if (result.success) onRefresh();
  };

  const handleRolloutRestart = async () => {
    if (!window.electronAPI || !row.namespace) return;
    const result = await window.electronAPI.k8s.rolloutRestart(row.name, row.namespace);
    setActionMsg(result.success ? "Rollout restart triggered" : result.error || "Restart failed");
  };

  const handleRestartPod = async () => {
    if (!window.electronAPI || !row.namespace || row.kind !== "pods") return;
    const result = await window.electronAPI.k8s.restartPod(row.name, row.namespace);
    setActionMsg(result.success ? "Pod restart triggered" : result.error || "Restart failed");
    if (result.success) onRefresh();
  };

  return (
    <div className="w-[420px] flex-shrink-0 border-l border-[var(--color-border)] bg-[var(--color-card)] flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="title-sm truncate">{row.name}</div>
          <div className="text-xs text-[var(--color-text-tertiary)]">
            {row.kind}
            {row.namespace ? ` · ${row.namespace}` : ""}
          </div>
        </div>
        <button onClick={onClose} className="btn-secondary !h-8 !py-1 !px-2 !text-xs">
          Close
        </button>
      </div>

      <div className="px-4 py-2 border-b border-[var(--color-border)] flex gap-1">
        {(["overview", "yaml"] as const).map((t) => (
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
      </div>

      {actionMsg && (
        <div className="px-4 py-2 text-xs text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">
          {actionMsg}
        </div>
      )}

      {tab === "overview" ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
          <div>
            <div className="caption-uppercase mb-1">Status</div>
            <div className="text-[var(--color-text-primary)]">{row.status}</div>
          </div>
          <div>
            <div className="caption-uppercase mb-1">Age</div>
            <div className="text-[var(--color-text-primary)]">{row.age}</div>
          </div>
          {row.info && (
            <div>
              <div className="caption-uppercase mb-1">Details</div>
              <div className="text-[var(--color-text-secondary)] break-all">{row.info}</div>
            </div>
          )}

          {isDeployment && row.namespace && (
            <div className="pt-2 border-t border-[var(--color-border)] space-y-2">
              <div className="caption-uppercase">Actions</div>
              <div className="flex gap-2">
                <input
                  value={scaleReplicas}
                  onChange={(e) => setScaleReplicas(e.target.value)}
                  placeholder="Replicas"
                  className="input-field flex-1 !h-8 !text-xs"
                />
                <button onClick={handleScale} className="btn-primary !h-8 !px-3 !text-xs">
                  Scale
                </button>
              </div>
              <button onClick={handleRolloutRestart} className="btn-secondary !h-8 !text-xs w-full">
                Rollout Restart
              </button>
            </div>
          )}

          {row.kind === "pods" && row.namespace && (
            <button onClick={handleRestartPod} className="btn-secondary !h-8 !text-xs w-full">
              Restart Pod
            </button>
          )}
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <Editor
            height="100%"
            defaultLanguage="json"
            value={yaml}
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
        </div>
      )}
    </div>
  );
}
