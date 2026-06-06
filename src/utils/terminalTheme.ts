import type { ITheme } from "@xterm/xterm";

function cssVar(name: string, fallback: string): string {
  if (typeof document === "undefined") {
    return fallback;
  }
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

/** xterm theme derived from DevBench CSS variables (light + dark). */
export function getTerminalTheme(): ITheme {
  const background = cssVar("--color-sidebar", "#1f1e1b");
  const foreground = cssVar("--color-text-primary", "#f7f7f4");
  const primary = cssVar("--color-primary", "#f54e00");
  const muted = cssVar("--color-muted", "#2e2c28");
  const soft = cssVar("--color-background-soft", "#242320");
  const secondary = cssVar("--color-text-secondary", "#a09c92");
  const error = cssVar("--color-semantic-error", "#cf2d56");
  const success = cssVar("--color-semantic-success", "#1f8a65");
  const warning = cssVar("--color-semantic-warning", "#c08532");
  const read = cssVar("--color-timeline-read", "#9fbbe0");
  const edit = cssVar("--color-timeline-edit", "#c0a8dd");
  const grep = cssVar("--color-timeline-grep", "#9fc9a2");

  return {
    background,
    foreground,
    cursor: primary,
    cursorAccent: background,
    selectionBackground: cssVar("--color-border-strong", muted),
    selectionForeground: foreground,
    black: soft,
    red: error,
    green: success,
    yellow: warning,
    blue: read,
    magenta: edit,
    cyan: grep,
    white: secondary,
    brightBlack: cssVar("--color-text-tertiary", secondary),
    brightRed: error,
    brightGreen: success,
    brightYellow: warning,
    brightBlue: read,
    brightMagenta: edit,
    brightCyan: grep,
    brightWhite: foreground,
  };
}

export function subscribeToTerminalTheme(onChange: () => void): () => void {
  if (typeof document === "undefined") {
    return () => {};
  }
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

export const terminalFontFamily =
  '"JetBrains Mono", "SF Mono", Menlo, Monaco, "Courier New", monospace';

export const K8S_POD_SHELL = "/bin/bash";
export const CONTAINER_SHELL = K8S_POD_SHELL;
