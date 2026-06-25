import { useState } from "react";
import { Editor } from "@monaco-editor/react";
import { getMonacoTheme, onMonacoBeforeMount } from "../utils/theme";
import { jsonToXml, xmlToJson } from "../utils/jsonXmlConverter";
import { PaneLabel, ToolToolbar } from "./ui/ToolChrome";

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
      <ToolToolbar
        title="JSON ↔ XML"
        actions={
          <>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as ConversionType)}
              className="input-field !h-7 !text-xs"
            >
              <option value="json-to-xml">JSON → XML</option>
              <option value="xml-to-json">XML → JSON</option>
            </select>
            <button onClick={handleConvert} className="btn-primary !h-7 !text-xs">
              Convert
            </button>
          </>
        }
      />
      <div className="flex-1 flex overflow-hidden gap-px bg-[var(--color-border)]">
        <div className="flex-1 flex flex-col bg-[var(--color-card)] overflow-hidden min-w-0">
          <PaneLabel>{type === "json-to-xml" ? "JSON" : "XML"}</PaneLabel>
          <div className="flex-1 min-h-0">
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
                fontSize: 12,
                wordWrap: "on",
                padding: { top: 8, bottom: 8 },
                automaticLayout: true,
              }}
            />
          </div>
        </div>
        <div className="flex-1 flex flex-col bg-[var(--color-card)] overflow-hidden min-w-0">
          <PaneLabel>{type === "json-to-xml" ? "XML" : "JSON"}</PaneLabel>
          <div className="flex-1 min-h-0 relative">
            <Editor
              height="100%"
              width="100%"
              defaultLanguage={type === "json-to-xml" ? "xml" : "json"}
              value={output || (error ? `Error: ${error}` : "// Output…")}
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
