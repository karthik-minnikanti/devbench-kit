import { Editor } from "@monaco-editor/react";
import { getMonacoTheme, onMonacoBeforeMount } from "../utils/theme";
import { useStore } from "../state/store";

export function JsonEditor() {
  const jsonInput = useStore((state) => state.jsonInput);
  const setJsonInput = useStore((state) => state.setJsonInput);

  return (
    <div className="h-full flex flex-col bg-[var(--color-card)]">
      <div className="px-4 py-2 border-b border-[var(--color-border)] flex-shrink-0">
        <div className="text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
          JSON Input
        </div>
      </div>
      <div className="flex-1">
        <Editor
          height="100%"
          width="100%"
          defaultLanguage="json"
          value={jsonInput}
          onChange={(value) => setJsonInput(value || "")}
          theme={getMonacoTheme()}
          beforeMount={onMonacoBeforeMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            wordWrap: "on",
            padding: { top: 16, bottom: 16 },
            automaticLayout: true,
          }}
        />
      </div>
    </div>
  );
}
