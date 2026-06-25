import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { getHistory } from "../services/history";
import { useDebounce } from "../utils/debounce";
import { getElectronAPI } from "../utils/electronAPI";
import { openTool } from "../utils/appEvents";
import {
  openLocalDevShell,
  setDevShellPanelOpen,
  toggleDevShellPanel,
} from "../utils/devShell";

type SearchResultType =
  | "note"
  | "drawing"
  | "history"
  | "snippet"
  | "command"
  | "devshell";

interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  content?: string;
  keywords?: string[];
  action?: () => void;
}

const DEVSHELL_QUICK_ACTIONS: SearchResult[] = [
  {
    id: "devshell-open",
    type: "devshell",
    title: "Open DevShell",
    content: "Unified terminal — local, Kubernetes, and Docker in one tab bar",
    keywords: ["devshell", "terminal", "shell", "console", "bash", "zsh"],
    action: () => openTool("devshell"),
  },
  {
    id: "devshell-new-local",
    type: "devshell",
    title: "DevShell: New local shell",
    content: "Open DevShell and start a new local tab",
    keywords: ["devshell", "local", "shell", "new tab", "terminal"],
    action: () => openLocalDevShell(),
  },
  {
    id: "devshell-show-panel",
    type: "devshell",
    title: "DevShell: Show session panel",
    content: "Open command history, saved sessions, and session context",
    keywords: ["devshell", "panel", "sidebar", "history", "sessions"],
    action: () => {
      openTool("devshell");
      setDevShellPanelOpen(true);
    },
  },
  {
    id: "devshell-toggle-panel",
    type: "devshell",
    title: "DevShell: Toggle session panel",
    content: "Show or hide the DevShell side panel",
    keywords: ["devshell", "panel", "toggle", "sidebar"],
    action: () => {
      openTool("devshell");
      toggleDevShellPanel();
    },
  },
  {
    id: "devshell-k8s",
    type: "devshell",
    title: "DevShell: Open Kube Lens",
    content: "Browse pods and open shells from Kube Lens",
    keywords: ["devshell", "k8s", "kubernetes", "pod", "kubectl"],
    action: () => openTool("k8s"),
  },
  {
    id: "devshell-docker",
    type: "devshell",
    title: "DevShell: Open Docker",
    content: "Browse containers and open shells from Docker",
    keywords: ["devshell", "docker", "container"],
    action: () => openTool("docker"),
  },
];

const OTHER_QUICK_ACTIONS: SearchResult[] = [
  {
    id: "cmd-new-note",
    type: "command",
    title: "Create New Note",
    keywords: ["note", "new"],
    action: () => {
      window.dispatchEvent(
        new CustomEvent("navigate", { detail: { tab: "notes" } }),
      );
    },
  },
  {
    id: "cmd-new-drawing",
    type: "command",
    title: "Create New Drawing",
    keywords: ["drawing", "excalidraw", "new"],
    action: () => {
      window.dispatchEvent(
        new CustomEvent("navigate", { detail: { tab: "excalidraw" } }),
      );
    },
  },
];

function matchesQuery(result: SearchResult, lowerQuery: string): boolean {
  if (result.title.toLowerCase().includes(lowerQuery)) return true;
  if (result.content?.toLowerCase().includes(lowerQuery)) return true;
  return (
    result.keywords?.some((keyword) => keyword.toLowerCase().includes(lowerQuery)) ??
    false
  );
}

