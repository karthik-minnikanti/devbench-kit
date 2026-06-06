import { useState } from "react";
import { Editor } from "@monaco-editor/react";
import { getMonacoTheme, onMonacoBeforeMount } from "../utils/theme";
import { jsonToXml, xmlToJson } from "../utils/jsonXmlConverter";

type ConversionType = "json-to-xml" | "xml-to-json";

export function JsonXmlConverter() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<ConversionType>("json-to-xml");

  const handleConvert = () => {
    setError(null);
    try {
      if (type === "json-to-xml") {
        setOutput(jsonToXml(input, "root"));
      } else {
        setOutput(xmlToJson(input));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Conversion failed");
      setOutput("");
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="tool-header">
        <h2 className="title-sm flex items-center gap-2">
          <span className="text-lg">🔄</span>
          JSON ↔ XML Converter
        </h2>
        <div className="flex items-center gap-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ConversionType)}
            className="input-field text-xs"
          >
            <option value="json-to-xml">JSON → XML</option>
            <option value="xml-to-json">XML → JSON</option>
          </select>
          <button onClick={handleConvert} className="btn-primary text-xs">
            ⚡ Convert
          </button>
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden gap-2 p-2">
        <div className="flex-1 flex flex-col card overflow-hidden">
          <div className="px-4 py-2.5 editor-pane-header">
            <div className="text-xs font-bold text-[var(--color-text-secondary)] flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-[var(--color-primary)] rounded-full"></span>
              {type === "json-to-xml" ? "JSON" : "XML"}
            </div>
          </div>
          <div className="flex-1">
            <Editor
              height="100%"
              width="100%"
              defaultLanguage={type === "json-to-xml" ? "json" : "xml"}
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
              {type === "json-to-xml" ? "XML" : "JSON"}
            </div>
          </div>
          <div className="flex-1 relative">
            <Editor
              height="100%"
              width="100%"
              defaultLanguage={type === "json-to-xml" ? "xml" : "json"}
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
