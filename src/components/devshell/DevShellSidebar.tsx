import { useMemo, useState } from "react";
import type { DevShellTab } from "../../state/devShellStore";
import { devShellKindLabel } from "../../utils/devShell";
import { getTerminalSessionDetails } from "../../utils/terminalScope";
import { Icon } from "../Icon";
import {
  ToolSidebar,
  ToolSidebarBody,
  ToolSidebarHeader,
  UnderlineTabs,
} from "../ui/ToolChrome";

interface DevShellSidebarProps {
  activeTab: DevShellTab;
  commands: { command: string; timestamp: string }[];
  sessions: {
    id: string;
    title: string;
    scope: string;
    lastActiveAt: string;
    closedAt?: string;
  }[];
  historyTab: "commands" | "sessions";
  onTabChange: (tab: "commands" | "sessions") => void;
  onRunCommand: (command: string) => void;
  onRestoreSession: (sessionId: string) => void;
  onClearCommands: () => void;
  onRemoveSession: (sessionId: string) => void;
  onNewLocalTab: () => void;
  onRestartTab: () => void;
  onClose: () => void;
}

async function copyText(value: string | undefined) {
  if (!value) return;
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    /* ignore */
  }
}

function SessionContextCard({ tab }: { tab: DevShellTab }) {
  const details = getTerminalSessionDetails(tab.config);

  return (
    <div className={`devshell-context devshell-context--${tab.config.kind}`}>
      <div className="devshell-context__header">
        <span className="devshell-context__kind">{devShellKindLabel(tab.config.kind)}</span>
        <span className="devshell-context__label">Active session</span>
      </div>
      <div className="devshell-context__title truncate" title={tab.title}>
        {tab.title}
      </div>
      <dl className="devshell-context__details">
        {details.map((detail) => (
          <div key={detail.label} className="devshell-context__row">
            <dt>{detail.label}</dt>
            <dd className="truncate" title={detail.value}>
              {detail.value}
            </dd>
            {detail.copyValue ? (
              <button
                type="button"
                className="devshell-context__copy"
                title={`Copy ${detail.label.toLowerCase()}`}
                onClick={() => void copyText(detail.copyValue)}
              >
                <Icon name="Copy" className="w-3 h-3" />
              </button>
            ) : null}
          </div>
        ))}
      </dl>
    </div>
  );
}

