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
        <div className="w-14 bg-[var(--color-background-soft)] border-r border-[var(--color-border)] flex flex-col items-center py-3 gap-2">
            {activities.map((activity) => {
                const isActive = activeActivity === activity.id;
                return (
                    <button
                        key={activity.id}
                        onClick={() => onActivityChange(activity.id)}
                        title={activity.tooltip}
                        className={`
                            w-11 h-11 flex items-center justify-center rounded-md transition-colors duration-150
                            relative group
                            ${
                                isActive
                                    ? 'bg-[var(--color-primary)] text-white'
                                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)] hover:text-[var(--color-text-primary)]'
                            }
                        `}
                    >
                        <span className="text-xl">{activity.icon}</span>
                        {isActive && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-[var(--color-primary)] rounded-r" />
                        )}
                        <div className="absolute left-full ml-3 px-3 py-1.5 bg-[var(--color-text-primary)] text-[var(--color-background)] text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 border border-[var(--color-border)]">
                            {activity.tooltip}
                            <div className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-4 border-t-transparent border-r-4 border-r-[var(--color-text-primary)] border-b-4 border-b-transparent" />
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
