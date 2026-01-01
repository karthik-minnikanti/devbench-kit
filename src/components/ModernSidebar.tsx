import { useState, useEffect } from 'react';
import { TabType } from './CategorizedTabs';
import { Icon } from './Icon';

interface ModernSidebarProps {
    activeTab: TabType;
    onTabChange: (tab: TabType) => void;
    onNewTab?: (tab: TabType) => void;
    tabs: Array<{ id: TabType; label: string; icon: string; description?: string }>;
    onClose?: () => void;
}

const categoryIcons: Record<string, keyof typeof import('./Icons').Icons> = {
    home: 'Home',
    converters: 'Convert',
    tools: 'Code',
    devops: 'Container',
    design: 'Pen',
    productivity: 'FileText',
    account: 'User',
};

interface Category {
    id: string;
    label: string;
    icon: string;
    tabs: TabType[];
}

// Allowed tabs: api, planner, js-runner, notes, excalidraw, uml (plus home)
const ALLOWED_TABS: TabType[] = ['home', 'api', 'planner', 'js-runner', 'notes', 'excalidraw', 'uml'];

const allCategories: Category[] = [
    { id: 'home', label: 'Home', icon: 'Menu', tabs: ['home'] },
    { id: 'tools', label: 'Developer Tools', icon: 'Code', tabs: ['api', 'formatter', 'regex', 'js-runner'] },
    { id: 'converters', label: 'Converters', icon: 'Convert', tabs: ['schema', 'json-xml', 'json-diff', 'encoder', 'csv-yaml'] },
    { id: 'productivity', label: 'Productivity', icon: 'FileText', tabs: ['notes', 'planner'] },
    { id: 'design', label: 'Design', icon: 'Pen', tabs: ['excalidraw', 'uml'] },
    { id: 'devops', label: 'DevOps', icon: 'Container', tabs: ['docker', 'k8s'] },
    { id: 'account', label: 'Account', icon: 'User', tabs: ['profile'] },
];

// Filter categories to only show allowed tabs
const categories: Category[] = allCategories
    .map(cat => ({
        ...cat,
        tabs: cat.tabs.filter(tab => ALLOWED_TABS.includes(tab))
    }))
    .filter(cat => cat.tabs.length > 0); // Only show categories that have allowed tabs

