import { useState } from "react";
import { Editor } from "@monaco-editor/react";
import { getMonacoTheme, onMonacoBeforeMount } from "../utils/theme";

export function JsonDiff() {
  const [leftJson, setLeftJson] = useState(
    '{\n "name": "John",\n "age": 30\n}',
  );
  const [rightJson, setRightJson] = useState(
    '{\n "name": "Jane",\n "age": 30,\n "city": "NYC"\n}',
  );
  const [error, setError] = useState<string | null>(null);
  const [diffResult, setDiffResult] = useState<string>("");

  const parseJson = (json: string): any => {
    try {
      return JSON.parse(json);
    } catch (e) {
      throw new Error(
        `Invalid JSON: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  };

  const formatJson = (obj: any): string => {
    return JSON.stringify(obj, null, 2);
  };

  const compareJson = () => {
    setError(null);
    try {
      const left = parseJson(leftJson);
      const right = parseJson(rightJson);

      const leftFormatted = formatJson(left);
      const rightFormatted = formatJson(right);

      // Simple line-by-line diff
      const leftLines = leftFormatted.split("\n");
      const rightLines = rightFormatted.split("\n");

      let diff = "";
      const maxLines = Math.max(leftLines.length, rightLines.length);

      for (let i = 0; i < maxLines; i++) {
        const leftLine = leftLines[i] || "";
        const rightLine = rightLines[i] || "";

        if (leftLine === rightLine) {
          diff += ` ${leftLine}\n`;
        } else {
          if (leftLine) {
            diff += `- ${leftLine}\n`;
          }
          if (rightLine) {
            diff += `+ ${rightLine}\n`;
          }
        }
      }

      setDiffResult(diff || "No differences found");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to compare JSON");
      setDiffResult("");
    }
  };

  const beautifyJson = (json: string, setter: (value: string) => void) => {
    try {
      const parsed = JSON.parse(json);
      setter(formatJson(parsed));
    } catch (e) {
      setError("Invalid JSON to beautify");
    }
  };

  return (
    <div className="h-full flex flex-col bg-[var(--color-card)]">
      <div className="px-4 py-2 border-b border-[var(--color-border)] flex-shrink-0 flex items-center justify-between">
        <div className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider">
          JSON Diff
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => beautifyJson(leftJson, setLeftJson)}
            className="btn-secondary text-xs"
          >
            Beautify Left
          </button>
          <button
            onClick={() => beautifyJson(rightJson, setRightJson)}
            className="btn-secondary text-xs"
          >
            Beautify Right
          </button>
          <button onClick={compareJson} className="btn-primary text-xs">
            Compare
          </button>
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
          <div className="text-xs text-red-600 dark:text-red-400">{error}</div>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden" style={{ minHeight: 0 }}>
        {/* Left JSON */}
        <div
          className="flex-1 flex flex-col border-r border-[var(--color-border)]"
          style={{ minHeight: 0 }}
        >
          <div className="px-3 py-1.5 bg-[var(--color-muted)] border-b border-[var(--color-border)]">
            <div className="text-[10px] font-medium text-[var(--color-text-secondary)] uppercase">
              Left JSON
            </div>
          </div>
          <div className="flex-1" style={{ minHeight: 0 }}>
            <Editor
              height="100%"
              defaultLanguage="json"
              value={leftJson}
              onChange={(value) => setLeftJson(value || "")}
              theme={getMonacoTheme()}
          beforeMount={onMonacoBeforeMount}
              options={{
                minimap: { enabled: false },
                fontSize: 12,
                wordWrap: "on",
                automaticLayout: true,
              }}
            />
          </div>
        </div>

        {/* Right JSON */}
        <div
          className="flex-1 flex flex-col border-r border-[var(--color-border)]"
          style={{ minHeight: 0 }}
        >
          <div className="px-3 py-1.5 bg-[var(--color-muted)] border-b border-[var(--color-border)]">
            <div className="text-[10px] font-medium text-[var(--color-text-secondary)] uppercase">
              Right JSON
            </div>
          </div>
          <div className="flex-1" style={{ minHeight: 0 }}>
            <Editor
              height="100%"
              defaultLanguage="json"
              value={rightJson}
              onChange={(value) => setRightJson(value || "")}
              theme={getMonacoTheme()}
          beforeMount={onMonacoBeforeMount}
              options={{
                minimap: { enabled: false },
                fontSize: 12,
                wordWrap: "on",
                automaticLayout: true,
              }}
            />
          </div>
        </div>

        {/* Diff Result */}
        <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
          <div className="px-3 py-1.5 bg-[var(--color-muted)] border-b border-[var(--color-border)] flex items-center justify-between">
            <div className="text-[10px] font-medium text-[var(--color-text-secondary)] uppercase">
              Diff Result
            </div>
            {diffResult && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(diffResult);
                }}
                className="btn-tertiary text-[10px]"
              >
                Copy
              </button>
            )}
          </div>
          <div className="flex-1" style={{ minHeight: 0 }}>
            <Editor
              height="100%"
              defaultLanguage="diff"
              value={diffResult || 'Click "Compare" to see differences'}
              theme={getMonacoTheme()}
          beforeMount={onMonacoBeforeMount}
              options={{
                minimap: { enabled: false },
                fontSize: 12,
                wordWrap: "on",
                readOnly: true,
                automaticLayout: true,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
