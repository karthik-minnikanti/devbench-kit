import { useState } from "react";
import { Editor } from "@monaco-editor/react";
import { getMonacoTheme, onMonacoBeforeMount } from "../utils/theme";

const commonPatterns = [
  { name: "Email", pattern: "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}" },
  {
    name: "URL",
    pattern:
      "https?://[\\w\\-]+(\\.[\\w\\-]+)+([\\w\\-.,@?^=%&:/~+#]*[\\w\\-@?^=%&/~+#])?",
  },
  {
    name: "Phone (US)",
    pattern: "\\+?1?[-.\\s]?\\(?[0-9]{3}\\)?[-.\\s]?[0-9]{3}[-.\\s]?[0-9]{4}",
  },
  { name: "IP Address", pattern: "\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b" },
  { name: "Date (YYYY-MM-DD)", pattern: "\\d{4}-\\d{2}-\\d{2}" },
  {
    name: "Credit Card",
    pattern: "\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}",
  },
  { name: "Hex Color", pattern: "#[0-9A-Fa-f]{6}" },
  { name: "Alphanumeric", pattern: "[a-zA-Z0-9]+" },
];

export function RegexTester() {
  const [pattern, setPattern] = useState(
    "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
  );
  const [testText, setTestText] = useState(
    "Contact us at john@example.com or jane@test.org",
  );
  const [flags, setFlags] = useState({
    global: true,
    ignoreCase: false,
    multiline: false,
    dotAll: false,
  });
  const [matches, setMatches] = useState<
    Array<{ match: string; index: number; groups: string[] }>
  >([]);
  const [replaceText, setReplaceText] = useState("");
  const [replacedResult, setReplacedResult] = useState("");

  const testPattern = () => {
    try {
      // Build flags array and remove duplicates
      const flagsArray: string[] = [];
      if (flags.global) flagsArray.push("g");
      if (flags.ignoreCase) flagsArray.push("i");
      if (flags.multiline) flagsArray.push("m");
      if (flags.dotAll) flagsArray.push("s");

      // Remove duplicates
      const uniqueFlags = Array.from(new Set(flagsArray)).join("");

      const regex = new RegExp(pattern, uniqueFlags);
      const foundMatches: Array<{
        match: string;
        index: number;
        groups: string[];
      }> = [];

      // For finding all matches, we always need the global flag
      // But we need to ensure we don't duplicate it
      let searchFlags = uniqueFlags;
      if (!searchFlags.includes("g")) {
        searchFlags += "g";
      }

      const regexGlobal = new RegExp(pattern, searchFlags);

      let match;
      let lastIndex = 0;
      while ((match = regexGlobal.exec(testText)) !== null) {
        // Prevent infinite loop
        if (match.index === lastIndex && match[0].length === 0) {
          regexGlobal.lastIndex++;
          lastIndex = regexGlobal.lastIndex;
          continue;
        }
        lastIndex = match.index;

        foundMatches.push({
          match: match[0],
          index: match.index,
          groups: match.slice(1),
        });

        if (!flags.global) break;
      }

      setMatches(foundMatches);

      // Perform replacement if replace text is provided
      if (replaceText) {
        const replaced = testText.replace(regex, replaceText);
        setReplacedResult(replaced);
      } else {
        setReplacedResult("");
      }
    } catch (err) {
      setMatches([]);
      setReplacedResult("");
      console.error("Regex error:", err);
    }
  };

  const selectPattern = (selectedPattern: string) => {
    setPattern(selectedPattern);
    testPattern();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="h-full flex flex-col bg-[var(--color-card)]">
      <div className="tool-header">
        <span className="text-xs font-medium">Regex Tester</span>
        <button onClick={testPattern} className="btn-primary !h-7 !text-xs">
          Test
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden" style={{ minHeight: 0 }}>
        {/* Left Panel - Pattern & Test Text */}
        <div
          className="w-1/2 flex flex-col border-r border-[var(--color-border)]"
          style={{ minHeight: 0 }}
        >
          {/* Pattern Input */}
          <div className="flex-shrink-0 border-b border-[var(--color-border)]">
            <div className="px-3 py-1.5 bg-[var(--color-muted)] border-b border-[var(--color-border)] flex items-center justify-between">
              <div className="text-[10px] font-medium text-[var(--color-text-secondary)] uppercase">
                Pattern
              </div>
              <div className="flex items-center gap-1">
                <label className="flex items-center gap-1 text-[10px] text-[var(--color-text-secondary)]">
                  <input
                    type="checkbox"
                    checked={flags.global}
                    onChange={(e) =>
                      setFlags({ ...flags, global: e.target.checked })
                    }
                    className="w-3 h-3"
                  />
                  g
                </label>
                <label className="flex items-center gap-1 text-[10px] text-[var(--color-text-secondary)]">
                  <input
                    type="checkbox"
                    checked={flags.ignoreCase}
                    onChange={(e) =>
                      setFlags({ ...flags, ignoreCase: e.target.checked })
                    }
                    className="w-3 h-3"
                  />
                  i
                </label>
                <label className="flex items-center gap-1 text-[10px] text-[var(--color-text-secondary)]">
                  <input
                    type="checkbox"
                    checked={flags.multiline}
                    onChange={(e) =>
                      setFlags({ ...flags, multiline: e.target.checked })
                    }
                    className="w-3 h-3"
                  />
                  m
                </label>
                <label className="flex items-center gap-1 text-[10px] text-[var(--color-text-secondary)]">
                  <input
                    type="checkbox"
                    checked={flags.dotAll}
                    onChange={(e) =>
                      setFlags({ ...flags, dotAll: e.target.checked })
                    }
                    className="w-3 h-3"
                  />
                  s
                </label>
              </div>
            </div>
            <div className="p-2">
              <input
                type="text"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                placeholder="Enter regex pattern"
                className="w-full px-2 py-1.5 text-sm bg-[var(--color-card)] border border-[var(--color-border)] rounded text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:border-[var(--color-border-strong)]"
              />
            </div>
            <div className="px-3 py-1.5 bg-[var(--color-muted)] border-t border-[var(--color-border)]">
              <div className="text-[10px] font-medium text-[var(--color-text-secondary)] uppercase mb-1">
                Common Patterns
              </div>
              <div className="flex flex-wrap gap-1">
                {commonPatterns.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => selectPattern(p.pattern)}
                    className="px-2 py-0.5 rounded text-[10px] bg-[var(--color-muted)] text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)] transition-colors"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Test Text */}
          <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
            <div className="px-3 py-1.5 bg-[var(--color-muted)] border-b border-[var(--color-border)]">
              <div className="text-[10px] font-medium text-[var(--color-text-secondary)] uppercase">
                Test Text
              </div>
            </div>
            <div className="flex-1" style={{ minHeight: 0 }}>
              <Editor
                height="100%"
                defaultLanguage="plaintext"
                value={testText}
                onChange={(value) => setTestText(value || "")}
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

          {/* Replace Text */}
          <div className="flex-shrink-0 border-t border-[var(--color-border)]">
            <div className="px-3 py-1.5 bg-[var(--color-muted)] border-b border-[var(--color-border)]">
              <div className="text-[10px] font-medium text-[var(--color-text-secondary)] uppercase">
                Replace With (Optional)
              </div>
            </div>
            <div className="p-2">
              <input
                type="text"
                value={replaceText}
                onChange={(e) => setReplaceText(e.target.value)}
                placeholder="Enter replacement text"
                className="w-full px-2 py-1.5 text-sm bg-[var(--color-card)] border border-[var(--color-border)] rounded text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:border-[var(--color-border-strong)]"
              />
            </div>
          </div>
        </div>

        {/* Right Panel - Results */}
        <div className="w-1/2 flex flex-col" style={{ minHeight: 0 }}>
          {/* Matches */}
          <div
            className="flex-1 flex flex-col border-b border-[var(--color-border)]"
            style={{ minHeight: 0 }}
          >
            <div className="px-3 py-1.5 bg-[var(--color-muted)] border-b border-[var(--color-border)] flex items-center justify-between">
              <div className="text-[10px] font-medium text-[var(--color-text-secondary)] uppercase">
                Matches ({matches.length})
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {matches.length === 0 ? (
                <div className="text-sm text-[var(--color-text-tertiary)]">
                  No matches found
                </div>
              ) : (
                <div className="space-y-2">
                  {matches.map((m, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded bg-[var(--color-muted)] border border-[var(--color-border)]"
                    >
                      <div className="flex items-start justify-between mb-1">
                        <div className="text-xs font-medium text-[var(--color-text-primary)]">
                          Match #{idx + 1}
                        </div>
                        <button
                          onClick={() => copyToClipboard(m.match)}
                          className="text-[10px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                        >
                          Copy
                        </button>
                      </div>
                      <div className="text-sm text-[var(--color-text-secondary)] font-mono mb-1">
                        {m.match}
                      </div>
                      <div className="text-[10px] text-[var(--color-text-tertiary)]">
                        Index: {m.index}
                      </div>
                      {m.groups.length > 0 && (
                        <div className="mt-1">
                          <div className="text-[10px] text-[var(--color-text-tertiary)] mb-0.5">
                            Groups:
                          </div>
                          {m.groups.map((g, gIdx) => (
                            <div
                              key={gIdx}
                              className="text-xs text-[var(--color-text-secondary)] font-mono ml-2"
                            >
                              ${gIdx + 1}: {g}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Replaced Result */}
          {replacedResult && (
            <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
              <div className="px-3 py-1.5 bg-[var(--color-muted)] border-b border-[var(--color-border)] flex items-center justify-between">
                <div className="text-[10px] font-medium text-[var(--color-text-secondary)] uppercase">
                  Replaced Result
                </div>
                <button
                  onClick={() => copyToClipboard(replacedResult)}
                  className="px-2 py-0.5 rounded text-[10px] text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)] transition-colors"
                >
                  Copy
                </button>
              </div>
              <div className="flex-1" style={{ minHeight: 0 }}>
                <Editor
                  height="100%"
                  defaultLanguage="plaintext"
                  value={replacedResult}
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
          )}
        </div>
      </div>
    </div>
  );
}
