// Offline queue to track data that needs to be synced when online

interface QueuedItem {
    type: 'note' | 'drawing' | 'history' | 'snippet' | 'planner' | 'folder';
    action: 'create' | 'update' | 'delete';
    data: any;
    timestamp: number;
    id?: string;
}

const QUEUE_KEY = 'devbench_offline_queue';

export function addToOfflineQueue(item: QueuedItem): void {
    try {
        const queue = getOfflineQueue();
        queue.push(item);
        localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
        console.error('Failed to add to offline queue:', error);
    }
}

export function getOfflineQueue(): QueuedItem[] {
    try {
        const queueStr = localStorage.getItem(QUEUE_KEY);
        return queueStr ? JSON.parse(queueStr) : [];
    } catch (error) {
        console.error('Failed to get offline queue:', error);
        return [];
    }
}

export function clearOfflineQueue(): void {
    try {
        localStorage.removeItem(QUEUE_KEY);
    } catch (error) {
        console.error('Failed to clear offline queue:', error);
    }
}

export function removeFromQueue(item: QueuedItem): void {
    try {
        const queue = getOfflineQueue();
        const filtered = queue.filter(q => 
            !(q.type === item.type && 
              q.action === item.action && 
              q.timestamp === item.timestamp)
        );
        localStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
    } catch (error) {
        console.error('Failed to remove from queue:', error);
    }
}

