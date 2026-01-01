import { useEffect } from 'react';
import { Icon } from './Icon';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
}

interface ToastProps {
    toast: Toast;
    onClose: (id: string) => void;
}

export function ToastComponent({ toast, onClose }: ToastProps) {
    useEffect(() => {
        const duration = toast.duration || 3000;
        const timer = setTimeout(() => {
            onClose(toast.id);
        }, duration);

        return () => clearTimeout(timer);
    }, [toast.id, toast.duration, onClose]);

    const icons: Record<ToastType, keyof typeof import('./Icons').Icons> = {
        success: 'Check',
        error: 'X',
        info: 'Info',
        warning: 'Alert',
    };

    const colors = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        info: 'bg-[var(--color-primary)]',
        warning: 'bg-yellow-500',
    };

    return (
        <div
            className={`${colors[toast.type]} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px] max-w-[500px] animate-slide-in-right`}
            onClick={() => onClose(toast.id)}
        >
            <Icon name={icons[toast.type] as keyof typeof import('./Icons').Icons} className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm font-medium flex-1">{toast.message}</p>
            <button
                onClick={(e) => {
                    e.stopPropagation();
                    onClose(toast.id);
                }}
                className="text-white/80 hover:text-white transition-colors"
            >
                <Icon name="X" className="w-4 h-4" />
            </button>
        </div>
    );
}

interface ToastContainerProps {
    toasts: Toast[];
    onClose: (id: string) => void;
}

export function ToastContainer({ toasts, onClose }: ToastContainerProps) {
    return (
        <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
            {toasts.map((toast) => (
                <div key={toast.id} className="pointer-events-auto">
                    <ToastComponent toast={toast} onClose={onClose} />
                </div>
            ))}
        </div>
    );
}

import { showToast } from './ToastProvider';

export function useToast() {
    return { showToast };
}

