import { useState, useEffect } from 'react';
import { getOfflineQueue } from '../services/offlineQueue';

export function SyncStatus() {
    const [pendingCount, setPendingCount] = useState(0);
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const updateStatus = () => {
            const queue = getOfflineQueue();
            setPendingCount(queue.length);
            setIsOnline(navigator.onLine);
        };

        // Check status on mount
        updateStatus();

        // Update when online/offline status changes
        const handleOnline = () => {
            setIsOnline(true);
            updateStatus();
        };
        const handleOffline = () => {
            setIsOnline(false);
            updateStatus();
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Check periodically
        const interval = setInterval(updateStatus, 5000);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            clearInterval(interval);
        };
    }, []);

    if (pendingCount === 0 && isOnline) {
        return null; // Don't show anything if everything is synced and online
    }

    return (
        <div className="fixed bottom-4 right-4 z-50">
            {!isOnline ? (
                <div className="bg-yellow-500 text-white px-3 py-2 rounded-lg shadow-lg text-xs font-medium flex items-center gap-2">
                    <span>📴</span>
                    <span>Offline - Changes will sync when online</span>
                </div>
            ) : pendingCount > 0 ? (
                <div className="bg-blue-500 text-white px-3 py-2 rounded-lg shadow-lg text-xs font-medium flex items-center gap-2">
                    <span className="animate-spin">⏳</span>
                    <span>Syncing {pendingCount} item{pendingCount !== 1 ? 's' : ''}...</span>
                </div>
            ) : null}
        </div>
    );
}

