import { useState } from "react";
import { Editor } from "@monaco-editor/react";
import { getMonacoTheme, onMonacoBeforeMount } from "../utils/theme";
import {
  encodeBase64,
  decodeBase64,
  encodeUrl,
  decodeUrl,
} from "../utils/encoders";
import { PaneLabel, ToolToolbar } from "./ui/ToolChrome";

type EncoderType =
  | "base64-encode"
  | "base64-decode"
  | "url-encode"
  | "url-decode";

export function EncoderDecoder() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<EncoderType>("base64-encode");

  const handleEncodeDecode = () => {
    setError(null);
    try {
      switch (type) {
        case "base64-encode":
          setOutput(encodeBase64(input));
          break;
        case "base64-decode":
          setOutput(decodeBase64(input));
          break;
        case "url-encode":
          setOutput(encodeUrl(input));
          break;
        case "url-decode":
          setOutput(decodeUrl(input));
          break;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Operation failed");
      setOutput("");
    }
  };

  return (
    <div className="h-full flex flex-col">
      <ToolToolbar
        title="Encoder / Decoder"
        actions={
          <>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as EncoderType)}
              className="input-field !h-7 !text-xs"
            >
              <option value="base64-encode">Base64 Encode</option>
              <option value="base64-decode">Base64 Decode</option>
              <option value="url-encode">URL Encode</option>
              <option value="url-decode">URL Decode</option>
            </select>
            <button onClick={handleEncodeDecode} className="btn-primary !h-7 !text-xs">
              {type.includes("encode") ? "Encode" : "Decode"}
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
              defaultLanguage="plaintext"
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
              defaultLanguage="plaintext"
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
