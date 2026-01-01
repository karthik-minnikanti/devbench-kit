import { Icons as IconSet } from './Icons';
import { cloneElement } from 'react';

interface IconProps {
    name: keyof typeof IconSet;
    className?: string;
}

export function Icon({ name, className = "w-4 h-4" }: IconProps) {
    const IconComponent = IconSet[name];
    if (!IconComponent) return null;
    const iconElement = <IconComponent />;
    // Clone the element and apply the className
    return cloneElement(iconElement, { className });
}








