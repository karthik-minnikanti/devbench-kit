import { useState, type ReactNode } from "react";
import { Icon } from "../Icon";
import {
  podCanRestart,
  PodPortInfo,
  PodSummary,
  suggestLocalPort,
} from "./podDetailUtils";

interface ActiveForward {
  forwardId: string;
  localPort: number;
  remotePort: number;
  portKey: string;
  status: "active" | "error";
  message?: string;
}

interface K8sPodOverviewProps {
  summary: PodSummary;
  rawPod: unknown;
  forwards: Record<string, ActiveForward>;
  localPorts: Record<string, string>;
  onLocalPortChange: (key: string, value: string) => void;
  onPortForward: (port: PodPortInfo) => void;
  onStopPortForward: (portKey: string) => void;
  onRestartPod: () => void;
}

function MetaItem({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] text-[var(--color-text-tertiary)]">{label}</div>
      <div className="text-xs font-mono text-[var(--color-text-primary)] truncate">{value ?? "—"}</div>
    </div>
  );
}

function CollapsibleSection({
  id,
  title,
  count,
  expanded,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  count?: number;
  expanded: boolean;
  onToggle: (id: string) => void;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-[var(--color-border)]">
      <button
        type="button"
        onClick={() => onToggle(id)}
        aria-expanded={expanded}
        className="w-full flex items-center gap-1.5 px-3 py-2 text-left hover:bg-[var(--color-muted)]/40 transition-colors"
      >
        <Icon
          name={expanded ? "ChevronDown" : "ChevronRight"}
          className="w-3 h-3 flex-shrink-0 text-[var(--color-text-tertiary)]"
        />
        <span className="text-xs font-medium text-[var(--color-text-primary)]">{title}</span>
        {count !== undefined && (
          <span className="ml-auto text-[10px] tabular-nums text-[var(--color-text-tertiary)]">{count}</span>
        )}
      </button>
      {expanded && <div className="px-3 pb-3 space-y-2">{children}</div>}
    </section>
  );
}

const DEFAULT_EXPANDED_SECTIONS = new Set(["containers", "ports"]);

