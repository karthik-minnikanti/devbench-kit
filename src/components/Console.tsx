import { useEffect, useRef } from 'react';
import { Icon } from './Icon';

export interface ConsoleLog {
  id: string;
  type: 'log' | 'error' | 'warn' | 'info' | 'request' | 'response';
  message: string;
  timestamp: string;
  data?: any;
}

interface ConsoleProps {
  isOpen: boolean;
  onClose: () => void;
  logs: ConsoleLog[];
  onClear: () => void;
}

export function Console({ isOpen, onClose, logs, onClear }: ConsoleProps) {
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isOpen]);

  if (!isOpen) return null;

  const getLogIcon = (type: ConsoleLog['type']) => {
    switch (type) {
      case 'error':
        return <Icon name="AlertCircle" className="w-4 h-4 text-red-500" />;
      case 'warn':
        return <Icon name="AlertTriangle" className="w-4 h-4 text-yellow-500" />;
      case 'info':
        return <Icon name="Info" className="w-4 h-4 text-blue-500" />;
      case 'request':
        return <Icon name="Send" className="w-4 h-4 text-[var(--color-primary)]" />;
      case 'response':
        return <Icon name="Check" className="w-4 h-4 text-green-500" />;
      default:
        return <Icon name="FileText" className="w-4 h-4 text-[var(--color-text-secondary)]" />;
    }
  };

  const getLogColor = (type: ConsoleLog['type']) => {
    switch (type) {
      case 'error':
        return 'text-red-500 bg-red-50 dark:bg-red-900/20';
      case 'warn':
        return 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20';
      case 'info':
        return 'text-blue-500 bg-blue-50 dark:bg-blue-900/20';
      case 'request':
        return 'text-[var(--color-primary)] bg-[var(--color-primary)]/10';
      case 'response':
        return 'text-green-500 bg-green-50 dark:bg-green-900/20';
      default:
        return 'text-[var(--color-text-primary)]';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-[var(--color-background)] rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Console</h2>
          <div className="flex items-center gap-2">
            {logs.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
                className="px-3 py-1.5 rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] text-xs hover:bg-[var(--color-muted)] transition-colors"
              >
                Clear
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

        <div className="flex-1 overflow-y-auto p-4 font-mono text-xs">
          {logs.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Icon name="Terminal" className="w-16 h-16 text-[var(--color-text-tertiary)] mx-auto mb-4 opacity-50" />
                <p className="text-sm text-[var(--color-text-secondary)]">Console is empty</p>
                <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                  Script logs and request details will appear here
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className={`p-2 rounded ${getLogColor(log.type)} flex items-start gap-2`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {getLogIcon(log.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] text-[var(--color-text-tertiary)]">
                        {formatTimestamp(log.timestamp)}
                      </span>
                      <span className="text-[10px] font-semibold uppercase">
                        {log.type}
                      </span>
                    </div>
                    <div className="break-words whitespace-pre-wrap">
                      {log.message}
                    </div>
                    {log.data && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]">
                          View data
                        </summary>
                        <pre className="mt-2 p-2 rounded bg-[var(--color-sidebar)] overflow-x-auto">
                          {JSON.stringify(log.data, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