function resultIcon(type: SearchResultType): string {
  switch (type) {
    case "devshell":
      return "⌘";
    case "note":
      return "📝";
    case "drawing":
      return "✏️";
    case "history":
      return "🕐";
    case "snippet":
      return "⚡";
    default:
      return "⚙️";
  }
}

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [drawings, setDrawings] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [snippets, setSnippets] = useState<any[]>([]);

  const closeSearch = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setResults([]);
    setSelectedIndex(0);
  }, []);

  const executeResult = useCallback(
    (result: SearchResult) => {
      result.action?.();
      closeSearch();
    },
    [closeSearch],
  );

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const electronAPI = getElectronAPI();
    if (!electronAPI) return;

    try {
      const notesResult = await electronAPI.notes.list();
      if (notesResult.success) {
        setNotes(notesResult.notes || []);
      }

      const drawingsResult = await electronAPI.drawings.list();
      if (drawingsResult.success) {
        setDrawings(drawingsResult.drawings || []);
      }

      const historyData = await getHistory();
      setHistory(historyData);

      const snippetsResult = await electronAPI.snippets.get();
      if (snippetsResult.snippets) {
        setSnippets(snippetsResult.snippets || []);
      }
    } catch (err) {
      console.error("Failed to load data for search:", err);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }

      if (e.key === "Escape" && isOpen) {
        e.preventDefault();
        closeSearch();
      }

      if (isOpen) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
        } else if (e.key === "Enter" && results[selectedIndex]) {
          e.preventDefault();
          executeResult(results[selectedIndex]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, results, selectedIndex, closeSearch, executeResult]);

  const debouncedQuery = useDebounce(query, 200);

  const searchResults = useMemo(() => {
    const lowerQuery = debouncedQuery.trim().toLowerCase();

    if (!lowerQuery) {
      return [...DEVSHELL_QUICK_ACTIONS, ...OTHER_QUICK_ACTIONS].slice(0, 8);
    }

    const results: SearchResult[] = [];

    [...DEVSHELL_QUICK_ACTIONS, ...OTHER_QUICK_ACTIONS].forEach((command) => {
      if (matchesQuery(command, lowerQuery)) {
        results.push(command);
      }
    });

    notes.forEach((note) => {
      if (
        note.title?.toLowerCase().includes(lowerQuery) ||
        JSON.stringify(note.content || "")
          .toLowerCase()
          .includes(lowerQuery)
      ) {
        results.push({
          id: note.id,
          type: "note",
          title: note.title || "Untitled Note",
          content: JSON.stringify(note.content || "").substring(0, 100),
          action: () => {
            window.dispatchEvent(
              new CustomEvent("navigate", {
                detail: { tab: "notes", noteId: note.id },
              }),
            );
          },
        });
      }
    });

    drawings.forEach((drawing) => {
      if (drawing.title?.toLowerCase().includes(lowerQuery)) {
        results.push({
          id: drawing.id,
          type: "drawing",
          title: drawing.title || "Untitled Drawing",
          action: () => {
            window.dispatchEvent(
              new CustomEvent("navigate", {
                detail: { tab: "excalidraw", drawingId: drawing.id },
              }),
            );
          },
        });
      }
    });

    history.forEach((entry) => {
      if (
        entry.jsonInput?.toLowerCase().includes(lowerQuery) ||
        entry.output?.toLowerCase().includes(lowerQuery) ||
        entry.code?.toLowerCase().includes(lowerQuery)
      ) {
        results.push({
          id: entry.id,
          type: "history",
          title: `History: ${entry.type} - ${new Date(entry.timestamp).toLocaleDateString()}`,
          content: (
            entry.jsonInput ||
            entry.code ||
            entry.output ||
            ""
          ).substring(0, 100),
          action: () => {
            window.dispatchEvent(
              new CustomEvent("navigate", { detail: { tab: "schema" } }),
            );
          },
        });
      }
    });

    snippets.forEach((snippet) => {
      if (
        snippet.name?.toLowerCase().includes(lowerQuery) ||
        snippet.code?.toLowerCase().includes(lowerQuery)
      ) {
        results.push({
          id: snippet.id,
          type: "snippet",
          title: snippet.name || "Unnamed Snippet",
          content: (snippet.code || "").substring(0, 100),
          action: () => {
            window.dispatchEvent(
              new CustomEvent("navigate", {
                detail: { tab: "js-runner", snippetId: snippet.id },
              }),
            );
          },
        });
      }
    });

    return results.slice(0, 12);
  }, [debouncedQuery, notes, drawings, history, snippets]);

  useEffect(() => {
    setResults(searchResults);
    setSelectedIndex(0);
  }, [searchResults]);

  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    const selected = listRef.current.querySelector('[aria-selected="true"]');
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex, isOpen, results]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 modal-overlay z-50 flex items-start justify-center pt-32"
      role="presentation"
      onClick={closeSearch}
    >
      <div
        className="modal-panel w-full max-w-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="global-search-label"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-3">
            <div className="text-[var(--color-text-tertiary)]" aria-hidden="true">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <label id="global-search-label" className="sr-only">
              Global search
            </label>
            <input
              ref={inputRef}
              id="global-search-input"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tools, DevShell, notes, or commands…"
              className="flex-1 bg-transparent border-none outline-none text-[var(--color-text-primary)] placeholder-[var(--color-text-muted-soft)] text-sm"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              aria-controls="global-search-results"
              aria-activedescendant={
                results[selectedIndex]
                  ? `global-search-result-${results[selectedIndex].id}`
                  : undefined
              }
            />
            <div
              className="hidden sm:flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]"
              aria-hidden="true"
            >
              <kbd className="px-2 py-1 bg-[var(--color-muted)] border border-[var(--color-border)] rounded-md">
                ↑↓
              </kbd>
              <span>Navigate</span>
              <kbd className="px-2 py-1 bg-[var(--color-muted)] border border-[var(--color-border)] rounded-md">
                ↵
              </kbd>
              <span>Select</span>
              <kbd className="px-2 py-1 bg-[var(--color-muted)] border border-[var(--color-border)] rounded-md">
                Esc
              </kbd>
              <span>Close</span>
            </div>
          </div>
        </div>

        {results.length > 0 ? (
          <div
            id="global-search-results"
            ref={listRef}
            role="listbox"
            aria-label="Search results"
            className="max-h-96 overflow-y-auto"
          >
            {!debouncedQuery.trim() && (
              <div className="px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-tertiary)] border-b border-[var(--color-border)]">
                Quick actions · DevShell
              </div>
            )}
            {results.map((result, index) => (
              <div
                key={result.id}
                id={`global-search-result-${result.id}`}
                role="option"
                aria-selected={index === selectedIndex}
                onClick={() => executeResult(result)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`px-4 py-3 cursor-pointer border-b border-[var(--color-border)] transition-colors ${
                  index === selectedIndex
                    ? "bg-[var(--color-muted)]"
                    : "hover:bg-[var(--color-background-soft)]"
                } ${result.type === "devshell" ? "devshell-search-result" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5" aria-hidden="true">
                    {resultIcon(result.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[var(--color-text-primary)]">
                      {result.title}
                    </div>
                    {result.content && (
                      <div className="text-xs text-[var(--color-text-secondary)] mt-1 truncate">
                        {result.content}
                      </div>
                    )}
                    <div className="text-[10px] text-[var(--color-text-tertiary)] mt-1 uppercase">
                      {result.type === "devshell" ? "DevShell" : result.type}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : query ? (
          <div
            className="p-8 text-center text-sm text-[var(--color-text-secondary)]"
            role="status"
          >
            No results found for &ldquo;{query}&rdquo;
          </div>
        ) : (
          <div
            className="p-8 text-center text-sm text-[var(--color-text-secondary)]"
            role="status"
          >
            Start typing to search…
          </div>
        )}
      </div>
    </div>
  );
}
