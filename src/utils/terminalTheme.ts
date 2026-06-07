import type { ITheme } from "@xterm/xterm";

export interface TerminalThemePreset {
  id: string;
  name: string;
  swatch: string;
  description?: string;
  theme: ITheme;
}

const TERMINAL_THEME_KEY = "devbench-terminal-theme";
const TERMINAL_FONT_SIZE_KEY = "devbench-terminal-font-size";
const TERMINAL_APPEARANCE_EVENT = "devbench-terminal-appearance-change";

const sharedBright = {
  brightBlack: "#6b7280",
  brightRed: "#f87171",
  brightGreen: "#4ade80",
  brightYellow: "#facc15",
  brightBlue: "#60a5fa",
  brightMagenta: "#c084fc",
  brightCyan: "#22d3ee",
  brightWhite: "#f9fafb",
};

export const TERMINAL_THEME_PRESETS: TerminalThemePreset[] = [
  {
    id: "devbench",
    name: "DevBench",
    swatch: "#1f1e1b",
    description: "Matches app theme",
    theme: {} as ITheme,
  },
  {
    id: "enterprise-midnight",
    name: "Midnight",
    swatch: "#0d1117",
    description: "GitHub-style dark",
    theme: {
      background: "#0d1117",
      foreground: "#e6edf3",
      cursor: "#58a6ff",
      cursorAccent: "#0d1117",
      selectionBackground: "#264f78",
      selectionForeground: "#e6edf3",
      black: "#484f58",
      red: "#ff7b72",
      green: "#3fb950",
      yellow: "#d29922",
      blue: "#58a6ff",
      magenta: "#bc8cff",
      cyan: "#39c5cf",
      white: "#b1bac4",
      ...sharedBright,
    },
  },
  {
    id: "enterprise-navy",
    name: "Navy",
    swatch: "#0a1628",
    description: "Deep corporate blue",
    theme: {
      background: "#0a1628",
      foreground: "#dbeafe",
      cursor: "#38bdf8",
      cursorAccent: "#0a1628",
      selectionBackground: "#1e3a5f",
      selectionForeground: "#eff6ff",
      black: "#1e293b",
      red: "#fb7185",
      green: "#34d399",
      yellow: "#fbbf24",
      blue: "#60a5fa",
      magenta: "#a78bfa",
      cyan: "#22d3ee",
      white: "#94a3b8",
      ...sharedBright,
    },
  },
  {
    id: "enterprise-charcoal",
    name: "Charcoal",
    swatch: "#161616",
    description: "Neutral enterprise gray",
    theme: {
      background: "#161616",
      foreground: "#f4f4f5",
      cursor: "#f97316",
      cursorAccent: "#161616",
      selectionBackground: "#3f3f46",
      selectionForeground: "#fafafa",
      black: "#27272a",
      red: "#ef4444",
      green: "#22c55e",
      yellow: "#eab308",
      blue: "#3b82f6",
      magenta: "#a855f7",
      cyan: "#06b6d4",
      white: "#a1a1aa",
      ...sharedBright,
    },
  },
  {
    id: "enterprise-forest",
    name: "Forest",
    swatch: "#0d1f12",
    description: "Classic green terminal",
    theme: {
      background: "#0d1f12",
      foreground: "#d1fae5",
      cursor: "#34d399",
      cursorAccent: "#0d1f12",
      selectionBackground: "#14532d",
      selectionForeground: "#ecfdf5",
      black: "#14532d",
      red: "#f87171",
      green: "#4ade80",
      yellow: "#facc15",
      blue: "#60a5fa",
      magenta: "#c084fc",
      cyan: "#2dd4bf",
      white: "#86efac",
      ...sharedBright,
    },
  },
  {
    id: "enterprise-violet",
    name: "Violet",
    swatch: "#13111c",
    description: "Modern purple studio",
    theme: {
      background: "#13111c",
      foreground: "#ede9fe",
      cursor: "#a78bfa",
      cursorAccent: "#13111c",
      selectionBackground: "#4c1d95",
      selectionForeground: "#f5f3ff",
      black: "#2e1065",
      red: "#fb7185",
      green: "#4ade80",
      yellow: "#fbbf24",
      blue: "#818cf8",
      magenta: "#c084fc",
      cyan: "#22d3ee",
      white: "#c4b5fd",
      ...sharedBright,
    },
  },
  {
    id: "dracula",
    name: "Dracula",
    swatch: "#282a36",
    theme: {
      background: "#282a36",
      foreground: "#f8f8f2",
      cursor: "#ffb86c",
      cursorAccent: "#282a36",
      selectionBackground: "#44475a",
      selectionForeground: "#f8f8f2",
      black: "#21222c",
      red: "#ff5555",
      green: "#50fa7b",
      yellow: "#f1fa8c",
      blue: "#bd93f9",
      magenta: "#ff79c6",
      cyan: "#8be9fd",
      white: "#6272a4",
      brightBlack: "#6272a4",
      brightRed: "#ff6e6e",
      brightGreen: "#69ff94",
      brightYellow: "#ffffa5",
      brightBlue: "#d6acff",
      brightMagenta: "#ff92df",
      brightCyan: "#a4ffff",
      brightWhite: "#ffffff",
    },
  },
  {
    id: "solarized-dark",
    name: "Solarized",
    swatch: "#002b36",
    theme: {
      background: "#002b36",
      foreground: "#839496",
      cursor: "#93a1a1",
      cursorAccent: "#002b36",
      selectionBackground: "#073642",
      selectionForeground: "#eee8d5",
      black: "#073642",
      red: "#dc322f",
      green: "#859900",
      yellow: "#b58900",
      blue: "#268bd2",
      magenta: "#d33682",
      cyan: "#2aa198",
      white: "#eee8d5",
      brightBlack: "#586e75",
      brightRed: "#cb4b16",
      brightGreen: "#93a1a1",
      brightYellow: "#657b83",
      brightBlue: "#839496",
      brightMagenta: "#6c71c4",
      brightCyan: "#2aa198",
      brightWhite: "#fdf6e3",
    },
  },
  {
    id: "enterprise-light",
    name: "Light Pro",
    swatch: "#f4f4f5",
    description: "Bright office terminal",
    theme: {
      background: "#f4f4f5",
      foreground: "#18181b",
      cursor: "#ea580c",
      cursorAccent: "#f4f4f5",
      selectionBackground: "#d4d4d8",
      selectionForeground: "#18181b",
      black: "#3f3f46",
      red: "#dc2626",
      green: "#16a34a",
      yellow: "#ca8a04",
      blue: "#2563eb",
      magenta: "#9333ea",
      cyan: "#0891b2",
      white: "#71717a",
      brightBlack: "#52525b",
      brightRed: "#ef4444",
      brightGreen: "#22c55e",
      brightYellow: "#eab308",
      brightBlue: "#3b82f6",
      brightMagenta: "#a855f7",
      brightCyan: "#06b6d4",
      brightWhite: "#09090b",
    },
  },
];

