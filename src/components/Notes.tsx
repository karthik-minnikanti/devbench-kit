import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { groupByDate } from "../utils/dateGrouping";
import {
  getNotes,
  loadNote,
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
} from "../utils/noteTemplates";
import { useStore } from "../state/store";
import { getElectronAPI } from "../utils/electronAPI";
import { NoteEditor, NoteEditorHandle } from "./notes/NoteEditor";
import {
  NoteRecord,
  GIT_DATA_CHANGED_EVENT,
  persistNotesSession,
  readNotesSession,
  cloneBlocks,
  dedupeNotes,
  generateNoteId,
  normalizeFolderId,
  normalizeNote,
  notesInFolder,
  noteContentSnapshot,
  pickDefaultNoteId,
  rootNotes,
} from "./notes/noteUtils";

interface NotesProps {
  pendingItemId?: string;
  onPendingItemHandled?: () => void;
}

export function Notes({ pendingItemId, onPendingItemHandled }: NotesProps) {
  const [notes, setNotes] = useState<NoteRecord[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedNote, setSelectedNote] = useState<string | null>(
    () => readNotesSession().selectedNoteId,
  );
  const [noteTitle, setNoteTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [notesLoading, setNotesLoading] = useState(true);
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
  const [currentTemplateId, setCurrentTemplateId] = useState("blank");
  const [storageError, setStorageError] = useState<string | null>(null);
  const appTheme = useStore((state) => state.config?.theme ?? "light");

  const editorRef = useRef<NoteEditorHandle | null>(null);
  const titleSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialSelectionDoneRef = useRef(false);
  const selectedNoteRef = useRef<string | null>(selectedNote);
  const noteTitleRef = useRef(noteTitle);
  const notesRef = useRef(notes);
  const isSavingRef = useRef(false);
  const pendingReloadRef = useRef(false);
  const lastSyncedRef = useRef<Map<string, string>>(new Map());
  const handleCreateNoteRef = useRef<(templateId?: string) => Promise<void>>(
    () => Promise.resolve(),
  );

  useEffect(() => {
    selectedNoteRef.current = selectedNote;
    persistNotesSession(selectedNote);
  }, [selectedNote]);

  useEffect(() => {
    noteTitleRef.current = noteTitle;
  }, [noteTitle]);

  useEffect(() => {
    notesRef.current = notes;
  }, [notes]);

  const dateGroups = useMemo(
    () => groupByDate(rootNotes(notes)),
    [notes],
  );

  const selectedNoteRecord = useMemo(
    () => notes.find((note) => note.id === selectedNote) ?? null,
    [notes, selectedNote],
  );

  const loadFolders = useCallback(async () => {
    try {
      const loadedFolders = await getFolders();
      const normalized = loadedFolders
        .map((folder) => ({
          ...folder,
          id: normalizeFolderId(folder.id) ?? undefined,
        }))
        .filter((folder) => Boolean(folder.id));
      normalized.sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime(),
      );
      setFolders(normalized);
    } catch (err) {
      console.error("Failed to load folders:", err);
    }
  }, []);

  const applyInitialSelection = useCallback((loaded: NoteRecord[]) => {
    if (initialSelectionDoneRef.current || pendingItemId) return;

    const current = selectedNoteRef.current;
    if (current && loaded.some((note) => note.id === current)) {
      const note = loaded.find((item) => item.id === current);
      if (note) setNoteTitle(note.title);
      initialSelectionDoneRef.current = true;
      return;
    }

    const targetId = pickDefaultNoteId(loaded);
    initialSelectionDoneRef.current = true;
    if (!targetId) return;

    const note = loaded.find((item) => item.id === targetId);
    setSelectedNote(targetId);
    setNoteTitle(note?.title ?? "");
  }, [pendingItemId]);

  const loadNotes = useCallback(async () => {
    setNotesLoading(true);
    setStorageError(null);

    try {
      let loaded = await getNotes();

      if (loaded.length === 0) {
        const api = getElectronAPI();
        if (api?.git?.getRepoPath) {
          for (let attempt = 0; attempt < 4; attempt++) {
            const repo = await api.git.getRepoPath();
            if (!repo.success || !repo.repoPath) break;
            await new Promise((resolve) =>
              setTimeout(resolve, 400 * (attempt + 1)),
            );
            loaded = await getNotes();
            if (loaded.length > 0) break;
          }
        }
      }

      const normalized = dedupeNotes(
        loaded
          .map((note, index) => normalizeNote(note, index))
          .filter((note): note is NoteRecord => note !== null),
      );

      setNotes(normalized);
      normalized.forEach((note) => {
        lastSyncedRef.current.set(
          note.id,
          noteContentSnapshot(note.title, note.content, note.folderId),
        );
      });
      applyInitialSelection(normalized);

      if (normalized.length === 0) {
        const api = getElectronAPI();
        const repo = await api?.git?.getRepoPath?.();
        if (!repo?.success || !repo.repoPath) {
          setStorageError(
            "Configure a Git repository in Settings to save notes.",
          );
        }
      }
    } catch (err) {
      console.error("Failed to load notes:", err);
      setStorageError("Failed to load notes.");
    } finally {
      setNotesLoading(false);
    }
  }, [applyInitialSelection]);

  const flushPendingReload = useCallback(() => {
    if (!pendingReloadRef.current || isSavingRef.current) return;
    pendingReloadRef.current = false;
    void loadNotes();
    void loadFolders();
  }, [loadFolders, loadNotes]);

  const persistNote = useCallback(
    async (
      noteId: string,
      title: string,
      content: any[],
      folderId: string | null,
      options?: { force?: boolean },
    ) => {
      const normalizedTitle = title.trim() || "Untitled";
      const snapshot = noteContentSnapshot(normalizedTitle, content, folderId);
      const existing = notesRef.current.find((note) => note.id === noteId);

      if (!options?.force && lastSyncedRef.current.get(noteId) === snapshot) {
        return existing ?? null;
      }

      isSavingRef.current = true;
      try {
        const saved = await saveNote({
          id: noteId,
          title: normalizedTitle,
          content,
          folderId,
          createdAt: existing?.createdAt,
        } as NoteType);

        if (!saved) {
          setStorageError("Could not save note. Check your Git repository.");
          return null;
        }

        setStorageError(null);
        const record = normalizeNote(saved);
        if (!record) return null;

        lastSyncedRef.current.set(
          noteId,
          noteContentSnapshot(record.title, record.content, record.folderId),
        );

        setNotes((prev) => {
          const exists = prev.some((note) => note.id === noteId);
          const next = exists
            ? prev.map((note) =>
                note.id === noteId
                  ? { ...note, ...record, updatedAt: record.updatedAt }
                  : note,
              )
            : [record, ...prev];
          return dedupeNotes(next);
        });
        return record;
      } finally {
        isSavingRef.current = false;
        flushPendingReload();
      }
    },
    [flushPendingReload],
  );

  const handleContentSave = useCallback(
    async (content: any[]) => {
      const noteId = selectedNoteRef.current;
      if (!noteId) return;

      const note = notesRef.current.find((item) => item.id === noteId);
      if (!note) return;

      const title = noteTitleRef.current.trim() || note.title || "Untitled";
      await persistNote(noteId, title, content, note.folderId);
    },
    [persistNote],
  );

  useEffect(() => {
    void loadNotes();
    void loadFolders();
  }, [loadFolders, loadNotes]);

  useEffect(() => {
    if (dateGroups.length === 0) return;
    setExpandedGroups((prev) =>
      prev.size > 0 ? prev : new Set(dateGroups.map((group) => group.label)),
    );
  }, [dateGroups]);

  useEffect(() => {
    const reloadIfIdle = () => {
      if (isSavingRef.current) {
        pendingReloadRef.current = true;
        return;
      }
      void loadNotes();
      void loadFolders();
    };

    window.addEventListener(GIT_DATA_CHANGED_EVENT, reloadIfIdle);
    return () => window.removeEventListener(GIT_DATA_CHANGED_EVENT, reloadIfIdle);
  }, [loadFolders, loadNotes]);

  const ensureNoteContent = useCallback(async (noteId: string) => {
    const existing = notesRef.current.find((note) => note.id === noteId);
    if (existing?.content?.length) return existing;

    const loaded = await loadNote(noteId);
    if (!loaded) return existing ?? null;

    const record = normalizeNote(loaded);
    if (!record) return existing ?? null;

    setNotes((prev) =>
      dedupeNotes(
        prev.map((note) => (note.id === noteId ? { ...note, ...record } : note)),
      ),
    );
    lastSyncedRef.current.set(
      noteId,
      noteContentSnapshot(record.title, record.content, record.folderId),
    );
    return record;
  }, []);

  const handleSelectNote = useCallback(
    async (noteId: string) => {
      const normalizedId = String(noteId || "");
      if (!normalizedId || normalizedId === selectedNoteRef.current) return;

      if (selectedNoteRef.current) {
        await editorRef.current?.flushSave();
      }

      const note = await ensureNoteContent(normalizedId);
      if (note) {
        const templateMatch = noteTemplates.find(
          (t) =>
            note.title === t.name ||
            (note.title && note.title.includes(t.name)),
        );
        setCurrentTemplateId(templateMatch?.id ?? "blank");
      }
      setNoteTitle(note?.title ?? "Untitled");
      setSelectedNote(normalizedId);
    },
    [ensureNoteContent],
  );

  useEffect(() => {
    if (!pendingItemId || notesLoading) return;
    const normalizedId = String(pendingItemId);
    if (!notes.some((note) => note.id === normalizedId)) {
      onPendingItemHandled?.();
      return;
    }
    void handleSelectNote(normalizedId).then(() => onPendingItemHandled?.());
  }, [
    pendingItemId,
    notes,
    notesLoading,
    handleSelectNote,
    onPendingItemHandled,
  ]);

  const handleCreateNote = useCallback(
    async (templateId?: string) => {
      if (isCreatingNote) return;

      setIsCreatingNote(true);
      setLoading(true);
      setShowTemplateModal(false);

      const templateIdToUse = templateId || "blank";
      const template = noteTemplates.find((item) => item.id === templateIdToUse);
      const templateContent = template
        ? cloneBlocks(template.content)
        : cloneBlocks([]);
      const templateTitle =
        template && template.id !== "blank" ? template.name : "Untitled";

      try {
        if (selectedNoteRef.current) {
          await editorRef.current?.flushSave();
        }

        const noteId = generateNoteId();
        const saved = await persistNote(
          noteId,
          templateTitle,
          templateContent,
          null,
          { force: true },
        );
        if (!saved) return;

        setCurrentTemplateId(templateIdToUse);
        setNoteTitle(saved.title);
        setSelectedNote(saved.id);
        setExpandedGroups((prev) => new Set(prev).add("Today"));
      } catch (err) {
        console.error("Failed to create note:", err);
      } finally {
        setLoading(false);
        setIsCreatingNote(false);
      }
    },
    [isCreatingNote, persistNote],
  );

  handleCreateNoteRef.current = handleCreateNote;

  const handleDeleteNote = useCallback(
    async (noteId: string) => {
      const normalizedId = String(noteId || "");
      if (!normalizedId || !confirm("Delete this note?")) return;

      try {
        const success = await deleteNote(normalizedId);
        if (!success) return;

        setNotes((prev) => prev.filter((note) => note.id !== normalizedId));
        lastSyncedRef.current.delete(normalizedId);
        if (selectedNoteRef.current === normalizedId) {
          setSelectedNote(null);
          setNoteTitle("");
        }
      } catch (err) {
        console.error("Failed to delete note:", err);
      }
    },
    [],
  );

  const handleTitleChange = useCallback(
    (newTitle: string) => {
      const noteId = selectedNoteRef.current;
      if (!noteId) return;

      setNoteTitle(newTitle);
      setNotes((prev) =>
        prev.map((note) =>
          note.id === noteId ? { ...note, title: newTitle } : note,
        ),
      );

      if (titleSaveTimerRef.current) clearTimeout(titleSaveTimerRef.current);
      titleSaveTimerRef.current = setTimeout(async () => {
        const note = notesRef.current.find((item) => item.id === noteId);
        if (!note) return;
        const content =
          editorRef.current?.getContent() ?? note.content ?? cloneBlocks([]);
        await persistNote(noteId, newTitle, content, note.folderId);
      }, 300);
    },
    [persistNote],
  );

  const handleExportPDF = useCallback(async () => {
    if (!selectedNote || !editorRef.current) return;
    const note = notes.find((item) => item.id === selectedNote);
    if (!note) return;

    try {
      const htmlContent = await editorRef.current.exportHtml();
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        alert("Please allow popups to export PDF");
        return;
      }

      const isDark = document.documentElement.classList.contains("dark");
      const bgColor = isDark ? "#111827" : "#fafafa";
      const textColor = isDark ? "#f9fafb" : "#111827";
      const borderColor = isDark ? "#374151" : "#e5e7eb";

      printWindow.document.write(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>${note.title || "Untitled"}</title>
<style>
body { font-family: Inter, sans-serif; background:${bgColor}; color:${textColor}; padding:40px; line-height:1.6; }
h1 { font-size:28px; border-bottom:2px solid ${borderColor}; padding-bottom:12px; margin-bottom:24px; }
.content { max-width:800px; margin:0 auto; }
</style></head><body><div class="content">
<h1>${note.title || "Untitled"}</h1><div>${htmlContent}</div></div></body></html>`);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 250);
    } catch (err) {
      console.error("Failed to export PDF:", err);
      alert("Failed to export PDF. Please try again.");
    }
  }, [notes, selectedNote]);

  const handleCreateFolder = useCallback(async () => {
    if (!newFolderName.trim() || loading) return;
    setLoading(true);
    try {
      const created = await saveFolder({
        name: newFolderName.trim(),
        parentId: null,
      });
      if (created?.id) {
        setNewFolderName("");
        setShowNewFolderInput(false);
        await loadFolders();
        setExpandedFolders((prev) =>
          new Set(prev).add(String(created.id)),
        );
      }
    } catch (err) {
      console.error("Failed to create folder:", err);
    } finally {
      setLoading(false);
    }
  }, [loading, loadFolders, newFolderName]);

  const handleDeleteFolder = useCallback(
    async (folderId: string) => {
      const normalizedFolderId = normalizeFolderId(folderId);
      if (!normalizedFolderId || !confirm("Delete this folder? Notes inside move to root.")) {
        return;
      }

      try {
        const success = await deleteFolder(normalizedFolderId);
        if (!success) return;

        const affected = notesInFolder(notes, normalizedFolderId);
        for (const note of affected) {
          await saveNote({ ...note, folderId: null } as NoteType);
        }

        setNotes((prev) =>
          prev.map((note) =>
            normalizeFolderId(note.folderId) === normalizedFolderId
              ? { ...note, folderId: null }
              : note,
          ),
        );
        setExpandedFolders((prev) => {
          const next = new Set(prev);
          next.delete(normalizedFolderId);
          return next;
        });
        await loadFolders();
      } catch (err) {
        console.error("Failed to delete folder:", err);
      }
    },
    [loadFolders, notes],
  );

  const handleDragStart = useCallback((e: React.DragEvent, noteId: string) => {
    e.stopPropagation();
    setDraggedNoteId(noteId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("application/x-note-id", noteId);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, folderId: string | null) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOverFolderId(folderId);
    },
    [],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const { clientX: x, clientY: y } = e;
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

      const note = notes.find((item) => item.id === noteId);
      const normalizedTarget = normalizeFolderId(targetFolderId);
      if (!note || normalizeFolderId(note.folderId) === normalizedTarget) {
        setDraggedNoteId(null);
        return;
      }

      try {
        await persistNote(
          note.id,
          note.title,
          note.content ?? cloneBlocks([]),
          normalizedTarget,
        );
        if (normalizedTarget) {
          setExpandedFolders((prev) => new Set(prev).add(normalizedTarget));
        }
      } finally {
        setDraggedNoteId(null);
      }
    },
    [draggedNoteId, notes, persistNote],
  );

  const toggleFolder = useCallback((folderId: string) => {
    const normalizedId = normalizeFolderId(folderId);
    if (!normalizedId) return;
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(normalizedId)) next.delete(normalizedId);
      else next.add(normalizedId);
      return next;
    });
  }, []);

  const toggleGroup = useCallback((label: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "n" && !e.shiftKey) {
        e.preventDefault();
        void handleCreateNoteRef.current("blank");
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "e" && !e.shiftKey) {
        e.preventDefault();
        if (selectedNote) void handleExportPDF();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "b" && !e.shiftKey) {
        e.preventDefault();
        setShowSidebar((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleExportPDF, selectedNote]);

  return (
    <div className="h-full w-full flex flex-col bg-[var(--color-background)] overflow-hidden">
      {storageError && (
        <div className="px-3 py-2 text-xs text-[var(--color-semantic-error)] bg-[var(--color-semantic-error)]/10 border-b border-[var(--color-border)]">
          {storageError}
        </div>
      )}

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
                if (!draggedNoteId) return;
                e.preventDefault();
                setDragOverFolderId(null);
              }}
              onDrop={(e) => {
                if (draggedNoteId) handleDrop(e, null);
              }}
            >
              {notesLoading ? (
                <div className="px-4 py-8 text-center text-sm text-[var(--color-text-secondary)]">
                  Loading notes...
                </div>
              ) : notes.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-[var(--color-text-secondary)]">
                  No notes yet. Click New to create one.
                </div>
              ) : (
                <>
                  {folders.length > 0 && (
                    <div className="px-2 pb-2 border-b border-[var(--color-border)]">
                      <div className="flex items-center justify-between mb-1 px-2">
                        <span className="tool-sidebar-title">Folders</span>
                        <button
                          onClick={() => setShowNewFolderInput((v) => !v)}
                          className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] text-sm w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--color-muted)]"
                        >
                          +
                        </button>
                      </div>
                      {showNewFolderInput && (
                        <div className="mb-2 px-2 flex gap-1">
                          <input
                            type="text"
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void handleCreateFolder();
                              if (e.key === "Escape") {
                                setShowNewFolderInput(false);
                                setNewFolderName("");
                              }
                            }}
                            placeholder="Folder name"
                            className="flex-1 text-sm px-3 py-2 rounded-md border border-[var(--color-border)] bg-[var(--color-background)]"
                            autoFocus
                          />
                          <button
                            onClick={() => void handleCreateFolder()}
                            disabled={loading}
                            className="px-2 py-1 rounded bg-[var(--color-primary)] text-white text-xs"
                          >
                            ✓
                          </button>
                        </div>
                      )}
                      {folders.map((folder) => {
                        const folderId = normalizeFolderId(folder.id);
                        if (!folderId) return null;
                        const folderNotes = notesInFolder(notes, folderId);
                        const isExpanded = expandedFolders.has(folderId);
                        return (
                          <div key={folderId} className="mb-0.5">
                            <div
                              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md cursor-pointer group hover:bg-[var(--color-muted)] ${
                                dragOverFolderId === folderId && draggedNoteId
                                  ? "bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30"
                                  : ""
                              }`}
                              onClick={() => toggleFolder(folderId)}
                              onDragOver={(e) => handleDragOver(e, folderId)}
                              onDragLeave={handleDragLeave}
                              onDrop={(e) => handleDrop(e, folderId)}
                            >
                              <span className="text-xs text-[var(--color-text-tertiary)]">
                                {isExpanded ? "▼" : "▶"}
                              </span>
                              <span className="flex-1 text-sm truncate font-medium">
                                {folder.name}
                              </span>
                              <span className="text-xs text-[var(--color-text-tertiary)] bg-[var(--color-muted)] px-1.5 py-0.5 rounded min-w-[20px] text-center">
                                {folderNotes.length}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleDeleteFolder(folderId);
                                }}
                                className="opacity-0 group-hover:opacity-100 text-sm text-[var(--color-text-tertiary)] hover:text-red-500"
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
                                    isSelected={selectedNote === note.id}
                                    isDragged={draggedNoteId === note.id}
                                    onSelect={() => void handleSelectNote(note.id)}
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
                      const isExpanded = expandedGroups.has(group.label);
                      return (
                        <div key={group.label} className="mb-0.5">
                          <ToolSidebarSection
                            label={group.label}
                            expanded={isExpanded}
                            onToggle={() => toggleGroup(group.label)}
                            count={group.items.length}
                          />
                          {isExpanded && (
                            <div className="mt-0">
                              {group.items.map((note) => (
                                <NoteItem
                                  key={note.id}
                                  note={note as NoteRecord}
                                  isSelected={selectedNote === note.id}
                                  isDragged={draggedNoteId === note.id}
                                  onSelect={() => void handleSelectNote(note.id)}
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
                </>
              )}
            </ToolSidebarBody>
          </ToolSidebar>
        )}

        <div className="flex-1 flex flex-col overflow-hidden h-full w-full">
          {selectedNote && selectedNoteRecord ? (
            <>
              <div className="border-b border-[var(--color-border)] bg-[var(--color-card)] px-3 py-1.5 flex-shrink-0">
                <div className="flex items-center gap-2 max-w-4xl mx-auto">
                  <button
                    onClick={() => setShowSidebar((v) => !v)}
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
                    className="flex-1 text-sm font-medium bg-transparent border-none outline-none placeholder-[var(--color-text-tertiary)]"
                  />
                  <button
                    onClick={() => void handleExportPDF()}
                    className="p-1 rounded hover:bg-[var(--color-muted)] text-[var(--color-text-secondary)]"
                    title="Export to PDF"
                  >
                    <Icon name="Download" size={16} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto overflow-x-hidden bg-[var(--color-background)]">
                <NoteEditor
                  key={selectedNote}
                  ref={editorRef}
                  noteId={selectedNote}
                  initialContent={cloneBlocks(selectedNoteRecord.content)}
                  templateId={currentTemplateId}
                  appTheme={appTheme}
                  onContentChange={(content) => void handleContentSave(content)}
                />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center px-5">
              <div className="text-center max-w-md">
                {notesLoading ? (
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    Loading notes...
                  </p>
                ) : notes.length === 0 ? (
                  <>
                    <h2 className="text-xl font-semibold mb-2">No notes yet</h2>
                    <p className="text-sm text-[var(--color-text-secondary)] mb-5">
                      Create your first note to get started.
                    </p>
                    <button
                      type="button"
                      onClick={() => void handleCreateNote("blank")}
                      disabled={isCreatingNote}
                      className="px-5 py-2 rounded-lg bg-[var(--color-primary)] text-white text-sm font-medium disabled:opacity-50"
                    >
                      {isCreatingNote ? "Creating..." : "+ Create New Note"}
                    </button>
                  </>
                ) : (
                  <>
                    <h2 className="text-xl font-semibold mb-2">Select a note</h2>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Pick a note from the sidebar or create a new one.
                    </p>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {showTemplateModal && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setShowTemplateModal(false)}
        >
          <div
            className="bg-[var(--color-card)] rounded-lg max-w-5xl w-full max-h-[85vh] overflow-hidden flex flex-col border border-[var(--color-border)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium">Templates</h2>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  Choose a template to get started
                </p>
              </div>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="p-1.5 rounded-md hover:bg-[var(--color-muted)]"
              >
                <Icon name="X" size={16} />
              </button>
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
                          className="group p-3 rounded-lg border border-[var(--color-border)] hover:border-[var(--color-primary)]/40 text-left disabled:opacity-50"
                        >
                          <div className="font-medium text-sm mb-0.5">
                            {template.name}
                          </div>
                          <div className="text-xs text-[var(--color-text-secondary)] line-clamp-2">
                            {template.description}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
