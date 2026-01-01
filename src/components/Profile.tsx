import { GitSettings } from './GitSettings';

export function Profile() {
    return (
        <div className="h-full flex flex-col bg-[var(--color-background)]">
            <div className="px-4 py-2 border-b border-[var(--color-border)] flex-shrink-0">
                <div className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider">
                    Settings
                </div>
            </div>
            <div className="flex-1 overflow-auto">
                <GitSettings />
            </div>
        </div>
    );
}
