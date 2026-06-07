import { useState, useEffect } from "react";
import { Icon } from "./Icon";
import {
  ProfileCard,
  ProfileInlineAlert,
  ProfileStatGrid,
} from "./profile/ProfileLayout";

interface GitStatus {
  isRepo: boolean;
  hasChanges: boolean;
  ahead: number;
  behind: number;
  currentBranch?: string;
}

interface GitSettingsProps {
  embedded?: boolean;
}

export function GitSettings({ embedded = false }: GitSettingsProps) {
  const [repoPath, setRepoPath] = useState("");
  const [savedRepoPath, setSavedRepoPath] = useState("");
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  useEffect(() => {
    void loadRepoPath();
    void loadStatus();

    const interval = window.setInterval(() => {
      void loadStatus();
    }, 5000);

    return () => window.clearInterval(interval);
  }, []);

  const loadRepoPath = async () => {
    try {
      const electronAPI = window.electronAPI;
      if (electronAPI) {
        const result = await electronAPI.git.getRepoPath();
        if (result.success && result.repoPath) {
          setRepoPath(result.repoPath);
          setSavedRepoPath(result.repoPath);
        }
      }
    } catch (error) {
      console.error("Failed to load repo path:", error);
    }
  };

  const loadStatus = async () => {
    try {
      const electronAPI = window.electronAPI;
      if (electronAPI) {
        const result = await electronAPI.git.status();
        if (result.success && result.status) {
          setStatus(result.status);
        }
      }
    } catch (error) {
      console.error("Failed to load Git status:", error);
    }
  };

  const handleBrowseRepoPath = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const electronAPI = window.electronAPI;
      if (!electronAPI?.git.pickRepoPath) {
        setMessage({ type: "error", text: "Folder picker is only available in the desktop app." });
        return;
      }

      const result = await electronAPI.git.pickRepoPath();
      if (result.canceled) return;
      if (result.success && result.repoPath) {
        setRepoPath(result.repoPath);
      } else {
        setMessage({ type: "error", text: result.error || "Failed to pick folder" });
      }
    } catch (error: unknown) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to pick folder",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRepoPath = async () => {
    const trimmed = repoPath.trim();
    if (!trimmed) {
      setMessage({ type: "error", text: "Enter a repository path first." });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const electronAPI = window.electronAPI;
      if (!electronAPI) {
        setMessage({ type: "error", text: "Git settings require the desktop app." });
        return;
      }

      const checkResult = await electronAPI.git.checkIfRepo(trimmed);
      if (!checkResult.success || !checkResult.isRepo) {
        setMessage({ type: "error", text: "That path is not a Git repository." });
        return;
      }

      const result = await electronAPI.git.setRepoPath(trimmed);
      if (result.success) {
        setSavedRepoPath(trimmed);
        setMessage({ type: "success", text: "Repository path saved." });
        await loadStatus();
      } else {
        setMessage({ type: "error", text: result.error || "Failed to save repository path" });
      }
    } catch (error: unknown) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to save repository path",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setMessage(null);
    try {
      const electronAPI = window.electronAPI;
      if (electronAPI) {
        const result = await electronAPI.git.sync();
        if (result.success) {
          setMessage({ type: "success", text: "Synced successfully." });
          await loadStatus();
        } else {
          setMessage({ type: "error", text: result.error || "Failed to sync" });
        }
      }
    } catch (error: unknown) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to sync",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handlePull = async () => {
    setPulling(true);
    setMessage(null);
    try {
      const electronAPI = window.electronAPI;
      if (electronAPI) {
        const result = await electronAPI.git.pull();
        if (result.success) {
          setMessage({ type: "success", text: "Pulled latest changes." });
          await loadStatus();
        } else if (result.hasConflicts) {
          setMessage({
            type: "error",
            text: "Merge conflicts detected. Resolve them manually, then sync again.",
          });
        } else {
          setMessage({ type: "error", text: result.error || "Failed to pull" });
        }
      }
    } catch (error: unknown) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to pull",
      });
    } finally {
      setPulling(false);
    }
  };

  const syncDisabled = syncing || (!status?.hasChanges && (status?.ahead ?? 0) === 0);
  const pathDirty = repoPath.trim() !== savedRepoPath.trim();

  const content = (
    <div className={`profile-settings-stack ${embedded ? "" : "p-6"}`}>
      {!embedded && (
        <ProfileSectionHeroFallback />
      )}

      <ProfileCard
        title="Repository"
        description="Local folder DevBench uses for notes sync and git operations."
      >
        <label htmlFor="git-repo-path" className="sr-only">
          Repository path
        </label>
        <div className="flex flex-col sm:flex-row gap-2 mt-3">
          <input
            id="git-repo-path"
            type="text"
            value={repoPath}
            onChange={(event) => setRepoPath(event.target.value)}
            placeholder="/path/to/git/repo"
            className="profile-settings-input flex-1"
          />
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void handleBrowseRepoPath()}
              disabled={loading}
              className="btn-secondary !h-9 !text-xs"
            >
              {loading ? "Opening…" : "Browse"}
            </button>
            <button
              type="button"
              onClick={() => void handleSaveRepoPath()}
              disabled={saving || !pathDirty}
              className="btn-primary !h-9 !text-xs"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
        {pathDirty && (
          <p className="text-[11px] text-[var(--color-text-tertiary)] mt-2">
            Unsaved changes — click Save to apply this repository path.
          </p>
        )}
      </ProfileCard>

      <ProfileCard
        title="Status"
        description="Live repository state — refreshes every few seconds."
      >
        {status ? (
          <>
            <div className="flex flex-wrap items-center gap-2 mt-3 mb-3">
              <span
                className={`profile-badge ${
                  status.hasChanges ? "profile-badge--warning" : "profile-badge--success"
                }`}
              >
                {status.hasChanges ? "Uncommitted changes" : "Clean working tree"}
              </span>
              {!status.isRepo && (
                <span className="profile-badge profile-badge--muted">Not a git repo</span>
              )}
            </div>
            <ProfileStatGrid
              stats={[
                {
                  label: "Branch",
                  value: status.currentBranch || "—",
                  mono: true,
                },
                {
                  label: "Ahead",
                  value: String(status.ahead),
                  tone: status.ahead > 0 ? "warning" : "default",
                },
                {
                  label: "Behind",
                  value: String(status.behind),
                  tone: status.behind > 0 ? "warning" : "default",
                },
              ]}
            />
          </>
        ) : (
          <p className="profile-settings-card__desc mt-3">Loading repository status…</p>
        )}

        <div className="profile-settings-actions mt-4 pt-4 border-t border-[var(--color-border)]">
          <button
            type="button"
            onClick={() => void handleSync()}
            disabled={syncDisabled}
            className="btn-primary !h-9 !text-xs inline-flex items-center gap-1.5"
          >
            <Icon name="RefreshCw" className="w-3.5 h-3.5" aria-hidden="true" />
            {syncing ? "Syncing…" : "Sync now"}
          </button>
          <button
            type="button"
            onClick={() => void handlePull()}
            disabled={pulling}
            className="btn-secondary !h-9 !text-xs inline-flex items-center gap-1.5"
          >
            <Icon name="ChevronDown" className="w-3.5 h-3.5" aria-hidden="true" />
            {pulling ? "Pulling…" : "Pull latest"}
          </button>
          <button
            type="button"
            onClick={() => void loadStatus()}
            className="profile-icon-button"
            title="Refresh status"
            aria-label="Refresh status"
          >
            <Icon name="RefreshCw" className="w-3.5 h-3.5" />
          </button>
        </div>
      </ProfileCard>

      {message && <ProfileInlineAlert tone={message.type}>{message.text}</ProfileInlineAlert>}
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <div className="h-full flex flex-col bg-[var(--color-background)] overflow-auto">
      {content}
    </div>
  );
}

function ProfileSectionHeroFallback() {
  return (
    <div className="profile-hero mb-2">
      <div className="profile-hero__icon" aria-hidden="true">
        <Icon name="Code" className="w-4 h-4" />
      </div>
      <div>
        <h1 className="profile-hero__title">Git sync</h1>
        <p className="profile-hero__desc">Repository path, status, and sync actions.</p>
      </div>
    </div>
  );
}
