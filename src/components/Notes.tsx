import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { BlockNoteEditor, PartialBlock } from "@blocknote/core";
import { BlockNoteContext, useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { groupByDate, DateGroup } from "../utils/dateGrouping";
import {
  getNotes,
  saveNote,
  deleteNote,
  Note as NoteType,
  getFolders,
  saveFolder,
  deleteFolder,
  Folder,
} from "../services/sync";
import { Icon } from "./Icon";
import { NoteItem } from "./memoized-list-items";
import {
  ToolSidebar,
  ToolSidebarBody,
  ToolSidebarHeader,
  ToolSidebarSection,
} from "./ui/ToolChrome";
import {
  noteTemplates,
  getTemplatesByCategory,
  NoteTemplate,
} from "../utils/noteTemplates";
import { getThemeForTemplate } from "../utils/blockNoteThemes";
import { useStore } from "../state/store";
import { getElectronAPI } from "../utils/electronAPI";

const NOTES_SESSION_KEY = "devbench-notes-session";
const GIT_DATA_CHANGED_EVENT = "devbench:git-data-changed";

function readNotesSession(): { selectedNoteId: string | null } {
  try {
    const raw = localStorage.getItem(NOTES_SESSION_KEY);
    if (!raw) return { selectedNoteId: null };
    const parsed = JSON.parse(raw);
    return { selectedNoteId: parsed?.selectedNoteId ?? null };
  } catch {
    return { selectedNoteId: null };
  }
}

function persistNotesSession(selectedNoteId: string | null) {
  try {
    localStorage.setItem(
      NOTES_SESSION_KEY,
      JSON.stringify({ selectedNoteId }),
    );
  } catch {
    // ignore quota errors
  }
}

interface Note {
  id: string;
  title: string;
  content: any;
  folderId?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface NotesProps {
  pendingItemId?: string;
  onPendingItemHandled?: () => void;
}

export function Notes({
  pendingItemId,
  onPendingItemHandled,
}: NotesProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const [noteTitle, setNoteTitle] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [notesLoading, setNotesLoading] = useState(true);
  const [dateGroups, setDateGroups] = useState<DateGroup[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );
  const [showSidebar, setShowSidebar] = useState(true);
  const [newFolderName, setNewFolderName] = useState("");
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [currentTemplateId, setCurrentTemplateId] = useState<string>("blank");
  const appTheme = useStore((state) => state.config?.theme ?? "light");

  const editorRef = useRef<BlockNoteEditor | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const titleSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncedStateRef = useRef<
    Map<string, { title: string; content: any; folderId?: string | null }>
  >(new Map());
  const isSavingRef = useRef<boolean>(false);
  const creatingNoteRef = useRef<boolean>(false);
  const lastLoadedNoteIdRef = useRef<string | null>(null);
  const notesLoadedRef = useRef(false);
  const loadNotesRequestRef = useRef(0);
  const loadContentRequestRef = useRef(0);
  const handleCreateNoteRef = useRef<
    (templateId?: string) => Promise<void>
  >(() => Promise.resolve());
  const selectedNoteRef = useRef<string | null>(null);
  const noteTitleRef = useRef("");
  const saveCurrentNoteRef = useRef<() => Promise<void>>(() => Promise.resolve());

  useEffect(() => {
    selectedNoteRef.current = selectedNote;
    persistNotesSession(selectedNote);
  }, [selectedNote]);

  useEffect(() => {
    noteTitleRef.current = noteTitle;
  }, [noteTitle]);

  const normalizeNoteId = (note: any): string => {
    return String(note.id || note._id || "");
  };

  const dedupeNotesById = useCallback((notesList: Note[]): Note[] => {
    const byId = new Map<string, Note>();
    for (const note of notesList) {
      const id = normalizeNoteId(note);
      if (!id) continue;
      const existing = byId.get(id);
      if (
        !existing ||
        new Date(note.updatedAt || 0).getTime() >=
          new Date(existing.updatedAt || 0).getTime()
      ) {
        byId.set(id, { ...note, id });
      }
    }
    return Array.from(byId.values());
  }, []);

  const applyLoadedNotes = useCallback(
    (loadedNotes: Note[]): Note[] => {
      const activeNoteId = selectedNoteRef.current;
      const activeTitle = noteTitleRef.current?.trim() ?? "";

      let merged = dedupeNotesById(loadedNotes);
      if (activeNoteId && activeTitle) {
        merged = merged.map((note) =>
          note.id === activeNoteId && activeTitle !== note.title
            ? { ...note, title: activeTitle }
            : note,
        );
      }
      return merged;
    },
    [dedupeNotesById],
  );

  const loadFolders = useCallback(async () => {
    try {
      const loadedFolders = await getFolders();
      const normalizedFolders = loadedFolders.map((folder) => ({
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
      console.error("Failed to load folders:", err);
    }
  }, []);

  const restoreSelectionAfterLoad = useCallback(
    (mergedNotes: Note[]) => {
      if (creatingNoteRef.current || pendingItemId) return;

      const currentSelection = selectedNoteRef.current;
      if (
        currentSelection &&
        mergedNotes.some((note) => note.id === currentSelection)
      ) {
        return;
      }

      const sessionId = readNotesSession().selectedNoteId;
      const targetId =
        sessionId && mergedNotes.some((note) => note.id === sessionId)
          ? sessionId
          : mergedNotes.length > 0
            ? [...mergedNotes].sort(
                (a, b) =>
                  new Date(b.updatedAt).getTime() -
                  new Date(a.updatedAt).getTime(),
              )[0].id
            : null;

      if (!targetId) return;

      const note = mergedNotes.find((item) => item.id === targetId);
      if (!note) return;

      setNoteTitle(note.title);
      setSelectedNote(targetId);
    },
    [pendingItemId],
  );

  const loadNotes = useCallback(async () => {
    const requestId = ++loadNotesRequestRef.current;
    setNotesLoading(true);

    try {
      let loadedNotes = await getNotes();

      if (loadedNotes.length === 0) {
        const api = getElectronAPI();
        if (api?.git?.getRepoPath) {
          for (let attempt = 0; attempt < 4; attempt++) {
            if (requestId !== loadNotesRequestRef.current) return;

            const repo = await api.git.getRepoPath();
            if (!repo.success || !repo.repoPath) break;

            await new Promise((resolve) =>
              setTimeout(resolve, 400 * (attempt + 1)),
            );
            loadedNotes = await getNotes();
            if (loadedNotes.length > 0) break;
          }
        }
      }

      if (requestId !== loadNotesRequestRef.current) return;

      const transformedNotes = loadedNotes
        .map((note) => ({
          ...note,
          id: normalizeNoteId(note),
          folderId: note.folderId ?? null,
          createdAt: note.createdAt || new Date().toISOString(),
          updatedAt: note.updatedAt || new Date().toISOString(),
          title: note.title || "Untitled Note",
        }))
        .filter((note) => note.id);

      let mergedNotes: Note[] = [];
      setNotes(() => {
        mergedNotes = applyLoadedNotes(transformedNotes);
        return mergedNotes;
      });
      setDateGroups(groupByDate(mergedNotes));

      mergedNotes.forEach((note) => {
        if (note.content) {
          lastSyncedStateRef.current.set(note.id, {
            title: note.title || "Untitled Note",
            content: note.content,
            folderId: note.folderId ?? null,
          });
        }
      });

      restoreSelectionAfterLoad(mergedNotes);
    } catch (err) {
      console.error("Failed to load notes:", err);
    } finally {
      if (requestId === loadNotesRequestRef.current) {
        notesLoadedRef.current = true;
        setNotesLoading(false);
      }
    }
  }, [applyLoadedNotes, restoreSelectionAfterLoad]);

  useEffect(() => {
    void loadNotes();
    void loadFolders();
  }, [loadNotes, loadFolders]);

  useEffect(() => {
    if (dateGroups.length > 0) {
      setExpandedGroups((prev) =>
        prev.size > 0 ? prev : new Set(dateGroups.map((group) => group.label)),
      );
    }
  }, [dateGroups]);

  useEffect(() => {
    if (folders.length > 0) {
      setExpandedFolders((prev) =>
        prev.size > 0
          ? prev
          : new Set(
              folders.map((folder) => String(folder.id || "")).filter(Boolean),
            ),
      );
    }
  }, [folders]);

  useEffect(() => {
    const onDataChanged = () => {
      void loadNotes();
      void loadFolders();
    };

    window.addEventListener(GIT_DATA_CHANGED_EVENT, onDataChanged);

    const api = getElectronAPI();
    let wasSyncing = false;
    const onSyncState = (state: { isSyncing?: boolean }) => {
      if (wasSyncing && !state.isSyncing) {
        onDataChanged();
      }
      wasSyncing = Boolean(state.isSyncing);
    };
    api?.git?.onSyncStateChange?.(onSyncState);

    return () => {
      window.removeEventListener(GIT_DATA_CHANGED_EVENT, onDataChanged);
    };
  }, [loadNotes, loadFolders]);

  const handleCreateFolder = useCallback(async () => {
    if (!newFolderName.trim() || loading) return;
    setLoading(true);
    try {
      const newFolder = await saveFolder({
        name: newFolderName.trim(),
        parentId: null,
      });
      if (newFolder) {
        setNewFolderName("");
        setShowNewFolderInput(false);
        await loadFolders();
      }
    } catch (err) {
      console.error("Failed to create folder:", err);
    } finally {
      setLoading(false);
    }
  }, [newFolderName, loading]);

  const handleDeleteFolder = useCallback(
    async (folderId: string) => {
      if (!confirm("Delete this folder? Items inside will be moved to root."))
        return;
      try {
        const success = await deleteFolder(folderId);
        if (success) {
          const notesInFolder = notes.filter((n) => n.folderId === folderId);
          for (const note of notesInFolder) {
            await saveNote({ ...note, folderId: null } as NoteType);
          }
          await loadFolders();
          await loadNotes();
        }
      } catch (err) {
        console.error("Failed to delete folder:", err);
      }
    },
    [notes],
  );

  const handleDragStart = useCallback((e: React.DragEvent, noteId: string) => {
    e.stopPropagation();
    setDraggedNoteId(noteId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("application/x-note-id", noteId);
    e.dataTransfer.setData("text/plain", "");
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, folderId: string | null) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = "move";
      setDragOverFolderId(folderId);
    },
    [],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragOverFolderId(null);
    }
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, targetFolderId: string | null) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOverFolderId(null);

      const noteId =
        e.dataTransfer.getData("application/x-note-id") || draggedNoteId;
      if (!noteId) {
        setDraggedNoteId(null);
        return;
      }

      const note = notes.find((n) => n.id === noteId);
      if (!note || note.folderId === targetFolderId) {
        setDraggedNoteId(null);
        return;
      }

      try {
        await saveNote({
          ...note,
          folderId: targetFolderId,
        } as NoteType);
        await loadNotes();

        if (targetFolderId) {
          setExpandedFolders((prev) => new Set(prev).add(targetFolderId));
        }
      } catch (err) {
        console.error("Failed to move note:", err);
      } finally {
        setDraggedNoteId(null);
      }
    },
    [notes, draggedNoteId],
  );

  const toggleFolder = useCallback((folderId: string) => {
    const normalizedId = String(folderId || "");
    if (!normalizedId) return;
    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(normalizedId)) {
        newSet.delete(normalizedId);
      } else {
        newSet.add(normalizedId);
      }
      return newSet;
    });
  }, []);

  const getNotesInFolder = useCallback(
    (folderId: string | null) => {
      if (folderId === null) {
        return notes.filter((note) => !note.folderId);
      }
      return notes.filter((note) => note.folderId === folderId);
    },
    [notes],
  );

  const getFolderNotesGrouped = useCallback(
    (folderId: string) => {
      return groupByDate(getNotesInFolder(folderId));
    },
    [getNotesInFolder],
  );

  const toggleGroup = useCallback((label: string) => {
    setExpandedGroups((prev) => {
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
    return [{ type: "paragraph", content: "Start typing..." }];
  }, []); // No dependencies - always same initial content

  const editorTheme = useMemo(
    () => getThemeForTemplate(currentTemplateId),
    [currentTemplateId],
  );

  const editor = useCreateBlockNote({
    initialContent: getInitialContent,
    theme: editorTheme,
  });

  editorRef.current = editor;

  // Load note content into editor ONLY when selectedNote changes
  // ALWAYS fetch fresh content when switching notes
  useEffect(() => {
    if (!editor || !selectedNote) return;

    const requestId = ++loadContentRequestRef.current;
    const noteIdToLoad = selectedNote;

    const loadNoteContent = async () => {
      try {
        if (requestId !== loadContentRequestRef.current) return;

        // Fetch fresh note data from file system
        const allNotes = await getNotes();
        if (requestId !== loadContentRequestRef.current) return;

        const note = allNotes.find((n) => {
          const noteId = String(n.id || (n as any)._id || "");
          return noteId === noteIdToLoad;
        });

        // Determine template ID from note title or content
        if (note) {
          const templateMatch = noteTemplates.find(
            (t) =>
              note.title === t.name ||
              (note.title && note.title.includes(t.name)),
          );
          if (templateMatch) {
            setCurrentTemplateId(templateMatch.id);
          } else {
            setCurrentTemplateId("blank");
          }
        }

        if (!note) {
          return;
        }

        const noteContent = note.content || [];
        const contentToLoad =
          noteContent.length > 0
            ? (JSON.parse(JSON.stringify(noteContent)) as PartialBlock[])
            : [
                {
                  type: "paragraph",
                  content: [
                    { type: "text", text: "Start typing...", styles: {} },
                  ],
                },
              ];

        // Compare with current editor content to avoid unnecessary updates
        const currentContent = editor.document;
        const currentStr = JSON.stringify(currentContent);
        const newStr = JSON.stringify(contentToLoad);

        // Only update if content is actually different
        if (currentStr !== newStr) {
          if (requestId !== loadContentRequestRef.current) return;

          // Mark as saving to prevent onChange from firing during load
          isSavingRef.current = true;
          editor.replaceBlocks(
            editor.document,
            contentToLoad as PartialBlock[],
          );

          // Update last synced state with fresh content
          lastSyncedStateRef.current.set(noteIdToLoad, {
            title: note.title,
            content: JSON.parse(JSON.stringify(noteContent)),
            folderId: note.folderId ?? null,
          });

          // Update notes state with fresh content
          // But preserve the current title if it's different (user might be renaming)
          setNotes((prev) =>
            prev.map((n) => {
              if (String(n.id) === noteIdToLoad) {
                const currentTitle = noteTitle || n.title;
                // Use the title from file, but if user is typing something different, preserve it
                // Also preserve if existing title is not empty and not "Untitled Note"
                const titleToUse =
                  currentTitle &&
                  currentTitle.trim() !== "" &&
                  currentTitle !== "Untitled Note" &&
                  currentTitle !== note.title
                    ? currentTitle
                    : note.title && note.title.trim() !== ""
                      ? note.title
                      : n.title;

                return {
                  ...n,
                  title: titleToUse,
                  content: JSON.parse(JSON.stringify(noteContent)),
                  folderId: note.folderId ?? null,
                  updatedAt: note.updatedAt || n.updatedAt,
                };
              }
              // For other notes, never change their title
              return n;
            }),
          );

          // Always update title when loading note content
          // But preserve if user is currently typing
          setNoteTitle((prevTitle) => {
            // If user has typed something different, keep it
            if (prevTitle && prevTitle !== note.title) {
              // Check if it's been more than 500ms since last change (user might be done typing)
              // For now, always preserve user's input
              return prevTitle;
            }
            return note.title;
          });

          lastLoadedNoteIdRef.current = noteIdToLoad;

          // Clear saving flag after a brief delay
          setTimeout(() => {
            if (requestId === loadContentRequestRef.current) {
              isSavingRef.current = false;
            }
          }, 100);
        } else {
          // Content is same, just update metadata
          if (requestId !== loadContentRequestRef.current) return;

          lastLoadedNoteIdRef.current = noteIdToLoad;
          // Update title to match the loaded note, but preserve if user is typing
          setNoteTitle((prevTitle) => {
            if (prevTitle && prevTitle !== note.title) {
              // User might be typing, preserve their input
              return prevTitle;
            }
            return note.title;
          });

          // Update notes state with fresh title from file
          setNotes((prev) =>
            prev.map((n) => {
              if (String(n.id) === noteIdToLoad) {
                // Only update title if it matches what we're loading (don't overwrite user's typing)
                // Preserve existing title if it's not empty and not "Untitled Note"
                const titleToUse =
                  noteTitle &&
                  noteTitle.trim() !== "" &&
                  noteTitle !== "Untitled Note" &&
                  noteTitle !== note.title
                    ? noteTitle
                    : note.title && note.title.trim() !== ""
                      ? note.title
                      : n.title;
                return { ...n, title: titleToUse };
              }
              // For other notes, never change their title
              return n;
            }),
          );
        }
      } catch (error) {
        console.error("Error loading note content:", error);
        isSavingRef.current = false;
      }
    };

    loadNoteContent();
    return () => {
      loadContentRequestRef.current += 1;
    };
  }, [selectedNote, editor]); // Only depends on selectedNote, NOT notes

  // Auto-save on editor changes
  useEffect(() => {
    if (!editor || !selectedNote) return;

    const handleChange = () => {
      // Don't save if we're currently loading content or saving
      if (
        isSavingRef.current ||
        !selectedNote ||
        creatingNoteRef.current
      ) {
        return;
      }

      // Don't save if this note isn't loaded yet
      if (lastLoadedNoteIdRef.current !== selectedNote) return;

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        if (
          selectedNote &&
          editorRef.current &&
          lastLoadedNoteIdRef.current === selectedNote
        ) {
          saveCurrentNote();
        }
      }, 500);
    };

    const unsubscribe = editor.onChange(handleChange);

    return () => {
      unsubscribe();
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [editor, selectedNote]);

  const saveCurrentNote = useCallback(async () => {
    if (
      !selectedNote ||
      !editorRef.current ||
      isSavingRef.current ||
      creatingNoteRef.current
    ) {
      return;
    }

    const note = notes.find((n) => String(n.id) === String(selectedNote));
    if (!note) return;

    const currentContent = editorRef.current.document;
    const currentTitle = noteTitle || note.title;

    // Check if changed
    const lastSynced = lastSyncedStateRef.current.get(selectedNote);
    if (lastSynced) {
      const contentChanged =
        JSON.stringify(lastSynced.content) !== JSON.stringify(currentContent);
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
          folderId: note.folderId ?? null,
        });

        // NEVER update notes state for currently selected note
        // This prevents the editor from being reset
        // Only update state for other notes
        if (updatedNote.id && String(updatedNote.id) !== selectedNote) {
          setNotes((prev) =>
            prev.map((n) =>
              String(n.id) === String(updatedNote.id)
                ? { ...n, ...updatedNote, id: String(updatedNote.id) }
                : n,
            ),
          );
        }
        // For selected note: skip ALL state updates to prevent editor reset
      }
    } catch (err) {
      console.error("Failed to save note:", err);
    } finally {
      isSavingRef.current = false;
    }
  }, [selectedNote, notes, noteTitle]);

  saveCurrentNoteRef.current = saveCurrentNote;

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      if (titleSaveTimeoutRef.current) {
        clearTimeout(titleSaveTimeoutRef.current);
        titleSaveTimeoutRef.current = null;
      }
      persistNotesSession(selectedNoteRef.current);
      if (
        selectedNoteRef.current &&
        editorRef.current &&
        lastLoadedNoteIdRef.current === selectedNoteRef.current
      ) {
        void saveCurrentNoteRef.current();
      }
    };
  }, []);

  const handleSelectNote = useCallback(
    async (noteId: string) => {
      const normalizedId = String(noteId || "");

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
      const note = notes.find((n) => n.id === normalizedId);
      if (note) {
        setNoteTitle(note.title);
      }

      // Set selected note - this will trigger the useEffect to load fresh content
      setSelectedNote(normalizedId);
    },
    [selectedNote, notes, saveCurrentNote],
  );

  useEffect(() => {
    if (!pendingItemId || !notesLoadedRef.current) return;

    const normalizedPendingId = String(pendingItemId);
    const note = notes.find((n) => String(n.id) === normalizedPendingId);
    if (!note) {
      onPendingItemHandled?.();
      return;
    }

    void handleSelectNote(note.id).then(() => {
      onPendingItemHandled?.();
    });
  }, [pendingItemId, notes, handleSelectNote, onPendingItemHandled]);

  // Generate UUID v4
  const generateUUID = useCallback(() => {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }, []);

  const handleCreateNote = useCallback(
    async (templateId?: string) => {
      if (creatingNoteRef.current) return;

      creatingNoteRef.current = true;
      setIsCreatingNote(true);
      setLoading(true);
      setShowTemplateModal(false);
      loadContentRequestRef.current += 1;

      const uniqueId = generateUUID();

      try {
        const templateIdToUse = templateId || "blank";
        const template = noteTemplates.find((t) => t.id === templateIdToUse);
        const templateContent = template
          ? JSON.parse(JSON.stringify(template.content))
          : [{ type: "paragraph", content: "" }];
        const templateTitle =
          template && template.id !== "blank" ? template.name : "Untitled";

        const newNote = await saveNote({
          id: uniqueId,
          title: templateTitle,
          content: templateContent,
          folderId: null,
        } as NoteType);

        if (!newNote) {
          console.error("Failed to create note: save returned null");
          return;
        }

        const noteId = String(newNote.id || (newNote as any)._id || uniqueId);

        setCurrentTemplateId(templateIdToUse);

        const createdNote: Note = {
          id: noteId,
          title: newNote.title,
          content: newNote.content || templateContent,
          folderId: null,
          createdAt: newNote.createdAt || new Date().toISOString(),
          updatedAt: newNote.updatedAt || new Date().toISOString(),
        };

        setNotes((prev) => {
          const deduped = dedupeNotesById([
            ...prev.filter((n) => String(n.id) !== noteId),
            createdNote,
          ]);
          const grouped = groupByDate(deduped);
          setDateGroups(grouped);
          setExpandedGroups(
            (prevExpanded) =>
              new Set([
                ...prevExpanded,
                ...grouped.map((group) => group.label),
              ]),
          );
          return deduped;
        });

        lastSyncedStateRef.current.set(noteId, {
          title: newNote.title,
          content: newNote.content || templateContent,
          folderId: null,
        });

        lastLoadedNoteIdRef.current = null;
        setNoteTitle(newNote.title);
        setSelectedNote(noteId);
      } catch (err) {
        console.error("Failed to create note:", err);
      } finally {
        setLoading(false);
        setIsCreatingNote(false);
        creatingNoteRef.current = false;
        void loadNotes();
      }
    },
    [generateUUID, dedupeNotesById, loadNotes],
  );

  handleCreateNoteRef.current = handleCreateNote;

  const handleDeleteNote = useCallback(
    async (noteId: string) => {
      const normalizedId = String(noteId || "");
      if (!normalizedId) return;
      if (!confirm("Delete this note?")) return;

      try {
        const success = await deleteNote(normalizedId);
        if (success) {
          setNotes((prev) => {
            const updated = prev.filter(
              (n) => String(n.id) !== normalizedId,
            );
            setDateGroups(groupByDate(updated));
            return updated;
          });
          lastSyncedStateRef.current.delete(normalizedId);

          if (String(selectedNote || "") === normalizedId) {
            setSelectedNote(null);
            setNoteTitle("");
            lastLoadedNoteIdRef.current = null;
          }
        }
      } catch (err) {
        console.error("Failed to delete note:", err);
      }
    },
    [selectedNote],
  );

  const handleExportPDF = useCallback(async () => {
    if (!selectedNote || !editorRef.current) return;

    try {
      const note = notes.find((n) => n.id === selectedNote);
      if (!note) return;

      // Get the editor content as HTML
      const htmlContent = await editorRef.current.blocksToHTMLLossy(
        editorRef.current.document,
      );

      // Create a temporary container with the note content
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        alert("Please allow popups to export PDF");
        return;
      }

      const isDark = document.documentElement.classList.contains("dark");
      const bgColor = isDark ? "#111827" : "#fafafa";
      const textColor = isDark ? "#f9fafb" : "#111827";
      const borderColor = isDark ? "#374151" : "#e5e7eb";

      printWindow.document.write(`
 <!DOCTYPE html>
 <html>
 <head>
 <meta charset="UTF-8">
 <title>${note.title || "Untitled Note"}</title>
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
 <h1>${note.title || "Untitled Note"}</h1>
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
      console.error("Failed to export PDF:", err);
      alert("Failed to export PDF. Please try again.");
    }
  }, [selectedNote, notes]);

  const handleTitleChange = useCallback(
    (newTitle: string) => {
      const currentNoteId = selectedNote;
      if (!currentNoteId) return;

      // Update title immediately in UI
      setNoteTitle(newTitle);

      // Update sidebar immediately (optimistic update)
      setNotes((prev) => {
        const updated = prev.map((n) =>
          n.id === currentNoteId ? { ...n, title: newTitle } : n,
        );
        setDateGroups(groupByDate(updated));
        return updated;
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
        const note = currentNotes.find((n) => {
          const noteId = String(n.id || (n as any)._id || "");
          return noteId === currentNoteId;
        });

        if (!note) {
          console.error("Note not found for title save:", currentNoteId);
          return;
        }

        const currentContent = editorRef.current.document;

        // Check if title actually changed from last synced
        const lastSynced = lastSyncedStateRef.current.get(currentNoteId);
        if (lastSynced && lastSynced.title === newTitle) {
          console.log("Title unchanged, skipping save");
          return; // Title hasn't changed
        }

        isSavingRef.current = true;

        try {
          console.log("Saving title change:", {
            noteId: currentNoteId,
            oldTitle: note.title,
            newTitle,
          });

          const updatedNote = await saveNote({
            id: currentNoteId,
            title: newTitle,
            content: JSON.parse(JSON.stringify(currentContent)),
            folderId: note.folderId ?? null,
          } as NoteType);

          if (updatedNote) {
            console.log("Title saved successfully:", updatedNote);

            // Update last synced state
            lastSyncedStateRef.current.set(currentNoteId, {
              title: newTitle,
              content: JSON.parse(JSON.stringify(currentContent)),
              folderId: note.folderId ?? null,
            });

            setNotes((prev) => {
              const updated = prev.map((n) =>
                n.id === currentNoteId
                  ? {
                      ...n,
                      title: newTitle,
                      updatedAt:
                        updatedNote.updatedAt || new Date().toISOString(),
                    }
                  : n,
              );
              setDateGroups(groupByDate(updated));
              return updated;
            });
          } else {
            console.error("Failed to save title: updatedNote is null");
          }
        } catch (err) {
          console.error("Failed to save title:", err);
        } finally {
          isSavingRef.current = false;
        }
      }, 200); // Very short debounce - saves almost immediately
    },
    [selectedNote],
  );

  // Keyboard shortcuts - placed after all handlers are defined
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + N: New note
      if ((e.metaKey || e.ctrlKey) && e.key === "n" && !e.shiftKey) {
        e.preventDefault();
        if (!creatingNoteRef.current) {
          void handleCreateNoteRef.current("blank");
        }
      }
      // Cmd/Ctrl + E: Export PDF
      if ((e.metaKey || e.ctrlKey) && e.key === "e" && !e.shiftKey) {
        e.preventDefault();
        if (selectedNote && editorRef.current) {
          handleExportPDF();
        }
      }
      // Cmd/Ctrl + B: Toggle sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === "b" && !e.shiftKey) {
        e.preventDefault();
        setShowSidebar((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedNote, handleExportPDF]);

  return (
    <div className="h-full w-full flex flex-col bg-[var(--color-background)] overflow-hidden">
      <div className="flex-1 flex overflow-hidden h-full">
        {showSidebar && (
          <ToolSidebar width="wide" aria-label="Notes">
            <ToolSidebarHeader
              title="Notes"
              actions={
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => void handleCreateNote("blank")}
                    disabled={loading || isCreatingNote}
                    className="px-2 py-0.5 text-xs font-medium text-[var(--color-primary)] hover:bg-[var(--color-muted)] rounded transition-colors disabled:opacity-50"
                  >
                    New
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowTemplateModal(true)}
                    disabled={loading || isCreatingNote}
                    className="p-1 rounded text-[var(--color-text-tertiary)] hover:bg-[var(--color-muted)] hover:text-[var(--color-text-primary)] transition-colors disabled:opacity-50"
                    title="Browse templates"
                  >
                    <Icon name="BookOpen" size={14} />
                  </button>
                </div>
              }
            />
            <ToolSidebarBody
              onDragOver={(e) => {
                if (draggedNoteId) {
                  e.preventDefault();
                  e.stopPropagation();
                  e.dataTransfer.dropEffect = "move";
                  setDragOverFolderId(null);
                }
              }}
              onDrop={(e) => {
                if (draggedNoteId) {
                  handleDrop(e, null);
                }
              }}
            >
              {folders.length > 0 && (
                <div className="px-2 pb-2 border-b border-[var(--color-border)]">
                  <div className="flex items-center justify-between mb-1 px-2">
                    <span className="tool-sidebar-title">Folders</span>
                    <button
                      onClick={() => setShowNewFolderInput(!showNewFolderInput)}
                      className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] text-sm w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--color-muted)] transition-colors duration-150"
                    >
                      +
                    </button>
                  </div>
                  {showNewFolderInput && (
                    <div className="mb-2">
                      <input
                        type="text"
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleCreateFolder();
                          } else if (e.key === "Escape") {
                            setShowNewFolderInput(false);
                            setNewFolderName("");
                          }
                        }}
                        placeholder="Folder name"
                        className="w-full text-sm px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-background)] text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary)] transition-colors duration-150"
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
                    if (!folder.id) return null;
                    const folderId = folder.id;
                    const folderNotes = getNotesInFolder(folderId);
                    const isExpanded = expandedFolders.has(folderId);
                    const isDragOver = dragOverFolderId === folderId;

                    return (
                      <div key={folderId} className="mb-0.5">
                        <div
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md cursor-pointer group transition-colors duration-150 ${
                            isDragOver
                              ? "bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30"
                              : "hover:bg-[var(--color-muted)]"
                          }`}
                          onClick={() => toggleFolder(folderId)}
                          onDragOver={(e) => handleDragOver(e, folderId)}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => handleDrop(e, folderId)}
                        >
                          <span className="text-xs text-[var(--color-text-tertiary)] flex-shrink-0">
                            {isExpanded ? "▼" : "▶"}
                          </span>
                          <span className="flex-1 text-sm text-[var(--color-text-primary)] truncate font-medium">
                            {folder.name}
                          </span>
                          <span className="text-xs text-[var(--color-text-tertiary)] px-1.5 py-0.5 rounded bg-[var(--color-muted)] min-w-[20px] text-center">
                            {folderNotes.length}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteFolder(folderId);
                            }}
                            className="opacity-0 group-hover:opacity-100 text-sm text-[var(--color-text-tertiary)] hover:text-red-500 transition-all duration-150 w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--color-muted)]"
                          >
                            ×
                          </button>
                        </div>
                        {isExpanded && folderNotes.length > 0 && (
                          <div className="ml-3 mt-0.5">
                            {folderNotes.map((note) => (
                              <NoteItem
                                key={note.id}
                                note={note}
                                isSelected={
                                  String(selectedNote || "") ===
                                  String(note.id || "")
                                }
                                isDragged={draggedNoteId === note.id}
                                onSelect={() => handleSelectNote(note.id)}
                                onDelete={handleDeleteNote}
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

              <div className="px-2 py-2">
                {dateGroups.map((group) => {
                  const rootNotes = group.items.filter(
                    (note) => !note.folderId,
                  );
                  if (rootNotes.length === 0) return null;

                  const isExpanded = expandedGroups.has(group.label);
                    return (
                      <div key={group.label} className="mb-0.5">
                      <ToolSidebarSection
                        label={group.label}
                        expanded={isExpanded}
                        onToggle={() => toggleGroup(group.label)}
                        count={rootNotes.length}
                      />
                      {isExpanded && (
                        <div className="mt-0">
                          {rootNotes.map((note) => (
                            <NoteItem
                              key={note.id}
                              note={note}
                              isSelected={
                                String(selectedNote || "") ===
                                String(note.id || "")
                              }
                              isDragged={draggedNoteId === note.id}
                              onSelect={() => handleSelectNote(note.id)}
                              onDelete={handleDeleteNote}
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
            </ToolSidebarBody>
          </ToolSidebar>
        )}

        <div className="flex-1 flex flex-col overflow-hidden h-full w-full">
          {selectedNote ? (
            <>
              <div className="border-b border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 flex-shrink-0">
                <div className="flex items-center gap-2 max-w-4xl mx-auto">
                  <button
                    onClick={() => setShowSidebar(!showSidebar)}
                    className="p-1 rounded hover:bg-[var(--color-muted)] text-[var(--color-text-secondary)]"
                    title={showSidebar ? "Hide sidebar" : "Show sidebar"}
                  >
                    <Icon name="menu" size={16} />
                  </button>
                  <input
                    type="text"
                    value={noteTitle}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="Untitled"
                    className="flex-1 text-sm font-medium text-[var(--color-text-primary)] bg-transparent border-none outline-none placeholder-[var(--color-text-tertiary)]"
                  />
                  <button
                    onClick={handleExportPDF}
                    className="p-1 rounded hover:bg-[var(--color-muted)] text-[var(--color-text-secondary)]"
                    title="Export to PDF"
                  >
                    <Icon name="Download" size={16} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto overflow-x-hidden h-full w-full bg-[var(--color-background)]">
                <div className="w-full h-full">
                  {editor ? (
                    <div
                      className="w-full h-full notes-editor-container px-6 py-8"
                      key={`editor-${selectedNote}-${currentTemplateId}-${appTheme}`}
                    >
                      <style>{`
 .notes-editor-container {
 --bn-colors-editor-text: var(--color-text-primary);
 --bn-colors-editor-background: var(--color-background);
 --bn-colors-menu-text: var(--color-text-primary);
 --bn-colors-menu-background: var(--color-card);
 --bn-colors-menu-text-hover: var(--color-text-primary);
 --bn-colors-menu-background-hover: var(--color-muted);
 --bn-colors-toolbar-text: var(--color-text-primary);
 --bn-colors-toolbar-background: var(--color-card);
 --bn-colors-toolbar-text-hover: var(--color-text-primary);
 --bn-colors-toolbar-background-hover: var(--color-muted);
 --bn-colors-suggestion-menu-text: var(--color-text-primary);
 --bn-colors-suggestion-menu-background: var(--color-card);
 --bn-colors-suggestion-menu-text-selected: var(--color-text-primary);
 --bn-colors-suggestion-menu-background-selected: var(--color-muted);
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
 max-width: 680px !important;
 margin: 0 auto !important;
 }
 .notes-editor-container .bn-editor {
 width: 100% !important;
 min-height: 100% !important;
 background: var(--color-background) !important;
 font-size: 15px !important;
 line-height: 1.6 !important;
 color: var(--color-text-primary) !important;
 font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', 'Roboto', sans-serif !important;
 }
 .notes-editor-container .bn-block-content {
 padding: 1px 0 !important;
 margin: 0 !important;
 }
 .notes-editor-container .bn-block-content:hover {
 background: transparent !important;
 }
 .notes-editor-container .bn-inline-content {
 font-size: 15px !important;
 line-height: 1.6 !important;
 }
 .notes-editor-container .bn-menu {
 background: var(--color-card) !important;
 border: 1px solid var(--color-border) !important;
 box-shadow: none !important;
 border-radius: 6px !important;
 padding: 3px !important;
 }
 .notes-editor-container .bn-toolbar {
 background: var(--color-card) !important;
 border: 1px solid var(--color-border) !important;
 border-radius: 6px !important;
 box-shadow: none !important;
 }
 .notes-editor-container .bn-suggestion-menu {
 background: var(--color-card) !important;
 border: 1px solid var(--color-border) !important;
 border-radius: 6px !important;
 min-width: 240px !important;
 z-index: 80 !important;
 }
 .notes-editor-container .bn-suggestion-menu p {
 margin: 0 !important;
 padding: 0 !important;
 }
 .notes-editor-container .bn-suggestion-menu .bn-mt-suggestion-menu-item-title {
 font-size: 14px !important;
 line-height: 20px !important;
 font-weight: 500 !important;
 }
 .notes-editor-container .bn-suggestion-menu .bn-mt-suggestion-menu-item-subtitle {
 font-size: 10px !important;
 line-height: 16px !important;
 color: var(--color-text-secondary) !important;
 }
 .notes-editor-container .bn-editor h1 {
 font-size: 2rem !important;
 font-weight: 600 !important;
 margin-top: 1.5rem !important;
 margin-bottom: 0.75rem !important;
 line-height: 1.2 !important;
 letter-spacing: -0.02em !important;
 }
 .notes-editor-container .bn-editor h2 {
 font-size: 1.375rem !important;
 font-weight: 600 !important;
 margin-top: 1.25rem !important;
 margin-bottom: 0.5rem !important;
 line-height: 1.3 !important;
 letter-spacing: -0.01em !important;
 }
 .notes-editor-container .bn-editor h3 {
 font-size: 1.125rem !important;
 font-weight: 600 !important;
 margin-top: 1rem !important;
 margin-bottom: 0.375rem !important;
 line-height: 1.4 !important;
 }
 .notes-editor-container .bn-editor p {
 margin: 0.375rem 0 !important;
 padding: 0 !important;
 }
 .notes-editor-container .bn-editor ul, .notes-editor-container .bn-editor ol {
 margin: 0.5rem 0 !important;
 padding-left: 1.25rem !important;
 }
 .notes-editor-container .bn-editor li {
 margin: 0.125rem 0 !important;
 padding: 0 !important;
 }
 .notes-editor-container .bn-editor blockquote {
 border-left: 2px solid var(--color-border) !important;
 padding-left: 0.75rem !important;
 margin: 0.75rem 0 !important;
 color: var(--color-text-secondary) !important;
 }
 .notes-editor-container .bn-editor code {
 background: var(--color-muted) !important;
 padding: 2px 5px !important;
 border-radius: 3px !important;
 font-size: 0.875em !important;
 font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Roboto Mono', monospace !important;
 }
 .notes-editor-container .bn-editor pre {
 background: var(--color-muted) !important;
 padding: 0.75rem !important;
 border-radius: 6px !important;
 margin: 0.75rem 0 !important;
 overflow-x: auto !important;
 }
 .notes-editor-container .bn-editor pre code {
 background: transparent !important;
 padding: 0 !important;
 }
 .notes-editor-container .bn-block-content[data-content-type="codeBlock"] {
 background: var(--color-muted) !important;
 color: var(--color-text-primary) !important;
 border: 1px solid var(--color-border) !important;
 border-radius: 6px !important;
 }
 .notes-editor-container .bn-block-content[data-content-type="codeBlock"] > div > select {
 color: var(--color-text-secondary) !important;
 }
 `}</style>
                      <BlockNoteContext.Provider
                        value={{ colorSchemePreference: appTheme }}
                      >
                        <BlockNoteView editor={editor} theme={appTheme} />
                      </BlockNoteContext.Provider>
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
              <div className="text-center px-5 max-w-md">
                {notesLoading ? (
                  <>
                    <div className="mb-4">
                      <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--color-muted)] flex items-center justify-center animate-pulse" />
                    </div>
                    <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-1.5">
                      Loading notes...
                    </h2>
                  </>
                ) : notes.length === 0 ? (
                  <>
                    <div className="mb-4">
                      <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--color-muted)] flex items-center justify-center">
                        <Icon
                          name="FileText"
                          size={24}
                          className="text-[var(--color-text-tertiary)]"
                        />
                      </div>
                    </div>
                    <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-1.5">
                      No notes yet
                    </h2>
                    <p className="text-[var(--color-text-secondary)] mb-6 text-sm leading-relaxed">
                      Get started by creating your first note. You can organize
                      them with folders and find them easily later.
                    </p>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => void handleCreateNote("blank")}
                      disabled={loading || isCreatingNote}
                      className="px-5 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition-all duration-200 disabled:opacity-50 active:scale-95"
                    >
                      {isCreatingNote ? "Creating..." : "+ Create New Note"}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="mb-4">
                      <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--color-muted)] flex items-center justify-center">
                        <Icon
                          name="FileText"
                          size={24}
                          className="text-[var(--color-text-tertiary)]"
                        />
                      </div>
                    </div>
                    <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-1.5">
                      Select a note
                    </h2>
                    <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed mb-5">
                      Choose a note from the sidebar to start editing, or create
                      a new one.
                    </p>
                    {!showSidebar && (
                      <button
                        onClick={() => setShowSidebar(true)}
                        className="px-5 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium hover:bg-[var(--color-primary)]/90 transition-all duration-200 "
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

      {/* Template Modal */}
      {showTemplateModal && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setShowTemplateModal(false)}
        >
          <div
            className="bg-[var(--color-card)] rounded-lg  max-w-5xl w-full max-h-[85vh] overflow-hidden flex flex-col border border-[var(--color-border)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-[var(--color-border)]">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-medium text-[var(--color-text-primary)] mb-0.5">
                    Templates
                  </h2>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    Choose a template to get started
                  </p>
                </div>
                <button
                  onClick={() => setShowTemplateModal(false)}
                  className="p-1.5 rounded-md hover:bg-[var(--color-muted)] text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors duration-150"
                >
                  <Icon name="X" size={16} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              {Object.entries(getTemplatesByCategory()).map(
                ([category, templates]) => (
                  <div key={category} className="mb-6 last:mb-0">
                    <h3 className="text-xs font-medium text-[var(--color-text-secondary)] mb-3 uppercase tracking-wide">
                      {category}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {templates.map((template) => (
                        <button
                          key={template.id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => void handleCreateNote(template.id)}
                          disabled={loading || isCreatingNote}
                          className="group p-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] hover:border-[var(--color-primary)]/40 hover:bg-[var(--color-card)] transition-all duration-150 text-left disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <div className="flex items-start gap-2.5">
                            <div className="w-9 h-9 rounded-lg bg-[var(--color-muted)] flex items-center justify-center flex-shrink-0 group-hover:bg-[var(--color-primary)]/10 transition-colors duration-150">
                              <Icon
                                name={template.icon as any}
                                size={18}
                                className="text-[var(--color-primary)]"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm text-[var(--color-text-primary)] mb-0.5 leading-tight">
                                {template.name}
                              </div>
                              <div className="text-xs text-[var(--color-text-secondary)] line-clamp-2 leading-relaxed">
                                {template.description}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ),
              )}
            </div>
            <div className="px-5 py-3 border-t border-[var(--color-border)] flex justify-end">
              <button
                onClick={() => setShowTemplateModal(false)}
                className="px-3 py-1.5 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors duration-150"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
