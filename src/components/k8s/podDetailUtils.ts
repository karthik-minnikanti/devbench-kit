import { formatAge, statusBadgeClass } from "./utils";

export interface PodPortInfo {
  key: string;
  container: string;
  containerPort: number;
  name?: string;
  protocol: string;
  source: "container" | "service";
  serviceName?: string;
  servicePort?: number;
}

function resolveTargetPort(
  targetPort: unknown,
  servicePort: number,
  containers: any[],
): number {
  if (typeof targetPort === "number") return targetPort;
  if (typeof targetPort === "string") {
    const asNum = parseInt(targetPort, 10);
    if (!Number.isNaN(asNum)) return asNum;
    for (const container of containers) {
      for (const port of container.ports || []) {
        if (port.name === targetPort) return port.containerPort;
      }
    }
  }
  return servicePort;
}

function podMatchesServiceSelector(pod: any, selector: Record<string, string>): boolean {
  const labels = pod.metadata?.labels || {};
  return Object.entries(selector).every(([key, value]) => labels[key] === value);
}

/** Local ports below 1024 need root — pick a safe default for port-forward. */
export function suggestLocalPort(remotePort: number): number {
  if (remotePort >= 1024) return remotePort;
  if (remotePort === 80) return 8080;
  if (remotePort === 443) return 8443;
  return remotePort + 10000;
}

export function isPrivilegedLocalPort(port: number): boolean {
  return port > 0 && port < 1024;
}

export interface PodOwnerInfo {
  kind: string;
  name: string;
}

export interface PodConditionInfo {
  type: string;
  status: string;
  reason?: string;
  message?: string;
}

export interface PodContainerResources {
  cpuRequest?: string;
  cpuLimit?: string;
  memoryRequest?: string;
  memoryLimit?: string;
}

export interface PodEnvVar {
  name: string;
  value?: string;
  source?: string;
  resolvedValue?: string;
  isSecret?: boolean;
}

export interface PodContainerInfo {
  name: string;
  image: string;
  ready: boolean;
  restarts: number;
  state: string;
  ports: PodPortInfo[];
  resources?: PodContainerResources;
  imagePullPolicy?: string;
  isInit?: boolean;
  env: PodEnvVar[];
}

export interface PodSummary {
  phase: string;
  node?: string;
  podIp?: string;
  hostIp?: string;
  qosClass?: string;
  serviceAccount?: string;
  age: string;
  createdAt?: string;
  uid?: string;
  totalRestarts: number;
  restartPolicy?: string;
  labels: Array<{ key: string; value: string }>;
  annotations: Array<{ key: string; value: string }>;
  owners: PodOwnerInfo[];
  conditions: PodConditionInfo[];
  linkedServices: string[];
  containers: PodContainerInfo[];
  initContainers: PodContainerInfo[];
  ports: PodPortInfo[];
}

export function extractPodPorts(pod: any): PodPortInfo[] {
  if (!pod?.spec?.containers) return [];
  const ports: PodPortInfo[] = [];
  for (const container of pod.spec.containers) {
    for (const port of container.ports || []) {
      ports.push({
        key: `${container.name}:${port.containerPort}:${port.protocol || "TCP"}`,
        container: container.name,
        containerPort: port.containerPort,
        name: port.name,
        protocol: port.protocol || "TCP",
        source: "container",
      });
    }
  }
  return ports;
}

export function extractServicePortsForPod(pod: any, services: any[] = []): PodPortInfo[] {
  if (!pod?.metadata?.namespace) return [];

  const podNamespace = pod.metadata.namespace;
  const containers = pod.spec?.containers || [];
  const primaryContainer = containers[0]?.name || "unknown";
  const ports: PodPortInfo[] = [];

  for (const service of services) {
    if (service.metadata?.namespace !== podNamespace) continue;
    const selector = service.spec?.selector;
    if (!selector || Object.keys(selector).length === 0) continue;
    if (!podMatchesServiceSelector(pod, selector)) continue;

    for (const port of service.spec?.ports || []) {
      const servicePort = port.port;
      if (!servicePort) continue;
      const containerPort = resolveTargetPort(port.targetPort, servicePort, containers);
      const protocol = port.protocol || "TCP";
      const serviceName = service.metadata?.name || "service";

      ports.push({
        key: `svc:${serviceName}:${servicePort}:${protocol}`,
        container: primaryContainer,
        containerPort,
        name: port.name || `${serviceName}:${servicePort}`,
        protocol,
        source: "service",
        serviceName,
        servicePort,
      });
    }
  }

  return ports;
}

