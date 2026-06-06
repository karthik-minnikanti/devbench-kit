import { K8sResourceKind, K8sResourceRow } from "./types";

export function formatAge(timestamp?: string): string {
  if (!timestamp) return "—";
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function statusBadgeClass(status: string): string {
  const s = status.toLowerCase();
  if (["running", "active", "ready", "healthy", "succeeded", "bound"].some((x) => s.includes(x))) {
    return "text-[var(--color-semantic-success)]";
  }
  if (["pending", "warning", "progressing"].some((x) => s.includes(x))) {
    return "text-[var(--color-timeline-done)]";
  }
  if (["failed", "error", "critical", "crashloopbackoff", "notready"].some((x) => s.includes(x))) {
    return "text-[var(--color-semantic-error)]";
  }
  return "text-[var(--color-text-secondary)]";
}

function row(
  kind: K8sResourceKind,
  name: string,
  namespace: string | undefined,
  status: string,
  created: string | undefined,
  info: string,
  raw: unknown,
): K8sResourceRow {
  const ns = namespace ? `${namespace}/` : "";
  return {
    id: `${kind}:${ns}${name}`,
    name,
    namespace,
    kind,
    status,
    age: formatAge(created),
    info,
    raw,
  };
}

export function podMetricsKey(
  podName: string,
  podNamespace: string | undefined,
  listNamespace?: string,
): string {
  if (listNamespace) return podName;
  return podNamespace ? `${podNamespace}/${podName}` : podName;
}

export function mapResources(
  kind: K8sResourceKind,
  items: any[],
  metrics: Record<string, { cpu: string; memory: string }> = {},
  listNamespace?: string,
): K8sResourceRow[] {
  switch (kind) {
    case "nodes":
      return items.map((n) =>
        row(
          kind,
          n.metadata?.name || "unknown",
          undefined,
          n.status?.conditions?.find((c: any) => c.type === "Ready")?.status === "True"
            ? "Ready"
            : "NotReady",
          n.metadata?.creationTimestamp,
          n.status?.nodeInfo?.kubeletVersion || "",
          n,
        ),
      );
    case "pods":
      return items.map((p) => {
        const podName = p.metadata?.name || "unknown";
        const podNamespace = p.metadata?.namespace;
        const restarts = (p.status?.containerStatuses || []).reduce(
          (sum: number, cs: { restartCount?: number }) => sum + (cs.restartCount || 0),
          0,
        );
        const usage = metrics[podMetricsKey(podName, podNamespace, listNamespace)];
        return {
          ...row(
            kind,
            podName,
            podNamespace,
            p.status?.phase || "Unknown",
            p.metadata?.creationTimestamp,
            p.spec?.containers?.[0]?.image || "",
            p,
          ),
          restarts,
          cpu: usage?.cpu ?? "—",
          memory: usage?.memory ?? "—",
        };
      });
    case "deployments":
      return items.map((d) =>
        row(
          kind,
          d.metadata?.name || "unknown",
          d.metadata?.namespace,
          `${d.status?.readyReplicas ?? 0}/${d.spec?.replicas ?? 0} ready`,
          d.metadata?.creationTimestamp,
          d.spec?.template?.spec?.containers?.[0]?.image || "",
          d,
        ),
      );
    case "replicasets":
      return items.map((r) =>
        row(
          kind,
          r.metadata?.name || "unknown",
          r.metadata?.namespace,
          `${r.status?.readyReplicas ?? 0}/${r.spec?.replicas ?? 0} ready`,
          r.metadata?.creationTimestamp,
          r.metadata?.ownerReferences?.[0]?.name || "",
          r,
        ),
      );
    case "statefulsets":
      return items.map((s) =>
        row(
          kind,
          s.metadata?.name || "unknown",
          s.metadata?.namespace,
          `${s.status?.readyReplicas ?? 0}/${s.spec?.replicas ?? 0} ready`,
          s.metadata?.creationTimestamp,
          s.spec?.serviceName || "",
          s,
        ),
      );
    case "daemonsets":
      return items.map((d) =>
        row(
          kind,
          d.metadata?.name || "unknown",
          d.metadata?.namespace,
          `${d.status?.numberReady ?? 0}/${d.status?.desiredNumberScheduled ?? 0} ready`,
          d.metadata?.creationTimestamp,
          d.spec?.template?.spec?.containers?.[0]?.image || "",
          d,
        ),
      );
    case "jobs":
      return items.map((j) =>
        row(
          kind,
          j.metadata?.name || "unknown",
          j.metadata?.namespace,
          j.status?.succeeded ? "Complete" : j.status?.active ? "Active" : "Pending",
          j.metadata?.creationTimestamp,
          j.spec?.template?.spec?.containers?.[0]?.image || "",
          j,
        ),
      );
    case "cronjobs":
      return items.map((c) =>
        row(
          kind,
          c.metadata?.name || "unknown",
          c.metadata?.namespace,
          c.spec?.suspend ? "Suspended" : "Active",
          c.metadata?.creationTimestamp,
          c.spec?.schedule || "",
          c,
        ),
      );
    case "services":
      return items.map((s) =>
        row(
          kind,
          s.metadata?.name || "unknown",
          s.metadata?.namespace,
          s.spec?.type || "ClusterIP",
          s.metadata?.creationTimestamp,
          (s.spec?.ports || []).map((p: any) => `${p.port}/${p.protocol}`).join(", "),
          s,
        ),
      );
    case "ingresses":
      return items.map((i) =>
        row(
          kind,
          i.metadata?.name || "unknown",
          i.metadata?.namespace,
          i.status?.loadBalancer?.ingress?.[0]?.hostname ? "Ready" : "Pending",
          i.metadata?.creationTimestamp,
          (i.spec?.rules || []).map((r: any) => r.host).filter(Boolean).join(", ") || "—",
          i,
        ),
      );
    case "configmaps":
      return items.map((c) =>
        row(
          kind,
          c.metadata?.name || "unknown",
          c.metadata?.namespace,
          "Active",
          c.metadata?.creationTimestamp,
          `${Object.keys(c.data || {}).length} keys`,
          c,
        ),
      );
    case "secrets":
      return items.map((s) =>
        row(
          kind,
          s.metadata?.name || "unknown",
          s.metadata?.namespace,
          s.type || "Opaque",
          s.metadata?.creationTimestamp,
          `${Object.keys(s.data || {}).length} keys`,
          s,
        ),
      );
    case "namespaces":
      return items.map((n) =>
        row(
          kind,
          n.metadata?.name || "unknown",
          undefined,
          n.status?.phase || "Active",
          n.metadata?.creationTimestamp,
          n.metadata?.labels?.["kubernetes.io/metadata.name"] || "",
          n,
        ),
      );
    default:
      return [];
  }
}

export const TABLE_COLUMNS: Record<
  K8sResourceKind,
  { key: keyof K8sResourceRow | "info"; label: string }[]
> = {
  nodes: [
    { key: "name", label: "Name" },
    { key: "status", label: "Status" },
    { key: "info", label: "Version" },
    { key: "age", label: "Age" },
  ],
  pods: [
    { key: "name", label: "Name" },
    { key: "namespace", label: "Namespace" },
    { key: "status", label: "Status" },
    { key: "restarts", label: "Restarts" },
    { key: "cpu", label: "CPU" },
    { key: "memory", label: "Memory" },
    { key: "info", label: "Image" },
    { key: "age", label: "Age" },
  ],
  deployments: [
    { key: "name", label: "Name" },
    { key: "namespace", label: "Namespace" },
    { key: "status", label: "Ready" },
    { key: "info", label: "Image" },
    { key: "age", label: "Age" },
  ],
  replicasets: [
    { key: "name", label: "Name" },
    { key: "namespace", label: "Namespace" },
    { key: "status", label: "Ready" },
    { key: "info", label: "Owner" },
    { key: "age", label: "Age" },
  ],
  statefulsets: [
    { key: "name", label: "Name" },
    { key: "namespace", label: "Namespace" },
    { key: "status", label: "Ready" },
    { key: "age", label: "Age" },
  ],
  daemonsets: [
    { key: "name", label: "Name" },
    { key: "namespace", label: "Namespace" },
    { key: "status", label: "Ready" },
    { key: "age", label: "Age" },
  ],
  jobs: [
    { key: "name", label: "Name" },
    { key: "namespace", label: "Namespace" },
    { key: "status", label: "Status" },
    { key: "age", label: "Age" },
  ],
  cronjobs: [
    { key: "name", label: "Name" },
    { key: "namespace", label: "Namespace" },
    { key: "status", label: "Status" },
    { key: "info", label: "Schedule" },
    { key: "age", label: "Age" },
  ],
  services: [
    { key: "name", label: "Name" },
    { key: "namespace", label: "Namespace" },
    { key: "status", label: "Type" },
    { key: "info", label: "Ports" },
    { key: "age", label: "Age" },
  ],
  ingresses: [
    { key: "name", label: "Name" },
    { key: "namespace", label: "Namespace" },
    { key: "status", label: "Status" },
    { key: "info", label: "Hosts" },
    { key: "age", label: "Age" },
  ],
  configmaps: [
    { key: "name", label: "Name" },
    { key: "namespace", label: "Namespace" },
    { key: "info", label: "Keys" },
    { key: "age", label: "Age" },
  ],
  secrets: [
    { key: "name", label: "Name" },
    { key: "namespace", label: "Namespace" },
    { key: "status", label: "Type" },
    { key: "age", label: "Age" },
  ],
  namespaces: [
    { key: "name", label: "Name" },
    { key: "status", label: "Phase" },
    { key: "age", label: "Age" },
  ],
  events: [],
  timeline: [],
  "dependency-graph": [],
  search: [],
};

export const NAV_SECTIONS = [
  {
    id: "cluster",
    label: "Cluster",
    items: [
      { kind: "nodes" as K8sResourceKind, label: "Nodes" },
      { kind: "namespaces" as K8sResourceKind, label: "Namespaces" },
    ],
  },
  {
    id: "workloads",
    label: "Workloads",
    items: [
      { kind: "pods" as K8sResourceKind, label: "Pods" },
      { kind: "deployments" as K8sResourceKind, label: "Deployments" },
      { kind: "replicasets" as K8sResourceKind, label: "ReplicaSets" },
      { kind: "statefulsets" as K8sResourceKind, label: "StatefulSets" },
      { kind: "daemonsets" as K8sResourceKind, label: "DaemonSets" },
      { kind: "jobs" as K8sResourceKind, label: "Jobs" },
      { kind: "cronjobs" as K8sResourceKind, label: "CronJobs" },
    ],
  },
  {
    id: "network",
    label: "Network",
    items: [
      { kind: "services" as K8sResourceKind, label: "Services" },
      { kind: "ingresses" as K8sResourceKind, label: "Ingresses" },
    ],
  },
  {
    id: "config",
    label: "Config",
    items: [
      { kind: "configmaps" as K8sResourceKind, label: "ConfigMaps" },
      { kind: "secrets" as K8sResourceKind, label: "Secrets" },
    ],
  },
  {
    id: "intelligence",
    label: "Intelligence",
    items: [
      { kind: "events" as K8sResourceKind, label: "Events" },
      { kind: "timeline" as K8sResourceKind, label: "Timeline" },
      { kind: "dependency-graph" as K8sResourceKind, label: "Dependencies" },
      { kind: "search" as K8sResourceKind, label: "Search" },
    ],
  },
];

export function isIntelligenceView(kind: K8sResourceKind): boolean {
  return ["events", "timeline", "dependency-graph", "search"].includes(kind);
}
