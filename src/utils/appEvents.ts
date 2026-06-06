/**
 * Event system for inter-component communication
 * Replaces window globals with a proper event-based system
 */

export interface OpenToolOptions {
    itemId?: string;
    date?: string;
    taskId?: string;
    addTask?: boolean;
}

type EventCallback = (data?: any) => void;

class AppEventEmitter {
    private listeners: Map<string, Set<EventCallback>> = new Map();

    /**
     * Subscribe to an event
     */
    on(event: string, callback: EventCallback): () => void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(callback);

        // Return unsubscribe function
        return () => {
            this.listeners.get(event)?.delete(callback);
        };
    }

    /**
     * Emit an event
     */
    emit(event: string, data?: any): void {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            });
        }
    }

    /**
     * Remove all listeners for an event
     */
    off(event: string): void {
        this.listeners.delete(event);
    }

    /**
     * Remove all listeners
     */
    clear(): void {
        this.listeners.clear();
    }
}

// Singleton instance
export const appEvents = new AppEventEmitter();

// Event names
export const EVENTS = {
    OPEN_TOOL: 'open-tool',
    PENDING_ITEM_ID: 'pending-item-id',
    PENDING_PLANNER_DATE: 'pending-planner-date',
    PENDING_ADD_TASK: 'pending-add-task',
} as const;

/**
 * Helper to open a tool with options
 */
export function openTool(toolId: string, options?: OpenToolOptions): void {
    appEvents.emit(EVENTS.OPEN_TOOL, { toolId, options });
}

/**
 * Helper to set pending item ID
 */
export function setPendingItemId(toolType: string, itemId: string): void {
    appEvents.emit(EVENTS.PENDING_ITEM_ID, { toolType, itemId });
}

/**
 * Helper to set pending planner date
 */
export function setPendingPlannerDate(date: string): void {
    appEvents.emit(EVENTS.PENDING_PLANNER_DATE, date);
}

/**
 * Helper to set pending add task flag
 */
export function setPendingAddTask(value: boolean): void {
    appEvents.emit(EVENTS.PENDING_ADD_TASK, value);
}

