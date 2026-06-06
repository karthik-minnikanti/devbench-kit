interface TerminalSuggestBarProps {
    line: string;
    suggestions: string[];
    selectedIndex: number;
    onSelect: (command: string) => void;
    onHover: (index: number) => void;
}

export function TerminalSuggestBar({
    line,
    suggestions,
    selectedIndex,
    onSelect,
    onHover,
}: TerminalSuggestBarProps) {
    if (!line.trim() || suggestions.length === 0) {
        return null;
    }

    return (
        <div className="terminal-suggest-bar border-t border-[var(--color-border)] bg-[var(--color-card)]">
            <div className="px-2 py-1 text-[10px] uppercase tracking-wide text-[var(--color-text-tertiary)]">
                Suggestions · Tab to complete
            </div>
            <ul className="max-h-32 overflow-y-auto custom-scrollbar">
                {suggestions.map((command, index) => {
                    const active = index === selectedIndex;
                    return (
                        <li key={`${command}-${index}`}>
                            <button
                                type="button"
                                onMouseEnter={() => onHover(index)}
                                onClick={() => onSelect(command)}
                                className={`w-full px-3 py-1.5 text-left text-xs font-mono truncate transition-colors ${
                                    active
                                        ? "bg-[var(--color-primary)]/10 text-[var(--color-text-primary)]"
                                        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)]/60"
                                }`}
                            >
                                {command}
                            </button>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
