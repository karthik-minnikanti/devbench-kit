import { useState, useEffect, useRef } from 'react';
import { Icon } from './Icon';

export function WindowMenu() {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleMinimize = () => {
        if (window.electronAPI?.window?.minimize) {
            window.electronAPI.window.minimize();
        }
        setIsOpen(false);
    };

    const handleMaximize = () => {
        if (window.electronAPI?.window?.maximize) {
            window.electronAPI.window.maximize();
        }
        setIsOpen(false);
    };

    const handleClose = () => {
        if (window.electronAPI?.window?.close) {
            window.electronAPI.window.close();
        }
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={menuRef}>
            <button
                className="px-2 py-1 rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)] transition-smooth hover-scale flex items-center"
                onClick={() => setIsOpen(!isOpen)}
                title="Window Menu"
            >
                <Icon name="Menu" className="w-4 h-4" />
            </button>
            {isOpen && (
                <div className="absolute left-0 top-full mt-1 bg-[var(--color-card)] border border-[var(--color-border)] rounded shadow-lg py-1 z-50 min-w-[140px]">
                    <button
                        onClick={handleMinimize}
                        className="w-full text-left px-3 py-1.5 text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-muted)] transition-colors"
                    >
                        Minimize
                    </button>
                    <button
                        onClick={handleMaximize}
                        className="w-full text-left px-3 py-1.5 text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-muted)] transition-colors"
                    >
                        Maximize
                    </button>
                    <div className="h-px bg-[var(--color-border)] my-1"></div>
                    <button
                        onClick={handleClose}
                        className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-[var(--color-muted)] transition-colors"
                    >
                        Close
                    </button>
                </div>
            )}
        </div>
    );
}

