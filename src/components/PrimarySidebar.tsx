import { ReactNode } from 'react';
import { ActivityType } from './ActivityBar';

interface PrimarySidebarProps {
    activeActivity: ActivityType;
    activeTab: string;
    onTabChange: (tab: string) => void;
    tabs: Array<{ id: string; label: string; icon: string }>;
    children?: ReactNode;
}

export function PrimarySidebar({
    activeActivity,
    activeTab,
    onTabChange,
    tabs,
    children,
}: PrimarySidebarProps) {
    const filteredTabs = tabs.filter((tab) => {
        const activityMap: Record<ActivityType, string[]> = {
            converters: ['schema', 'json-xml', 'json-diff', 'encoder', 'csv-yaml'],
            tools: ['api', 'formatter', 'regex', 'js-runner'],
            devops: ['docker', 'k8s'],
            design: ['notes', 'excalidraw', 'uml'],
            account: ['profile'],
        };
        return activityMap[activeActivity]?.includes(tab.id);
    });

    return (
        <div className="w-56 bg-[var(--color-card)] border-r border-[var(--color-border)] flex flex-col h-full">
            <div className="h-12 flex items-center px-4 border-b border-[var(--color-border)] bg-[var(--color-background-soft)]">
                <h2 className="caption-uppercase">
                    {activeActivity === 'converters' && 'Converters'}
                    {activeActivity === 'tools' && 'Tools'}
                    {activeActivity === 'devops' && 'DevOps'}
                    {activeActivity === 'design' && 'Design'}
                    {activeActivity === 'account' && 'Account'}
                </h2>
            </div>

            <div className="flex-1 overflow-auto">
                <div className="py-2">
                    {filteredTabs.map((tab) => {
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => onTabChange(tab.id)}
                                className={`
                                    w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 transition-colors
                                    ${
                                        isActive
                                            ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary)] border-l-2 border-[var(--color-primary)] font-medium'
                                            : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)] hover:text-[var(--color-text-primary)]'
                                    }
                                `}
                            >
                                <span className="text-lg">{tab.icon}</span>
                                <span className="flex-1">{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
                {children && (
                    <div className="border-t border-[var(--color-border)] mt-2">{children}</div>
                )}
            </div>
        </div>
    );
}
