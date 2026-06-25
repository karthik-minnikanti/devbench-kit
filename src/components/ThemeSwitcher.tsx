import { useState, useEffect, useRef } from "react";
import { useStore } from "../state/store";
import { Config } from "../services/config";
import { Icon } from "./Icon";

export function ThemeSwitcher() {
  const config = useStore((state) => state.config);
  const setTheme = useStore((state) => state.setTheme);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const themes: {
    value: Config["theme"];
    label: string;
    icon: "Sun" | "Moon";
  }[] = [
    { value: "light", label: "Light", icon: "Sun" },
    { value: "dark", label: "Dark", icon: "Moon" },
  ];

  const currentTheme = config?.theme || "light";
  const activeTheme =
    themes.find((theme) => theme.value === currentTheme) ?? themes[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = async (theme: Config["theme"]) => {
    await setTheme(theme);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen((open) => !open)}
        className="px-1.5 py-1 rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)] hover:text-[var(--color-text-primary)] transition-smooth flex items-center gap-1"
        title={`Theme: ${activeTheme.label}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <Icon name={activeTheme.icon} className="w-3.5 h-3.5" />
        <Icon
          name={isOpen ? "ChevronUp" : "ChevronDown"}
          className="w-3 h-3 opacity-60"
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="absolute right-0 top-full mt-1 min-w-[140px] bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg py-1 z-[9999]"
        >
          {themes.map((theme) => (
            <button
              key={theme.value}
              role="option"
              aria-selected={currentTheme === theme.value}
              onClick={() => handleSelect(theme.value)}
              className={`w-full px-3 py-2 flex items-center gap-2 text-left text-sm transition-colors ${
                currentTheme === theme.value
                  ? "bg-[var(--color-muted)] text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)] hover:text-[var(--color-text-primary)]"
              }`}
            >
              <Icon name={theme.icon} className="w-4 h-4" />
              {theme.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
