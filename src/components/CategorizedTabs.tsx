import { useState, useRef, useEffect } from 'react';

export type TabType = 'home' | 'schema' | 'json-xml' | 'encoder' | 'api' | 'formatter' | 'js-runner' | 'docker' | 'k8s' | 'notes' | 'planner' | 'excalidraw' | 'uml' | 'json-diff' | 'regex' | 'csv-yaml' | 'profile' | 'git-settings';

interface Tab {
    id: TabType;
    label: string;
    icon: string;
}

interface Category {
    label: string;
    icon: string;
    tabs: Tab[];
}

interface CategorizedTabsProps {
    tabs: Tab[];
    activeTab: TabType;
    onTabChange: (tab: TabType) => void;
}

export function CategorizedTabs({ tabs, activeTab, onTabChange }: CategorizedTabsProps) {
    const [openCategory, setOpenCategory] = useState<string | null>(null);
    const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number } | null>(null);
    const categoryRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

    // Update dropdown position when category opens or scrolls
    useEffect(() => {
        if (!openCategory) {
            setDropdownPosition(null);
            return;
        }

        const updatePosition = () => {
            const ref = categoryRefs.current[openCategory];
            if (ref) {
                const rect = ref.getBoundingClientRect();
                setDropdownPosition({
                    top: rect.bottom + 4,
                    left: rect.left,
                });
            }
        };

        updatePosition();

        // Update on scroll
        const handleScroll = () => updatePosition();
        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', updatePosition);

        return () => {
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', updatePosition);
        };
    }, [openCategory]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (!openCategory) return;

            const ref = categoryRefs.current[openCategory];
            const dropdown = document.querySelector(`[data-dropdown="${openCategory}"]`);

            if (ref && !ref.contains(event.target as Node) &&
                dropdown && !dropdown.contains(event.target as Node)) {
                setOpenCategory(null);
            }
        };

        if (openCategory) {
            // Use a small delay to avoid closing immediately when opening
            setTimeout(() => {
                document.addEventListener('mousedown', handleClickOutside);
            }, 0);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [openCategory]);

    // Allowed tabs: api, planner, js-runner, notes, excalidraw, uml (plus home)
    const ALLOWED_TABS: TabType[] = ['home', 'api', 'planner', 'js-runner', 'notes', 'excalidraw', 'uml'];

    const allCategories: Category[] = [
        {
            label: 'Converters',
            icon: '🔄',
            tabs: tabs.filter(t => ['schema', 'json-xml', 'json-diff', 'encoder', 'csv-yaml'].includes(t.id)),
        },
        {
            label: 'Tools',
            icon: '🛠️',
            tabs: tabs.filter(t => ['api', 'formatter', 'regex', 'js-runner'].includes(t.id)),
        },
        {
            label: 'DevOps',
            icon: '⚙️',
            tabs: tabs.filter(t => ['docker', 'k8s'].includes(t.id)),
        },
        {
            label: 'Design',
            icon: '🎨',
            tabs: tabs.filter(t => ['home', 'notes', 'planner', 'excalidraw', 'uml'].includes(t.id)),
        },
        {
            label: 'Account',
            icon: '👤',
            tabs: tabs.filter(t => ['profile'].includes(t.id)),
        },
    ];

    // Filter categories to only show allowed tabs
    const categories: Category[] = allCategories
        .map(cat => ({
            ...cat,
            tabs: cat.tabs.filter(t => ALLOWED_TABS.includes(t.id))
        }))
        .filter(cat => cat.tabs.length > 0); // Only show categories that have allowed tabs

    const toggleCategory = (label: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        setOpenCategory(openCategory === label ? null : label);
    };

    const getActiveCategory = () => {
        return categories.find(cat =>
            cat.tabs.some(tab => tab.id === activeTab)
        );
    };

    const activeCategory = getActiveCategory();
    const activeTabData = tabs.find(t => t.id === activeTab);

    return (
        <div className="flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto scrollbar-hide" style={{ position: 'relative' }}>
            {categories.map((category) => {
                const isOpen = openCategory === category.label;
                const hasActiveTab = category.tabs.some(tab => tab.id === activeTab);

                return (
                    <div key={category.label} className="relative flex-shrink-0" ref={(el) => { categoryRefs.current[category.label] = el; }}>
                        <button
                            onClick={(e) => toggleCategory(category.label, e)}
                            className={`px-2 py-0.5 rounded flex-shrink-0 transition-all duration-150 flex items-center gap-1 ${hasActiveTab
                                ? 'text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800'
                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900'
                                }`}
                        >
                            <span className="text-[10px]">{category.icon}</span>
                            <span className="text-[10px] font-medium whitespace-nowrap">{category.label}</span>
                            <span className="text-[8px]">{isOpen ? '▲' : '▼'}</span>
                        </button>
                        {isOpen && dropdownPosition && (
                            <div
                                data-dropdown={category.label}
                                className="fixed bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg shadow-xl py-1 z-[9999] min-w-[140px]"
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                    position: 'fixed',
                                    top: `${dropdownPosition.top}px`,
                                    left: `${dropdownPosition.left}px`,
                                }}
                            >
                                {category.tabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => {
                                            onTabChange(tab.id);
                                            setOpenCategory(null);
                                        }}
                                        className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${activeTab === tab.id
                                            ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-medium'
                                            : 'text-gray-600 dark:text-gray-400'
                                            }`}
                                    >
                                        <span className="text-xs">{tab.icon}</span>
                                        <span>{tab.label}</span>
                                        {activeTab === tab.id && (
                                            <span className="ml-auto text-[10px]">✓</span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

