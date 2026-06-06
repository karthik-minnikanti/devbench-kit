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
            <div className="mb-6 flex items-center justify-center">
                <div className="w-16 h-16 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] flex items-center justify-center">
                    <Icon name={icon} className="w-8 h-8 text-[var(--color-text-secondary)]" />
                </div>
            </div>
            <h3 className="title-sm mb-2 text-center">{title}</h3>
            {description && (
                <p className="text-sm text-[var(--color-text-secondary)] text-center max-w-md mb-6">
                    {description}
                </p>
            )}
            {action && (
                <button onClick={action.onClick} className="btn-primary !h-auto !py-2 !px-4 !text-sm">
                    {action.label}
                </button>
            )}
        </div>
    );
}
