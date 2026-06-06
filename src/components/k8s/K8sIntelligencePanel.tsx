import { K8sResourceKind } from "./types";
import { formatAge } from "./utils";

interface K8sIntelligencePanelProps {
  kind: K8sResourceKind;
  namespace: string;
  timeline: any[];
  graph: any;
  events: any[];
  searchImage: string;
  searchEnv: string;
  searchLabel: string;
  searchResults: any;
  onSearchImageChange: (v: string) => void;
  onSearchEnvChange: (v: string) => void;
  onSearchLabelChange: (v: string) => void;
  onSearch: () => void;
}

export function K8sIntelligencePanel({
  kind,
  namespace,
  timeline,
  graph,
  events,
  searchImage,
  searchEnv,
  searchLabel,
  searchResults,
  onSearchImageChange,
  onSearchEnvChange,
  onSearchLabelChange,
  onSearch,
}: K8sIntelligencePanelProps) {
  if (kind === "timeline") {
    return (
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        <h2 className="title-sm mb-4">Change Timeline · {namespace === "__all__" ? "All namespaces" : namespace}</h2>
        {timeline.length === 0 ? (
          <div className="text-sm text-[var(--color-text-tertiary)]">No timeline events</div>
        ) : (
          <div className="space-y-4">
            {timeline.slice(0, 100).map((event: any, idx: number) => (
              <div key={idx} className="border-l-2 border-[var(--color-border)] pl-4">
                <div className="text-xs text-[var(--color-text-tertiary)]">
                  {new Date(event.timestamp).toLocaleString()}
                </div>
                <div className="text-sm font-medium text-[var(--color-text-primary)] mt-1">
                  {event.description}
                </div>
                <div className="text-xs text-[var(--color-text-secondary)] mt-1">
                  {event.type} · {event.resource}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (kind === "dependency-graph") {
    return (
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
        <h2 className="title-sm mb-4">Dependency Graph</h2>
        {!graph ? (
          <div className="text-sm text-[var(--color-text-tertiary)]">Loading graph...</div>
        ) : (
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="caption-uppercase mb-2">Nodes ({graph.nodes?.length || 0})</div>
              <div className="space-y-2">
                {(graph.nodes || []).map((node: any, idx: number) => (
                  <div key={idx} className="card p-3 text-xs">
                    <div className="font-medium">{node.name}</div>
                    <div className="text-[var(--color-text-tertiary)]">
                      {node.type} · {node.status}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="caption-uppercase mb-2">Connections ({graph.edges?.length || 0})</div>
              <div className="space-y-1 text-xs text-[var(--color-text-secondary)]">
                {(graph.edges || []).map((edge: any, idx: number) => (
                  <div key={idx}>
                    {edge.from.split("-").pop()} → {edge.to.split("-").pop()} ({edge.type})
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (kind === "events") {
    return (
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="px-6 py-4 border-b border-[var(--color-border)]">
          <h2 className="title-sm">Cluster Events</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-[var(--color-background-soft)] border-b border-[var(--color-border)]">
            <tr>
              {["Type", "Reason", "Object", "Message", "Age"].map((h) => (
                <th key={h} className="text-left px-4 py-2 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {events.map((event: any, idx: number) => (
              <tr key={idx} className="border-b border-[var(--color-border)]">
                <td className="px-4 py-2">{event.type}</td>
                <td className="px-4 py-2">{event.reason}</td>
                <td className="px-4 py-2">{event.source}</td>
                <td className="px-4 py-2 text-[var(--color-text-secondary)]">{event.message}</td>
                <td className="px-4 py-2">{formatAge(event.timestamp?.toString?.() || event.timestamp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <h2 className="title-sm mb-4">Resource Search</h2>
      <div className="grid grid-cols-3 gap-3 mb-4 max-w-3xl">
        <input
          value={searchImage}
          onChange={(e) => onSearchImageChange(e.target.value)}
          placeholder="Image contains..."
          className="input-field !text-sm"
        />
        <input
          value={searchEnv}
          onChange={(e) => onSearchEnvChange(e.target.value)}
          placeholder="Env var..."
          className="input-field !text-sm"
        />
        <input
          value={searchLabel}
          onChange={(e) => onSearchLabelChange(e.target.value)}
          placeholder="labelSelector..."
          className="input-field !text-sm"
        />
      </div>
      <button onClick={onSearch} className="btn-primary !h-9 !text-sm mb-6">
        Search
      </button>
      {searchResults && (
        <div className="space-y-4">
          <div className="caption-uppercase">Pods ({searchResults.pods?.length || 0})</div>
          {(searchResults.pods || []).slice(0, 20).map((pod: any) => (
            <div key={pod.metadata?.uid} className="card p-3 text-sm">
              {pod.metadata?.namespace}/{pod.metadata?.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
