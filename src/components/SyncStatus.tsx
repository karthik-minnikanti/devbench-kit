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

        updateStatus();

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

        const interval = setInterval(updateStatus, 5000);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            clearInterval(interval);
        };
    }, []);

    if (pendingCount === 0 && isOnline) {
        return null;
    }

    return (
        <div className="fixed bottom-4 right-4 z-50">
            {!isOnline ? (
                <div className="bg-[var(--color-timeline-done)] text-white px-3 py-2 rounded-md border border-[var(--color-border)] text-xs font-medium flex items-center gap-2">
                    <span>📴</span>
                    <span>Offline — changes will sync when online</span>
                </div>
            ) : pendingCount > 0 ? (
                <div className="bg-[var(--color-primary)] text-white px-3 py-2 rounded-md border border-[var(--color-border)] text-xs font-medium flex items-center gap-2">
                    <span className="animate-spin">⏳</span>
                    <span>
                        Syncing {pendingCount} item{pendingCount !== 1 ? 's' : ''}...
                    </span>
                </div>
            ) : null}
        </div>
    );
}
