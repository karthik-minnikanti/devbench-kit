import { useState, useEffect } from 'react';
import { ToastContainer, Toast } from './Toast';

// Global toast state
let toastState: Toast[] = [];
let toastStateListeners: Array<(toasts: Toast[]) => void> = [];
let toastIdCounter = 0;

export function showToast(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info', duration?: number) {
    const toast: Toast = {
        id: `toast-${toastIdCounter++}`,
        message,
        type,
        duration,
    };
    toastState = [...toastState, toast];
    toastStateListeners.forEach(listener => listener([...toastState]));
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    useEffect(() => {
        const listener = (newToasts: Toast[]) => {
            setToasts(newToasts);
        };
        
        toastStateListeners.push(listener);
        setToasts([...toastState]);

        return () => {
            toastStateListeners = toastStateListeners.filter(l => l !== listener);
        };
    }, []);

    const handleClose = (id: string) => {
        toastState = toastState.filter(t => t.id !== id);
        toastStateListeners.forEach(listener => listener([...toastState]));
    };

    // Expose showToast globally
    useEffect(() => {
        (window as any).showToast = showToast;
    }, []);

    return (
        <>
            {children}
            <ToastContainer toasts={toasts} onClose={handleClose} />
        </>
    );
}

