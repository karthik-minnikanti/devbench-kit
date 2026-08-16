import { create } from "zustand";

export type K8sPortForwardStatus = "active" | "paused" | "error";

export interface K8sPortForward {
  forwardId: string;
  podName: string;
  namespace: string;
  localPort: number;
  remotePort: number;
  address: string;
  status: K8sPortForwardStatus;
  message?: string;
  startedAt: number;
  portKey?: string;
}

interface K8sPortForwardState {
  forwards: K8sPortForward[];
  busyIds: Record<string, boolean>;
  hydrated: boolean;
  refresh: () => Promise<void>;
  startListening: () => () => void;
  start: (input: {
    podName: string;
    namespace: string;
    localPort: number;
    remotePort: number;
    address?: string;
    portKey?: string;
  }) => Promise<{ success: boolean; error?: string; forward?: K8sPortForward }>;
  pause: (forwardId: string) => Promise<{ success: boolean; error?: string }>;
  resume: (forwardId: string) => Promise<{ success: boolean; error?: string }>;
  stop: (forwardId: string) => Promise<{ success: boolean; error?: string }>;
}

function sortForwards(forwards: K8sPortForward[]): K8sPortForward[] {
  return [...forwards].sort((a, b) => b.startedAt - a.startedAt);
}

export const useK8sPortForwardStore = create<K8sPortForwardState>((set, get) => ({
  forwards: [],
  busyIds: {},
  hydrated: false,

  refresh: async () => {
    if (!window.electronAPI?.k8s.listPortForwards) return;
    const result = await window.electronAPI.k8s.listPortForwards();
    if (result.success) {
      set({
        forwards: sortForwards(result.forwards || []),
        hydrated: true,
      });
    }
  },

  startListening: () => {
    void get().refresh();
    const unsubs: Array<() => void> = [];

    if (window.electronAPI?.onK8sPortForwardList) {
      unsubs.push(
        window.electronAPI.onK8sPortForwardList((forwards) => {
          set({ forwards: sortForwards(forwards || []), hydrated: true });
        }),
      );
    }

    if (window.electronAPI?.onK8sPortForwardExit) {
      unsubs.push(
        window.electronAPI.onK8sPortForwardExit(({ forwardId, error, exitCode }) => {
          set((state) => ({
            forwards: state.forwards.map((forward) =>
              forward.forwardId === forwardId
                ? {
                    ...forward,
                    status: "error" as const,
                    message:
                      error ||
                      (exitCode !== undefined
                        ? `Port forward stopped (code ${exitCode})`
                        : "Port forward stopped"),
                  }
                : forward,
            ),
          }));
        }),
      );
    }

    if (window.electronAPI?.onK8sPortForwardMessage) {
      unsubs.push(
        window.electronAPI.onK8sPortForwardMessage(({ forwardId, message }) => {
          set((state) => ({
            forwards: state.forwards.map((forward) =>
              forward.forwardId === forwardId ? { ...forward, message } : forward,
            ),
          }));
        }),
      );
    }

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  },

  start: async ({ podName, namespace, localPort, remotePort, address, portKey }) => {
    if (!window.electronAPI?.k8s.portForward) {
      return { success: false, error: "Port forward API unavailable" };
    }
    const tempId = `${namespace}/${podName}:${localPort}`;
    set((state) => ({ busyIds: { ...state.busyIds, [tempId]: true } }));
    try {
      const result = await window.electronAPI.k8s.portForward(
        podName,
        namespace,
        localPort,
        remotePort,
        address,
        portKey,
      );
      await get().refresh();
      return {
        success: result.success,
        error: result.error,
        forward: result.forward,
      };
    } finally {
      set((state) => {
        const next = { ...state.busyIds };
        delete next[tempId];
        return { busyIds: next };
      });
    }
  },

  pause: async (forwardId) => {
    if (!window.electronAPI?.k8s.pausePortForward) {
      return { success: false, error: "Pause API unavailable" };
    }
    set((state) => ({ busyIds: { ...state.busyIds, [forwardId]: true } }));
    try {
      const result = await window.electronAPI.k8s.pausePortForward(forwardId);
      await get().refresh();
      return { success: result.success, error: result.error };
    } finally {
      set((state) => {
        const next = { ...state.busyIds };
        delete next[forwardId];
        return { busyIds: next };
      });
    }
  },

  resume: async (forwardId) => {
    if (!window.electronAPI?.k8s.resumePortForward) {
      return { success: false, error: "Resume API unavailable" };
    }
    set((state) => ({ busyIds: { ...state.busyIds, [forwardId]: true } }));
    try {
      const result = await window.electronAPI.k8s.resumePortForward(forwardId);
      await get().refresh();
      return { success: result.success, error: result.error };
    } finally {
      set((state) => {
        const next = { ...state.busyIds };
        delete next[forwardId];
        return { busyIds: next };
      });
    }
  },

  stop: async (forwardId) => {
    if (!window.electronAPI?.k8s.stopPortForward) {
      return { success: false, error: "Stop API unavailable" };
    }
    set((state) => ({ busyIds: { ...state.busyIds, [forwardId]: true } }));
    try {
      const result = await window.electronAPI.k8s.stopPortForward(forwardId);
      await get().refresh();
      return { success: result.success, error: result.error };
    } finally {
      set((state) => {
        const next = { ...state.busyIds };
        delete next[forwardId];
        return { busyIds: next };
      });
    }
  },
}));
