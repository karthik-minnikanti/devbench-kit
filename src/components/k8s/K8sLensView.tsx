import { useCallback, useEffect, useState } from "react";
import { K8sClusterPanel } from "../K8sClusterPanel";
import { K8sIntelligencePanel } from "./K8sIntelligencePanel";
import { K8sNavigator } from "./K8sNavigator";
import { K8sPodBottomPanel, PodDockTab } from "./K8sPodBottomPanel";
import { K8sPodDetail } from "./K8sPodDetail";
import { K8sResourceDetail } from "./K8sResourceDetail";
import { K8sResourceTable } from "./K8sResourceTable";
import { ALL_NAMESPACES, K8sResourceKind, K8sResourceRow } from "./types";
import { isIntelligenceView, mapResources } from "./utils";

interface PodDockTarget {
  name: string;
  namespace: string;
}

function podDockTargetId(target: PodDockTarget | null): string | null {
  return target ? `${target.namespace}/${target.name}` : null;
}

interface Namespace {
  metadata: { name: string };
}

async function fetchResources(
  kind: K8sResourceKind,
  namespace: string,
): Promise<K8sResourceRow[]> {
  if (!window.electronAPI) return [];
  const ns = namespace === ALL_NAMESPACES ? undefined : namespace;

  const load = async () => {
    switch (kind) {
      case "nodes": {
        const r = await window.electronAPI!.k8s.nodes();
        return r.success ? mapResources(kind, r.nodes || []) : [];
      }
      case "pods": {
        const r = await window.electronAPI!.k8s.pods(ns);
        return r.success
          ? mapResources(kind, r.pods || [], r.metrics || {}, ns)
          : [];
      }
      case "deployments": {
        const r = await window.electronAPI!.k8s.deployments(ns);
        return r.success ? mapResources(kind, r.deployments || []) : [];
      }
      case "replicasets": {
        const r = await window.electronAPI!.k8s.replicaSets(ns);
        return r.success ? mapResources(kind, r.replicaSets || []) : [];
      }
      case "statefulsets": {
        const r = await window.electronAPI!.k8s.statefulSets(ns);
        return r.success ? mapResources(kind, r.statefulSets || []) : [];
      }
      case "daemonsets": {
        const r = await window.electronAPI!.k8s.daemonSets(ns);
        return r.success ? mapResources(kind, r.daemonSets || []) : [];
      }
      case "jobs": {
        const r = await window.electronAPI!.k8s.jobs(ns);
        return r.success ? mapResources(kind, r.jobs || []) : [];
      }
      case "cronjobs": {
        const r = await window.electronAPI!.k8s.cronJobs(ns);
        return r.success ? mapResources(kind, r.cronJobs || []) : [];
      }
      case "services": {
        const r = await window.electronAPI!.k8s.services(ns);
        return r.success ? mapResources(kind, r.services || []) : [];
      }
      case "ingresses": {
        const r = await window.electronAPI!.k8s.ingresses(ns);
        return r.success ? mapResources(kind, r.ingresses || []) : [];
      }
      case "configmaps": {
        const r = await window.electronAPI!.k8s.configMaps(ns);
        return r.success ? mapResources(kind, r.configMaps || []) : [];
      }
      case "secrets": {
        const r = await window.electronAPI!.k8s.secrets(ns);
        return r.success ? mapResources(kind, r.secrets || []) : [];
      }
      case "namespaces": {
        const r = await window.electronAPI!.k8s.namespaces();
        return r.success ? mapResources(kind, r.namespaces || []) : [];
      }
      default:
        return [];
    }
  };

  try {
    return await load();
  } catch {
    return [];
  }
}

