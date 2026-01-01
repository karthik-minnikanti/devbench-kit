import { useState } from 'react';

export type ActivityType = 'converters' | 'tools' | 'devops' | 'design' | 'account';

interface ActivityBarProps {
    activeActivity: ActivityType;
    onActivityChange: (activity: ActivityType) => void;
}

interface Activity {
    id: ActivityType;
    label: string;
    icon: string;
    tooltip: string;
}

const activities: Activity[] = [
    { id: 'converters', label: 'Converters', icon: '🔄', tooltip: 'Converters & Transformers' },
    { id: 'tools', label: 'Tools', icon: '🛠️', tooltip: 'Developer Tools' },
    { id: 'devops', label: 'DevOps', icon: '⚙️', tooltip: 'Docker & Kubernetes' },
    { id: 'design', label: 'Design', icon: '🎨', tooltip: 'Notes & Diagrams' },
    { id: 'account', label: 'Account', icon: '👤', tooltip: 'Profile & Settings' },
];

export function ActivityBar({ activeActivity, onActivityChange }: ActivityBarProps) {
    return (
        <div className="w-14 bg-gray-100 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col items-center py-3 gap-2">
            {activities.map((activity) => {
                const isActive = activeActivity === activity.id;
                return (
                    <button
                        key={activity.id}
                        onClick={() => onActivityChange(activity.id)}
                        title={activity.tooltip}
                        className={`
                            w-11 h-11 flex items-center justify-center rounded-lg transition-all duration-150
                            relative group
                            ${isActive 
                                ? 'bg-blue-500 dark:bg-blue-600 text-white shadow-md' 
                                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-200'
                            }
                        `}
                    >
                        <span className="text-xl">{activity.icon}</span>
                        {isActive && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-500 dark:bg-blue-400 rounded-r" />
                        )}
                        {/* Tooltip */}
                        <div className="absolute left-full ml-3 px-3 py-1.5 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-lg">
                            {activity.tooltip}
                            <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-4 border-t-transparent border-r-4 border-r-gray-900 dark:border-r-gray-700 border-b-4 border-b-transparent" />
                        </div>
                    </button>
                );
            })}
        </div>
    );
}

