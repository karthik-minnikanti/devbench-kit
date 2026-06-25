export const NOTES_EDITOR_CSS = `
.notes-editor-container {
  --bn-colors-editor-text: var(--color-text-primary);
  --bn-colors-editor-background: var(--color-background);
  --bn-colors-menu-text: var(--color-text-primary);
  --bn-colors-menu-background: var(--color-card);
  --bn-colors-menu-text-hover: var(--color-text-primary);
  --bn-colors-menu-background-hover: var(--color-muted);
  --bn-colors-toolbar-text: var(--color-text-primary);
  --bn-colors-toolbar-background: var(--color-card);
  --bn-colors-toolbar-text-hover: var(--color-text-primary);
  --bn-colors-toolbar-background-hover: var(--color-muted);
  --bn-colors-suggestion-menu-text: var(--color-text-primary);
  --bn-colors-suggestion-menu-background: var(--color-card);
  --bn-colors-suggestion-menu-text-selected: var(--color-text-primary);
  --bn-colors-suggestion-menu-background-selected: var(--color-muted);
  --bn-colors-placeholder-text: var(--color-text-tertiary);
  --bn-colors-selected-text: var(--color-text-primary);
  --bn-colors-selected-background: var(--color-primary);
  --bn-border-radius: 6px;
  --bn-border-color: var(--color-border);
}
.notes-editor-container .bn-container {
  width: 100% !important;
  height: 100% !important;
  background: var(--color-background) !important;
  max-width: 680px !important;
  margin: 0 auto !important;
}
.notes-editor-container .bn-editor {
  width: 100% !important;
  min-height: 100% !important;
  background: var(--color-background) !important;
  font-size: 15px !important;
  line-height: 1.6 !important;
  color: var(--color-text-primary) !important;
  font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', 'Roboto', sans-serif !important;
}
.notes-editor-container .bn-block-content {
  padding: 1px 0 !important;
  margin: 0 !important;
}
.notes-editor-container .bn-block-content:hover {
  background: transparent !important;
}
.notes-editor-container .bn-inline-content {
  font-size: 15px !important;
  line-height: 1.6 !important;
}
.notes-editor-container .bn-menu,
.notes-editor-container .bn-toolbar,
.notes-editor-container .bn-suggestion-menu {
  background: var(--color-card) !important;
  border: 1px solid var(--color-border) !important;
  border-radius: 6px !important;
  box-shadow: none !important;
}
.notes-editor-container .bn-suggestion-menu {
  min-width: 240px !important;
  z-index: 80 !important;
}
.notes-editor-container .bn-editor h1 {
  font-size: 2rem !important;
  font-weight: 600 !important;
  margin-top: 1.5rem !important;
  margin-bottom: 0.75rem !important;
}
.notes-editor-container .bn-editor h2 {
  font-size: 1.375rem !important;
  font-weight: 600 !important;
  margin-top: 1.25rem !important;
  margin-bottom: 0.5rem !important;
}
.notes-editor-container .bn-editor h3 {
  font-size: 1.125rem !important;
  font-weight: 600 !important;
  margin-top: 1rem !important;
  margin-bottom: 0.375rem !important;
}
.notes-editor-container .bn-editor p {
  margin: 0.375rem 0 !important;
}
.notes-editor-container .bn-editor ul,
.notes-editor-container .bn-editor ol {
  margin: 0.5rem 0 !important;
  padding-left: 1.25rem !important;
}
.notes-editor-container .bn-editor blockquote {
  border-left: 2px solid var(--color-border) !important;
  padding-left: 0.75rem !important;
  margin: 0.75rem 0 !important;
  color: var(--color-text-secondary) !important;
}
.notes-editor-container .bn-editor code {
  background: var(--color-muted) !important;
  padding: 2px 5px !important;
  border-radius: 3px !important;
  font-size: 0.875em !important;
}
.notes-editor-container .bn-editor pre {
  background: var(--color-muted) !important;
  padding: 0.75rem !important;
  border-radius: 6px !important;
  margin: 0.75rem 0 !important;
  overflow-x: auto !important;
}
`;
