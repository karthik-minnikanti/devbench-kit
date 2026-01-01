import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { BlockNoteEditor, PartialBlock } from '@blocknote/core';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import '@blocknote/core/fonts/inter.css';
import '@blocknote/mantine/style.css';
import { groupByDate, DateGroup } from '../utils/dateGrouping';
import { getNotes, saveNote, deleteNote, Note as NoteType, getFolders, saveFolder, deleteFolder, Folder } from '../services/sync';
import { Icon } from './Icon';
import { hasNoteChanged } from '../utils/sync';
import { NoteItem } from './memoized-list-items';

interface Note {
    id: string;
    title: string;
    content: any;
    folderId?: string | null;
    createdAt: string;
    updatedAt: string;
}

export function Notes() {
    const [notes, setNotes] = useState<Note[]>([]);
    const [folders, setFolders] = useState<Folder[]>([]);
    const [selectedNote, setSelectedNote] = useState<string | null>(null);
    const [noteTitle, setNoteTitle] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [dateGroups, setDateGroups] = useState<DateGroup[]>([]);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['Today', 'Yesterday', 'This Week']));
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
    const [showSidebar, setShowSidebar] = useState(true);
    const [newFolderName, setNewFolderName] = useState('');
    const [showNewFolderInput, setShowNewFolderInput] = useState(false);
    const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null);
    const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
    
    const editorRef = useRef<BlockNoteEditor | null>(null);
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const titleSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastSyncedStateRef = useRef<Map<string, { title: string; content: any; folderId?: string | null }>>(new Map());
    const isSavingRef = useRef<boolean>(false);
    const creatingNoteRef = useRef<boolean>(false);
    const lastLoadedNoteIdRef = useRef<string | null>(null);

    useEffect(() => {
        loadNotes();
        loadFolders();
    }, []);

    useEffect(() => {
        const pendingItem = (window as any).__pendingItemId;
        if (pendingItem && pendingItem.toolType === 'notes' && pendingItem.itemId) {
            setTimeout(() => {
                const noteId = pendingItem.itemId;
                const note = notes.find(n => String(n.id) === String(noteId));
                if (note) {
                    handleSelectNote(note.id);
                }
                delete (window as any).__pendingItemId;
            }, 500);
        }
    }, [notes]);

    const normalizeNoteId = (note: any): string => {
        return String(note.id || note._id || '');
    };

    const loadNotes = async () => {
        try {
            const loadedNotes = await getNotes();
            const transformedNotes = loadedNotes
                .map(note => ({
                    ...note,
                    id: normalizeNoteId(note),
                    folderId: note.folderId ?? null,
                    createdAt: note.createdAt || new Date().toISOString(),
                    updatedAt: note.updatedAt || new Date().toISOString(),
                }))
                .filter(note => note.id);
            
            setNotes(transformedNotes);
            setDateGroups(groupByDate(transformedNotes));
            
            // Update last synced state
            transformedNotes.forEach(note => {
                if (note.content) {
                    lastSyncedStateRef.current.set(note.id, {
                        title: note.title,
                        content: note.content,
                        folderId: note.folderId ?? null
                    });
                }
            });
        } catch (err) {
            console.error('Failed to load notes:', err);
        }
    };

    const loadFolders = async () => {
        try {
            const loadedFolders = await getFolders();
            const normalizedFolders = loadedFolders.map(folder => ({
                ...folder,
                id: folder.id || (folder as any)._id,
            }));
            normalizedFolders.sort((a, b) => {
                const dateA = new Date(a.createdAt || 0).getTime();
                const dateB = new Date(b.createdAt || 0).getTime();
                return dateB - dateA;
            });
            setFolders(normalizedFolders);
        } catch (err) {
            console.error('Failed to load folders:', err);
        }
    };

    const handleCreateFolder = useCallback(async () => {
        if (!newFolderName.trim() || loading) return;
        setLoading(true);
        try {
            const newFolder = await saveFolder({
                name: newFolderName.trim(),
                parentId: null,
            });
            if (newFolder) {
                setNewFolderName('');
                setShowNewFolderInput(false);
                await loadFolders();
            }
        } catch (err) {
            console.error('Failed to create folder:', err);
        } finally {
            setLoading(false);
        }
    }, [newFolderName, loading]);

    const handleDeleteFolder = useCallback(async (folderId: string) => {
        if (!confirm('Delete this folder? Items inside will be moved to root.')) return;
        try {
            const success = await deleteFolder(folderId);
            if (success) {
                const notesInFolder = notes.filter(n => n.folderId === folderId);
                for (const note of notesInFolder) {
                    await saveNote({ ...note, folderId: null } as NoteType);
                }
                await loadFolders();
                await loadNotes();
            }
        } catch (err) {
            console.error('Failed to delete folder:', err);
        }
    }, [notes]);

    const handleDragStart = useCallback((e: React.DragEvent, noteId: string) => {
        e.stopPropagation();
        setDraggedNoteId(noteId);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('application/x-note-id', noteId);
        e.dataTransfer.setData('text/plain', '');
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent, folderId: string | null) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        setDragOverFolderId(folderId);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX;
        const y = e.clientY;
        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
            setDragOverFolderId(null);
        }
    }, []);

    const handleDrop = useCallback(async (e: React.DragEvent, targetFolderId: string | null) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOverFolderId(null);
        
        const noteId = e.dataTransfer.getData('application/x-note-id') || draggedNoteId;
        if (!noteId) {
            setDraggedNoteId(null);
            return;
        }

        const note = notes.find(n => n.id === noteId);
        if (!note || note.folderId === targetFolderId) {
            setDraggedNoteId(null);
            return;
        }

        try {
            await saveNote({
                ...note,
                folderId: targetFolderId
            } as NoteType);
            await loadNotes();
            
            if (targetFolderId) {
                setExpandedFolders(prev => new Set(prev).add(targetFolderId));
            }
        } catch (err) {
            console.error('Failed to move note:', err);
        } finally {
            setDraggedNoteId(null);
        }
    }, [notes, draggedNoteId]);

    const toggleFolder = useCallback((folderId: string) => {
        const normalizedId = String(folderId || '');
        if (!normalizedId) return;
        setExpandedFolders(prev => {
            const newSet = new Set(prev);
            if (newSet.has(normalizedId)) {
                newSet.delete(normalizedId);
            } else {
                newSet.add(normalizedId);
            }
            return newSet;
        });
    }, []);

    const getNotesInFolder = useCallback((folderId: string | null) => {
        if (folderId === null) {
            return notes.filter(note => !note.folderId);
        }
        return notes.filter(note => note.folderId === folderId);
    }, [notes]);

    const getFolderNotesGrouped = useCallback((folderId: string) => {
        return groupByDate(getNotesInFolder(folderId));
    }, [getNotesInFolder]);

    const toggleGroup = useCallback((label: string) => {
        setExpandedGroups(prev => {
            const newSet = new Set(prev);
            if (newSet.has(label)) {
                newSet.delete(label);
            } else {
                newSet.add(label);
            }
            return newSet;
        });
    }, []);

    // Get initial content for editor - only depends on selectedNote, not notes state
    // This prevents editor recreation when notes state changes
    const getInitialContent = useMemo(() => {
        // Always return default content - we'll load actual content in useEffect
        return [{ type: 'paragraph', content: 'Start typing...' }];
    }, []); // No dependencies - always same initial content

    const editor = useCreateBlockNote({
        initialContent: getInitialContent,
    });

    editorRef.current = editor;

    // Load note content into editor ONLY when selectedNote changes
    // ALWAYS fetch fresh content when switching notes
    useEffect(() => {
        if (!editor || !selectedNote) return;

        const loadNoteContent = async () => {
            try {
                // Fetch fresh note data from file system
                const allNotes = await getNotes();
                const note = allNotes.find(n => {
                    const noteId = String(n.id || (n as any)._id || '');
                    return noteId === selectedNote;
                });

                if (!note) {
                    // Note not found, clear editor
                    try {
                        isSavingRef.current = true;
                        editor.replaceBlocks(editor.document, [{ type: 'paragraph', content: 'Start typing...' }]);
                        lastLoadedNoteIdRef.current = selectedNote;
                        setTimeout(() => { isSavingRef.current = false; }, 100);
                    } catch (error) {
                        console.error('Error clearing editor:', error);
                        isSavingRef.current = false;
                    }
                    return;
                }

                const noteContent = note.content || [];
                const contentToLoad = noteContent.length > 0 
                    ? JSON.parse(JSON.stringify(noteContent)) as PartialBlock[]
                    : [{ type: 'paragraph', content: 'Start typing...' }];
                
                // Compare with current editor content to avoid unnecessary updates
                const currentContent = editor.document;
                const currentStr = JSON.stringify(currentContent);
                const newStr = JSON.stringify(contentToLoad);
                
                // Only update if content is actually different
                if (currentStr !== newStr) {
                    // Mark as saving to prevent onChange from firing during load
                    isSavingRef.current = true;
                    editor.replaceBlocks(editor.document, contentToLoad);
                    
                    // Update last synced state with fresh content
                    lastSyncedStateRef.current.set(selectedNote, {
                        title: note.title,
                        content: JSON.parse(JSON.stringify(noteContent)),
                        folderId: note.folderId ?? null
                    });
                    
                    // Update notes state with fresh content
                    // But preserve the current title if it's different (user might be renaming)
                    setNotes(prev => prev.map(n => {
                        if (n.id === selectedNote) {
                            const currentTitle = noteTitle || n.title;
                            // Use the title from file, but if user is typing something different, preserve it
                            const titleToUse = (currentTitle !== n.title && currentTitle !== note.title) 
                                ? currentTitle 
                                : note.title;
                            
                            return { 
                                ...n, 
                                title: titleToUse,
                                content: JSON.parse(JSON.stringify(noteContent)),
                                folderId: note.folderId ?? null,
                                updatedAt: note.updatedAt || n.updatedAt
                            };
                        }
                        return n;
                    }));
                    
                    // Always update title when loading note content
                    // But preserve if user is currently typing
                    setNoteTitle(prevTitle => {
                        // If user has typed something different, keep it
                        if (prevTitle && prevTitle !== note.title) {
                            // Check if it's been more than 500ms since last change (user might be done typing)
                            // For now, always preserve user's input
                            return prevTitle;
                        }
                        return note.title;
                    });
                    
                    lastLoadedNoteIdRef.current = selectedNote;
                    
                    // Clear saving flag after a brief delay
                    setTimeout(() => {
                        isSavingRef.current = false;
                    }, 100);
                } else {
                    // Content is same, just update metadata
                    lastLoadedNoteIdRef.current = selectedNote;
                    // Update title to match the loaded note, but preserve if user is typing
                    setNoteTitle(prevTitle => {
                        if (prevTitle && prevTitle !== note.title) {
                            // User might be typing, preserve their input
                            return prevTitle;
                        }
                        return note.title;
                    });
                    
                    // Update notes state with fresh title from file
                    setNotes(prev => prev.map(n => {
                        if (n.id === selectedNote) {
                            // Only update title if it matches what we're loading (don't overwrite user's typing)
                            const titleToUse = (noteTitle && noteTitle !== note.title) ? noteTitle : note.title;
                            return { ...n, title: titleToUse };
                        }
                        return n;
                    }));
                }
            } catch (error) {
                console.error('Error loading note content:', error);
                isSavingRef.current = false;
            }
        };

        loadNoteContent();
    }, [selectedNote, editor]); // Only depends on selectedNote, NOT notes

    // Auto-save on editor changes
    useEffect(() => {
        if (!editor || !selectedNote) return;

        const handleChange = () => {
            // Don't save if we're currently loading content or saving
            if (isSavingRef.current || !selectedNote) return;
            
            // Don't save if this note isn't loaded yet
            if (lastLoadedNoteIdRef.current !== selectedNote) return;

            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }

            saveTimeoutRef.current = setTimeout(() => {
                if (selectedNote && editorRef.current && lastLoadedNoteIdRef.current === selectedNote) {
                    saveCurrentNote();
                }
            }, 500);
        };

        editor.onChange(handleChange);

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [editor, selectedNote]);

    const saveCurrentNote = useCallback(async () => {
        if (!selectedNote || !editorRef.current || isSavingRef.current) return;

        const note = notes.find(n => n.id === selectedNote);
        if (!note) return;

        const currentContent = editorRef.current.document;
        const currentTitle = noteTitle || note.title;

        // Check if changed
        const lastSynced = lastSyncedStateRef.current.get(selectedNote);
        if (lastSynced) {
            const contentChanged = JSON.stringify(lastSynced.content) !== JSON.stringify(currentContent);
            const titleChanged = lastSynced.title !== currentTitle;
            if (!contentChanged && !titleChanged) {
                return; // No changes
            }
        }

        isSavingRef.current = true;

        try {
            const updatedNote = await saveNote({
                id: note.id,
                title: currentTitle,
                content: JSON.parse(JSON.stringify(currentContent)),
                folderId: note.folderId ?? null,
            } as NoteType);

            if (updatedNote) {
                // Update last synced state
                lastSyncedStateRef.current.set(selectedNote, {
                    title: currentTitle,
                    content: JSON.parse(JSON.stringify(currentContent)),
                    folderId: note.folderId ?? null
                });

                // NEVER update notes state for currently selected note
                // This prevents the editor from being reset
                // Only update state for other notes
                if (updatedNote.id && String(updatedNote.id) !== selectedNote) {
                    setNotes(prev => prev.map(n => 
                        String(n.id) === String(updatedNote.id) 
                            ? { ...n, ...updatedNote, id: String(updatedNote.id) }
                            : n
                    ));
                }
                // For selected note: skip ALL state updates to prevent editor reset
            }
        } catch (err) {
            console.error('Failed to save note:', err);
        } finally {
            isSavingRef.current = false;
        }
    }, [selectedNote, notes, noteTitle]);

    const handleSelectNote = useCallback(async (noteId: string) => {
        const normalizedId = String(noteId || '');
        
        // Save current note before switching
        if (selectedNote && selectedNote !== normalizedId && editorRef.current) {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
                saveTimeoutRef.current = null;
            }
            await saveCurrentNote();
        }

        // Always clear last loaded ref to force fresh content load
        lastLoadedNoteIdRef.current = null;
        
        // Get the note to set title immediately
        const note = notes.find(n => n.id === normalizedId);
        if (note) {
            setNoteTitle(note.title);
        }
        
        // Set selected note - this will trigger the useEffect to load fresh content
        setSelectedNote(normalizedId);
    }, [selectedNote, notes, saveCurrentNote]);

    // Generate UUID v4
    const generateUUID = useCallback(() => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }, []);

    const handleCreateNote = useCallback(async () => {
        if (loading || creatingNoteRef.current) return; // Prevent duplicate creation
        
        creatingNoteRef.current = true;
        setLoading(true);
        
        try {
            const uniqueId = generateUUID();
            const timestamp = new Date().toLocaleString();
            
            const newNote = await saveNote({
                id: uniqueId,
                title: `Untitled Note ${timestamp}`,
                content: [{ type: 'paragraph', content: 'Start typing...' }],
                folderId: null,
            } as NoteType);

            if (newNote) {
                const noteId = String(newNote.id || (newNote as any)._id || uniqueId);
                
                // Add to state immediately
                setNotes(prev => {
                    // Check if already exists to prevent duplicates
                    if (prev.find(n => n.id === noteId)) {
                        return prev;
                    }
                    return [...prev, {
                        id: noteId,
                        title: newNote.title,
                        content: newNote.content || [{ type: 'paragraph', content: 'Start typing...' }],
                        folderId: null,
                        createdAt: newNote.createdAt || new Date().toISOString(),
                        updatedAt: newNote.updatedAt || new Date().toISOString(),
                    }];
                });

                setSelectedNote(noteId);
                setNoteTitle(newNote.title);
                
                lastSyncedStateRef.current.set(noteId, {
                    title: newNote.title,
                    content: newNote.content || [{ type: 'paragraph', content: 'Start typing...' }],
                    folderId: null
                });

                // Reload to get fresh data
                await loadNotes();
            }
        } catch (err) {
            console.error('Failed to create note:', err);
        } finally {
            setLoading(false);
            creatingNoteRef.current = false;
        }
    }, [loading, generateUUID]);

    const handleDeleteNote = useCallback(async (noteId: string) => {
        if (!confirm('Delete this note?')) return;

        try {
            const success = await deleteNote(noteId);
            if (success) {
                setNotes(prev => prev.filter(n => n.id !== noteId));
                lastSyncedStateRef.current.delete(noteId);
                
                if (selectedNote === noteId) {
                    setSelectedNote(null);
                    setNoteTitle('');
                }
                
                await loadNotes();
            }
        } catch (err) {
            console.error('Failed to delete note:', err);
        }
    }, [selectedNote]);

    const handleExportPDF = useCallback(async () => {
        if (!selectedNote || !editorRef.current) return;
        
        try {
            const note = notes.find(n => n.id === selectedNote);
            if (!note) return;

            // Get the editor content as HTML
            const htmlContent = await editorRef.current.blocksToHTMLLossy(editorRef.current.document);
            
            // Create a temporary container with the note content
            const printWindow = window.open('', '_blank');
            if (!printWindow) {
                alert('Please allow popups to export PDF');
                return;
            }

            const isDark = document.documentElement.classList.contains('dark');
            const bgColor = isDark ? '#111827' : '#fafafa';
            const textColor = isDark ? '#f9fafb' : '#111827';
            const borderColor = isDark ? '#374151' : '#e5e7eb';

            printWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>${note.title || 'Untitled Note'}</title>
                    <style>
                        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
                        * {
                            margin: 0;
                            padding: 0;
                            box-sizing: border-box;
                        }
                        body {
                            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
                            background: ${bgColor};
                            color: ${textColor};
                            padding: 40px;
                            line-height: 1.6;
                        }
                        h1 {
                            font-size: 28px;
                            font-weight: 700;
                            margin-bottom: 24px;
                            color: ${textColor};
                            border-bottom: 2px solid ${borderColor};
                            padding-bottom: 12px;
                        }
                        .content {
                            max-width: 800px;
                            margin: 0 auto;
                        }
                        @media print {
                            body {
                                padding: 20px;
                            }
                        }
                    </style>
                </head>
                <body>
                    <div class="content">
                        <h1>${note.title || 'Untitled Note'}</h1>
                        <div>${htmlContent}</div>
                    </div>
                </body>
                </html>
            `);
            printWindow.document.close();
            
            // Wait for content to load, then print
            setTimeout(() => {
                printWindow.print();
            }, 250);
        } catch (err) {
            console.error('Failed to export PDF:', err);
            alert('Failed to export PDF. Please try again.');
        }
    }, [selectedNote, notes]);

    const handleTitleChange = useCallback((newTitle: string) => {
        const currentNoteId = selectedNote;
        if (!currentNoteId) return;
        
        // Update title immediately in UI
        setNoteTitle(newTitle);
        
        // Update sidebar immediately (optimistic update)
        // Force re-render by creating new array and objects
        setNotes(prev => {
            const updated = prev.map(n => 
                n.id === currentNoteId 
                    ? { ...n, title: newTitle } // New object reference
                    : n
            );
            // Update date groups to reflect the change
            setDateGroups(groupByDate(updated));
            return [...updated]; // New array reference to force re-render
        });
        
        // Clear any pending save
        if (titleSaveTimeoutRef.current) {
            clearTimeout(titleSaveTimeoutRef.current);
        }
        
        // Save immediately (no debounce for title changes)
        titleSaveTimeoutRef.current = setTimeout(async () => {
            if (!currentNoteId || !editorRef.current || isSavingRef.current) return;

            // Get fresh note data
            const currentNotes = await getNotes();
            const note = currentNotes.find(n => {
                const noteId = String(n.id || (n as any)._id || '');
                return noteId === currentNoteId;
            });
            
            if (!note) {
                console.error('Note not found for title save:', currentNoteId);
                return;
            }

            const currentContent = editorRef.current.document;
            
            // Check if title actually changed from last synced
            const lastSynced = lastSyncedStateRef.current.get(currentNoteId);
            if (lastSynced && lastSynced.title === newTitle) {
                console.log('Title unchanged, skipping save');
                return; // Title hasn't changed
            }

            isSavingRef.current = true;

            try {
                console.log('Saving title change:', { noteId: currentNoteId, oldTitle: note.title, newTitle });
                
                const updatedNote = await saveNote({
                    id: currentNoteId,
                    title: newTitle,
                    content: JSON.parse(JSON.stringify(currentContent)),
                    folderId: note.folderId ?? null,
                } as NoteType);

                if (updatedNote) {
                    console.log('Title saved successfully:', updatedNote);
                    
                    // Update last synced state
                    lastSyncedStateRef.current.set(currentNoteId, {
                        title: newTitle,
                        content: JSON.parse(JSON.stringify(currentContent)),
                        folderId: note.folderId ?? null
                    });

                    // Update the note in the list with server response (in case it changed)
                    setNotes(prev => prev.map(n => 
                        n.id === currentNoteId 
                            ? { ...n, title: newTitle, updatedAt: updatedNote.updatedAt || new Date().toISOString() }
                            : n
                    ));
                } else {
                    console.error('Failed to save title: updatedNote is null');
                }
            } catch (err) {
                console.error('Failed to save title:', err);
            } finally {
                isSavingRef.current = false;
            }
        }, 200); // Very short debounce - saves almost immediately
    }, [selectedNote]);

    // Keyboard shortcuts - placed after all handlers are defined
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Cmd/Ctrl + N: New note
            if ((e.metaKey || e.ctrlKey) && e.key === 'n' && !e.shiftKey) {
                e.preventDefault();
                if (!loading && !creatingNoteRef.current) {
                    handleCreateNote();
                }
            }
            // Cmd/Ctrl + E: Export PDF
            if ((e.metaKey || e.ctrlKey) && e.key === 'e' && !e.shiftKey) {
                e.preventDefault();
                if (selectedNote && editorRef.current) {
                    handleExportPDF();
                }
            }
            // Cmd/Ctrl + B: Toggle sidebar
            if ((e.metaKey || e.ctrlKey) && e.key === 'b' && !e.shiftKey) {
                e.preventDefault();
                setShowSidebar(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [loading, selectedNote, handleCreateNote, handleExportPDF]);

    return (
        <div className="h-full w-full flex flex-col bg-[var(--color-background)] overflow-hidden">
            <div className="flex-1 flex overflow-hidden h-full">
                {showSidebar && (
                    <div className="w-64 flex-shrink-0 border-r border-[var(--color-border)] bg-[var(--color-sidebar)] overflow-y-auto custom-scrollbar flex flex-col transition-all duration-300 ease-in-out">
                        <div 
                            className="p-2 flex-1"
                            onDragOver={(e) => {
                                if (draggedNoteId) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    e.dataTransfer.dropEffect = 'move';
                                    setDragOverFolderId(null);
                                }
                            }}
                            onDrop={(e) => {
                                if (draggedNoteId) {
                                    handleDrop(e, null);
                                }
                            }}
                        >
                            <div className="flex items-center justify-between mb-3 px-3 pt-3">
                                <h2 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                                    Notes
                                </h2>
                                <button
                                    onClick={handleCreateNote}
                                    disabled={loading}
                                    className="px-3 py-1.5 rounded-md bg-[var(--color-primary)] text-white text-xs font-medium hover:opacity-90 transition-all duration-200 disabled:opacity-50 active:scale-95"
                                >
                                    + New
                                </button>
                            </div>

                            {folders.length > 0 && (
                                <div className="mb-4">
                                    <div className="flex items-center justify-between px-2 mb-1">
                                        <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                                            Folders
                                        </span>
                                        <button
                                            onClick={() => setShowNewFolderInput(!showNewFolderInput)}
                                            className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] text-xs"
                                        >
                                            +
                                        </button>
                                    </div>
                                    {showNewFolderInput && (
                                        <div className="px-2 mb-2 flex gap-1">
                                            <input
                                                type="text"
                                                value={newFolderName}
                                                onChange={(e) => setNewFolderName(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        handleCreateFolder();
                                                    } else if (e.key === 'Escape') {
                                                        setShowNewFolderInput(false);
                                                        setNewFolderName('');
                                                    }
                                                }}
                                                placeholder="Folder name"
                                                className="flex-1 text-xs px-2 py-1 rounded border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                                                autoFocus
                                            />
                                            <button
                                                onClick={handleCreateFolder}
                                                disabled={loading}
                                                className="px-2 py-1 rounded bg-[var(--color-primary)] text-white text-xs hover:opacity-90 disabled:opacity-50"
                                            >
                                                ✓
                                            </button>
                                        </div>
                                    )}
                                    {folders.map((folder) => {
                                        const folderNotes = getNotesInFolder(folder.id);
                                        const isExpanded = expandedFolders.has(folder.id);
                                        const isDragOver = dragOverFolderId === folder.id;
                                        
                                        return (
                                            <div key={folder.id} className="mb-1">
                                                <div
                                                    className={`flex items-center gap-1 px-2 py-1 rounded cursor-pointer group transition-all duration-200 ${
                                                        isDragOver ? 'bg-[var(--color-primary)]/20' : 'hover:bg-[var(--color-hover)]'
                                                    }`}
                                                    onClick={() => toggleFolder(folder.id)}
                                                    onDragOver={(e) => handleDragOver(e, folder.id)}
                                                    onDragLeave={handleDragLeave}
                                                    onDrop={(e) => handleDrop(e, folder.id)}
                                                >
                                                    <span className="text-xs text-[var(--color-text-tertiary)]">
                                                        {isExpanded ? '▼' : '▶'}
                                                    </span>
                                                    <span className="flex-1 text-xs text-[var(--color-text-primary)] truncate">
                                                        {folder.name}
                                                    </span>
                                                    <span className="text-xs text-[var(--color-text-tertiary)]">
                                                        {folderNotes.length}
                                                    </span>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteFolder(folder.id);
                                                        }}
                                                        className="opacity-0 group-hover:opacity-100 text-xs text-[var(--color-text-tertiary)] hover:text-red-500 transition-all duration-200"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                                {isExpanded && folderNotes.length > 0 && (
                                                    <div className="ml-4 mt-1">
                                                        {folderNotes.map((note) => (
                                                            <NoteItem
                                                                key={note.id}
                                                                note={note}
                                                                isSelected={String(selectedNote || '') === String(note.id || '')}
                                                                isDragged={draggedNoteId === note.id}
                                                                onSelect={() => handleSelectNote(note.id)}
                                                                onDelete={() => handleDeleteNote(note.id)}
                                                                onDragStart={(e) => handleDragStart(e, note.id)}
                                                                onDragEnd={() => setDraggedNoteId(null)}
                                                            />
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {dateGroups.map((group) => {
                                const rootNotes = group.items.filter(note => !note.folderId);
                                if (rootNotes.length === 0) return null;
                                
                                const isExpanded = expandedGroups.has(group.label);
                                return (
                                    <div key={group.label} className="mb-2">
                                        <div
                                            className="flex items-center gap-1 px-2 py-1 rounded cursor-pointer hover:bg-[var(--color-hover)] transition-all duration-200"
                                            onClick={() => toggleGroup(group.label)}
                                        >
                                            <span className="text-xs text-[var(--color-text-tertiary)]">
                                                {isExpanded ? '▼' : '▶'}
                                            </span>
                                            <span className="flex-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                                                {group.label}
                                            </span>
                                            <span className="text-xs text-[var(--color-text-tertiary)]">
                                                {rootNotes.length}
                                            </span>
                                        </div>
                                        {isExpanded && (
                                            <div className="ml-4 mt-1">
                                                {rootNotes.map((note) => (
                                                    <NoteItem
                                                        key={note.id}
                                                        note={note}
                                                        isSelected={String(selectedNote || '') === String(note.id || '')}
                                                        isDragged={draggedNoteId === note.id}
                                                        onSelect={() => handleSelectNote(note.id)}
                                                        onDelete={() => handleDeleteNote(note.id)}
                                                        onDragStart={(e) => handleDragStart(e, note.id)}
                                                        onDragEnd={() => setDraggedNoteId(null)}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="flex-1 flex flex-col overflow-hidden h-full w-full">
                    {selectedNote ? (
                        <>
                            <div className="border-b border-[var(--color-border)] bg-[var(--color-background)] px-4 py-2 flex-shrink-0">
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setShowSidebar(!showSidebar)}
                                        className="p-1.5 rounded hover:bg-[var(--color-hover)] text-[var(--color-text-secondary)] transition-colors duration-150"
                                        title={showSidebar ? "Hide sidebar" : "Show sidebar"}
                                    >
                                        <Icon name="menu" size={18} />
                                    </button>
                                    <input
                                        type="text"
                                        value={noteTitle}
                                        onChange={(e) => handleTitleChange(e.target.value)}
                                        placeholder="Untitled Note"
                                        className="flex-1 text-base font-semibold text-[var(--color-text-primary)] bg-transparent border-none outline-none placeholder-[var(--color-text-tertiary)] focus:outline-none"
                                    />
                                    <button
                                        onClick={handleExportPDF}
                                        className="p-1.5 rounded hover:bg-[var(--color-hover)] text-[var(--color-text-secondary)] transition-colors duration-150"
                                        title="Export to PDF"
                                    >
                                        <Icon name="Download" size={18} />
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto overflow-x-hidden h-full w-full bg-[var(--color-background)]">
                                <div className="w-full h-full">
                                    {editor ? (
                                        <div className="w-full h-full notes-editor-container px-6 py-4" key={`editor-${selectedNote}`}>
                                            <style>{`
                                                .notes-editor-container {
                                                    --bn-colors-editor-text: var(--color-text-primary);
                                                    --bn-colors-editor-background: var(--color-background);
                                                    --bn-colors-menu-text: var(--color-text-primary);
                                                    --bn-colors-menu-background: var(--color-card);
                                                    --bn-colors-menu-text-hover: var(--color-text-primary);
                                                    --bn-colors-menu-background-hover: var(--color-hover);
                                                    --bn-colors-toolbar-text: var(--color-text-primary);
                                                    --bn-colors-toolbar-background: var(--color-card);
                                                    --bn-colors-toolbar-text-hover: var(--color-text-primary);
                                                    --bn-colors-toolbar-background-hover: var(--color-hover);
                                                    --bn-colors-suggestion-menu-text: var(--color-text-primary);
                                                    --bn-colors-suggestion-menu-background: var(--color-card);
                                                    --bn-colors-suggestion-menu-text-selected: var(--color-text-primary);
                                                    --bn-colors-suggestion-menu-background-selected: var(--color-hover);
                                                    --bn-colors-placeholder-text: var(--color-text-tertiary);
                                                    --bn-colors-selected-text: var(--color-text-primary);
                                                    --bn-colors-selected-background: var(--color-primary);
                                                    --bn-border-radius: 6px;
                                                    --bn-border-color: var(--color-border);
                                                }
                                                .notes-editor-container .bn-container {
                                                    width: 100% !important;
                                                    height: 100% !important;
                                                    background: var(--color-background) !important;
                                                }
                                                .notes-editor-container .bn-editor {
                                                    width: 100% !important;
                                                    min-height: 100% !important;
                                                    background: var(--color-background) !important;
                                                }
                                                .notes-editor-container .bn-menu {
                                                    background: var(--color-card) !important;
                                                    border: 1px solid var(--color-border) !important;
                                                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1) !important;
                                                }
                                                .notes-editor-container .bn-toolbar {
                                                    background: var(--color-card) !important;
                                                    border: 1px solid var(--color-border) !important;
                                                }
                                                .notes-editor-container .bn-suggestion-menu {
                                                    background: var(--color-card) !important;
                                                    border: 1px solid var(--color-border) !important;
                                                }
                                            `}</style>
                                            <BlockNoteView editor={editor} />
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-[var(--color-text-secondary)]">
                                            <p>Loading editor...</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center bg-[var(--color-background)] w-full h-full">
                            <div className="text-center px-6">
                                {notes.length === 0 ? (
                                    <>
                                        <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-3">
                                            No notes yet
                                        </h2>
                                        <p className="text-[var(--color-text-secondary)] mb-6 text-base">
                                            Create your first note to get started
                                        </p>
                                        <button
                                            onClick={handleCreateNote}
                                            disabled={loading}
                                            className="px-6 py-3 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition-all duration-200 disabled:opacity-50 active:scale-95"
                                        >
                                            {loading ? 'Creating...' : '+ Create New Note'}
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-3">
                                            Select a note
                                        </h2>
                                        <p className="text-[var(--color-text-secondary)] text-base">
                                            Choose a note from the sidebar to start editing
                                        </p>
                                        {!showSidebar && (
                                            <button
                                                onClick={() => setShowSidebar(true)}
                                                className="mt-4 px-4 py-2 rounded-lg bg-[var(--color-muted)] text-[var(--color-text-primary)] text-sm font-medium hover:bg-[var(--color-hover)] transition-all duration-200"
                                            >
                                                Show Sidebar
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