export const TERMINAL_FONT_SIZES = [12, 13, 14, 15, 16] as const;
export type TerminalFontSize = (typeof TERMINAL_FONT_SIZES)[number];

function cssVar(name: string, fallback: string): string {
  if (typeof document === "undefined") {
    return fallback;
  }
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

function getDevBenchAdaptiveTheme(): ITheme {
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

export function getTerminalThemePresetId(): string {
  if (typeof localStorage === "undefined") {
    return "devbench";
  }
  return localStorage.getItem(TERMINAL_THEME_KEY) || "devbench";
}

export function setTerminalThemePresetId(id: string): void {
  localStorage.setItem(TERMINAL_THEME_KEY, id);
  notifyTerminalAppearanceChange();
}

export function getTerminalFontSize(): TerminalFontSize {
  if (typeof localStorage === "undefined") {
    return 13;
  }
  const raw = Number(localStorage.getItem(TERMINAL_FONT_SIZE_KEY));
  return TERMINAL_FONT_SIZES.includes(raw as TerminalFontSize)
    ? (raw as TerminalFontSize)
    : 13;
}

export function setTerminalFontSize(size: TerminalFontSize): void {
  localStorage.setItem(TERMINAL_FONT_SIZE_KEY, String(size));
  notifyTerminalAppearanceChange();
}

export function getTerminalThemePreset(id = getTerminalThemePresetId()): TerminalThemePreset {
  return (
    TERMINAL_THEME_PRESETS.find((preset) => preset.id === id) ??
    TERMINAL_THEME_PRESETS[0]
  );
}

/** Resolved xterm theme for the active preset. */
export function getTerminalTheme(): ITheme {
  const preset = getTerminalThemePreset();
  if (preset.id === "devbench") {
    return getDevBenchAdaptiveTheme();
  }
  return preset.theme;
}

export function getTerminalBackgroundColor(): string {
  return getTerminalTheme().background || "#0d1117";
}

function notifyTerminalAppearanceChange(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(new Event(TERMINAL_APPEARANCE_EVENT));
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

  const onStorage = (event: StorageEvent) => {
    if (
      event.key === TERMINAL_THEME_KEY ||
      event.key === TERMINAL_FONT_SIZE_KEY
    ) {
      onChange();
    }
  };

  const onAppearance = () => onChange();

  window.addEventListener("storage", onStorage);
  window.addEventListener(TERMINAL_APPEARANCE_EVENT, onAppearance);

  return () => {
    observer.disconnect();
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(TERMINAL_APPEARANCE_EVENT, onAppearance);
  };
}

export const terminalFontFamily =
  '"JetBrains Mono", "SF Mono", Menlo, Monaco, "Courier New", monospace';
