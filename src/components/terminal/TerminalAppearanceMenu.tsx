import { useEffect, useRef, useState } from "react";
import {
  TERMINAL_FONT_SIZES,
  TERMINAL_THEME_PRESETS,
  getTerminalFontSize,
  getTerminalThemePresetId,
  setTerminalFontSize,
  setTerminalThemePresetId,
  type TerminalFontSize,
} from "../../utils/terminalTheme";

interface TerminalAppearanceMenuProps {
  className?: string;
  compact?: boolean;
}

export function TerminalAppearanceMenu({
  className = "",
  compact = false,
}: TerminalAppearanceMenuProps) {
  const [open, setOpen] = useState(false);
  const [themeId, setThemeId] = useState(getTerminalThemePresetId);
  const [fontSize, setFontSize] = useState(getTerminalFontSize);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const selectTheme = (id: string) => {
    setThemeId(id);
    setTerminalThemePresetId(id);
  };

  const selectFontSize = (size: TerminalFontSize) => {
    setFontSize(size);
    setTerminalFontSize(size);
  };

  const activePreset =
    TERMINAL_THEME_PRESETS.find((preset) => preset.id === themeId) ??
    TERMINAL_THEME_PRESETS[0];

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={
          compact
            ? `devshell-header__action ${className}`
            : `btn-secondary !h-7 !text-xs inline-flex items-center gap-1.5 ${className}`
        }
        title="Terminal appearance"
        aria-label="Terminal appearance"
      >
        <span
          className="w-3 h-3 rounded-full border border-white/20 shrink-0"
          style={{ backgroundColor: activePreset.swatch }}
        />
        {!compact && "Theme"}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-72 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] shadow-xl p-3 space-y-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-2">
              Background
            </div>
            <div className="grid grid-cols-3 gap-2">
              {TERMINAL_THEME_PRESETS.map((preset) => {
                const selected = preset.id === themeId;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => selectTheme(preset.id)}
                    className={`rounded-md border p-2 text-left transition-all ${
                      selected
                        ? "border-[var(--color-primary)] ring-1 ring-[var(--color-primary)]/40"
                        : "border-[var(--color-border)] hover:border-[var(--color-border-strong)]"
                    }`}
                    title={preset.description || preset.name}
                  >
                    <span
                      className="block w-full h-7 rounded mb-1.5 border border-black/10"
                      style={{ backgroundColor: preset.swatch }}
                    />
                    <span className="block text-[10px] font-medium text-[var(--color-text-primary)] truncate">
                      {preset.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-2">
              Font size
            </div>
            <div className="flex gap-1">
              {TERMINAL_FONT_SIZES.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => selectFontSize(size)}
                  className={`flex-1 py-1 rounded text-xs font-medium transition-colors ${
                    fontSize === size
                      ? "bg-[var(--color-primary)] text-white"
                      : "bg-[var(--color-muted)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  {size}px
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
