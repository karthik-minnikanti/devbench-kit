import { PartialBlock } from "@blocknote/core";

export const NOTES_SESSION_KEY = "devbench-notes-session";
export const GIT_DATA_CHANGED_EVENT = "devbench:git-data-changed";

export interface NoteRecord {
  id: string;
  title: string;
  content: any[];
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
}

export function readNotesSession(): { selectedNoteId: string | null } {
  try {
    const raw = localStorage.getItem(NOTES_SESSION_KEY);
    if (!raw) return { selectedNoteId: null };
    const parsed = JSON.parse(raw);
    return { selectedNoteId: parsed?.selectedNoteId ?? null };
  } catch {
    return { selectedNoteId: null };
  }
}

export function persistNotesSession(selectedNoteId: string | null) {
  try {
    localStorage.setItem(
      NOTES_SESSION_KEY,
      JSON.stringify({ selectedNoteId }),
    );
  } catch {
    // ignore quota errors
  }
}

export function normalizeNoteId(note: { id?: string; _id?: string }): string {
  return String(note.id || note._id || "");
}

export function normalizeFolderId(
  value: string | number | null | undefined,
): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized === "" ? null : normalized;
}

export function normalizeNote(raw: any, index = 0): NoteRecord | null {
  const id = normalizeNoteId(raw);
  if (!id) return null;

  const content = Array.isArray(raw.content) ? raw.content : [];

  return {
    id,
    title: raw.title?.trim() || "Untitled",
    content,
    folderId: normalizeFolderId(raw.folderId),
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };
}

export function dedupeNotes(notesList: NoteRecord[]): NoteRecord[] {
  const byId = new Map<string, NoteRecord>();
  for (const note of notesList) {
    const existing = byId.get(note.id);
    if (
      !existing ||
      new Date(note.updatedAt).getTime() >= new Date(existing.updatedAt).getTime()
    ) {
      byId.set(note.id, note);
    }
  }
  return Array.from(byId.values());
}

export function rootNotes(notesList: NoteRecord[]): NoteRecord[] {
  return notesList.filter((note) => !note.folderId);
}

export function notesInFolder(
  notesList: NoteRecord[],
  folderId: string | null,
): NoteRecord[] {
  if (folderId === null) return rootNotes(notesList);
  const normalizedFolderId = normalizeFolderId(folderId);
  if (!normalizedFolderId) return [];
  return notesList.filter(
    (note) => normalizeFolderId(note.folderId) === normalizedFolderId,
  );
}

export function defaultBlocks(): PartialBlock[] {
  return [
    {
      type: "paragraph",
      content: [{ type: "text", text: "", styles: {} }],
    },
  ];
}

export function cloneBlocks(content: any[]): PartialBlock[] {
  if (!content?.length) return defaultBlocks();
  return JSON.parse(JSON.stringify(content)) as PartialBlock[];
}

export function generateNoteId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function noteContentSnapshot(
  title: string,
  content: any[],
  folderId?: string | null,
): string {
  return JSON.stringify({
    title: title.trim() || "Untitled",
    content,
    folderId: folderId ?? null,
  });
}

export function pickDefaultNoteId(notesList: NoteRecord[]): string | null {
  if (notesList.length === 0) return null;
  const sessionId = readNotesSession().selectedNoteId;
  if (sessionId && notesList.some((note) => note.id === sessionId)) {
    return sessionId;
  }
  return [...notesList].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )[0].id;
}