export function K8sLensView() {
  const [clusters, setClusters] = useState<K8sClusterProfile[]>([]);
  const [activeClusterId, setActiveClusterId] = useState<string | null>(null);
  const [contexts, setContexts] = useState<string[]>([]);
  const [currentContext, setCurrentContext] = useState("");
  const [namespaces, setNamespaces] = useState<Namespace[]>([]);
  const [selectedNamespace, setSelectedNamespace] = useState("default");
  const [activeKind, setActiveKind] = useState<K8sResourceKind>("pods");
  const [rows, setRows] = useState<K8sResourceRow[]>([]);
  const [selectedRow, setSelectedRow] = useState<K8sResourceRow | null>(null);
  const [tableFilter, setTableFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showClusterPanel, setShowClusterPanel] = useState(false);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [graph, setGraph] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [searchImage, setSearchImage] = useState("");
  const [searchEnv, setSearchEnv] = useState("");
  const [searchLabel, setSearchLabel] = useState("");
  const [searchResults, setSearchResults] = useState<any>(null);
  const [podDockTab, setPodDockTab] = useState<PodDockTab | null>(null);
  const [podDockTarget, setPodDockTarget] = useState<PodDockTarget | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const applyAuthResult = (auth?: {
    success?: boolean;
    required?: boolean;
    openedUrls?: string[];
    error?: string;
  }) => {
    if (!auth?.required) {
      setAuthMessage(null);
      return true;
    }
    if (auth.success) {
      setAuthMessage(
        auth.openedUrls?.length
          ? "Signed in. Cluster connection updated."
          : null,
      );
      return true;
    }
    if (auth.openedUrls?.length) {
      setAuthMessage("Browser opened for OIDC sign-in. Complete login, then click Sign in again.");
    } else {
      setAuthMessage(auth.error || "OIDC sign-in required for this context.");
    }
    return false;
  };

  const handleAuthenticate = async () => {
    if (!window.electronAPI) return;
    setAuthLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.k8s.authenticate();
      if (result.auth) {
        const ok = applyAuthResult(result.auth);
        if (ok) {
          await loadNamespaces();
          await loadResources();
        }
      } else if (!result.success) {
        setAuthMessage(result.error || "OIDC authentication failed.");
      }
    } catch (err) {
      setAuthMessage(err instanceof Error ? err.message : "OIDC authentication failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const closePodDock = () => {
    setPodDockTab(null);
    setPodDockTarget(null);
  };

  const openPodDock = (target: PodDockTarget, tab: PodDockTab) => {
    setPodDockTarget(target);
    setPodDockTab(tab);
  };

  const loadClusters = useCallback(async () => {
    if (!window.electronAPI) return;
    const result = await window.electronAPI.k8s.clusters.list();
    if (result.success) {
      const clusterList = result.clusters || [];
      setClusters(clusterList);
      setActiveClusterId(result.activeClusterId ?? null);
      const active = clusterList.find((c) => c.id === result.activeClusterId);
      if (active?.defaultNamespace) {
        setSelectedNamespace(active.defaultNamespace);
      }
    }
  }, []);

  const loadContexts = useCallback(async () => {
    if (!window.electronAPI) return;
    const result = await window.electronAPI.k8s.contexts();
    if (result.success) setContexts(result.contexts || []);
  }, []);

  const loadCurrentContext = useCallback(async () => {
    if (!window.electronAPI) return;
    const result = await window.electronAPI.k8s.currentContext();
    if (result.success) setCurrentContext(result.context || "");
  }, []);

  const loadNamespaces = useCallback(async () => {
    if (!window.electronAPI) return;
    const result = await window.electronAPI.k8s.namespaces();
    if (result.success) setNamespaces(result.namespaces || []);
  }, []);

  const loadResources = useCallback(async () => {
    if (!window.electronAPI) return;
    setLoading(true);
    setError(null);
    try {
      if (isIntelligenceView(activeKind)) {
        const ns = selectedNamespace === ALL_NAMESPACES ? "default" : selectedNamespace;
        if (activeKind === "timeline") {
          const r = await window.electronAPI.k8s.timeline(ns);
          if (r.success) setTimeline(r.timeline || []);
        } else if (activeKind === "dependency-graph") {
          const r = await window.electronAPI.k8s.dependencyGraph(ns);
          if (r.success) setGraph(r.graph);
        } else if (activeKind === "events") {
          const nsParam = selectedNamespace === ALL_NAMESPACES ? undefined : selectedNamespace;
          const r = await window.electronAPI.k8s.events(nsParam);
          if (r.success) setEvents(r.events || []);
        }
        setRows([]);
      } else {
        const data = await fetchResources(activeKind, selectedNamespace);
        setRows(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load resources");
    } finally {
      setLoading(false);
    }
  }, [activeKind, selectedNamespace]);

  useEffect(() => {
    if (!window.electronAPI) return;
    loadClusters().then(() => {
      loadContexts();
      loadCurrentContext();
      loadNamespaces();
    });
  }, [loadClusters, loadContexts, loadCurrentContext, loadNamespaces]);

  useEffect(() => {
    if (selectedNamespace === ALL_NAMESPACES || namespaces.length === 0) return;
    const exists = namespaces.some(
      (ns) => ns.metadata.name === selectedNamespace,
    );
    if (!exists) {
      setSelectedNamespace("default");
    }
  }, [namespaces, selectedNamespace]);

  useEffect(() => {
    setSelectedRow(null);
    closePodDock();
    loadResources();
    if (!isIntelligenceView(activeKind)) {
      const interval = setInterval(loadResources, 8000);
      return () => clearInterval(interval);
    }
  }, [activeKind, selectedNamespace, loadResources]);

  const handleClusterChange = async (clusterId: string) => {
    if (!window.electronAPI || clusterId === activeClusterId) return;
    setAuthLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.k8s.clusters.activate(clusterId);
      if (result.cluster) {
        setActiveClusterId(clusterId);
        setCurrentContext(result.cluster.context);
        setSelectedNamespace(result.cluster.defaultNamespace ?? "default");
        setClusters((prev) =>
          prev.map((c) => (c.id === clusterId ? result.cluster! : c)),
        );
        await loadContexts();
        if (result.auth) {
          const ok = applyAuthResult(result.auth);
          if (ok) {
            await loadNamespaces();
          }
        } else {
          await loadNamespaces();
        }
        setSelectedRow(null);
        closePodDock();
      } else {
        setError(result.error || "Failed to switch cluster");
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleNamespaceChange = async (namespace: string) => {
    setSelectedNamespace(namespace);
    setSelectedRow(null);
    closePodDock();

    if (!window.electronAPI || !activeClusterId) return;

    const result = await window.electronAPI.k8s.clusters.update({
      id: activeClusterId,
      defaultNamespace: namespace,
    });
    if (result.success && result.cluster) {
      setClusters((prev) =>
        prev.map((c) => (c.id === activeClusterId ? result.cluster! : c)),
      );
    }
  };

  const handleContextChange = async (context: string) => {
    if (!window.electronAPI) return;
    setAuthLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.k8s.useContext(context);
      if (result.success) {
        setCurrentContext(context);
        if (activeClusterId) {
          await window.electronAPI.k8s.clusters.update({ id: activeClusterId, context });
        }
        applyAuthResult(result.auth);
        await loadNamespaces();
        setSelectedRow(null);
        closePodDock();
      } else {
        applyAuthResult(result.auth);
        if (!result.auth?.openedUrls?.length) {
          setError(result.error || result.auth?.error || "Failed to switch context");
        }
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!window.electronAPI) return;
    const ns = selectedNamespace === ALL_NAMESPACES ? undefined : selectedNamespace;
    const result = await window.electronAPI.k8s.search({
      image: searchImage || undefined,
      envVar: searchEnv || undefined,
      labelSelector: searchLabel || undefined,
      namespace: ns,
    });
    if (result.success) setSearchResults(result.results);
  };

  const handleNavSelect = (kind: K8sResourceKind) => {
    setActiveKind(kind);
    setSelectedRow(null);
    closePodDock();
    setTableFilter("");
  };

  const handlePodRestarted = async (result: {
    deletedPodName: string;
    replacementPodName?: string;
    message: string;
  }) => {
    const data = await fetchResources("pods", selectedNamespace);
    setRows(data);
    if (result.replacementPodName) {
      const replacement = data.find(
        (row) =>
          row.kind === "pods" &&
          row.name === result.replacementPodName &&
          row.namespace === selectedRow?.namespace,
      );
      if (replacement) {
        setSelectedRow(replacement);
        setPodDockTarget((prev) =>
          prev?.name === result.deletedPodName && prev.namespace === selectedRow?.namespace
            ? { name: result.replacementPodName!, namespace: replacement.namespace! }
            : prev,
        );
        return;
      }
    }
    setSelectedRow(null);
    setPodDockTarget((prev) => {
      if (prev?.name === result.deletedPodName && prev.namespace === selectedRow?.namespace) {
        setPodDockTab(null);
        return null;
      }
      return prev;
    });
  };

  const handleOpenPodDock = (tab: PodDockTab) => {
    if (selectedRow?.kind === "pods" && selectedRow.namespace) {
      openPodDock({ name: selectedRow.name, namespace: selectedRow.namespace }, tab);
    }
  };

  const handlePodDockFromTable = (row: K8sResourceRow, tab: PodDockTab) => {
    if (!row.namespace) return;
    setSelectedRow(row);
    openPodDock({ name: row.name, namespace: row.namespace }, tab);
  };

  const handleSelectRow = (row: K8sResourceRow) => {
    setSelectedRow(row);
    if (row.kind !== "pods") {
      closePodDock();
    }
  };

  if (!window.electronAPI) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--color-text-secondary)]">
        Kubernetes is only available in the Electron desktop app.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[var(--color-background)]">
      {/* Cluster toolbar */}
      <div className="px-3 py-1.5 border-b border-[var(--color-border)] bg-[var(--color-card)] flex items-center gap-2 flex-shrink-0 flex-wrap text-xs">
        <select
          value={activeClusterId || ""}
          onChange={(e) => handleClusterChange(e.target.value)}
          className="input-field !h-7 !py-0 !text-xs max-w-[140px]"
          title="Cluster profile"
        >
          {clusters.length === 0 ? (
            <option value="">No clusters</option>
          ) : (
            clusters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))
          )}
        </select>
        <select
          value={currentContext}
          onChange={(e) => handleContextChange(e.target.value)}
          className="input-field !h-7 !py-0 !text-xs max-w-[160px]"
          title="Kube context"
        >
          {contexts.map((ctx) => (
            <option key={ctx} value={ctx}>
              {ctx}
            </option>
          ))}
        </select>
        <select
          value={selectedNamespace}
          onChange={(e) => handleNamespaceChange(e.target.value)}
          className="input-field !h-7 !py-0 !text-xs max-w-[130px]"
          title="Namespace"
        >
          <option value={ALL_NAMESPACES}>All ns</option>
          {namespaces.map((ns) => (
            <option key={ns.metadata.name} value={ns.metadata.name}>
              {ns.metadata.name}
            </option>
          ))}
        </select>
        <div className="flex-1" />
        {authMessage && (
          <span className="text-[11px] text-[var(--color-text-secondary)] max-w-[280px] truncate" title={authMessage}>
            {authMessage}
          </span>
        )}
        {(authMessage || authLoading) && (
          <button
            onClick={handleAuthenticate}
            disabled={authLoading}
            className="btn-secondary !h-7 !py-0 !px-2 !text-xs"
            title="Complete OIDC sign-in"
          >
            {authLoading ? "Signing in..." : "Sign in"}
          </button>
        )}
        <button
          onClick={() => setShowClusterPanel(true)}
          className="btn-secondary !h-7 !py-0 !px-2 !text-xs"
          title="Manage clusters"
        >
          Clusters
        </button>
      </div>

      {error && (
        <div className="px-4 py-2 text-sm text-[var(--color-semantic-error)] border-b border-[var(--color-border)] bg-[var(--color-card)]">
          {error}
        </div>
      )}

      <div className="flex-1 flex overflow-hidden min-h-0">
        <K8sNavigator activeKind={activeKind} onSelect={handleNavSelect} />

        {isIntelligenceView(activeKind) ? (
          <K8sIntelligencePanel
            kind={activeKind}
            namespace={selectedNamespace}
            timeline={timeline}
            graph={graph}
            events={events}
            searchImage={searchImage}
            searchEnv={searchEnv}
            searchLabel={searchLabel}
            searchResults={searchResults}
            onSearchImageChange={setSearchImage}
            onSearchEnvChange={setSearchEnv}
            onSearchLabelChange={setSearchLabel}
            onSearch={handleSearch}
          />
        ) : (
          <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
            <div className="flex-1 flex min-h-0 overflow-hidden">
              <K8sResourceTable
                kind={activeKind}
                rows={rows}
                selectedId={selectedRow?.id ?? null}
                loading={loading}
                filter={tableFilter}
                onFilterChange={setTableFilter}
                onSelect={handleSelectRow}
                onRefresh={loadResources}
                onPodDockOpen={activeKind === "pods" ? handlePodDockFromTable : undefined}
                activePodDockTab={podDockTab}
                activePodDockTargetId={podDockTargetId(podDockTarget)}
                hideNamespace={selectedNamespace !== ALL_NAMESPACES}
              />
              {selectedRow?.kind === "pods" && selectedRow.namespace && (
                <K8sPodDetail
                  name={selectedRow.name}
                  namespace={selectedRow.namespace}
                  onClose={() => setSelectedRow(null)}
                  onPodRestarted={handlePodRestarted}
                  onOpenDockPanel={handleOpenPodDock}
                  activeDockTab={
                    podDockTarget?.name === selectedRow.name &&
                    podDockTarget?.namespace === selectedRow.namespace
                      ? podDockTab
                      : null
                  }
                />
              )}
              {selectedRow && selectedRow.kind !== "pods" && (
                <K8sResourceDetail
                  row={selectedRow}
                  onClose={() => setSelectedRow(null)}
                  onRefresh={loadResources}
                />
              )}
            </div>
            {activeKind === "pods" && podDockTab && podDockTarget && (
              <K8sPodBottomPanel
                name={podDockTarget.name}
                namespace={podDockTarget.namespace}
                activeTab={podDockTab}
                onTabChange={setPodDockTab}
                onClose={closePodDock}
              />
            )}
          </div>
        )}
      </div>

      <K8sClusterPanel
        isOpen={showClusterPanel}
        onClose={() => setShowClusterPanel(false)}
        onClustersChanged={async () => {
          await loadClusters();
          await loadContexts();
          await loadCurrentContext();
          await loadNamespaces();
          await loadResources();
        }}
      />
    </div>
  );
}
