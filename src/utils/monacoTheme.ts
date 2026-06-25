import type { Monaco } from "@monaco-editor/react";

export const DEVBENCH_MONACO_LIGHT = "devbench-light";
export const DEVBENCH_MONACO_DARK = "devbench-dark";

let registered = false;

export function registerDevBenchMonacoThemes(monaco: Monaco): void {
  if (registered) return;
  registered = true;

  monaco.editor.defineTheme(DEVBENCH_MONACO_LIGHT, {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "807D72", fontStyle: "italic" },
      { token: "string", foreground: "1F8A65" },
      { token: "number", foreground: "C08532" },
      { token: "keyword", foreground: "D04200" },
      { token: "type", foreground: "9FBBE0" },
      { token: "delimiter", foreground: "5A5852" },
      { token: "tag", foreground: "D04200" },
      { token: "attribute.name", foreground: "C08532" },
      { token: "attribute.value", foreground: "1F8A65" },
    ],
    colors: {
      "editor.background": "#f7f7f4",
      "editor.foreground": "#26251e",
      "editor.lineHighlightBackground": "#efeee8",
      "editor.selectionBackground": "#f54e0033",
      "editor.inactiveSelectionBackground": "#f54e0022",
      "editorCursor.foreground": "#26251e",
      "editorLineNumber.foreground": "#a09c92",
      "editorLineNumber.activeForeground": "#807d72",
      "editor.selectionHighlightBackground": "#efeee8",
      "editorWidget.background": "#ffffff",
      "editorWidget.border": "#e6e5e0",
      "input.background": "#ffffff",
      "input.border": "#e6e5e0",
      "dropdown.background": "#ffffff",
      "dropdown.border": "#e6e5e0",
      "scrollbarSlider.background": "#cfcdc466",
      "scrollbarSlider.hoverBackground": "#cfcdc499",
      "minimap.background": "#fafaf7",
    },
  });

  monaco.editor.defineTheme(DEVBENCH_MONACO_DARK, {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "807D72", fontStyle: "italic" },
      { token: "string", foreground: "1F8A65" },
      { token: "number", foreground: "C08532" },
      { token: "keyword", foreground: "FF6A1A" },
      { token: "type", foreground: "9FBBE0" },
      { token: "delimiter", foreground: "A09C92" },
      { token: "tag", foreground: "FF6A1A" },
      { token: "attribute.name", foreground: "C08532" },
      { token: "attribute.value", foreground: "1F8A65" },
    ],
    colors: {
      "editor.background": "#1a1917",
      "editor.foreground": "#f7f7f4",
      "editor.lineHighlightBackground": "#2e2c28",
      "editor.selectionBackground": "#f54e0044",
      "editor.inactiveSelectionBackground": "#f54e0022",
      "editorCursor.foreground": "#f7f7f4",
      "editorLineNumber.foreground": "#5a5852",
      "editorLineNumber.activeForeground": "#807d72",
      "editor.selectionHighlightBackground": "#2e2c28",
      "editorWidget.background": "#242320",
      "editorWidget.border": "#3d3b36",
      "input.background": "#242320",
      "input.border": "#3d3b36",
      "dropdown.background": "#242320",
      "dropdown.border": "#3d3b36",
      "scrollbarSlider.background": "#4a484066",
      "scrollbarSlider.hoverBackground": "#4a484099",
      "minimap.background": "#1f1e1b",
    },
  });
}

export function onMonacoBeforeMount(monaco: Monaco): void {
  registerDevBenchMonacoThemes(monaco);
}
