import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../Icon";
import {
  DEFAULT_GENERATOR,
  generatePassword,
  GeneratorOptions,
  hostnameFromDomain,
  scorePassword,
  STRENGTH_LABEL,
  strengthBarClass,
  strengthTextClass,
  websiteHref,
} from "./passwordUtils";

type FilterId = "all" | "favorites" | "weak" | "reused";
type CopyFieldName = "password" | "username" | "domain";

const AUTO_LOCK_MS = 12 * 60 * 60 * 1000;
const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "favorites", label: "Favorites" },
  { id: "weak", label: "Weak" },
  { id: "reused", label: "Reused" },
];

function api() {
  return window.electronAPI?.passwords;
}

function emptyDraft(): PasswordVaultEntry {
  return {
    id: "",
    title: "",
    username: "",
    password: generatePassword(),
    domain: "",
    notes: "",
    favorite: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function StrengthMeter({ password }: { password: string }) {
  const strength = scorePassword(password);
  const width = { weak: "25%", fair: "50%", good: "75%", strong: "100%" }[strength];
  return (
    <div className="space-y-1">
      <div className="h-1 rounded-full bg-[var(--color-muted)] overflow-hidden">
        <div className={`h-full ${strengthBarClass(strength)}`} style={{ width }} />
      </div>
      <div className={`text-[10px] font-medium ${strengthTextClass(strength)}`}>
        {STRENGTH_LABEL[strength]} password
      </div>
    </div>
  );
}

function Favicon({ domain, title }: { domain: string; title: string }) {
  const host = hostnameFromDomain(domain);
  const letter = (title || host || "?").charAt(0).toUpperCase();
  const [failed, setFailed] = useState(false);
  return (
    <div className="w-9 h-9 rounded-lg bg-[var(--color-muted)] flex items-center justify-center overflow-hidden shrink-0 text-xs font-semibold text-[var(--color-text-secondary)]">
      {host && !failed ? (
        <img
          src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`}
          alt=""
          className="w-5 h-5"
          onError={() => setFailed(true)}
        />
      ) : (
        letter
      )}
    </div>
  );
}

function ActionChip({
  label,
  onClick,
  disabled,
  primary,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`h-7 px-2.5 rounded-md text-[11px] font-medium transition-colors disabled:opacity-40 ${
        primary
          ? "bg-[var(--color-primary)] text-white hover:opacity-90"
          : "bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)]"
      }`}
    >
      {label}
    </button>
  );
}

export function PasswordManager({
  visible = true,
  pendingItemId,
  onPendingItemHandled,
}: {
  visible?: boolean;
  pendingItemId?: string;
  onPendingItemHandled?: () => void;
}) {
  const [ready, setReady] = useState(false);
  const [exists, setExists] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [entries, setEntries] = useState<PasswordVaultSummary[]>([]);
  const [mode, setMode] = useState<"browse" | "edit">("browse");
  const [draft, setDraft] = useState<PasswordVaultEntry | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");
  const [activeIndex, setActiveIndex] = useState(0);
  const [masterPassword, setMasterPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [revealPassword, setRevealPassword] = useState(false);
  const [showGenerator, setShowGenerator] = useState(false);
  const [generator, setGenerator] = useState<GeneratorOptions>(DEFAULT_GENERATOR);
  const [dirty, setDirty] = useState(false);
  const lastActivityRef = useRef(Date.now());
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const saveRef = useRef<() => void>(() => {});

  const refreshList = useCallback(async () => {
    const list = await api()?.list();
    if (list?.success) setEntries(list.entries || []);
  }, []);

  const refreshStatus = useCallback(async () => {
    const passwords = api();
    if (!passwords) {
      setReady(true);
      return;
    }
    const status = await passwords.status();
    setExists(Boolean(status.exists));
    setUnlocked(Boolean(status.unlocked));
    setReady(true);
    if (status.unlocked) {
      await refreshList();
    } else {
      setEntries([]);
      setDraft(null);
      setMode("browse");
    }
  }, [refreshList]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    if (!unlocked || !visible) return;
    const t = window.setTimeout(() => searchRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [unlocked, visible, mode]);

  useEffect(() => {
    if (!unlocked) return;
    const bump = () => {
      lastActivityRef.current = Date.now();
    };
    const events = ["pointerdown", "keydown"] as const;
    events.forEach((event) => window.addEventListener(event, bump));
    const timer = window.setInterval(() => {
      if (Date.now() - lastActivityRef.current >= AUTO_LOCK_MS) {
        void api()?.lock().then(() => {
          setUnlocked(false);
          setEntries([]);
          setDraft(null);
          setMode("browse");
          setMasterPassword("");
          setToast("Vault locked after 12 hours idle");
        });
      }
    }, 15_000);
    return () => {
      events.forEach((event) => window.removeEventListener(event, bump));
      window.clearInterval(timer);
    };
  }, [unlocked]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (filter === "favorites" && !entry.favorite) return false;
      if (filter === "weak" && entry.strength !== "weak" && entry.strength !== "fair") {
        return false;
      }
      if (filter === "reused" && entry.reusedCount < 1) return false;
      if (!q) return true;
      return (
        entry.title.toLowerCase().includes(q) ||
        entry.username.toLowerCase().includes(q) ||
        entry.domain.toLowerCase().includes(q)
      );
    });
  }, [entries, filter, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, filter, entries.length]);

  useEffect(() => {
    if (!listRef.current) return;
    const row = listRef.current.querySelector(`[data-index="${activeIndex}"]`);
    row?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const flashCopied = (key: string) => {
    setCopiedKey(key);
    window.setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 1200);
  };

  const copyEntryField = useCallback(
    async (id: string, field: CopyFieldName) => {
      const result = await api()?.copy(id, field);
      if (!result?.success) {
        setToast(result?.error || "Copy failed");
        return;
      }
      flashCopied(`${id}:${field}`);
      setToast(
        field === "password"
          ? "Password copied · clears in 30s"
          : field === "username"
            ? "Username copied"
            : "Domain copied",
      );
      if (field === "password") void refreshList();
    },
    [refreshList],
  );

  const openSite = useCallback(async (domain: string) => {
    const href = websiteHref(domain);
    if (!href) {
      setToast("No website set");
      return;
    }
    const result = await window.electronAPI?.app?.openExternal?.(href);
    if (!result?.success) setToast(result?.error || "Could not open site");
  }, []);

  const openEdit = useCallback(async (id: string) => {
    const result = await api()?.get(id);
    if (!result?.success || !result.entry) {
      setToast(result?.error || "Could not open login");
      return;
    }
    setDraft(result.entry);
    setIsNew(false);
    setDirty(false);
    setRevealPassword(false);
    setShowGenerator(false);
    setMode("edit");
  }, []);

  useEffect(() => {
    if (!unlocked || !pendingItemId) return;
    void openEdit(pendingItemId);
    onPendingItemHandled?.();
  }, [unlocked, pendingItemId, openEdit, onPendingItemHandled]);

  const startNew = useCallback(() => {
    setDraft(emptyDraft());
    setIsNew(true);
    setDirty(true);
    setRevealPassword(true);
    setShowGenerator(true);
    setMode("edit");
  }, []);

  const closeEdit = useCallback(() => {
    if (dirty && !window.confirm("Discard unsaved changes?")) return;
    setMode("browse");
    setDraft(null);
    setIsNew(false);
    setDirty(false);
    window.setTimeout(() => searchRef.current?.focus(), 30);
  }, [dirty]);

  const handleSetup = async () => {
    if (masterPassword !== confirmPassword) {
      setAuthError("Passwords do not match");
      return;
    }
    setBusy(true);
    setAuthError(null);
    const result = await api()?.setup(masterPassword);
    setBusy(false);
    if (!result?.success) {
      setAuthError(result?.error || "Could not create vault");
      return;
    }
    setMasterPassword("");
    setConfirmPassword("");
    setUnlocked(true);
    setExists(true);
    setEntries([]);
  };

  const handleUnlock = async () => {
    setBusy(true);
    setAuthError(null);
    const result = await api()?.unlock(masterPassword);
    setBusy(false);
    if (!result?.success) {
      setAuthError(result?.error || "Could not unlock vault");
      return;
    }
    setMasterPassword("");
    setUnlocked(true);
    await refreshList();
  };

  const handleLock = async () => {
    await api()?.lock();
    setUnlocked(false);
    setEntries([]);
    setDraft(null);
    setMode("browse");
    setMasterPassword("");
  };

  const updateDraft = (patch: Partial<PasswordVaultEntry>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
    setDirty(true);
  };

  const handleSave = async () => {
    if (!draft) return;
    setBusy(true);
    const title =
      draft.title.trim() || hostnameFromDomain(draft.domain) || "Untitled login";
    const result = await api()?.save({
      ...draft,
      title,
      id: isNew ? undefined : draft.id,
    });
    setBusy(false);
    if (!result?.success) {
      setToast(result?.error || "Save failed");
      return;
    }
    setToast("Saved");
    setDirty(false);
    setIsNew(false);
    if (result.entry) setDraft(result.entry);
    await refreshList();
    setMode("browse");
    setDraft(null);
    window.setTimeout(() => searchRef.current?.focus(), 30);
  };
  saveRef.current = () => {
    if (mode === "edit" && dirty && draft) void handleSave();
  };

  const handleDelete = async () => {
    if (!draft?.id || isNew) {
      closeEdit();
      return;
    }
    if (!window.confirm(`Delete “${draft.title}”? This cannot be undone.`)) return;
    const result = await api()?.delete(draft.id);
    if (!result?.success) {
      setToast(result?.error || "Delete failed");
      return;
    }
    setDraft(null);
    setMode("browse");
    setDirty(false);
    await refreshList();
  };

  useEffect(() => {
    if (!unlocked || !visible || mode !== "browse") return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "n") {
        event.preventDefault();
        startNew();
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        return;
      }

      const active = filtered[activeIndex];
      if (!active) return;

      if (event.key === "Enter" && !event.metaKey && !event.ctrlKey) {
        if (typing && target === searchRef.current) {
          event.preventDefault();
          void copyEntryField(active.id, "password");
        } else if (!typing) {
          event.preventDefault();
          void copyEntryField(active.id, "password");
        }
        return;
      }
      if (!typing && event.key.toLowerCase() === "u") {
        event.preventDefault();
        void copyEntryField(active.id, "username");
      }
      if (!typing && event.key.toLowerCase() === "o") {
        event.preventDefault();
        void openSite(active.domain);
      }
      if (!typing && event.key.toLowerCase() === "e") {
        event.preventDefault();
        void openEdit(active.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    unlocked,
    visible,
    mode,
    filtered,
    activeIndex,
    copyEntryField,
    openSite,
    openEdit,
    startNew,
  ]);

  useEffect(() => {
    if (!unlocked || !visible || mode !== "edit") return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveRef.current();
      }
      if (event.key === "Escape") {
        event.preventDefault();
        closeEdit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [unlocked, visible, mode, closeEdit]);

  if (!ready) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-[var(--color-text-tertiary)]">
        Loading vault…
      </div>
    );
  }

  if (!window.electronAPI?.passwords) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-[var(--color-text-secondary)]">
        Password Manager is available in the desktop app.
      </div>
    );
  }

  if (!unlocked) {
    return (
      <div className="h-full flex items-center justify-center bg-[var(--color-background)] p-6">
        <div className="w-full max-w-sm space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center">
              <Icon name="Lock" className="w-5 h-5" />
            </div>
            <h1 className="text-base font-semibold text-[var(--color-text-primary)]">
              {exists ? "Unlock Vault" : "Create Vault"}
            </h1>
          </div>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void (exists ? handleUnlock() : handleSetup());
            }}
          >
            <label className="block space-y-1">
              <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-tertiary)]">
                Master password
              </span>
              <input
                type="password"
                value={masterPassword}
                onChange={(e) => setMasterPassword(e.target.value)}
                autoFocus
                className="w-full h-9 px-3 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] text-sm"
              />
            </label>
            {!exists && (
              <>
                <label className="block space-y-1">
                  <span className="text-[10px] uppercase tracking-wide text-[var(--color-text-tertiary)]">
                    Confirm
                  </span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full h-9 px-3 rounded-md border border-[var(--color-border)] bg-[var(--color-card)] text-sm"
                  />
                </label>
                <StrengthMeter password={masterPassword} />
              </>
            )}
            {authError && (
              <div className="text-xs text-[var(--color-semantic-error)]">{authError}</div>
            )}
            <button
              type="submit"
              disabled={busy || masterPassword.length < 8}
              className="btn-primary w-full !h-9"
            >
              {busy ? "Working…" : exists ? "Unlock" : "Create vault"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0 bg-[var(--color-background)] relative">
      <div className="shrink-0 border-b border-[var(--color-border)] px-4 py-3 space-y-3">
        <div className="flex items-center gap-2">
          <label className="flex flex-1 min-w-0 items-center gap-2.5 h-10 px-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] focus-within:border-[var(--color-primary)]">
            <Icon name="Search" className="w-4 h-4 shrink-0 text-[var(--color-text-tertiary)]" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search title, username, or domain…"
              className="flex-1 min-w-0 h-full bg-transparent text-sm outline-none border-0 p-0"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]"
                title="Clear"
              >
                <Icon name="X" className="w-3.5 h-3.5" />
              </button>
            )}
          </label>
          <button
            type="button"
            onClick={startNew}
            className="btn-primary !h-10 !px-3 !text-xs inline-flex items-center gap-1.5 shrink-0"
          >
            <Icon name="Plus" className="w-3.5 h-3.5" />
            New
          </button>
          <button
            type="button"
            onClick={() => void handleLock()}
            className="btn-secondary !h-10 !px-3 !text-xs shrink-0"
          >
            Lock
          </button>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-1 flex-wrap">
            {FILTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setFilter(item.id)}
                className={`h-6 px-2.5 rounded-full text-[10px] border transition-colors ${
                  filter === item.id
                    ? "border-[var(--color-primary)] text-[var(--color-primary)] bg-[var(--color-primary)]/10"
                    : "border-[var(--color-border)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="hidden md:flex items-center gap-3 text-[10px] text-[var(--color-text-tertiary)] tabular-nums">
            <span>{filtered.length} login{filtered.length === 1 ? "" : "s"}</span>
            <span>↵ password</span>
            <span>U user</span>
            <span>O open</span>
            <span>E edit</span>
          </div>
        </div>
      </div>

      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        {filtered.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-[var(--color-muted)] flex items-center justify-center text-[var(--color-text-tertiary)]">
              <Icon name="Key" className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-medium text-[var(--color-text-primary)]">
                {entries.length === 0 ? "No logins yet" : "No matches"}
              </div>
              <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
                {entries.length === 0
                  ? "Add a login, then copy with one keystroke."
                  : "Try another search or filter."}
              </p>
            </div>
            {entries.length === 0 && (
              <button type="button" onClick={startNew} className="btn-primary !h-8 !text-xs">
                New login
              </button>
            )}
          </div>
        ) : (
          <ul className="py-1">
            {filtered.map((entry, index) => {
              const active = index === activeIndex;
              const host = hostnameFromDomain(entry.domain);
              return (
                <li key={entry.id}>
                  <div
                    data-index={index}
                    role="option"
                    aria-selected={active}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => setActiveIndex(index)}
                    onDoubleClick={() => void copyEntryField(entry.id, "password")}
                    className={`group flex items-center gap-3 px-4 py-2.5 cursor-default border-l-2 transition-colors ${
                      active
                        ? "bg-[var(--color-muted)]/70 border-[var(--color-primary)]"
                        : "border-transparent hover:bg-[var(--color-muted)]/40"
                    }`}
                  >
                    <Favicon domain={entry.domain} title={entry.title} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                          {entry.title}
                        </span>
                        {entry.favorite && (
                          <Icon
                            name="Star"
                            className="w-3 h-3 shrink-0 text-[var(--color-semantic-warning)]"
                          />
                        )}
                        {(entry.strength === "weak" || entry.reusedCount > 0) && (
                          <span className="shrink-0 text-[10px] text-[var(--color-semantic-warning)]">
                            {entry.strength === "weak"
                              ? "Weak"
                              : `Reused ×${entry.reusedCount + 1}`}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 min-w-0 text-[11px] text-[var(--color-text-tertiary)]">
                        <span className="truncate">
                          {entry.username || "No username"}
                        </span>
                        {host && (
                          <>
                            <span className="opacity-40">·</span>
                            <span className="truncate">{host}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div
                      className={`flex items-center gap-1.5 shrink-0 transition-opacity ${
                        active ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      }`}
                    >
                      <ActionChip
                        label={copiedKey === `${entry.id}:username` ? "Copied" : "User"}
                        disabled={!entry.username}
                        onClick={() => void copyEntryField(entry.id, "username")}
                      />
                      <ActionChip
                        label={copiedKey === `${entry.id}:password` ? "Copied" : "Password"}
                        primary
                        onClick={() => void copyEntryField(entry.id, "password")}
                      />
                      <ActionChip
                        label="Open"
                        disabled={!host}
                        onClick={() => void openSite(entry.domain)}
                      />
                      <ActionChip label="Edit" onClick={() => void openEdit(entry.id)} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {mode === "edit" && draft && (
        <div className="absolute inset-0 z-20 flex bg-[var(--color-background)]/80 backdrop-blur-[2px]">
          <div className="m-auto w-full max-w-lg max-h-[min(92%,720px)] flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] shadow-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">
                  {isNew ? "New login" : draft.title || "Edit login"}
                </div>
                <div className="text-[10px] text-[var(--color-text-tertiary)]">
                  Esc to close · ⌘S to save
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {!isNew && (
                  <button
                    type="button"
                    onClick={() => void handleDelete()}
                    className="btn-secondary !h-7 !px-2"
                    title="Delete"
                  >
                    <Icon name="Trash2" className="w-3.5 h-3.5" />
                  </button>
                )}
                <button type="button" onClick={closeEdit} className="btn-secondary !h-7 !text-xs">
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!dirty || busy}
                  onClick={() => void handleSave()}
                  className="btn-primary !h-7 !text-xs"
                >
                  Save
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
              <div className="flex items-start gap-3">
                <Favicon domain={draft.domain} title={draft.title} />
                <div className="flex-1 min-w-0 space-y-2">
                  <input
                    value={draft.title}
                    onChange={(e) => updateDraft({ title: e.target.value })}
                    placeholder="Title"
                    className="w-full bg-transparent text-base font-semibold outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => updateDraft({ favorite: !draft.favorite })}
                    className={`inline-flex items-center gap-1 text-[10px] ${
                      draft.favorite
                        ? "text-[var(--color-semantic-warning)]"
                        : "text-[var(--color-text-tertiary)]"
                    }`}
                  >
                    <Icon name="Star" className="w-3.5 h-3.5" />
                    {draft.favorite ? "Favorite" : "Add to favorites"}
                  </button>
                </div>
              </div>

              {(
                [
                  ["domain", "Website / domain", "github.com"],
                  ["username", "Username or email", "you@company.com"],
                ] as const
              ).map(([field, label, placeholder]) => (
                <label key={field} className="block space-y-1.5">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
                    {label}
                  </span>
                  <input
                    value={draft[field]}
                    placeholder={placeholder}
                    onChange={(e) => updateDraft({ [field]: e.target.value })}
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full h-9 px-3 rounded-md border border-[var(--color-border)] bg-[var(--color-background)] text-sm font-mono"
                  />
                </label>
              ))}

              <div className="space-y-2">
                <label className="block space-y-1.5">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
                    Password
                  </span>
                  <div className="flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-2">
                    <input
                      type={revealPassword ? "text" : "password"}
                      value={draft.password}
                      onChange={(e) => updateDraft({ password: e.target.value })}
                      autoComplete="off"
                      spellCheck={false}
                      className="h-9 flex-1 min-w-0 bg-transparent text-sm font-mono outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setRevealPassword((prev) => !prev)}
                      className="p-1.5 text-[var(--color-text-tertiary)]"
                    >
                      <Icon
                        name={revealPassword ? "EyeOff" : "Eye"}
                        className="w-3.5 h-3.5"
                      />
                    </button>
                  </div>
                </label>
                <StrengthMeter password={draft.password} />
                <button
                  type="button"
                  onClick={() => setShowGenerator((prev) => !prev)}
                  className="text-[11px] text-[var(--color-primary)]"
                >
                  {showGenerator ? "Hide generator" : "Generate password"}
                </button>
                {showGenerator && (
                  <div className="rounded-md border border-[var(--color-border)] p-3 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        Length {generator.length}
                      </span>
                      <input
                        type="range"
                        min={8}
                        max={64}
                        value={generator.length}
                        onChange={(e) =>
                          setGenerator((prev) => ({
                            ...prev,
                            length: Number(e.target.value),
                          }))
                        }
                        className="flex-1"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      {(
                        [
                          ["uppercase", "A–Z"],
                          ["lowercase", "a–z"],
                          ["numbers", "0–9"],
                          ["symbols", "Symbols"],
                          ["excludeAmbiguous", "No lookalikes"],
                        ] as const
                      ).map(([key, label]) => (
                        <label key={key} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={generator[key]}
                            onChange={(e) =>
                              setGenerator((prev) => ({
                                ...prev,
                                [key]: e.target.checked,
                              }))
                            }
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        updateDraft({ password: generatePassword(generator) });
                        setRevealPassword(true);
                      }}
                      className="btn-primary !h-7 !text-xs w-full"
                    >
                      Use generated password
                    </button>
                  </div>
                )}
              </div>

              <label className="block space-y-1.5">
                <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
                  Notes
                </span>
                <textarea
                  value={draft.notes}
                  onChange={(e) => updateDraft({ notes: e.target.value })}
                  rows={3}
                  className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-background)] p-2 text-sm"
                  placeholder="Recovery codes, extra context…"
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 rounded-full bg-[var(--color-card)] border border-[var(--color-border)] text-xs shadow-sm">
          {toast}
        </div>
      )}
    </div>
  );
}
