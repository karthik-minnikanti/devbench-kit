/**
 * Utility functions for safely accessing Electron API
 */

/**
 * Safely get the electronAPI object
 * @returns electronAPI if available, null otherwise
 */
export function getElectronAPI(): typeof window.electronAPI | null {
    if (typeof window !== 'undefined' && window.electronAPI) {
        return window.electronAPI;
    }
    return null;
}

/**
 * Check if electronAPI is available
 */
export function isElectron(): boolean {
    return getElectronAPI() !== null;
}

/**
 * Safely access electronAPI with error handling
 * @param callback Function that uses electronAPI
 * @param fallback Optional fallback value if electronAPI is not available
 */
export function withElectronAPI<T>(
    callback: (api: typeof window.electronAPI) => T | Promise<T>,
    fallback?: T
): T | Promise<T> | undefined {
    const api = getElectronAPI();
    if (api) {
        return callback(api);
    }
    return fallback;
}

