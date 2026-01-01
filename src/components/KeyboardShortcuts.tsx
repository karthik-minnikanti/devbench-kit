import { useState, useEffect } from 'react';
import { Icon } from './Icon';

interface Shortcut {
    category: string;
    shortcuts: Array<{
        keys: string[];
        description: string;
    }>;
}

const shortcuts: Shortcut[] = [
    {
        category: 'Navigation',
        shortcuts: [
            { keys: ['Cmd/Ctrl', 'K'], description: 'Open global search' },
            { keys: ['Cmd/Ctrl', 'T'], description: 'New tab' },
            { keys: ['Cmd/Ctrl', 'W'], description: 'Close current tab' },
            { keys: ['Cmd/Ctrl', '1-9'], description: 'Switch to tab by number' },
        ],
    },
    {
        category: 'Editor',
        shortcuts: [
            { keys: ['Cmd/Ctrl', 'S'], description: 'Save current item' },
            { keys: ['Cmd/Ctrl', 'Enter'], description: 'Run/Execute' },
            { keys: ['Cmd/Ctrl', 'B'], description: 'Beautify/Format' },
        ],
    },
    {
        category: 'General',
        shortcuts: [
            { keys: ['Esc'], description: 'Close dialogs/modals' },
            { keys: ['Cmd/Ctrl', '/'], description: 'Show keyboard shortcuts' },
        ],
    },
];

interface KeyboardShortcutsProps {
    isOpen: boolean;
    onClose: () => void;
}

export function KeyboardShortcuts({ isOpen, onClose }: KeyboardShortcutsProps) {
    useEffect(() => {
        if (isOpen) {
            const handleKeyDown = (e: KeyboardEvent) => {
                if (e.key === 'Escape') {
                    onClose();
                }
            };
            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

    const formatKey = (key: string) => {
        if (key === 'Cmd/Ctrl') {
            return isMac ? '⌘' : 'Ctrl';
        }
        if (key === 'Cmd') {
            return '⌘';
        }
        if (key === 'Ctrl') {
            return 'Ctrl';
        }
        if (key === 'Enter') {
            return '↵';
        }
        if (key === 'Esc') {
            return 'Esc';
        }
        if (key.startsWith('1-9')) {
            return '1-9';
        }
        return key;
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[9998] flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div
                className="bg-[var(--color-card)] rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col border border-[var(--color-border)]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Keyboard Shortcuts</h2>
                    <button
                        onClick={onClose}
                        className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                    >
                        <Icon name="X" className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    <div className="space-y-6">
                        {shortcuts.map((category) => (
                            <div key={category.category}>
                                <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3 uppercase tracking-wider">
                                    {category.category}
                                </h3>
                                <div className="space-y-2">
                                    {category.shortcuts.map((shortcut, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center justify-between py-2 px-3 rounded hover:bg-[var(--color-muted)] transition-colors"
                                        >
                                            <span className="text-sm text-[var(--color-text-secondary)]">
                                                {shortcut.description}
                                            </span>
                                            <div className="flex items-center gap-1">
                                                {shortcut.keys.map((key, keyIndex) => (
                                                    <span key={keyIndex}>
                                                        {keyIndex > 0 && (
                                                            <span className="text-[var(--color-text-tertiary)] mx-1">+</span>
                                                        )}
                                                        <kbd className="px-2 py-1 text-xs font-medium bg-[var(--color-muted)] border border-[var(--color-border)] rounded text-[var(--color-text-primary)]">
                                                            {formatKey(key)}
                                                        </kbd>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="px-6 py-4 border-t border-[var(--color-border)] bg-[var(--color-sidebar)]">
                    <p className="text-xs text-[var(--color-text-tertiary)] text-center">
                        Press <kbd className="px-1.5 py-0.5 text-[10px] bg-[var(--color-muted)] border border-[var(--color-border)] rounded">Esc</kbd> to close
                    </p>
                </div>
            </div>
        </div>
    );
}








