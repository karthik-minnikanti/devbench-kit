import { K8sResourceKind, K8sResourceRow } from "./types";
import { TABLE_COLUMNS, statusBadgeClass } from "./utils";
import { Icon } from "../Icon";
import { PodDockTab } from "./K8sPodBottomPanel";

interface K8sResourceTableProps {
  kind: K8sResourceKind;
  rows: K8sResourceRow[];
  selectedId: string | null;
  loading: boolean;
  filter: string;
  onFilterChange: (value: string) => void;
  onSelect: (row: K8sResourceRow) => void;
  onRefresh: () => void;
  onPodDockOpen?: (row: K8sResourceRow, tab: PodDockTab) => void;
  activePodDockTab?: PodDockTab | null;
  activePodDockTargetId?: string | null;
  hideNamespace?: boolean;
}

export function K8sResourceTable({
  kind,
  rows,
  selectedId,
  loading,
  filter,
  onFilterChange,
  onSelect,
  onRefresh,
  onPodDockOpen,
  activePodDockTab,
  activePodDockTargetId,
  hideNamespace = false,
}: K8sResourceTableProps) {
  const columns = (TABLE_COLUMNS[kind] || []).filter(
    (col) => !(hideNamespace && col.key === "namespace"),
  );
  const filtered = rows.filter((row) => {
    if (!filter.trim()) return true;
    const q = filter.toLowerCase();
    return (
      row.name.toLowerCase().includes(q) ||
      row.namespace?.toLowerCase().includes(q) ||
      row.status.toLowerCase().includes(q) ||
      row.info.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
      <div className="px-3 py-1.5 border-b border-[var(--color-border)] bg-[var(--color-card)] flex items-center gap-2">
        <input
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          placeholder="Filter…"
          className="input-field flex-1 !h-7 !py-0 !text-xs font-mono"
        />
        <button
          onClick={onRefresh}
          className="btn-secondary !h-7 !w-7 !p-0 inline-flex items-center justify-center"
          title="Refresh"
        >
          <Icon name="RefreshCw" className="w-3.5 h-3.5" />
        </button>
        <span className="text-[10px] text-[var(--color-text-tertiary)] tabular-nums">
          {filtered.length}
        </span>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar">
        {loading ? (
          <div className="p-6 text-center text-xs text-[var(--color-text-secondary)]">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-xs text-[var(--color-text-tertiary)]">No resources</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-[var(--color-background-soft)] border-b border-[var(--color-border)] z-10">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.label}
                    className="text-left px-3 py-1.5 font-medium text-[var(--color-text-tertiary)]"
                  >
                    {col.label}
                  </th>
                ))}
                {kind === "pods" && onPodDockOpen && <th className="w-16" />}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const rowDockId = row.namespace ? `${row.namespace}/${row.name}` : null;
                const isDockTarget = rowDockId === activePodDockTargetId;
                return (
                  <tr
                    key={row.id}
                    onClick={() => onSelect(row)}
                    className={`group border-b border-[var(--color-border)] cursor-pointer transition-colors ${
                      selectedId === row.id
                        ? "bg-[var(--color-primary)]/8"
                        : "hover:bg-[var(--color-muted)]/50"
                    }`}
                  >
                    {columns.map((col) => {
                      const value =
                        col.key === "info"
                          ? row.info
                          : String(row[col.key as keyof K8sResourceRow] ?? "—");
                      return (
                        <td key={col.label} className="px-3 py-1.5 text-[var(--color-text-primary)]">
                          {col.key === "status" ? (
                            <span className={statusBadgeClass(value)}>{value}</span>
                          ) : col.key === "name" ? (
                            <span className="font-mono font-medium truncate block max-w-[280px]">
                              {value}
                            </span>
                          ) : col.key === "info" ? (
                            <span className="text-[var(--color-text-secondary)] truncate block max-w-[200px]">
                              {value}
                            </span>
                          ) : (
                            <span className="tabular-nums">{value}</span>
                          )}
                        </td>
                      );
                    })}
                    {kind === "pods" && onPodDockOpen && (
                      <td className="px-2 py-1.5">
                        <div
                          className={`inline-flex items-center gap-0.5 transition-opacity ${
                            isDockTarget ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                          }`}
                        >
                          <button
                            type="button"
                            title="Logs"
                            onClick={(e) => {
                              e.stopPropagation();
                              onPodDockOpen(row, "logs");
                            }}
                            className={`p-1 rounded transition-colors ${
                              isDockTarget && activePodDockTab === "logs"
                                ? "text-[var(--color-primary)] bg-[var(--color-primary)]/10"
                                : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-muted)]"
                            }`}
                          >
                            <Icon name="FileText" className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            title="DevShell"
                            onClick={(e) => {
                              e.stopPropagation();
                              onPodDockOpen(row, "terminal");
                            }}
                            className={`p-1 rounded transition-colors ${
                              isDockTarget && activePodDockTab === "terminal"
                                ? "text-[var(--color-primary)] bg-[var(--color-primary)]/10"
                                : "text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-muted)]"
                            }`}
                          >
                            <Icon name="Terminal" className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
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
