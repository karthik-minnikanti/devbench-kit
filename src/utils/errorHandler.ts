/**
 * Centralized error handling utility
 */

import { showToast } from '../components/ToastProvider';

export interface ErrorContext {
    component?: string;
    action?: string;
    [key: string]: any;
}

/**
 * Handle errors with optional user notification
 */
export function handleError(
    error: unknown,
    options: {
        message?: string;
        showToast?: boolean;
        toastType?: 'error' | 'warning' | 'info';
        context?: ErrorContext;
        logToConsole?: boolean;
    } = {}
): void {
    const {
        message = 'An error occurred',
        showToast: shouldShowToast = true,
        toastType = 'error',
        context,
        logToConsole = true,
    } = options;

    // Extract error message
    const errorMessage = error instanceof Error ? error.message : String(error);
    const fullMessage = message || errorMessage;

    // Log to console if enabled
    if (logToConsole) {
        if (context) {
            console.error(`[${context.component || 'Unknown'}] ${context.action || 'Error'}:`, errorMessage, context);
        } else {
            console.error(fullMessage, error);
        }
    }

    // Show toast notification if enabled
    if (shouldShowToast && typeof window !== 'undefined') {
        showToast(fullMessage, toastType);
    }
}

/**
 * Handle async errors with optional user notification
 */
export async function handleAsyncError<T>(
    promise: Promise<T>,
    options: {
        message?: string;
        showToast?: boolean;
        toastType?: 'error' | 'warning' | 'info';
        context?: ErrorContext;
        fallback?: T;
    } = {}
): Promise<T | undefined> {
    try {
        return await promise;
    } catch (error) {
        handleError(error, options);
        return options.fallback;
    }
}

/**
 * Create an error handler with default context
 */
export function createErrorHandler(context: ErrorContext) {
    return (
        error: unknown,
        options: {
            message?: string;
            showToast?: boolean;
            toastType?: 'error' | 'warning' | 'info';
            logToConsole?: boolean;
        } = {}
    ) => {
        handleError(error, { ...options, context });
    };
}