function ContainerCard({ container }: { container: PodSummary["containers"][0] }) {
  const borderTone = container.ready
    ? "border-l-[var(--color-semantic-success)]"
    : container.state === "Waiting" || container.state === "ContainerCreating"
      ? "border-l-[var(--color-timeline-done)]"
      : "border-l-[var(--color-semantic-error)]";

  return (
    <div
      className={`rounded border border-[var(--color-border)] border-l-2 ${borderTone} p-2.5 space-y-2 text-xs`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono font-medium text-[var(--color-text-primary)] truncate">{container.name}</span>
        <span
          className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded ${
            container.ready
              ? "text-[var(--color-semantic-success)] bg-[var(--color-semantic-success)]/10"
              : "text-[var(--color-semantic-error)] bg-[var(--color-semantic-error)]/10"
          }`}
        >
          {container.ready ? "ready" : container.state}
        </span>
      </div>
      <div className="font-mono text-[10px] text-[var(--color-text-secondary)] break-all">{container.image}</div>
      <div className="flex gap-4 text-[10px] text-[var(--color-text-tertiary)]">
        <span>restarts {container.restarts}</span>
        {container.resources && (
          <span className="truncate">
            cpu {container.resources.cpuRequest || "—"} / {container.resources.cpuLimit || "—"}
          </span>
        )}
      </div>
    </div>
  );
}

function PortRow({
  port,
  active,
  localPorts,
  onLocalPortChange,
  onPortForward,
  onStopPortForward,
}: {
  port: PodPortInfo;
  active?: ActiveForward;
  localPorts: Record<string, string>;
  onLocalPortChange: (key: string, value: string) => void;
  onPortForward: (port: PodPortInfo) => void;
  onStopPortForward: (portKey: string) => void;
}) {
  const isActiveForward = active?.status === "active";
  const defaultLocal = suggestLocalPort(port.containerPort);

  return (
    <div className="rounded border border-[var(--color-border)] p-2.5 space-y-2 text-xs">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <span className="font-mono font-medium">{port.name || `${port.container}:${port.containerPort}`}</span>
          <span className="ml-2 text-[10px] text-[var(--color-text-tertiary)]">
            :{port.containerPort}
            {port.servicePort ? ` → svc ${port.servicePort}` : ""}
          </span>
        </div>
        {port.source === "service" && (
          <span className="text-[10px] text-[var(--color-primary)]">{port.serviceName}</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={1}
          max={65535}
          disabled={isActiveForward}
          value={localPorts[port.key] ?? String(defaultLocal)}
          onChange={(e) => onLocalPortChange(port.key, e.target.value)}
          className="w-16 h-7 px-2 rounded border border-[var(--color-border)] bg-[var(--color-background)] text-xs font-mono"
          title={`Pod port ${port.containerPort}. Use ≥1024 on macOS.`}
        />
        {isActiveForward ? (
          <button
            onClick={() => onStopPortForward(port.key)}
            className="btn-secondary !h-7 !px-2 !text-[10px]"
          >
            Stop :{active.localPort}
          </button>
        ) : (
          <button onClick={() => onPortForward(port)} className="btn-primary !h-7 !px-2 !text-[10px]">
            Forward
          </button>
        )}
      </div>
      {active?.status === "error" && (
        <div className="text-[10px] text-[var(--color-semantic-error)]">{active.message || "Failed"}</div>
      )}
    </div>
  );
}

export function K8sPodOverview({
  summary,
  rawPod,
  forwards,
  localPorts,
  onLocalPortChange,
  onPortForward,
  onStopPortForward,
  onRestartPod,
}: K8sPodOverviewProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(() => {
    const initial = new Set(DEFAULT_EXPANDED_SECTIONS);
    if (summary.conditions.some((c) => c.status !== "True")) {
      initial.add("conditions");
    }
    return initial;
  });

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isExpanded = (id: string) => expandedSections.has(id);

  const restartCheck = podCanRestart(rawPod);

  return (
    <div className="h-full overflow-y-auto custom-scrollbar">
      <div className="px-3 py-2 border-b border-[var(--color-border)] grid grid-cols-2 gap-x-4 gap-y-2">
        <MetaItem label="Node" value={summary.node} />
        <MetaItem label="Pod IP" value={summary.podIp} />
        <MetaItem label="Age" value={summary.age} />
        <MetaItem label="QoS" value={summary.qosClass} />
        <MetaItem label="Restarts" value={summary.totalRestarts} />
        <MetaItem label="Policy" value={summary.restartPolicy} />
      </div>

      {summary.owners.length > 0 && (
        <div className="px-3 py-1.5 border-b border-[var(--color-border)] flex flex-wrap gap-1">
          {summary.owners.map((owner) => (
            <span
              key={`${owner.kind}/${owner.name}`}
              className="text-[10px] font-mono text-[var(--color-text-secondary)]"
            >
              {owner.kind}/{owner.name}
            </span>
          ))}
        </div>
      )}

      <div>
        {summary.conditions.length > 0 && (
          <CollapsibleSection
            id="conditions"
            title="Conditions"
            count={summary.conditions.length}
            expanded={isExpanded("conditions")}
            onToggle={toggleSection}
          >
            <div className="space-y-1">
              {summary.conditions.map((cond) => {
                const ok = cond.status === "True";
                return (
                  <div key={cond.type} className="flex gap-2 text-xs py-1">
                    <span className={ok ? "text-[var(--color-semantic-success)]" : "text-[var(--color-semantic-error)]"}>
                      {ok ? "✓" : "!"}
                    </span>
                    <div className="min-w-0">
                      <span className="font-medium">{cond.type}</span>
                      {(cond.reason || cond.message) && (
                        <span className="text-[var(--color-text-tertiary)] ml-1">
                          {[cond.reason, cond.message].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CollapsibleSection>
        )}

        {summary.linkedServices.length > 0 && (
          <CollapsibleSection
            id="services"
            title="Services"
            count={summary.linkedServices.length}
            expanded={isExpanded("services")}
            onToggle={toggleSection}
          >
            <div className="flex flex-wrap gap-1">
              {summary.linkedServices.map((svc) => (
                <span key={svc} className="text-xs font-mono text-[var(--color-text-primary)]">
                  {svc}
                </span>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {summary.labels.length > 0 && (
          <CollapsibleSection
            id="labels"
            title="Labels"
            count={summary.labels.length}
            expanded={isExpanded("labels")}
            onToggle={toggleSection}
          >
            <div className="flex flex-wrap gap-1">
              {summary.labels.map(({ key, value }) => (
                <span
                  key={key}
                  className="text-[10px] font-mono text-[var(--color-text-secondary)]"
                  title={`${key}=${value}`}
                >
                  {key}={value}
                </span>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {summary.initContainers.length > 0 && (
          <CollapsibleSection
            id="init-containers"
            title="Init Containers"
            count={summary.initContainers.length}
            expanded={isExpanded("init-containers")}
            onToggle={toggleSection}
          >
            <div className="space-y-2">
              {summary.initContainers.map((c) => (
                <ContainerCard key={c.name} container={c} />
              ))}
            </div>
          </CollapsibleSection>
        )}

        <CollapsibleSection
          id="containers"
          title="Containers"
          count={summary.containers.length}
          expanded={isExpanded("containers")}
          onToggle={toggleSection}
        >
          <div className="space-y-2">
            {summary.containers.map((c) => (
              <ContainerCard key={c.name} container={c} />
            ))}
          </div>
        </CollapsibleSection>

        <CollapsibleSection
          id="ports"
          title="Port Forward"
          count={summary.ports.length || undefined}
          expanded={isExpanded("ports")}
          onToggle={toggleSection}
        >
          {summary.ports.length === 0 ? (
            <p className="text-[10px] text-[var(--color-text-tertiary)]">
              No ports — add container ports or expose via Service.
            </p>
          ) : (
            <div className="space-y-2">
              {summary.ports.map((port) => (
                <PortRow
                  key={port.key}
                  port={port}
                  active={forwards[port.key]}
                  localPorts={localPorts}
                  onLocalPortChange={onLocalPortChange}
                  onPortForward={onPortForward}
                  onStopPortForward={onStopPortForward}
                />
              ))}
            </div>
          )}
        </CollapsibleSection>

        {summary.annotations.length > 0 && (
          <CollapsibleSection
            id="annotations"
            title="Annotations"
            count={summary.annotations.length}
            expanded={isExpanded("annotations")}
            onToggle={toggleSection}
          >
            <div className="space-y-1">
              {summary.annotations.slice(0, 6).map(({ key, value }) => (
                <div key={key} className="text-[10px] font-mono break-all text-[var(--color-text-secondary)]">
                  <span className="text-[var(--color-text-tertiary)]">{key}: </span>
                  {value}
                </div>
              ))}
              {summary.annotations.length > 6 && (
                <div className="text-[10px] text-[var(--color-text-tertiary)]">
                  +{summary.annotations.length - 6} in YAML
                </div>
              )}
            </div>
          </CollapsibleSection>
        )}

        <CollapsibleSection
          id="actions"
          title="Actions"
          expanded={isExpanded("actions")}
          onToggle={toggleSection}
        >
          <button
            onClick={onRestartPod}
            disabled={!restartCheck.ok}
            title={restartCheck.reason}
            className="btn-secondary !h-7 !text-xs w-full disabled:opacity-50"
          >
            Restart pod
          </button>
          {!restartCheck.ok && (
            <p className="text-[10px] text-[var(--color-text-tertiary)] mt-1">{restartCheck.reason}</p>
          )}
        </CollapsibleSection>
      </div>
    </div>
  );
}
