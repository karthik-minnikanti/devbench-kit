import { Icon } from './Icon';

interface EmptyStateProps {
    icon: keyof typeof import('./Icons').Icons;
    title: string;
    description?: string;
    action?: {
        label: string;
        onClick: () => void;
    };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center justify-center h-full p-8 animate-fade-in">
            <div className="relative mb-6">
                <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[var(--color-primary)] to-[rgba(37,99,235,0.7)] flex items-center justify-center shadow-lg glow-primary">
                    <Icon name={icon} className="w-8 h-8 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-[var(--color-primary)] rounded-full animate-pulse-subtle"></div>
            </div>
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                {title}
            </h3>
            {description && (
                <p className="text-sm text-[var(--color-text-secondary)] text-center max-w-md mb-6">
                    {description}
                </p>
            )}
            {action && (
                <button
                    onClick={action.onClick}
                    className="px-4 py-2 bg-[var(--color-primary)] text-white rounded transition-smooth hover-scale glow-primary-hover text-sm font-medium"
                >
                    {action.label}
                </button>
            )}
        </div>
    );
}








