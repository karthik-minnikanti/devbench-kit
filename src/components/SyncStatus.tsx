import { useState, useEffect, useCallback } from "react";

interface GitSyncState {
  isRepo: boolean;
  isOnline: boolean;
  isSyncing: boolean;
  pendingFileCount: number;
  unpushedCommits: number;
  hasUncommittedChanges: boolean;
  lastError: string | null;
}

export function SyncStatus() {
  const [syncState, setSyncState] = useState<GitSyncState | null>(null);

  const refreshSyncState = useCallback(async () => {
    const electronAPI = window.electronAPI;
    if (!electronAPI?.git?.getSyncState) {
      return;
    }

    try {
      const result = await electronAPI.git.getSyncState();
      if (result.success && result.state) {
        setSyncState(result.state);
      }
    } catch (error) {
      console.error("Failed to load Git sync state:", error);
    }
  }, []);

  const retryPendingSync = useCallback(async () => {
    const electronAPI = window.electronAPI;
    if (!electronAPI?.git?.retryPendingSync) {
      return;
    }

    try {
      await electronAPI.git.retryPendingSync();
    } catch (error) {
      console.error("Failed to retry Git sync:", error);
    } finally {
      await refreshSyncState();
    }
  }, [refreshSyncState]);

  useEffect(() => {
    void refreshSyncState();

    const electronAPI = window.electronAPI;
    electronAPI?.git?.onSyncStateChange?.((state: GitSyncState) => {
      setSyncState(state);
    });

    const handleOnline = () => {
      void retryPendingSync();
    };

    window.addEventListener("online", handleOnline);
    const interval = setInterval(() => {
      void refreshSyncState();
    }, 15000);

    return () => {
      window.removeEventListener("online", handleOnline);
      clearInterval(interval);
    };
  }, [refreshSyncState, retryPendingSync]);

  if (!syncState?.isRepo) {
    return null;
  }

  const hasPendingWork =
    syncState.pendingFileCount > 0 ||
    syncState.unpushedCommits > 0 ||
    syncState.hasUncommittedChanges;

  if (
    syncState.isOnline &&
    !syncState.isSyncing &&
    !hasPendingWork &&
    !syncState.lastError
  ) {
    return null;
  }

  let message = "";
  let tone: "neutral" | "info" | "error" = "neutral";

  if (syncState.isSyncing) {
    message = "Syncing with Git...";
    tone = "info";
  } else if (!syncState.isOnline) {
    message = hasPendingWork
      ? "Offline — saved locally. Git sync will retry when online."
      : "Offline — changes are saved locally.";
    tone = "neutral";
  } else if (syncState.lastError?.includes("conflict")) {
    message = syncState.lastError;
    tone = "error";
  } else if (hasPendingWork) {
    const parts: string[] = [];
    if (syncState.pendingFileCount > 0) {
      parts.push(
        `${syncState.pendingFileCount} file${syncState.pendingFileCount === 1 ? "" : "s"}`,
      );
    }
    if (syncState.unpushedCommits > 0) {
      parts.push(
        `${syncState.unpushedCommits} unpushed commit${syncState.unpushedCommits === 1 ? "" : "s"}`,
      );
    }
    if (syncState.hasUncommittedChanges && syncState.pendingFileCount === 0) {
      parts.push("uncommitted changes");
    }
    message = `Waiting to sync ${parts.join(", ")}...`;
    tone = "info";
  } else if (syncState.lastError) {
    message = syncState.lastError;
    tone = "error";
  }

  if (!message) {
    return null;
  }

  const className =
    tone === "error"
      ? "bg-red-500/90 text-white"
      : tone === "info"
        ? "bg-[var(--color-primary)] text-white"
        : "bg-[var(--color-timeline-done)] text-white";

  return (
    <div
      className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1.5 max-w-[420px] ${className}`}
      title={syncState.lastError || message}
    >
      {syncState.isSyncing ? (
        <span className="animate-spin">⏳</span>
      ) : tone === "error" ? (
        <span>⚠️</span>
      ) : !syncState.isOnline ? (
        <span>📴</span>
      ) : (
        <span>↻</span>
      )}
      <span className="truncate">{message}</span>
      {!syncState.isSyncing &&
        syncState.isOnline &&
        hasPendingWork &&
        !syncState.lastError?.includes("conflict") && (
          <button
            type="button"
            onClick={() => void retryPendingSync()}
            className="underline underline-offset-2 hover:opacity-80 shrink-0"
          >
            Retry
          </button>
        )}
    </div>
  );
}