export function extractAllPodPorts(pod: any, services: any[] = []): PodPortInfo[] {
  const containerPorts = extractPodPorts(pod);
  const servicePorts = extractServicePortsForPod(pod, services);
  const seen = new Set(containerPorts.map((p) => `${p.containerPort}:${p.protocol}`));

  const merged = [...containerPorts];
  for (const port of servicePorts) {
    const sig = `${port.containerPort}:${port.protocol}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    merged.push(port);
  }
  return merged;
}

export function buildPodSummary(pod: any, services: any[] = []): PodSummary | null {
  if (!pod) return null;

  const statusByName = new Map<string, any>();
  for (const cs of pod.status?.containerStatuses || []) {
    statusByName.set(cs.name, cs);
  }
  const initStatusByName = new Map<string, any>();
  for (const cs of pod.status?.initContainerStatuses || []) {
    initStatusByName.set(cs.name, cs);
  }

  const containers: PodContainerInfo[] = (pod.spec?.containers || []).map((c: any) =>
    mapContainer(c, statusByName.get(c.name), false),
  );

  const initContainers: PodContainerInfo[] = (pod.spec?.initContainers || []).map((c: any) =>
    mapContainer(c, initStatusByName.get(c.name), true),
  );

  const totalRestarts = [...containers, ...initContainers].reduce(
    (sum, c) => sum + c.restarts,
    0,
  );

  const labels = Object.entries(pod.metadata?.labels || {}).map(([key, value]) => ({
    key,
    value: String(value),
  }));

  const annotations = Object.entries(pod.metadata?.annotations || {}).map(([key, value]) => ({
    key,
    value: String(value),
  }));

  const owners: PodOwnerInfo[] = (pod.metadata?.ownerReferences || []).map((ref: any) => ({
    kind: ref.kind,
    name: ref.name,
  }));

  const conditions: PodConditionInfo[] = (pod.status?.conditions || []).map((c: any) => ({
    type: c.type,
    status: c.status,
    reason: c.reason,
    message: c.message,
  }));

  return {
    phase: pod.status?.phase || "Unknown",
    node: pod.spec?.nodeName,
    podIp: pod.status?.podIP,
    hostIp: pod.status?.hostIP,
    qosClass: pod.status?.qosClass,
    serviceAccount: pod.spec?.serviceAccountName,
    age: formatAge(pod.metadata?.creationTimestamp),
    createdAt: pod.metadata?.creationTimestamp,
    uid: pod.metadata?.uid,
    restartPolicy: pod.spec?.restartPolicy,
    totalRestarts,
    labels,
    annotations,
    owners,
    conditions,
    linkedServices: extractLinkedServices(pod, services),
    containers,
    initContainers,
    ports: extractAllPodPorts(pod, services),
  };
}

export function podPhaseClass(phase: string): string {
  return statusBadgeClass(phase);
}

export function podPhaseBadgeClass(phase: string): string {
  const p = phase.toLowerCase();
  if (p === "running") return "bg-[var(--color-semantic-success)]/15 text-[var(--color-semantic-success)] border-[var(--color-semantic-success)]/30";
  if (p === "pending") return "bg-[var(--color-timeline-done)]/15 text-[var(--color-timeline-done)] border-[var(--color-timeline-done)]/30";
  if (p === "succeeded") return "bg-[var(--color-semantic-success)]/15 text-[var(--color-semantic-success)] border-[var(--color-semantic-success)]/30";
  if (p === "failed") return "bg-[var(--color-semantic-error)]/15 text-[var(--color-semantic-error)] border-[var(--color-semantic-error)]/30";
  return "bg-[var(--color-muted)] text-[var(--color-text-secondary)] border-[var(--color-border)]";
}

function formatEnvSource(valueFrom: Record<string, unknown> | undefined): string | undefined {
  if (!valueFrom) return undefined;
  if (valueFrom.configMapKeyRef) {
    const ref = valueFrom.configMapKeyRef as { name?: string; key?: string };
    return `configMap/${ref.name ?? "?"}:${ref.key ?? "?"}`;
  }
  if (valueFrom.secretKeyRef) {
    const ref = valueFrom.secretKeyRef as { name?: string; key?: string };
    return `secret/${ref.name ?? "?"}:${ref.key ?? "?"}`;
  }
  if (valueFrom.fieldRef) {
    const ref = valueFrom.fieldRef as { fieldPath?: string };
    return `fieldRef(${ref.fieldPath ?? "?"})`;
  }
  if (valueFrom.resourceFieldRef) {
    const ref = valueFrom.resourceFieldRef as { resource?: string };
    return `resourceFieldRef(${ref.resource ?? "?"})`;
  }
  return undefined;
}

function extractContainerEnv(container: { env?: unknown[] }): PodEnvVar[] {
  return (container.env || []).map((entry) => {
    const env = entry as {
      name?: string;
      value?: string;
      valueFrom?: Record<string, unknown>;
    };
    return {
      name: env.name || "—",
      value: env.value,
      source: formatEnvSource(env.valueFrom),
    };
  });
}

function resolveFieldRef(pod: any, fieldPath: string): string | undefined {
  const parts = fieldPath.split(".");
  let current: unknown = pod;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current != null ? String(current) : undefined;
}

function configMapValue(
  configMaps: any[],
  namespace: string,
  name: string,
  key: string,
): string | undefined {
  const cm = configMaps.find(
    (c) => c.metadata?.name === name && c.metadata?.namespace === namespace,
  );
  const raw = cm?.data?.[key];
  return raw != null ? String(raw) : undefined;
}

function collectSecretNamesFromContainer(container: {
  env?: unknown[];
  envFrom?: unknown[];
}): string[] {
  const names = new Set<string>();
  for (const entry of container.env || []) {
    const ref = (entry as { valueFrom?: { secretKeyRef?: { name?: string } } })
      .valueFrom?.secretKeyRef?.name;
    if (ref) names.add(ref);
  }
  for (const entry of container.envFrom || []) {
    const ref = (entry as { secretRef?: { name?: string } }).secretRef?.name;
    if (ref) names.add(ref);
  }
  return [...names];
}

function resolveContainerEnv(
  container: { env?: unknown[]; envFrom?: unknown[] },
  pod: any,
  namespace: string,
  configMaps: any[],
  secretData: Record<string, Record<string, string>>,
): PodEnvVar[] {
  const resolved: PodEnvVar[] = [];

  for (const entry of container.env || []) {
    const env = entry as {
      name?: string;
      value?: string;
      valueFrom?: Record<string, unknown>;
    };
    const name = env.name || "—";
    const source = formatEnvSource(env.valueFrom);

    if (env.value !== undefined) {
      resolved.push({ name, value: env.value, resolvedValue: env.value });
      continue;
    }

    const secretRef = env.valueFrom?.secretKeyRef as { name?: string; key?: string } | undefined;
    if (secretRef?.name && secretRef.key) {
      const val = secretData[secretRef.name]?.[secretRef.key];
      resolved.push({
        name,
        source,
        resolvedValue: val,
        isSecret: true,
      });
      continue;
    }

    const cmRef = env.valueFrom?.configMapKeyRef as { name?: string; key?: string } | undefined;
    if (cmRef?.name && cmRef.key) {
      const val = configMapValue(configMaps, namespace, cmRef.name, cmRef.key);
      resolved.push({
        name,
        source,
        resolvedValue: val,
      });
      continue;
    }

    const fieldRef = env.valueFrom?.fieldRef as { fieldPath?: string } | undefined;
    if (fieldRef?.fieldPath) {
      const val = resolveFieldRef(pod, fieldRef.fieldPath);
      resolved.push({
        name,
        source,
        resolvedValue: val,
      });
      continue;
    }

    resolved.push({ name, source });
  }

  for (const entry of container.envFrom || []) {
    const envFrom = entry as {
      prefix?: string;
      secretRef?: { name?: string };
      configMapRef?: { name?: string };
    };
    const prefix = envFrom.prefix || "";

    if (envFrom.secretRef?.name) {
      const secretName = envFrom.secretRef.name;
      const data = secretData[secretName] || {};
      for (const [key, val] of Object.entries(data)) {
        resolved.push({
          name: `${prefix}${key}`,
          source: `secret/${secretName}`,
          resolvedValue: val,
          isSecret: true,
        });
      }
      continue;
    }

    if (envFrom.configMapRef?.name) {
      const cmName = envFrom.configMapRef.name;
      const cm = configMaps.find(
        (c) => c.metadata?.name === cmName && c.metadata?.namespace === namespace,
      );
      for (const [key, val] of Object.entries(cm?.data || {})) {
        resolved.push({
          name: `${prefix}${key}`,
          source: `configMap/${cmName}`,
          resolvedValue: String(val),
        });
      }
    }
  }

  return resolved;
}

export function collectPodSecretNames(pod: any): string[] {
  const names = new Set<string>();
  const containers = [
    ...(pod?.spec?.containers || []),
    ...(pod?.spec?.initContainers || []),
  ];
  for (const container of containers) {
    for (const name of collectSecretNamesFromContainer(container)) {
      names.add(name);
    }
  }
  return [...names];
}

export async function resolvePodSummaryEnv(
  summary: PodSummary,
  pod: any,
  namespace: string,
  configMaps: any[],
  fetchSecretData: (namespace: string, name: string) => Promise<Record<string, string>>,
): Promise<PodSummary> {
  const secretNames = collectPodSecretNames(pod);
  const secretData: Record<string, Record<string, string>> = {};

  await Promise.all(
    secretNames.map(async (name) => {
      try {
        secretData[name] = await fetchSecretData(namespace, name);
      } catch {
        secretData[name] = {};
      }
    }),
  );

  const resolveContainers = (containers: PodContainerInfo[], specContainers: any[]) =>
    containers.map((c, i) => ({
      ...c,
      env: resolveContainerEnv(specContainers[i] || {}, pod, namespace, configMaps, secretData),
    }));

  return {
    ...summary,
    containers: resolveContainers(summary.containers, pod?.spec?.containers || []),
    initContainers: resolveContainers(summary.initContainers, pod?.spec?.initContainers || []),
  };
}

function mapContainer(
  c: any,
  cs: any,
  isInit = false,
): PodContainerInfo {
  const stateKey = cs?.state ? Object.keys(cs.state)[0] : "unknown";
  const stateObj = cs?.state?.[stateKey];
  const stateLabel =
    stateKey === "running"
      ? "Running"
      : stateKey === "waiting"
        ? stateObj?.reason || "Waiting"
        : stateKey === "terminated"
          ? stateObj?.reason || "Terminated"
          : stateKey;

  const resources = c.resources;
  return {
    name: c.name,
    image: c.image || "",
    ready: cs?.ready ?? false,
    restarts: cs?.restartCount ?? 0,
    state: stateLabel,
    imagePullPolicy: c.imagePullPolicy,
    isInit,
    resources: resources
      ? {
          cpuRequest: resources.requests?.cpu,
          cpuLimit: resources.limits?.cpu,
          memoryRequest: resources.requests?.memory,
          memoryLimit: resources.limits?.memory,
        }
      : undefined,
    ports: (c.ports || []).map((p: any) => ({
      key: `${c.name}:${p.containerPort}:${p.protocol || "TCP"}`,
      container: c.name,
      containerPort: p.containerPort,
      name: p.name,
      protocol: p.protocol || "TCP",
      source: "container" as const,
    })),
    env: extractContainerEnv(c),
  };
}

function extractLinkedServices(pod: any, services: any[]): string[] {
  if (!pod?.metadata?.namespace) return [];
  const names: string[] = [];
  for (const service of services) {
    if (service.metadata?.namespace !== pod.metadata.namespace) continue;
    const selector = service.spec?.selector;
    if (!selector || !podMatchesServiceSelector(pod, selector)) continue;
    if (service.metadata?.name) names.push(service.metadata.name);
  }
  return names;
}

export function podCanRestart(pod: unknown): { ok: boolean; reason?: string } {
  const owner = (pod as { metadata?: { ownerReferences?: { kind: string }[] } })?.metadata
    ?.ownerReferences?.[0];
  if (!owner) {
    return {
      ok: false,
      reason: "Not managed by a controller — restart would permanently delete this pod.",
    };
  }
  if (owner.kind === "Job") {
    return { ok: false, reason: "Job pods cannot be restarted. Run the Job again instead." };
  }
  if (!["ReplicaSet", "StatefulSet", "DaemonSet", "ReplicationController"].includes(owner.kind)) {
    return { ok: false, reason: `Restart is not supported for pods owned by ${owner.kind}.` };
  }
  return { ok: true };
}
