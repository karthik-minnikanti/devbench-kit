import { TabType } from './CategorizedTabs';
import { Icon } from './Icon';

export interface Tab {
    id: string;
    type: TabType;
    label: string;
    icon: string;
}

interface TabManagerProps {
    openTabs: Tab[];
    activeTabId: string;
    onTabClick: (tabId: string) => void;
    onCloseTab: (tabId: string) => void;
    onNewTab: () => void;
    onPopOut?: (tabId: string) => void;
    allTools: Array<{ id: TabType; label: string; icon: string }>;
}

export function TabManager({ openTabs, activeTabId, onTabClick, onCloseTab, onNewTab, onPopOut, allTools }: TabManagerProps) {

    return (
        <div className="flex items-center gap-0.5 bg-[var(--color-sidebar)] border-b border-[var(--color-border)] px-2 overflow-x-auto custom-scrollbar h-9">
            {openTabs.map((tab, index) => {
                const isActive = activeTabId === tab.id;
                return (
                    <div
                        key={tab.id}
                        onClick={() => onTabClick(tab.id)}
                        className={`
                            group flex items-center gap-2 px-3 py-1.5 rounded-t transition-smooth cursor-pointer
                            min-w-[100px] max-w-[200px] relative h-8 animate-fade-in
                            ${isActive
                                ? 'bg-[var(--color-card)] border-t border-l border-r border-[var(--color-border)] shadow-sm'
                                : 'bg-transparent hover:bg-[var(--color-muted)]'
                            }
                        `}
                        style={{ animationDelay: `${index * 0.05}s` }}
                    >
                        <span className={`flex-shrink-0 transition-smooth ${isActive ? 'text-[var(--color-primary)] scale-110' : 'text-[var(--color-text-secondary)]'}`}>
                            <Icon name={tab.icon as keyof typeof import('./Icons').Icons} className="w-3.5 h-3.5" />
                        </span>
                        <span className={`text-xs truncate flex-1 ${isActive ? 'font-medium text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)]'}`}>
                            {tab.label}
                        </span>
                        <div className="flex items-center gap-0.5 ml-1">
                            {/* Show pop-out button for planner tabs */}
                            {tab.type === 'planner' && onPopOut && typeof window !== 'undefined' && (window as any).electronAPI?.window?.openPlanner && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onPopOut(tab.id);
                                    }}
                                    className={`
                                        p-0.5 rounded hover:bg-[var(--color-muted)] transition-colors flex-shrink-0
                                        opacity-0 group-hover:opacity-100 ${isActive ? 'opacity-100' : ''}
                                    `}
                                    title="Open in new window"
                                >
                                    <Icon name="PopOut" className="w-3 h-3 text-[var(--color-text-tertiary)]" />
                                </button>
                            )}
                            {/* Show close button for all tabs except the main home tab (id: '1') */}
                            {!(tab.type === 'home' && tab.id === '1') && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onCloseTab(tab.id);
                                    }}
                                    className={`
                                        p-0.5 rounded hover:bg-[var(--color-muted)] transition-colors flex-shrink-0
                                        opacity-0 group-hover:opacity-100 ${isActive ? 'opacity-100' : ''}
                                    `}
                                    title="Close tab"
                                >
                                    <Icon name="X" className="w-3 h-3 text-[var(--color-text-tertiary)]" />
                                </button>
                            )}
                        </div>
                        {isActive && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--color-primary)] animate-fade-in glow-primary" />
                        )}
                    </div>
                );
            })}
            
            {/* New Tab Button */}
            <button
                onClick={onNewTab}
                className="px-2 py-1.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-muted)] rounded-t transition-smooth hover-scale flex items-center justify-center h-8 group"
                title="New tab"
            >
                <Icon name="Plus" className="w-3.5 h-3.5 transition-smooth group-hover:rotate-90" />
            </button>
        </div>
    );
}

