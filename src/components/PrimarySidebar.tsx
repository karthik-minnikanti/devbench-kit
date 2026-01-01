import { ReactNode } from 'react';
import { ActivityType } from './ActivityBar';

interface PrimarySidebarProps {
    activeActivity: ActivityType;
    activeTab: string;
    onTabChange: (tab: string) => void;
    tabs: Array<{ id: string; label: string; icon: string }>;
    children?: ReactNode;
}

export function PrimarySidebar({ activeActivity, activeTab, onTabChange, tabs, children }: PrimarySidebarProps) {
    const filteredTabs = tabs.filter(tab => {
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
        <div className="w-56 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col h-full shadow-sm">
            {/* Sidebar Header */}
            <div className="h-12 flex items-center px-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950">
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    {activeActivity === 'converters' && 'Converters'}
                    {activeActivity === 'tools' && 'Tools'}
                    {activeActivity === 'devops' && 'DevOps'}
                    {activeActivity === 'design' && 'Design'}
                    {activeActivity === 'account' && 'Account'}
                </h2>
            </div>
            
            {/* Tab List */}
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
                                    ${isActive
                                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border-l-3 border-blue-500 dark:border-blue-400 font-medium'
                                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
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
                    <div className="border-t border-gray-200 dark:border-gray-800 mt-2">
                        {children}
                    </div>
                )}
            </div>
        </div>
    );
}

