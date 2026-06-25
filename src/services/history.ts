export interface HistoryEntry {
    id: string;
    timestamp: string;
    type: 'schema' | 'js-snippet' | 'uml' | 'api';
    jsonInput?: string;
    code?: string;
    schemaType?: 'typescript' | 'zod' | 'prisma' | 'mongoose';
    output: string;
    umlCode?: string;
    apiRequest?: {
        method: string;
        url: string;
        headers: Record<string, string>;
        body?: string;
        bodyType?: 'json' | 'form-data' | 'x-www-form-urlencoded' | 'binary' | 'raw' | 'none';
        formData?: Array<{ key: string; value: string; type: 'text' | 'file'; enabled: boolean }>;
        binaryData?: string;
        timeout?: number;
    };
    apiResponse?: {
        status: number;
        statusText: string;
        data: any;
        time: number;
    };
}

export interface HistoryData {
    entries: HistoryEntry[];
}

export async function getHistory(limit?: number): Promise<HistoryEntry[]> {
    // Try backend first, fallback to local storage
    try {
        const { getHistory: getHistoryFromSync } = await import('./sync');
        const entries = await getHistoryFromSync(undefined, limit);
        if (entries.length > 0) {
            return entries.map(entry => ({
                id: entry.id || (entry as any)._id,
                timestamp: entry.createdAt || (entry as any).createdAt || new Date().toISOString(),
                type: entry.type,
                jsonInput: entry.jsonInput,
                code: entry.code,
                schemaType: entry.schemaType,
                output: entry.output,
                umlCode: entry.umlCode,
                apiRequest: entry.apiRequest,
                apiResponse: entry.apiResponse,
            }));
        }
    } catch (error) {
        console.error('Failed to get history from backend:', error);
    }

    // Fallback to local storage
    if (!window.electronAPI) {
        return [];
    }

    try {
        const data = await window.electronAPI.history.get();
        return (data as HistoryData).entries || [];
    } catch (error) {
        console.error('Failed to get history:', error);
        return [];
    }
}

export async function addHistoryEntry(entry: Omit<HistoryEntry, 'id' | 'timestamp'>): Promise<boolean> {
    // Try backend first
    try {
        const { addHistoryEntry: addHistoryToSync } = await import('./sync');
        const success = await addHistoryToSync(entry);
        if (success) {
            // Also save locally as backup
            if (window.electronAPI) {
                try {
                    await window.electronAPI.history.add({
                        ...entry,
                        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                        timestamp: new Date().toISOString(),
                    });
                } catch (err) {
                    console.error('Failed to save history locally:', err);
                }
            }
            return true;
        }
    } catch (error) {
        console.error('Failed to add history to backend:', error);
    }

    // Fallback to local storage
    if (!window.electronAPI) {
        return false;
    }

    try {
        const fullEntry: HistoryEntry = {
            ...entry,
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
        };
        const result = await window.electronAPI.history.add(fullEntry);
        return result.success === true;
    } catch (error) {
        console.error('Failed to add history entry:', error);
        return false;
    }
}