export function ModernSidebar({ activeTab, onTabChange, onNewTab, tabs, onClose }: ModernSidebarProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['home']));

    // Auto-expand category containing active tab
    useEffect(() => {
        const category = categories.find(cat => cat.tabs.includes(activeTab));
        if (category) {
            setExpandedCategories(prev => new Set([...prev, category.id]));
        }
    }, [activeTab]);

    const toggleCategory = (categoryId: string) => {
        const newExpanded = new Set(expandedCategories);
        if (newExpanded.has(categoryId)) {
            newExpanded.delete(categoryId);
        } else {
            newExpanded.add(categoryId);
        }
        setExpandedCategories(newExpanded);
    };

    const filteredTabs = tabs.filter(tab => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return tab.label.toLowerCase().includes(query) || 
               (tab.description && tab.description.toLowerCase().includes(query));
    });

    const getTabsForCategory = (category: Category) => {
        return filteredTabs.filter(tab => category.tabs.includes(tab.id));
    };

    return (
        <div className="w-64 bg-[var(--color-sidebar)] border-r border-[var(--color-border)] flex flex-col h-full custom-scrollbar animate-slide-in-right">
            {/* Header */}
            <div className="px-4 py-3 border-b border-[var(--color-border)]">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-wider">Tools</h2>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="p-1 rounded text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-muted)] transition-colors"
                            title="Close sidebar"
                        >
                            <Icon name="X" className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
                {/* Search */}
                <div className="relative">
                    <input
                        type="text"
                        placeholder="Search tools..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-3 py-1.5 pl-8 text-xs bg-[var(--color-card)] border border-[var(--color-border)] rounded focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)] text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] transition-smooth"
                    />
                    <Icon name="Search" className="absolute left-2.5 top-1.5 w-3.5 h-3.5 text-[var(--color-text-tertiary)] transition-smooth" />
                </div>
            </div>

            {/* Categories and Tabs */}
            <div className="flex-1 overflow-y-auto">
                {categories.map((category) => {
                    const categoryTabs = getTabsForCategory(category);
                    if (categoryTabs.length === 0) return null;
                    
                    const isExpanded = expandedCategories.has(category.id);
                    const hasActiveTab = categoryTabs.some(tab => tab.id === activeTab);

                    return (
                        <div key={category.id} className="border-b border-gray-100 dark:border-gray-800">
                            <button
                                onClick={() => toggleCategory(category.id)}
                                className={`w-full px-3 py-2 flex items-center justify-between text-left transition-smooth hover-scale ${
                                    hasActiveTab 
                                        ? 'bg-[var(--color-muted)] border-l-2 border-[var(--color-primary)]' 
                                        : 'hover:bg-[var(--color-muted)]'
                                }`}
                            >
                                <div className="flex items-center gap-2.5">
                                    <span className="text-[var(--color-text-secondary)]">
                                        <Icon name={categoryIcons[category.id] || 'Menu'} className="w-3.5 h-3.5" />
                                    </span>
                                    <span className="text-xs font-medium text-[var(--color-text-primary)]">
                                        {category.label}
                                    </span>
                                </div>
                                <Icon 
                                    name="ChevronRight" 
                                    className={`w-3 h-3 text-[var(--color-text-tertiary)] transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                />
                            </button>
                            
                            {isExpanded && (
                                <div className="pb-2">
                                    {categoryTabs.map((tab) => {
                                        const isActive = activeTab === tab.id;
                                        return (
                                            <button
                                                key={tab.id}
                                                onClick={(e) => {
                                                    if (e.ctrlKey || e.metaKey) {
                                                        // Cmd/Ctrl + Click to open in new tab
                                                        e.preventDefault();
                                                        if (onNewTab) {
                                                            onNewTab(tab.id);
                                                        }
                                                    } else {
                                                        onTabChange(tab.id);
                                                    }
                                                }}
                                                onContextMenu={(e) => {
                                                    e.preventDefault();
                                                    if (onNewTab) {
                                                        onNewTab(tab.id);
                                                    }
                                                }}
                                                className={`w-full px-3 py-2 pl-10 flex items-center gap-2.5 text-left transition-smooth group hover-scale ${
                                                    isActive
                                                        ? 'bg-[var(--color-primary)] text-white shadow-sm glow-primary'
                                                        : 'text-[var(--color-text-primary)] hover:bg-[var(--color-muted)]'
                                                }`}
                                                title={`${tab.description || tab.label} (Ctrl/Cmd+Click to open in new tab)`}
                                            >
                                                <span className={`flex-shrink-0 ${isActive ? 'text-white' : 'text-[var(--color-text-secondary)]'}`}>
                                                    <Icon name={tab.icon as keyof typeof import('./Icons').Icons} className="w-3.5 h-3.5" />
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    <div className={`text-xs font-medium ${isActive ? 'text-white' : 'text-[var(--color-text-primary)]'}`}>
                                                        {tab.label}
                                                    </div>
                                                    {tab.description && (
                                                        <div className={`text-[10px] mt-0.5 ${isActive ? 'text-white/80' : 'text-[var(--color-text-tertiary)]'}`}>
                                                            {tab.description}
                                                        </div>
                                                    )}
                                                </div>
                                                {isActive && (
                                                    <div className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0 animate-pulse-subtle shadow-sm" />
                                                )}
                                                {/* Open in new tab indicator */}
                                                {!isActive && onNewTab && (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onNewTab(tab.id);
                                                        }}
                                                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[var(--color-muted)] transition-opacity flex-shrink-0"
                                                        title="Open in new tab"
                                                    >
                                                        <Icon name="Plus" className="w-3 h-3 text-[var(--color-text-tertiary)]" />
                                                    </button>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

