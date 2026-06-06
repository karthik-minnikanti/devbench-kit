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
      <div className="tool-header">
        <h2 className="title-sm flex items-center gap-2">
          <span className="text-lg">✨</span>
          Formatter
        </h2>
        <div className="flex items-center gap-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as FormatType)}
            className="input-field text-xs"
          >
            <option value="json-format">JSON Format</option>
            <option value="json-minify">JSON Minify</option>
            <option value="xml-format">XML Format</option>
            <option value="remove-newlines">Remove Newlines</option>
            <option value="quotes-single">Single Quotes</option>
            <option value="postman-keys">Add Quotes to Keys</option>
            <option value="postman-escape">Escape for Postman</option>
          </select>
          <button onClick={handleFormat} className="btn-primary text-xs">
            ⚡ Format
          </button>
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden gap-2 p-2">
        <div className="flex-1 flex flex-col card overflow-hidden">
          <div className="px-4 py-2.5 editor-pane-header">
            <div className="text-xs font-bold text-[var(--color-text-secondary)] flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[var(--color-primary)] rounded-full"></span>
              Input
            </div>
          </div>
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
                fontSize: 14,
                wordWrap: "on",
                padding: { top: 16, bottom: 16 },
                automaticLayout: true,
              }}
            />
          </div>
        </div>
        <div className="flex-1 flex flex-col card overflow-hidden">
          <div className="px-4 py-2.5 editor-pane-header">
            <div className="text-xs font-bold text-[var(--color-text-secondary)] flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[var(--color-semantic-success)] rounded-full"></span>
              Output
            </div>
          </div>
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
                fontSize: 14,
                wordWrap: "on",
                padding: { top: 16, bottom: 16 },
                automaticLayout: true,
              }}
            />
            {error && (
              <div className="error-banner absolute bottom-4 left-4 right-4 animate-slide-up">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⚠️</span>
                  <span className="font-medium">{error}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
