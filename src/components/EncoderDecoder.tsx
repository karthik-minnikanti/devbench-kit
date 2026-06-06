import { useState } from "react";
import { Editor } from "@monaco-editor/react";
import { getMonacoTheme, onMonacoBeforeMount } from "../utils/theme";
import {
  encodeBase64,
  decodeBase64,
  encodeUrl,
  decodeUrl,
} from "../utils/encoders";

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
      <div className="tool-header">
        <h2 className="title-sm flex items-center gap-2">
          <span className="text-lg">🔐</span>
          Encoder / Decoder
        </h2>
        <div className="flex items-center gap-2">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as EncoderType)}
            className="input-field text-xs"
          >
            <option value="base64-encode">Base64 Encode</option>
            <option value="base64-decode">Base64 Decode</option>
            <option value="url-encode">URL Encode</option>
            <option value="url-decode">URL Decode</option>
          </select>
          <button onClick={handleEncodeDecode} className="btn-primary text-xs">
            {type.includes("encode") ? "⚡ Encode" : "🔓 Decode"}
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
              defaultLanguage="plaintext"
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
