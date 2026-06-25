import { create } from "zustand";
import type { TerminalSessionConfig } from "../components/TerminalView";
import {
  getTerminalScope,
  getTerminalTitle,
  formatDevShellTabTitle,
  sessionConfigKey,
} from "../utils/terminalScope";
import {
  persistDevShellPanelOpen,
  readDevShellPanelOpen,
} from "../utils/devShellPreferences";

export interface DevShellTab {
  id: string;
  title: string;
  scope: string;
  config: TerminalSessionConfig;
  mountKey: number;
  createdAt: number;
  namedByCommand: boolean;
}

interface OpenSessionOptions {
  activate?: boolean;
  reuseExisting?: boolean;
}

interface DevShellState {
  tabs: DevShellTab[];
  activeTabId: string | null;
  showHistory: boolean;
  dismissedHistorySessionIds: string[];
  openSession: (
    config: TerminalSessionConfig,
    options?: OpenSessionOptions,
  ) => string;
  newLocalTab: () => string;
  closeTab: (id: string) => string | null;
  setActiveTab: (id: string) => void;
  reorderTabs: (draggedId: string, targetId: string, position: "before" | "after") => void;
  restartTab: (id: string) => void;
  renameTabFromFirstCommand: (id: string, command: string) => void;
  dismissHistorySession: (id: string) => void;
  restoreHistorySession: (id: string) => void;
  toggleHistory: () => void;
  setShowHistory: (show: boolean) => void;
}

function createTab(config: TerminalSessionConfig): DevShellTab {
  return {
    id: crypto.randomUUID(),
    title: getTerminalTitle(config),
    scope: getTerminalScope(config),
    config,
    mountKey: 0,
    createdAt: Date.now(),
    namedByCommand: false,
  };
}

const initialTab = createTab({ kind: "local" });

export const useDevShellStore = create<DevShellState>((set, get) => ({
  tabs: [initialTab],
  activeTabId: initialTab.id,
  showHistory: readDevShellPanelOpen(),
  dismissedHistorySessionIds: [],

  openSession: (config, options = {}) => {
    const { activate = true, reuseExisting = true } = options;
    const key = sessionConfigKey(config);
    const state = get();

    if (reuseExisting) {
      const existing = state.tabs.find(
        (tab) => sessionConfigKey(tab.config) === key,
      );
      if (existing) {
        if (activate) {
          set({ activeTabId: existing.id });
        }
        return existing.id;
      }
    }

    const tab = createTab(config);
    set({
      tabs: [...state.tabs, tab],
      activeTabId: activate ? tab.id : state.activeTabId ?? tab.id,
    });
    return tab.id;
  },

  newLocalTab: () => {
    return get().openSession({ kind: "local" }, { activate: true, reuseExisting: false });
  },

  closeTab: (id) => {
    const state = get();
    if (state.tabs.length <= 1) {
      const fresh = createTab({ kind: "local" });
      set({ tabs: [fresh], activeTabId: fresh.id });
      return fresh.id;
    }

    const index = state.tabs.findIndex((tab) => tab.id === id);
    if (index === -1) {
      return state.activeTabId;
    }

    const nextTabs = state.tabs.filter((tab) => tab.id !== id);
    let nextActive = state.activeTabId;
    if (state.activeTabId === id) {
      const neighbor = nextTabs[Math.min(index, nextTabs.length - 1)];
      nextActive = neighbor?.id ?? null;
    }

    set({ tabs: nextTabs, activeTabId: nextActive });
    return nextActive;
  },

  setActiveTab: (id) => {
    if (get().tabs.some((tab) => tab.id === id)) {
      set({ activeTabId: id });
    }
  },

  reorderTabs: (draggedId, targetId, position) => {
    const state = get();
    const fromIndex = state.tabs.findIndex((tab) => tab.id === draggedId);
    const targetIndex = state.tabs.findIndex((tab) => tab.id === targetId);
    if (fromIndex === -1 || targetIndex === -1 || fromIndex === targetIndex) {
      return;
    }

    let toIndex = position === "after" ? targetIndex + 1 : targetIndex;
    if (fromIndex < toIndex) {
      toIndex -= 1;
    }
    if (fromIndex === toIndex) {
      return;
    }

    const tabs = [...state.tabs];
    const [moved] = tabs.splice(fromIndex, 1);
    tabs.splice(toIndex, 0, moved);
    set({ tabs });
  },

  restartTab: (id) => {
    set({
      tabs: get().tabs.map((tab) =>
        tab.id === id
          ? {
              ...tab,
              mountKey: tab.mountKey + 1,
              title: getTerminalTitle(tab.config),
              namedByCommand: false,
            }
          : tab,
      ),
    });
  },

  renameTabFromFirstCommand: (id, command) => {
    const state = get();
    const tab = state.tabs.find((entry) => entry.id === id);
    if (!tab || tab.namedByCommand) {
      return;
    }

    const title = formatDevShellTabTitle(command);
    if (!title || title === "Shell") {
      return;
    }

    set({
      tabs: state.tabs.map((entry) =>
        entry.id === id ? { ...entry, title, namedByCommand: true } : entry,
      ),
    });

    if (window.electronAPI?.terminal?.updateSession) {
      void window.electronAPI.terminal.updateSession(id, { title });
    }
  },

  dismissHistorySession: (id) => {
    const state = get();
    if (state.dismissedHistorySessionIds.includes(id)) {
      return;
    }
    set({ dismissedHistorySessionIds: [...state.dismissedHistorySessionIds, id] });
  },

  restoreHistorySession: (id) => {
    set({
      dismissedHistorySessionIds: get().dismissedHistorySessionIds.filter(
        (entry) => entry !== id,
      ),
    });
  },

  toggleHistory: () => {
    const next = !get().showHistory;
    persistDevShellPanelOpen(next);
    set({ showHistory: next });
  },
  setShowHistory: (show) => {
    persistDevShellPanelOpen(show);
    set({ showHistory: show });
  },
}));

export function ensureDevShellInitialized(): void {
  const state = useDevShellStore.getState();
  if (!state.activeTabId && state.tabs.length > 0) {
    useDevShellStore.setState({ activeTabId: state.tabs[0].id });
  }
}
