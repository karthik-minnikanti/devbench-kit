import { useState, useEffect, useRef } from 'react';
import { getHistory } from '../services/history';

interface SearchResult {
    id: string;
    type: 'note' | 'drawing' | 'history' | 'snippet' | 'command';
    title: string;
    content?: string;
    action?: () => void;
}

export function GlobalSearch() {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
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
        if (!window.electronAPI) return;

        try {
            // Load notes
            const notesResult = await window.electronAPI.notes.list();
            if (notesResult.success) {
                setNotes(notesResult.notes || []);
            }

            // Load drawings
            const drawingsResult = await window.electronAPI.drawings.list();
            if (drawingsResult.success) {
                setDrawings(drawingsResult.drawings || []);
            }

            // Load history
            const historyData = await getHistory();
            setHistory(historyData);

            // Load snippets
            const snippetsResult = await window.electronAPI.snippets.get();
            if (snippetsResult.snippets) {
                setSnippets(snippetsResult.snippets || []);
            }
        } catch (err) {
            console.error('Failed to load data for search:', err);
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Cmd+K or Ctrl+K to open
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(true);
                setTimeout(() => inputRef.current?.focus(), 0);
            }

            // Escape to close
            if (e.key === 'Escape' && isOpen) {
                setIsOpen(false);
                setQuery('');
                setResults([]);
            }

            // Arrow keys navigation
            if (isOpen) {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSelectedIndex((prev) => Math.max(prev - 1, 0));
                } else if (e.key === 'Enter' && results[selectedIndex]) {
                    e.preventDefault();
                    executeResult(results[selectedIndex]);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, results, selectedIndex]);

    useEffect(() => {
        if (!query.trim()) {
            setResults([]);
            return;
        }

        const searchResults: SearchResult[] = [];
        const lowerQuery = query.toLowerCase();

        // Search notes
        notes.forEach((note) => {
            if (
                note.title?.toLowerCase().includes(lowerQuery) ||
                JSON.stringify(note.content || '').toLowerCase().includes(lowerQuery)
            ) {
                searchResults.push({
                    id: note.id,
                    type: 'note',
                    title: note.title || 'Untitled Note',
                    content: JSON.stringify(note.content || '').substring(0, 100),
                    action: () => {
                        // Navigate to notes tab and select this note
                        window.dispatchEvent(new CustomEvent('navigate', { detail: { tab: 'notes', noteId: note.id } }));
                        setIsOpen(false);
                    },
                });
            }
        });

        // Search drawings
        drawings.forEach((drawing) => {
            if (drawing.title?.toLowerCase().includes(lowerQuery)) {
                searchResults.push({
                    id: drawing.id,
                    type: 'drawing',
                    title: drawing.title || 'Untitled Drawing',
                    action: () => {
                        window.dispatchEvent(new CustomEvent('navigate', { detail: { tab: 'excalidraw', drawingId: drawing.id } }));
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
                searchResults.push({
                    id: entry.id,
                    type: 'history',
                    title: `History: ${entry.type} - ${new Date(entry.timestamp).toLocaleDateString()}`,
                    content: (entry.jsonInput || entry.code || entry.output || '').substring(0, 100),
                    action: () => {
                        window.dispatchEvent(new CustomEvent('navigate', { detail: { tab: 'schema' } }));
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
                searchResults.push({
                    id: snippet.id,
                    type: 'snippet',
                    title: snippet.name || 'Unnamed Snippet',
                    content: (snippet.code || '').substring(0, 100),
                    action: () => {
                        window.dispatchEvent(new CustomEvent('navigate', { detail: { tab: 'js-runner', snippetId: snippet.id } }));
                        setIsOpen(false);
                    },
                });
            }
        });

        // Commands
        const commands = [
            { id: 'cmd-new-note', title: 'Create New Note', action: () => { window.dispatchEvent(new CustomEvent('navigate', { detail: { tab: 'notes' } })); setIsOpen(false); } },
            { id: 'cmd-new-drawing', title: 'Create New Drawing', action: () => { window.dispatchEvent(new CustomEvent('navigate', { detail: { tab: 'excalidraw' } })); setIsOpen(false); } },
            { id: 'cmd-settings', title: 'Open Settings', action: () => { setIsOpen(false); } },
        ];

        commands.forEach((cmd) => {
            if (cmd.title.toLowerCase().includes(lowerQuery)) {
                searchResults.push({
                    id: cmd.id,
                    type: 'command',
                    title: cmd.title,
                    action: cmd.action,
                });
            }
        });

        setResults(searchResults.slice(0, 10)); // Limit to 10 results
        setSelectedIndex(0);
    }, [query, notes, drawings, history, snippets]);

    const executeResult = (result: SearchResult) => {
        if (result.action) {
            result.action();
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-32"
            onClick={() => {
                setIsOpen(false);
                setQuery('');
                setResults([]);
            }}
        >
            <div
                className="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Search Input */}
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                        <div className="text-gray-400 dark:text-gray-500">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search notes, drawings, history, snippets, or commands..."
                            className="flex-1 bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-sm"
                            autoFocus
                        />
                        <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                            <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">↑↓</kbd>
                            <span>Navigate</span>
                            <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">↵</kbd>
                            <span>Select</span>
                            <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">Esc</kbd>
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
                                className={`px-4 py-3 cursor-pointer border-b border-gray-100 dark:border-gray-800 transition-colors ${
                                    index === selectedIndex
                                        ? 'bg-gray-100 dark:bg-gray-800'
                                        : 'hover:bg-gray-50 dark:hover:bg-gray-850'
                                }`}
                            >
                                <div className="flex items-start gap-3">
                                    <div className="mt-0.5">
                                        {result.type === 'note' && '📝'}
                                        {result.type === 'drawing' && '✏️'}
                                        {result.type === 'history' && '🕐'}
                                        {result.type === 'snippet' && '⚡'}
                                        {result.type === 'command' && '⚙️'}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                                            {result.title}
                                        </div>
                                        {result.content && (
                                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                                                {result.content}
                                            </div>
                                        )}
                                        <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 uppercase">
                                            {result.type}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : query ? (
                    <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                        No results found for "{query}"
                    </div>
                ) : (
                    <div className="p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                        Start typing to search...
                    </div>
                )}
            </div>
        </div>
    );
}

