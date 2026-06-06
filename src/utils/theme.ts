import type { Monaco } from "@monaco-editor/react";
import {
  DEVBENCH_MONACO_DARK,
  DEVBENCH_MONACO_LIGHT,
  onMonacoBeforeMount,
  registerDevBenchMonacoThemes,
} from "./monacoTheme";

export {
  DEVBENCH_MONACO_DARK,
  DEVBENCH_MONACO_LIGHT,
  onMonacoBeforeMount,
  registerDevBenchMonacoThemes,
};

/**
 * DevBench Monaco theme name for the current app color scheme.
 */
export function getMonacoTheme(): typeof DEVBENCH_MONACO_LIGHT | typeof DEVBENCH_MONACO_DARK {
  return document.documentElement.classList.contains("dark")
    ? DEVBENCH_MONACO_DARK
    : DEVBENCH_MONACO_LIGHT;
}

/**
 * Get the current theme name
 */
export function getCurrentTheme(): "light" | "dark" {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/** Shared Monaco editor options aligned with the design system */
export const monacoEditorOptions = {
  minimap: { enabled: false },
  fontSize: 13,
  fontFamily: "'JetBrains Mono', 'Fira Code', ui-monospace, monospace",
  wordWrap: "on" as const,
  padding: { top: 16, bottom: 16 },
  automaticLayout: true,
  scrollBeyondLastLine: false,
};

export type MonacoBeforeMount = (monaco: Monaco) => void;
