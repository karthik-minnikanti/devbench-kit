import { useState } from 'react';
import { Icon } from './Icon';

export interface HistoryEntry {
  id: string;
  method: string;
  url: string;
  status?: number;
  statusText?: string;
  time: number;
  timestamp: string;
  requestName?: string;
}

interface RequestHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryEntry[];
  onSelectRequest: (entry: HistoryEntry) => void;
  onClearHistory: () => void;
}

export function RequestHistory({
  isOpen,
  onClose,
  history,
  onSelectRequest,
  onClearHistory,
}: RequestHistoryProps) {
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const filteredHistory = history.filter((entry) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      entry.method.toLowerCase().includes(query) ||
      entry.url.toLowerCase().includes(query) ||
      entry.requestName?.toLowerCase().includes(query) ||
      entry.status?.toString().includes(query)
    );
  });

  const getStatusColor = (status?: number) => {
    if (!status) return 'text-gray-500';
    if (status >= 200 && status < 300) return 'text-green-500';
    if (status >= 400) return 'text-red-500';
    return 'text-yellow-500';
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[var(--color-background)] rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Request History</h2>
          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('Clear all history?')) {
                    onClearHistory();
                  }
                }}
                className="px-3 py-1.5 rounded border border-red-500 text-red-500 text-xs hover:bg-red-500/10 transition-colors"
              >
                Clear All
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-[var(--color-muted)] transition-colors"
            >
              <Icon name="X" className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 border-b border-[var(--color-border)]">
          <div className="relative">
            <Icon name="Search" className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--color-text-tertiary)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search history..."
              className="w-full pl-10 pr-4 py-2 rounded border border-[var(--color-border)] bg-[var(--color-sidebar)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredHistory.length === 0 ? (
            <div className="flex items-center justify-center h-full p-8">
              <div className="text-center">
                <Icon name="Clock" className="w-16 h-16 text-[var(--color-text-tertiary)] mx-auto mb-4 opacity-50" />
                <p className="text-sm text-[var(--color-text-secondary)] mb-2">
                  {searchQuery ? 'No matching requests' : 'No history yet'}
                </p>
                <p className="text-xs text-[var(--color-text-tertiary)]">
                  {searchQuery ? 'Try a different search term' : 'Your request history will appear here'}
                </p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-border)]">
              {filteredHistory.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => {
                    onSelectRequest(entry);
                    onClose();
                  }}
                  className="w-full px-6 py-4 text-left hover:bg-[var(--color-muted)] transition-colors group"
                >
                  <div className="flex items-start gap-4">
                    <div className={`px-2 py-1 rounded text-xs font-semibold ${
                      entry.method === 'GET' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                      entry.method === 'POST' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                      entry.method === 'PUT' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                      entry.method === 'DELETE' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                      'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
                    }`}>
                      {entry.method}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                          {entry.requestName || entry.url}
                        </p>
                        {entry.status && (
                          <span className={`text-xs font-semibold ${getStatusColor(entry.status)}`}>
                            {entry.status} {entry.statusText}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--color-text-secondary)] truncate mb-1">
                        {entry.url}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-[var(--color-text-tertiary)]">
                        <span>{formatTime(entry.timestamp)}</span>
                        {entry.time && <span>{entry.time}ms</span>}
                      </div>
                    </div>
                    <Icon name="ChevronRight" className="w-5 h-5 text-[var(--color-text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

