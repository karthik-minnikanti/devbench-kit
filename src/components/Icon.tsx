import { Icons as IconSet } from './Icons';

interface IconProps {
    name: keyof typeof IconSet;
    className?: string;
}

export function Icon({ name, className = "w-4 h-4" }: IconProps) {
    const IconComponent = IconSet[name];
    if (!IconComponent) return null;
    return <IconComponent />;
}