export function DevShellSidebar({
  activeTab,
  commands,
  sessions,
  historyTab,
  onTabChange,
  onRunCommand,
  onRestoreSession,
  onClearCommands,
  onRemoveSession,
  onNewLocalTab,
  onRestartTab,
  onClose,
}: DevShellSidebarProps) {
  const [query, setQuery] = useState("");

  const filteredCommands = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return commands;
    return commands.filter((entry) => entry.command.toLowerCase().includes(normalized));
  }, [commands, query]);

  const openSessions = sessions.filter((session) => !session.closedAt);
  const closedSessions = sessions.filter((session) => session.closedAt);

  return (
    <ToolSidebar
      width="wide"
      aria-label="DevShell session panel"
      id="devshell-session-panel"
      className="devshell-sidebar border-r border-[var(--color-border)] bg-[var(--color-background-soft)]"
    >
      <ToolSidebarHeader
        title="Session panel"
        actions={
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-muted)]"
            title="Hide panel"
          >
            <Icon name="ChevronLeft" className="w-3.5 h-3.5" />
          </button>
        }
      />

      <ToolSidebarBody className="px-2 pb-2 space-y-3">
        <SessionContextCard tab={activeTab} />

        <div className="devshell-quick-actions">
          <button type="button" onClick={onNewLocalTab} className="devshell-quick-actions__btn">
            <Icon name="Plus" className="w-3 h-3" />
            New local
          </button>
          <button type="button" onClick={onRestartTab} className="devshell-quick-actions__btn">
            <Icon name="RefreshCw" className="w-3 h-3" />
            Restart
          </button>
        </div>

        <div className="devshell-sidebar-search">
          <Icon name="Search" className="w-3.5 h-3.5 shrink-0 text-[var(--color-text-tertiary)]" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={historyTab === "commands" ? "Filter commands…" : "Filter sessions…"}
            className="devshell-sidebar-search__input"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
              title="Clear search"
            >
              <Icon name="X" className="w-3 h-3" />
            </button>
          ) : null}
        </div>

        <UnderlineTabs
          tabs={[
            { id: "commands" as const, label: `Commands (${commands.length})` },
            { id: "sessions" as const, label: `Sessions (${sessions.length})` },
          ]}
          active={historyTab}
          onChange={onTabChange}
        />

        {historyTab === "commands" && commands.length > 0 && (
          <div className="flex justify-end -mt-1">
            <button
              type="button"
              onClick={onClearCommands}
              className="text-[10px] text-[var(--color-text-tertiary)] hover:text-[var(--color-semantic-error)]"
            >
              Clear scope history
            </button>
          </div>
        )}

        <div className="devshell-sidebar-list custom-scrollbar">
          {historyTab === "commands" ? (
            filteredCommands.length === 0 ? (
              <div className="devshell-sidebar-empty">
                <Icon name="Terminal" className="w-5 h-5 opacity-40" />
                <p>
                  {query
                    ? "No commands match your filter."
                    : "Run commands in the terminal — they appear here for quick reuse."}
                </p>
              </div>
            ) : (
              <ul>
                {filteredCommands.map((entry) => (
                  <li key={`${entry.timestamp}-${entry.command}`}>
                    <button
                      type="button"
                      onClick={() => onRunCommand(entry.command)}
                      className="devshell-history-item"
                      title={entry.command}
                    >
                      <span className="devshell-history-item__command">{entry.command}</span>
                      <span className="devshell-history-item__meta">
                        {new Date(entry.timestamp).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : sessions.length === 0 ? (
            <div className="devshell-sidebar-empty">
              <Icon name="Clock" className="w-5 h-5 opacity-40" />
              <p>Past sessions are saved here. Click one to reopen it in a tab.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {openSessions.length > 0 && (
                <section>
                  <div className="devshell-sidebar-section-label">Recent</div>
                  <SessionList
                    sessions={openSessions.filter((session) =>
                      matchesSessionQuery(session, query),
                    )}
                    onRestoreSession={onRestoreSession}
                    onRemoveSession={onRemoveSession}
                  />
                </section>
              )}
              {closedSessions.length > 0 && (
                <section>
                  <div className="devshell-sidebar-section-label">Closed</div>
                  <SessionList
                    sessions={closedSessions.filter((session) =>
                      matchesSessionQuery(session, query),
                    )}
                    onRestoreSession={onRestoreSession}
                    onRemoveSession={onRemoveSession}
                  />
                </section>
              )}
            </div>
          )}
        </div>
      </ToolSidebarBody>

      <div className="devshell-sidebar-footer">
        <span>↑↓ command history</span>
        <span>·</span>
        <span>Tab complete</span>
        <span>·</span>
        <span>Click to rerun</span>
      </div>
    </ToolSidebar>
  );
}

function matchesSessionQuery(
  session: { title: string; scope: string },
  query: string,
): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return (
    session.title.toLowerCase().includes(normalized) ||
    session.scope.toLowerCase().includes(normalized)
  );
}

function SessionList({
  sessions,
  onRestoreSession,
  onRemoveSession,
}: {
  sessions: {
    id: string;
    title: string;
    scope: string;
    lastActiveAt: string;
    closedAt?: string;
  }[];
  onRestoreSession: (sessionId: string) => void;
  onRemoveSession: (sessionId: string) => void;
}) {
  if (sessions.length === 0) {
    return (
      <p className="px-2 py-2 text-[11px] text-[var(--color-text-tertiary)]">
        No sessions match your filter.
      </p>
    );
  }

  return (
    <ul>
      {sessions.map((session) => (
        <li key={session.id} className="flex items-stretch gap-0.5">
          <button
            type="button"
            onClick={() => onRestoreSession(session.id)}
            className="devshell-history-item flex-1 min-w-0 text-left"
          >
            <span className="devshell-history-item__command font-sans font-medium truncate">
              {session.title}
            </span>
            <span className="devshell-history-item__meta truncate">{session.scope}</span>
            <span className="devshell-history-item__meta">
              {new Date(session.lastActiveAt).toLocaleString([], {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
              {session.closedAt ? " · closed" : " · active"}
            </span>
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onRemoveSession(session.id);
            }}
            className="shrink-0 self-center p-1.5 mr-0.5 rounded text-[var(--color-text-tertiary)] hover:text-[var(--color-semantic-error)] hover:bg-[var(--color-muted)]"
            title="Remove from history"
            aria-label={`Remove ${session.title} from history`}
          >
            <Icon name="X" className="w-3 h-3" />
          </button>
        </li>
      ))}
    </ul>
  );
}
