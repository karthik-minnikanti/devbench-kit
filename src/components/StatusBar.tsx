import { SyncStatus } from './SyncStatus';
import { BrandLogo } from './BrandLogo';

interface StatusBarProps {
    onShowShortcuts?: () => void;
}

export function StatusBar({ onShowShortcuts }: StatusBarProps) {
    return (
        <div className="h-6 bg-[var(--color-sidebar)] border-t border-[var(--color-border)] flex items-center justify-between px-3 text-[10px]">
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] animate-pulse-subtle" />
                    <span className="text-[var(--color-text-secondary)]">Ready</span>
                </div>
                <SyncStatus />
            </div>
            <div className="flex items-center gap-3 text-[var(--color-text-secondary)]">
                {onShowShortcuts && (
                    <button
                        onClick={onShowShortcuts}
                        className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors cursor-help"
                        title="Keyboard Shortcuts (Cmd/Ctrl + /)"
                    >
                        <span className="text-xs">⌘/</span>
                    </button>
                )}
                <BrandLogo size="sm" showText={false} />
                <span className="font-medium text-[var(--color-text-tertiary)]">v1.0</span>
            </div>
        </div>
    );
}

