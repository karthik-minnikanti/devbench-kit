import { useCallback, useEffect, useRef, useState } from "react";
import {
  TerminalView,
  type TerminalSessionConfig,
  type TerminalViewHandle,
} from "../TerminalView";
import { DevShellTabBar } from "./DevShellTabBar";
import { DevShellSidebar } from "./DevShellSidebar";
import { DevShellStatusBar, type DevShellSessionStatus } from "./DevShellStatusBar";
import { DevShellWelcome } from "./DevShellWelcome";
import { ensureDevShellInitialized, useDevShellStore } from "../../state/devShellStore";
import { sessionConfigKey } from "../../utils/terminalScope";
import {
  persistDevShellWelcomeSeen,
  readDevShellWelcomeSeen,
} from "../../utils/devShellPreferences";
import { openTool } from "../../utils/appEvents";

export function DevShell() {
  const tabs = useDevShellStore((state) => state.tabs);
  const activeTabId = useDevShellStore((state) => state.activeTabId);
  const showHistory = useDevShellStore((state) => state.showHistory);
  const openSession = useDevShellStore((state) => state.openSession);
  const newLocalTab = useDevShellStore((state) => state.newLocalTab);
  const closeTab = useDevShellStore((state) => state.closeTab);
  const setActiveTab = useDevShellStore((state) => state.setActiveTab);
  const reorderTabs = useDevShellStore((state) => state.reorderTabs);
  const restartTab = useDevShellStore((state) => state.restartTab);
  const renameTabFromFirstCommand = useDevShellStore(
    (state) => state.renameTabFromFirstCommand,
  );
  const dismissHistorySession = useDevShellStore((state) => state.dismissHistorySession);
  const restoreHistorySession = useDevShellStore((state) => state.restoreHistorySession);
  const toggleHistory = useDevShellStore((state) => state.toggleHistory);
  const setShowHistory = useDevShellStore((state) => state.setShowHistory);
  const dismissedHistorySessionIds = useDevShellStore(
    (state) => state.dismissedHistorySessionIds,
  );

  const [historyTab, setHistoryTab] = useState<"commands" | "sessions">("commands");
  const [commands, setCommands] = useState<{ command: string; timestamp: string }[]>([]);
  const [sessions, setSessions] = useState<
    {
      id: string;
      title: string;
      scope: string;
      lastActiveAt: string;
      closedAt?: string;
      config: TerminalSessionConfig;
    }[]
  >([]);
  const [showWelcome, setShowWelcome] = useState(() => !readDevShellWelcomeSeen());
  const [tabStatuses, setTabStatuses] = useState<Record<string, DevShellSessionStatus>>({});

  const terminalRefs = useRef<Map<string, TerminalViewHandle>>(new Map());
  const sessionRegisteredRef = useRef<Set<string>>(new Set());
  const activeTabIdRef = useRef(activeTabId);

  activeTabIdRef.current = activeTabId;

  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0];
  const activeStatus = activeTab
    ? (tabStatuses[activeTab.id] ?? "connecting")
    : "connecting";

  useEffect(() => {
    ensureDevShellInitialized();
  }, []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || !event.shiftKey) return;
      if (event.key.toLowerCase() !== "h") return;
      event.preventDefault();
      toggleHistory();
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [toggleHistory]);

  const dismissWelcome = useCallback(() => {
    persistDevShellWelcomeSeen();
    setShowWelcome(false);
  }, []);

  const focusActiveTerminal = useCallback(() => {
    if (!activeTab) return;
    terminalRefs.current.get(activeTab.id)?.focus();
  }, [activeTab]);

  const handleWelcomeNewLocal = useCallback(() => {
    dismissWelcome();
    newLocalTab();
  }, [dismissWelcome, newLocalTab]);

  const handleOpenK8s = useCallback(() => {
    dismissWelcome();
    openTool("k8s");
  }, [dismissWelcome]);

  const handleOpenDocker = useCallback(() => {
    dismissWelcome();
    openTool("docker");
  }, [dismissWelcome]);

  const setTabStatus = useCallback((tabId: string, status: DevShellSessionStatus) => {
    setTabStatuses((previous) => {
      if (previous[tabId] === status) return previous;
      return { ...previous, [tabId]: status };
    });
  }, []);

  const refreshCommands = useCallback(async (scope: string) => {
    if (!window.electronAPI?.terminal?.getCommands) return;
    const entries = await window.electronAPI.terminal.getCommands(scope, "", 100);
    setCommands(
      (entries.commands ?? []).map((entry) => ({
        command: entry.command,
        timestamp: entry.timestamp,
      })),
    );
  }, []);

  const refreshSessions = useCallback(async () => {
    if (!window.electronAPI?.terminal?.listSessions) return;
    const result = await window.electronAPI.terminal.listSessions(30);
    if (!result.success) return;
    setSessions(
      (result.sessions ?? []).map((entry) => ({
        id: entry.id,
        title: entry.title,
        scope: entry.scope,
        lastActiveAt: entry.lastActiveAt,
        closedAt: entry.closedAt,
        config: entry.config as unknown as TerminalSessionConfig,
      })),
    );
  }, []);

  const removeSessionFromHistory = useCallback(
    async (sessionId: string) => {
      if (!window.electronAPI?.terminal?.removeSession) return;

      dismissHistorySession(sessionId);
      setSessions((previous) => previous.filter((session) => session.id !== sessionId));

      const result = await window.electronAPI.terminal.removeSession(sessionId);
      if (!result?.success) {
        restoreHistorySession(sessionId);
        await refreshSessions();
      }
    },
    [dismissHistorySession, restoreHistorySession, refreshSessions],
  );

  useEffect(() => {
    if (!activeTab) return;
    void refreshCommands(activeTab.scope);
    void refreshSessions();
  }, [activeTab?.id, activeTab?.scope, refreshCommands, refreshSessions]);

  useEffect(() => {
    if (!activeTab || !window.electronAPI?.terminal?.addSession) return;
    if (sessionRegisteredRef.current.has(activeTab.id)) return;
    if (dismissedHistorySessionIds.includes(activeTab.id)) return;

    sessionRegisteredRef.current.add(activeTab.id);
    void window.electronAPI.terminal.addSession({
      id: activeTab.id,
      title: activeTab.title,
      scope: activeTab.scope,
      kind: activeTab.config.kind,
      config: activeTab.config as unknown as Record<string, unknown>,
    });
  }, [
    activeTab?.id,
    activeTab?.title,
    activeTab?.scope,
    activeTab?.config,
    dismissedHistorySessionIds,
  ]);

  const handleTabCommandSubmitted = useCallback(
    (tabId: string, scope: string) => (command: string) => {
      dismissWelcome();
      renameTabFromFirstCommand(tabId, command);
      if (tabId === activeTabIdRef.current) {
        void refreshCommands(scope);
      }
    },
    [dismissWelcome, renameTabFromFirstCommand, refreshCommands],
  );

  const handleTerminalReady = useCallback(
    (tabId: string) => () => {
      setTabStatus(tabId, "running");
    },
    [setTabStatus],
  );

  const handleTerminalExit = useCallback(
    (tabId: string) => () => {
      setTabStatus(tabId, "exited");
      void refreshSessions();
    },
    [setTabStatus, refreshSessions],
  );

  const handleRestartTab = useCallback(
    (tabId: string) => {
      setTabStatus(tabId, "connecting");
      restartTab(tabId);
    },
    [restartTab, setTabStatus],
  );

  const runCommandOnActive = useCallback((command: string) => {
    if (!activeTab) return;
    dismissWelcome();
    terminalRefs.current.get(activeTab.id)?.runCommand(command);
  }, [activeTab, dismissWelcome]);

  const restoreSession = useCallback(
    (sessionId: string) => {
      const match = sessions.find((session) => session.id === sessionId);
      if (!match) return;

      dismissWelcome();
      const tabId = openSession(match.config, {
        activate: true,
        reuseExisting: true,
      });
      handleRestartTab(tabId);

      if (window.electronAPI?.terminal?.touchSession) {
        void window.electronAPI.terminal.touchSession(match.id);
      }
    },
    [sessions, openSession, handleRestartTab, dismissWelcome],
  );

  if (!activeTab) {
    return (
      <div className="h-full flex flex-col bg-[var(--color-background)] devshell-root">
        <DevShellWelcome
          onNewLocal={() => {
            newLocalTab();
            dismissWelcome();
          }}
          onOpenK8s={handleOpenK8s}
          onOpenDocker={handleOpenDocker}
          onDismiss={dismissWelcome}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[var(--color-background)] devshell-root">
      <DevShellTabBar
        tabs={tabs}
        activeTabId={activeTab.id}
        showHistory={showHistory}
        onToggleHistory={toggleHistory}
        onSelect={setActiveTab}
        onClose={closeTab}
        onReorder={reorderTabs}
        onNewLocalTab={() => {
          dismissWelcome();
          newLocalTab();
        }}
        onOpenK8s={handleOpenK8s}
        onOpenDocker={handleOpenDocker}
        onRestart={() => handleRestartTab(activeTab.id)}
      />

      <div className="flex-1 min-h-0 flex overflow-hidden">
        {showHistory && (
          <DevShellSidebar
            activeTab={activeTab}
            commands={commands}
            sessions={sessions}
            historyTab={historyTab}
            onTabChange={setHistoryTab}
            onRunCommand={runCommandOnActive}
            onRestoreSession={restoreSession}
            onClearCommands={() => {
              if (window.electronAPI?.terminal?.clearCommands && activeTab) {
                void window.electronAPI.terminal
                  .clearCommands(activeTab.scope)
                  .then(() => refreshCommands(activeTab.scope));
              }
            }}
            onRemoveSession={(sessionId) => {
              void removeSessionFromHistory(sessionId);
            }}
            onNewLocalTab={() => {
              dismissWelcome();
              newLocalTab();
            }}
            onRestartTab={() => handleRestartTab(activeTab.id)}
            onClose={() => setShowHistory(false)}
          />
        )}

        <div
          className={`flex-1 min-h-0 min-w-0 relative devshell-terminal-pane devshell-terminal-pane--${activeTab.config.kind}`}
          role="tabpanel"
          id="devshell-terminal-panel"
          aria-label={`Terminal: ${activeTab.title}`}
        >
          {showWelcome && (
            <DevShellWelcome
              onNewLocal={handleWelcomeNewLocal}
              onOpenK8s={handleOpenK8s}
              onOpenDocker={handleOpenDocker}
              onDismiss={() => {
                dismissWelcome();
                focusActiveTerminal();
              }}
            />
          )}

          {tabs.map((tab) => {
            const isActive = tab.id === activeTab.id;
            return (
              <div
                key={tab.id}
                className={`absolute inset-0 ${isActive ? "z-10" : "z-0 invisible pointer-events-none"}`}
              >
                <TerminalView
                  ref={(handle) => {
                    if (handle) {
                      terminalRefs.current.set(tab.id, handle);
                    } else {
                      terminalRefs.current.delete(tab.id);
                    }
                  }}
                  key={`${tab.id}-${tab.mountKey}-${sessionConfigKey(tab.config)}`}
                  active
                  session={tab.config}
                  sessionRecordId={tab.id}
                  onReady={handleTerminalReady(tab.id)}
                  onCommandSubmitted={handleTabCommandSubmitted(tab.id, tab.scope)}
                  onExit={handleTerminalExit(tab.id)}
                />
              </div>
            );
          })}
        </div>
      </div>

      <DevShellStatusBar activeTab={activeTab} status={activeStatus} />
    </div>
  );
}

/** @deprecated Use DevShell */
export const LocalTerminal = DevShell;
