import { TabType } from './CategorizedTabs';
import { Icon } from './Icon';

interface TopBarProps {
    activeTab: TabType;
    tabs: Array<{ id: TabType; label: string; icon: string }>;
    onTabChange: (tab: TabType) => void;
    onNewTab?: (tab: TabType) => void;
    children?: React.ReactNode;
}

export function TopBar({ activeTab, tabs, onTabChange, onNewTab, children }: TopBarProps) {
    const activeTabData = tabs.find(t => t.id === activeTab);

    return (
        <div className="h-11 bg-[var(--color-card)] border-b border-[var(--color-border)] flex items-center justify-between px-4">
            {/* Left: Tab Info */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-[var(--color-primary)] flex-shrink-0 transition-smooth hover-scale">
                        <Icon name={activeTabData?.icon as keyof typeof import('./Icons').Icons || 'Menu'} className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                        <h1 className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                            {activeTabData?.label}
                        </h1>
                    </div>
                </div>
                {children}
            </div>
        </div>
    );
}

