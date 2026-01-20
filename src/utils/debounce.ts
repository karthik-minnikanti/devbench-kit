/**
 * Debounce and throttle utilities for performance optimization
 */

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds
 * have elapsed since the last time the debounced function was invoked.
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | null = null;

    return function debounced(...args: Parameters<T>) {
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(() => {
            func(...args);
        }, wait);
    };
}

/**
 * Creates a debounced function that returns a promise resolving to the result
 */
export function debounceAsync<T extends (...args: any[]) => Promise<any>>(
    func: T,
    wait: number
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
    let timeout: NodeJS.Timeout | null = null;
    let resolvePromise: ((value: ReturnType<T>) => void) | null = null;
    let rejectPromise: ((error: any) => void) | null = null;

    return function debounced(...args: Parameters<T>): Promise<ReturnType<T>> {
        return new Promise((resolve, reject) => {
            if (timeout) {
                clearTimeout(timeout);
            }
            if (resolvePromise) {
                resolvePromise = resolve;
            } else {
                resolvePromise = resolve;
            }
            rejectPromise = reject;

            timeout = setTimeout(async () => {
                try {
                    const result = await func(...args);
                    if (resolvePromise) {
                        resolvePromise(result);
                    }
                } catch (error) {
                    if (rejectPromise) {
                        rejectPromise(error);
                    }
                } finally {
                    resolvePromise = null;
                    rejectPromise = null;
                }
            }, wait);
        });
    };
}

/**
 * Creates a throttled function that only invokes func at most once per every wait milliseconds
 */
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void {
    let lastCall = 0;
    let timeout: NodeJS.Timeout | null = null;

    return function throttled(...args: Parameters<T>) {
        const now = Date.now();
        const timeSinceLastCall = now - lastCall;

        if (timeSinceLastCall >= wait) {
            lastCall = now;
            func(...args);
        } else {
            if (timeout) {
                clearTimeout(timeout);
            }
            timeout = setTimeout(() => {
                lastCall = Date.now();
                func(...args);
            }, wait - timeSinceLastCall);
        }
    };
}

/**
 * React hook for debounced values
 */
import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

