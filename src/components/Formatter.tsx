import { useState } from "react";
import { Editor } from "@monaco-editor/react";
import { getMonacoTheme, onMonacoBeforeMount } from "../utils/theme";
import {
  formatJson,
  minifyJson,
  formatXml,
  removeNewlines,
  replaceDoubleQuotesWithSingle,
  addQuotesToKeys,
  escapeJsonForPostman,
} from "../utils/formatters";
import { PaneLabel, ToolToolbar } from "./ui/ToolChrome";

type FormatType =
  | "json-format"
  | "json-minify"
  | "xml-format"
  | "remove-newlines"
  | "quotes-single"
  | "postman-keys"
  | "postman-escape";

export function Formatter() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<FormatType>("json-format");

  const handleFormat = () => {
    setError(null);
    try {
      switch (type) {
        case "json-format":
          setOutput(formatJson(input, 2));
          break;
        case "json-minify":
          setOutput(minifyJson(input));
          break;
        case "xml-format":
          setOutput(formatXml(input, 2));
          break;
        case "remove-newlines":
          setOutput(removeNewlines(input));
          break;
        case "quotes-single":
          setOutput(replaceDoubleQuotesWithSingle(input));
          break;
        case "postman-keys":
          setOutput(addQuotesToKeys(input));
          break;
        case "postman-escape":
          setOutput(escapeJsonForPostman(input));
          break;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Formatting failed");
      setOutput("");
    }
  };

  return (
    <div className="h-full flex flex-col">
      <ToolToolbar
        title="Formatter"
        actions={
          <>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as FormatType)}
              className="input-field !h-7 !text-xs max-w-[180px]"
            >
              <option value="json-format">JSON Format</option>
              <option value="json-minify">JSON Minify</option>
              <option value="xml-format">XML Format</option>
              <option value="remove-newlines">Remove Newlines</option>
              <option value="quotes-single">Single Quotes</option>
              <option value="postman-keys">Add Quotes to Keys</option>
              <option value="postman-escape">Escape for Postman</option>
            </select>
            <button onClick={handleFormat} className="btn-primary !h-7 !text-xs">
              Format
            </button>
          </>
        }
      />
      <div className="flex-1 flex overflow-hidden gap-px bg-[var(--color-border)]">
        <div className="flex-1 flex flex-col bg-[var(--color-card)] overflow-hidden min-w-0">
          <PaneLabel>Input</PaneLabel>
          <div className="flex-1">
            <Editor
              height="100%"
              width="100%"
              defaultLanguage="json"
              value={input}
              onChange={(value) => setInput(value || "")}
              theme={getMonacoTheme()}
          beforeMount={onMonacoBeforeMount}
              options={{
                minimap: { enabled: false },
                fontSize: 12,
                wordWrap: "on",
                padding: { top: 8, bottom: 8 },
                automaticLayout: true,
              }}
            />
          </div>
        </div>
        <div className="flex-1 flex flex-col bg-[var(--color-card)] overflow-hidden min-w-0">
          <PaneLabel>Output</PaneLabel>
          <div className="flex-1 relative">
            <Editor
              height="100%"
              width="100%"
              defaultLanguage="json"
              value={
                output ||
                (error ? `Error: ${error}` : "// Output will appear here...")
              }
              theme={getMonacoTheme()}
          beforeMount={onMonacoBeforeMount}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 12,
                wordWrap: "on",
                padding: { top: 8, bottom: 8 },
                automaticLayout: true,
              }}
            />
            {error && (
              <div className="error-banner absolute bottom-3 left-3 right-3 text-xs">{error}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
