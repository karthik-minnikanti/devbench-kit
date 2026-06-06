export type K8sResourceKind =
  | "nodes"
  | "pods"
  | "deployments"
  | "replicasets"
  | "statefulsets"
  | "daemonsets"
  | "jobs"
  | "cronjobs"
  | "services"
  | "ingresses"
  | "configmaps"
  | "secrets"
  | "namespaces"
  | "events"
  | "timeline"
  | "dependency-graph"
  | "search";

export interface K8sResourceRow {
  id: string;
  name: string;
  namespace?: string;
  kind: K8sResourceKind;
  status: string;
  age: string;
  info: string;
  raw: unknown;
  restarts?: number;
  cpu?: string;
  memory?: string;
}

export interface K8sNavSection {
  id: string;
  label: string;
  items: { kind: K8sResourceKind; label: string }[];
}

export const ALL_NAMESPACES = "__all__";
