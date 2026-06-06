import { K8sResourceKind, K8sResourceRow } from "./types";
import { TABLE_COLUMNS, statusBadgeClass } from "./utils";

interface K8sResourceTableProps {
  kind: K8sResourceKind;
  rows: K8sResourceRow[];
  selectedId: string | null;
  loading: boolean;
  filter: string;
  onFilterChange: (value: string) => void;
  onSelect: (row: K8sResourceRow) => void;
  onRefresh: () => void;
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
}: K8sResourceTableProps) {
  const columns = TABLE_COLUMNS[kind] || [];
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
      <div className="px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-card)] flex items-center gap-3">
        <input
          value={filter}
          onChange={(e) => onFilterChange(e.target.value)}
          placeholder="Filter resources..."
          className="input-field flex-1 !h-8 !py-1 !text-sm"
        />
        <button onClick={onRefresh} className="btn-secondary !h-8 !py-1 !px-3 !text-xs">
          Refresh
        </button>
        <span className="text-xs text-[var(--color-text-tertiary)] whitespace-nowrap">
          {filtered.length} items
        </span>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar">
        {loading ? (
          <div className="p-8 text-center text-sm text-[var(--color-text-secondary)]">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-[var(--color-text-tertiary)]">No resources found</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[var(--color-background-soft)] border-b border-[var(--color-border)]">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.label}
                    className="text-left px-4 py-2 text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wide"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr
                  key={row.id}
                  onClick={() => onSelect(row)}
                  className={`border-b border-[var(--color-border)] cursor-pointer transition-colors ${
                    selectedId === row.id
                      ? "bg-[var(--color-primary)]/10"
                      : "hover:bg-[var(--color-muted)]"
                  }`}
                >
                  {columns.map((col) => {
                    const value =
                      col.key === "info"
                        ? row.info
                        : String(row[col.key as keyof K8sResourceRow] ?? "—");
                    return (
                      <td key={col.label} className="px-4 py-2.5 text-[var(--color-text-primary)]">
                        {col.key === "status" ? (
                          <span className={statusBadgeClass(value)}>{value}</span>
                        ) : (
                          <span className={col.key === "name" ? "font-medium" : ""}>{value}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
