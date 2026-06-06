import { useState } from "react";
import { Editor } from "@monaco-editor/react";
import { getMonacoTheme, onMonacoBeforeMount } from "../../utils/theme";
import { Icon } from "../Icon";
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
    setActionMsg(result.success ? `Scaled to ${replicas}` : result.error || "Scale failed");
    if (result.success) onRefresh();
  };

  const handleRolloutRestart = async () => {
    if (!window.electronAPI || !row.namespace) return;
    const result = await window.electronAPI.k8s.rolloutRestart(row.name, row.namespace);
    setActionMsg(result.success ? "Restart triggered" : result.error || "Restart failed");
  };

  return (
    <div className="w-[min(360px,32vw)] min-w-[280px] flex-shrink-0 border-l border-[var(--color-border)] bg-[var(--color-card)] flex flex-col overflow-hidden">
      <div className="px-3 py-2 border-b border-[var(--color-border)] flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-sm font-medium truncate">{row.name}</div>
          <div className="text-[10px] text-[var(--color-text-tertiary)] font-mono truncate">
            {row.kind}
            {row.namespace ? ` · ${row.namespace}` : ""}
          </div>
        </div>
        <button
          onClick={onClose}
          title="Close"
          className="p-1.5 rounded text-[var(--color-text-tertiary)] hover:bg-[var(--color-muted)]"
        >
          <Icon name="X" className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="px-3 border-b border-[var(--color-border)] flex gap-3">
        {(["overview", "yaml"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`py-2 text-xs font-medium capitalize border-b-2 -mb-px transition-colors ${
              tab === t
                ? "border-[var(--color-primary)] text-[var(--color-text-primary)]"
                : "border-transparent text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {actionMsg && (
        <div className="px-3 py-1.5 text-[10px] text-[var(--color-text-secondary)] border-b border-[var(--color-border)] font-mono">
          {actionMsg}
        </div>
      )}

      {tab === "overview" ? (
        <div className="flex-1 overflow-y-auto p-3 space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] text-[var(--color-text-tertiary)]">Status</div>
              <div className="font-mono">{row.status}</div>
            </div>
            <div>
              <div className="text-[10px] text-[var(--color-text-tertiary)]">Age</div>
              <div className="font-mono">{row.age}</div>
            </div>
          </div>
          {row.info && (
            <div>
              <div className="text-[10px] text-[var(--color-text-tertiary)] mb-1">Details</div>
              <div className="font-mono text-[var(--color-text-secondary)] break-all">{row.info}</div>
            </div>
          )}

          {isDeployment && row.namespace && (
            <div className="pt-2 border-t border-[var(--color-border)] space-y-2">
              <div className="flex gap-2">
                <input
                  value={scaleReplicas}
                  onChange={(e) => setScaleReplicas(e.target.value)}
                  placeholder="Replicas"
                  className="input-field flex-1 !h-7 !text-xs font-mono"
                />
                <button onClick={handleScale} className="btn-primary !h-7 !px-2 !text-xs">
                  Scale
                </button>
              </div>
              <button onClick={handleRolloutRestart} className="btn-secondary !h-7 !text-xs w-full">
                Rollout restart
              </button>
            </div>
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
              fontSize: 11,
              wordWrap: "on",
              automaticLayout: true,
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            }}
          />
        </div>
      )}
    </div>
  );
}
