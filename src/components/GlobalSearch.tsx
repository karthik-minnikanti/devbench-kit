import { useState, useEffect, useRef, useMemo } from "react";
import { getHistory } from "../services/history";
import { useDebounce } from "../utils/debounce";
import { getElectronAPI } from "../utils/electronAPI";

interface SearchResult {
  id: string;
  type: "note" | "drawing" | "history" | "snippet" | "command";
  title: string;
  content?: string;
  action?: () => void;
}

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [drawings, setDrawings] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [snippets, setSnippets] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const electronAPI = getElectronAPI();
    if (!electronAPI) return;

    try {
      // Load notes
      const notesResult = await electronAPI.notes.list();
      if (notesResult.success) {
        setNotes(notesResult.notes || []);
      }

      // Load drawings
      const drawingsResult = await electronAPI.drawings.list();
      if (drawingsResult.success) {
        setDrawings(drawingsResult.drawings || []);
      }

      // Load history
      const historyData = await getHistory();
      setHistory(historyData);

      // Load snippets
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
      // Cmd+K or Ctrl+K to open
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }

      // Escape to close
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
        setQuery("");
        setResults([]);
      }

      // Arrow keys navigation
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
  }, [isOpen, results, selectedIndex]);

  // Debounce search query to avoid expensive operations on every keystroke
  const debouncedQuery = useDebounce(query, 200);

  // Memoize search results computation
  const searchResults = useMemo(() => {
    if (!debouncedQuery.trim()) {
      return [];
    }

    const results: SearchResult[] = [];
    const lowerQuery = debouncedQuery.toLowerCase();

    // Search notes
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
            // Navigate to notes tab and select this note
            window.dispatchEvent(
              new CustomEvent("navigate", {
                detail: { tab: "notes", noteId: note.id },
              }),
            );
            setIsOpen(false);
          },
        });
      }
    });

    // Search drawings
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
            setIsOpen(false);
          },
        });
      }
    });

    // Search history
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
            setIsOpen(false);
          },
        });
      }
    });

    // Search snippets
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
            setIsOpen(false);
          },
        });
      }
    });

    // Commands
    const commands = [
      {
        id: "cmd-new-note",
        title: "Create New Note",
        action: () => {
          window.dispatchEvent(
            new CustomEvent("navigate", { detail: { tab: "notes" } }),
          );
          setIsOpen(false);
        },
      },
      {
        id: "cmd-new-drawing",
        title: "Create New Drawing",
        action: () => {
          window.dispatchEvent(
            new CustomEvent("navigate", { detail: { tab: "excalidraw" } }),
          );
          setIsOpen(false);
        },
      },
      {
        id: "cmd-settings",
        title: "Open Settings",
        action: () => {
          setIsOpen(false);
        },
      },
    ];

    commands.forEach((cmd) => {
      if (cmd.title.toLowerCase().includes(lowerQuery)) {
        results.push({
          id: cmd.id,
          type: "command",
          title: cmd.title,
          action: cmd.action,
        });
      }
    });

    return results.slice(0, 10); // Limit to 10 results
  }, [debouncedQuery, notes, drawings, history, snippets]);

  // Update results when search results change
  useEffect(() => {
    setResults(searchResults);
    setSelectedIndex(0);
  }, [searchResults]);

  const executeResult = (result: SearchResult) => {
    if (result.action) {
      result.action();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 modal-overlay z-50 flex items-start justify-center pt-32"
      onClick={() => {
        setIsOpen(false);
        setQuery("");
        setResults([]);
      }}
    >
      <div
        className="modal-panel w-full max-w-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-3">
            <div className="text-[var(--color-text-tertiary)]">
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
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notes, drawings, history, snippets, or commands..."
              className="flex-1 bg-transparent border-none outline-none text-[var(--color-text-primary)] placeholder-[var(--color-text-muted-soft)] text-sm"
              autoFocus
            />
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-tertiary)]">
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

        {/* Results */}
        {results.length > 0 ? (
          <div className="max-h-96 overflow-y-auto">
            {results.map((result, index) => (
              <div
                key={result.id}
                onClick={() => executeResult(result)}
                className={`px-4 py-3 cursor-pointer border-b border-[var(--color-border)] transition-colors ${
                  index === selectedIndex
                    ? "bg-[var(--color-muted)]"
                    : "hover:bg-[var(--color-background-soft)]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {result.type === "note" && "📝"}
                    {result.type === "drawing" && "✏️"}
                    {result.type === "history" && "🕐"}
                    {result.type === "snippet" && "⚡"}
                    {result.type === "command" && "⚙️"}
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
                      {result.type}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : query ? (
          <div className="p-8 text-center text-sm text-[var(--color-text-secondary)]">
            No results found for "{query}"
          </div>
        ) : (
          <div className="p-8 text-center text-sm text-[var(--color-text-secondary)]">
            Start typing to search...
          </div>
        )}
      </div>
    </div>
  );
}
