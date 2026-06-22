import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { PartialBlock } from "@blocknote/core";
import { BlockNoteContext, useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/core/fonts/inter.css";
import "@blocknote/mantine/style.css";
import { getThemeForTemplate } from "../../utils/blockNoteThemes";
import { cloneBlocks } from "./noteUtils";
import { NOTES_EDITOR_CSS } from "./notesEditorStyles";

export interface NoteEditorHandle {
  flushSave: () => Promise<void>;
  exportHtml: () => Promise<string>;
  getContent: () => any[];
}

interface NoteEditorProps {
  noteId: string;
  initialContent: PartialBlock[];
  templateId: string;
  appTheme: "light" | "dark";
  onContentChange: (content: any[]) => void;
}

export const NoteEditor = forwardRef<NoteEditorHandle, NoteEditorProps>(
  function NoteEditor(
    { noteId, initialContent, templateId, appTheme, onContentChange },
    ref,
  ) {
    const editor = useCreateBlockNote({
      initialContent: cloneBlocks(initialContent as any[]),
      theme: getThemeForTemplate(templateId),
    });

    const onContentChangeRef = useRef(onContentChange);
    const readyRef = useRef(false);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const initialSnapshotRef = useRef(
      JSON.stringify(cloneBlocks(initialContent as any[])),
    );
    const dirtyRef = useRef(false);

    useEffect(() => {
      initialSnapshotRef.current = JSON.stringify(
        cloneBlocks(initialContent as any[]),
      );
      dirtyRef.current = false;
    }, [noteId, initialContent]);

    useEffect(() => {
      onContentChangeRef.current = onContentChange;
    }, [onContentChange]);

    useEffect(() => {
      readyRef.current = false;
      dirtyRef.current = false;
      const timer = window.setTimeout(() => {
        if (editor) {
          // Baseline from the live document so BlockNote normalization does not count as edits.
          initialSnapshotRef.current = JSON.stringify(editor.document);
        }
        readyRef.current = true;
      }, 120);
      return () => window.clearTimeout(timer);
    }, [noteId, editor]);

    const maybeNotifyChange = () => {
      if (!editor) return;
      const current = JSON.stringify(editor.document);
      dirtyRef.current = current !== initialSnapshotRef.current;
      if (!dirtyRef.current) return;
      onContentChangeRef.current(JSON.parse(current));
    };

    const flushSave = async () => {
      if (!editor) return;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      maybeNotifyChange();
    };

    useImperativeHandle(ref, () => ({
      flushSave,
      exportHtml: async () => editor.blocksToHTMLLossy(editor.document),
      getContent: () => JSON.parse(JSON.stringify(editor.document)),
    }));

    useEffect(() => {
      if (!editor) return;

      const unsubscribe = editor.onChange(() => {
        if (!readyRef.current) return;
        const current = JSON.stringify(editor.document);
        dirtyRef.current = current !== initialSnapshotRef.current;
        if (!dirtyRef.current) return;
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
          maybeNotifyChange();
        }, 500);
      });

      return () => {
        unsubscribe();
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
      };
    }, [editor, noteId]);

    return (
      <div className="w-full h-full notes-editor-container px-6 py-8">
        <style>{NOTES_EDITOR_CSS}</style>
        <BlockNoteContext.Provider value={{ colorSchemePreference: appTheme }}>
          <BlockNoteView editor={editor} theme={appTheme} />
        </BlockNoteContext.Provider>
      </div>
    );
  },
);
