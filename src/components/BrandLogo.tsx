import { Icon } from './Icon';

interface BrandLogoProps {
    size?: 'sm' | 'md' | 'lg';
    showText?: boolean;
    className?: string;
}

export function BrandLogo({ size = 'md', showText = true, className = '' }: BrandLogoProps) {
    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-5 h-5',
        lg: 'w-6 h-6'
    };

    const textSizeClasses = {
        sm: 'text-xs',
        md: 'text-sm',
        lg: 'text-base'
    };

    return (
        <div className={`flex items-center gap-2 ${className} group`}>
            <div className="relative transition-smooth group-hover:scale-110">
                <div className={`${sizeClasses[size]} rounded-md bg-gradient-to-br from-[var(--color-primary)] to-[rgba(37,99,235,0.7)] flex items-center justify-center shadow-sm transition-smooth group-hover:shadow-md group-hover:glow-primary`}>
                    <Icon name="Code" className={`${size === 'sm' ? 'w-2.5 h-2.5' : size === 'md' ? 'w-3 h-3' : 'w-4 h-4'} text-white transition-smooth`} />
                </div>
                <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-[var(--color-primary)] rounded-full animate-pulse-subtle"></div>
            </div>
            {showText && (
                <span className={`${textSizeClasses[size]} font-semibold text-[var(--color-text-primary)] tracking-tight transition-smooth group-hover:text-[var(--color-primary)]`}>
                    DevBench
                </span>
            )}
        </div>
    );
}

