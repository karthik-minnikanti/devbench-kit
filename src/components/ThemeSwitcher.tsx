import { useState, useEffect, useRef } from 'react';
import { useStore } from '../state/store';
import { Config } from '../services/config';
import { Icon } from './Icon';

export function ThemeSwitcher() {
    const config = useStore((state) => state.config);
    const setTheme = useStore((state) => state.setTheme);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const themes: { value: Config['theme']; label: string; icon: 'Sun' | 'Moon' }[] = [
        { value: 'light', label: 'Light', icon: 'Sun' },
    ];

    const currentTheme = config?.theme || 'light';

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
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

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                className="px-2 py-1 rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)] transition-smooth hover-scale flex items-center"
                title="Light Theme"
            >
                <Icon name="Sun" className="w-4 h-4 transition-smooth" />
            </button>
        </div>
    );
}

