import { ReactNode } from 'react';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
    width?: number;
}

export function Sidebar({ isOpen, onClose, title, children, width = 300 }: SidebarProps) {
    if (!isOpen) return null;

    return (
        <div
            className="bg-[var(--color-card)] border-l border-[var(--color-border)] flex flex-col h-full"
            style={{ width: `${width}px` }}
        >
            <div className="h-12 flex items-center justify-between px-4 border-b border-[var(--color-border)] bg-[var(--color-background-soft)]">
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h2>
                <button
                    onClick={onClose}
                    className="w-8 h-8 flex items-center justify-center text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-muted)] rounded-md transition-colors"
                    title="Close sidebar"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="flex-1 overflow-auto">{children}</div>
        </div>
    );
}
