import { useEffect, useState } from "react";

interface K8sClusterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onClustersChanged: () => void;
}

export function K8sClusterPanel({
  isOpen,
  onClose,
  onClustersChanged,
}: K8sClusterPanelProps) {
  const [clusters, setClusters] = useState<K8sClusterProfile[]>([]);
  const [activeClusterId, setActiveClusterId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [configPath, setConfigPath] = useState("");
  const [contexts, setContexts] = useState<string[]>([]);
  const [selectedContext, setSelectedContext] = useState("");
  const [defaultNamespace, setDefaultNamespace] = useState("default");

  const loadClusters = async () => {
    if (!window.electronAPI) return;
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.k8s.clusters.list();
      if (result.success) {
        setClusters(result.clusters || []);
        setActiveClusterId(result.activeClusterId ?? null);
      } else {
        setError(result.error || "Failed to load clusters");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load clusters");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadClusters();
    }
  }, [isOpen]);

  const handleBrowseKubeconfig = async () => {
    if (!window.electronAPI) return;
    setError(null);
    const result = await window.electronAPI.k8s.pickKubeconfig();
    if (result.canceled) return;
    if (!result.success || !result.filePath) {
      setError(result.error || "Failed to pick kubeconfig");
      return;
    }
    setConfigPath(result.filePath);
    setContexts(result.contexts || []);
    const ctx = result.defaultContext || result.contexts?.[0] || "";
    setSelectedContext(ctx);
    if (!name.trim()) {
      const baseName =
        result.filePath
          .split(/[/\\]/)
          .pop()
          ?.replace(/\.(yaml|yml|conf|config)$/i, "") || ctx;
      setName(baseName);
    }
  };

  const handleAddCluster = async () => {
    if (!window.electronAPI || !configPath || !selectedContext) return;
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.k8s.clusters.add({
        name: name.trim() || selectedContext,
        configPath,
        context: selectedContext,
        defaultNamespace: defaultNamespace.trim() || undefined,
      });
      if (result.success) {
        setName("");
        setConfigPath("");
        setContexts([]);
        setSelectedContext("");
        setDefaultNamespace("default");
        await loadClusters();
        onClustersChanged();
      } else {
        setError(result.error || "Failed to add cluster");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add cluster");
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (clusterId: string) => {
    if (!window.electronAPI) return;
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.k8s.clusters.activate(clusterId);
      if (result.success) {
        setActiveClusterId(clusterId);
        onClustersChanged();
        onClose();
      } else {
        setError(result.error || "Failed to switch cluster");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to switch cluster");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (clusterId: string) => {
    if (!window.electronAPI) return;
    if (!confirm("Remove this cluster from DevBench?")) return;
    setLoading(true);
    setError(null);
    try {
      const result = await window.electronAPI.k8s.clusters.remove(clusterId);
      if (result.success) {
        await loadClusters();
        onClustersChanged();
      } else {
        setError(result.error || "Failed to remove cluster");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove cluster");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 modal-overlay z-50 flex items-center justify-center p-4">
      <div className="modal-panel w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <div>
            <h3 className="title-md">Manage Clusters</h3>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
              Save multiple kubeconfigs and switch between them quickly.
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn-secondary !h-auto !py-1.5 !px-3 !text-sm"
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-3">
              Saved Clusters
            </div>
            {loading && clusters.length === 0 ? (
              <div className="text-sm text-[var(--color-text-tertiary)]">
                Loading clusters...
              </div>
            ) : clusters.length === 0 ? (
              <div className="text-sm text-[var(--color-text-tertiary)]">
                No clusters saved yet. Add your first cluster below.
              </div>
            ) : (
              <div className="space-y-2">
                {clusters.map((cluster) => (
                  <div
                    key={cluster.id}
                    className={`p-3 rounded-lg border flex items-center justify-between gap-3 ${
                      cluster.id === activeClusterId
                        ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5"
                        : "border-[var(--color-border)]"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                          {cluster.name}
                        </span>
                        {cluster.id === activeClusterId && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-primary)] text-white">
                            Active
                          </span>
                        )}
                        {cluster.sourceType === "system" && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-muted)] text-[var(--color-text-secondary)]">
                            System
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[var(--color-text-tertiary)] mt-1 truncate">
                        Context: {cluster.context}
                        {cluster.defaultNamespace
                          ? ` · NS: ${cluster.defaultNamespace}`
                          : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {cluster.id !== activeClusterId && (
                        <button
                          onClick={() => handleActivate(cluster.id)}
                          className="px-2.5 py-1 rounded text-xs font-medium bg-[var(--color-primary)] text-white hover:opacity-90"
                        >
                          Switch
                        </button>
                      )}
                      <button
                        onClick={() => handleRemove(cluster.id)}
                        className="px-2.5 py-1 rounded text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-[var(--color-border)] pt-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-3">
              Add Cluster
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[var(--color-text-tertiary)] mb-1 block">
                  Display name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Production EKS"
                  className="w-full px-3 py-2 rounded-lg text-sm border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)]"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--color-text-tertiary)] mb-1 block">
                  Kubeconfig file
                </label>
                <div className="flex gap-2">
                  <input
                    value={configPath}
                    readOnly
                    placeholder="Select a kubeconfig file..."
                    className="flex-1 px-3 py-2 rounded-lg text-sm border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)]"
                  />
                  <button
                    onClick={handleBrowseKubeconfig}
                    className="px-3 py-2 rounded-lg text-sm font-medium border border-[var(--color-border)] hover:bg-[var(--color-muted)]"
                  >
                    Browse
                  </button>
                </div>
              </div>
              {contexts.length > 0 && (
                <div>
                  <label className="text-xs text-[var(--color-text-tertiary)] mb-1 block">
                    Context
                  </label>
                  <select
                    value={selectedContext}
                    onChange={(e) => setSelectedContext(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)]"
                  >
                    {contexts.map((ctx) => (
                      <option key={ctx} value={ctx}>
                        {ctx}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs text-[var(--color-text-tertiary)] mb-1 block">
                  Default namespace
                </label>
                <input
                  value={defaultNamespace}
                  onChange={(e) => setDefaultNamespace(e.target.value)}
                  placeholder="default"
                  className="w-full px-3 py-2 rounded-lg text-sm border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)]"
                />
              </div>
              <button
                onClick={handleAddCluster}
                disabled={loading || !configPath || !selectedContext}
                className="w-full px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-primary)] text-white hover:opacity-90 disabled:opacity-50"
              >
                Add Cluster
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
