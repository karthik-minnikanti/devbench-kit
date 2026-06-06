export interface BlockNoteTheme {
  colors: Record<string, Record<string, string>>;
  fonts: Record<string, string>;
  borderRadius: number;
  spacing: Record<string, number>;
}

/** Shared DevBench tokens — follow app light/dark via CSS variables. */
export const createTheme = (
  overrides: Partial<BlockNoteTheme> = {},
): BlockNoteTheme => ({
  colors: {
    editor: {
      background: "var(--color-background)",
      text: "var(--color-text-primary)",
    },
    menu: {
      background: "var(--color-card)",
      text: "var(--color-text-primary)",
    },
    tooltip: {
      background: "var(--color-card)",
      text: "var(--color-text-primary)",
    },
    hovered: {
      background: "var(--color-muted)",
    },
    selected: {
      background: "var(--color-muted)",
    },
    disabled: {
      background: "var(--color-muted)",
      text: "var(--color-text-tertiary)",
    },
    ...overrides.colors,
  },
  fonts: {
    body: "var(--font-sans)",
    heading: "var(--font-sans)",
    monospace: "var(--font-mono)",
    ...overrides.fonts,
  },
  borderRadius: 8,
  spacing: {
    block: 8,
    ...overrides.spacing,
  },
  ...overrides,
});

const structuralOverrides: Record<string, Partial<BlockNoteTheme>> = {
  "jira-ticket": { borderRadius: 6 },
  "daily-standup": { borderRadius: 6 },
  "technical-design": { borderRadius: 10 },
};

export function getThemeForTemplate(templateId: string): BlockNoteTheme {
  return createTheme(structuralOverrides[templateId] ?? {});
}
