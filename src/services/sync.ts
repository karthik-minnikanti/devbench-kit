// IPC-based sync service - uses Electron file storage instead of backend API

// Helper to get electronAPI
function getElectronAPI() {
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
        return (window as any).electronAPI;
    }
    return null;
}

// ========== FOLDERS ==========
export interface Folder {
    id?: string;
    name: string;
    parentId?: string | null;
    createdAt?: string;
    updatedAt?: string;
}

export async function getFolders(parentId?: string | null): Promise<Folder[]> {
    try {
        const electronAPI = getElectronAPI();
        if (!electronAPI) {
            return [];
        }
        
        // Check if folders IPC handler exists
        if (electronAPI.folders && electronAPI.folders.get) {
            const result = await electronAPI.folders.get(parentId);
            if (result.success) {
                return result.folders || [];
            }
        }
        return [];
    } catch (error: any) {
        console.error('Failed to get folders:', error.message);
        return [];
    }
}

export async function saveFolder(folder: Folder): Promise<Folder | null> {
    try {
        const electronAPI = getElectronAPI();
        if (!electronAPI) {
            return folder;
        }
        
        if (electronAPI.folders && electronAPI.folders.save) {
            const result = await electronAPI.folders.save(folder);
            if (result.success && result.folder) {
                return result.folder;
            }
        }
        return folder;
    } catch (error: any) {
        console.error('Failed to save folder:', error);
        return null;
    }
}

export async function deleteFolder(id: string): Promise<boolean> {
    try {
        const electronAPI = getElectronAPI();
        if (!electronAPI) {
            return false;
        }
        
        if (electronAPI.folders && electronAPI.folders.delete) {
            const result = await electronAPI.folders.delete(id);
            return result.success || false;
        }
        return false;
    } catch (error: any) {
        console.error('Failed to delete folder:', error);
        return false;
    }
}

// ========== NOTES ==========
export interface Note {
    id?: string;
    title: string;
    content: any;
    folderId?: string | null;
    createdAt?: string;
    updatedAt?: string;
}

export async function getNotes(limit?: number, folderId?: string | null): Promise<Note[]> {
    try {
        const electronAPI = getElectronAPI();
        if (!electronAPI) {
            return [];
        }
        
        const result = await electronAPI.notes.list();
        if (result.success) {
            let notes = result.notes || [];
            
            // Filter by folderId if specified
            if (folderId !== undefined) {
                notes = notes.filter((note: Note) => {
                    if (folderId === null) {
                        return !note.folderId || note.folderId === null;
                    }
                    return note.folderId === folderId;
                });
            }
            
            // Apply limit if specified
            if (limit) {
                notes = notes.slice(0, limit);
            }
            
            return notes;
        }
        return [];
    } catch (error: any) {
        console.error('Failed to get notes:', error.message);
        return [];
    }
}


export async function saveNote(note: Note): Promise<Note | null> {
    try {
        const electronAPI = getElectronAPI();
        if (!electronAPI) {
            return note;
        }
        
        const updatedNote = {
            ...note,
            updatedAt: new Date().toISOString(),
            createdAt: note.createdAt || new Date().toISOString()
        };
        
        const result = await electronAPI.notes.save(updatedNote);
        if (result.success && result.note) {
            return result.note;
        }
        return updatedNote;
    } catch (error: any) {
        console.error('Failed to save note:', error);
        return note;
    }
}

export async function deleteNote(id: string): Promise<boolean> {
    try {
        const electronAPI = getElectronAPI();
        if (!electronAPI) {
            return false;
        }
        
        const result = await electronAPI.notes.delete(id);
        return result.success || false;
    } catch (error: any) {
        console.error('Failed to delete note:', error);
        return false;
    }
}

// ========== DRAWINGS ==========
export interface Drawing {
    id?: string;
    title: string;
    elements?: any[];
    files?: any;
    folderId?: string | null;
    createdAt?: string;
    updatedAt?: string;
}

export async function getDrawings(limit?: number, folderId?: string | null, includeContent: boolean = false): Promise<Drawing[]> {
    try {
        const electronAPI = getElectronAPI();
        if (!electronAPI) {
            return [];
        }
        
        const result = await electronAPI.drawings.list();
        if (result.success) {
            let drawings = result.drawings || [];
            
            // Filter by folderId if specified
            if (folderId !== undefined) {
                drawings = drawings.filter((drawing: Drawing) => {
                    if (folderId === null) {
                        return !drawing.folderId || drawing.folderId === null;
                    }
                    return drawing.folderId === folderId;
                });
            }
            
            // Apply limit if specified
            if (limit) {
                drawings = drawings.slice(0, limit);
            }
            
            // If includeContent is false, remove elements and files for performance
            if (!includeContent) {
                drawings = drawings.map((d: Drawing) => ({
                    ...d,
                    elements: undefined,
                    files: undefined
                }));
            }
            
            return drawings;
        }
        return [];
    } catch (error: any) {
        console.error('Failed to get drawings:', error.message);
        return [];
    }
}

// Get a single drawing with full content
export async function getDrawing(id: string): Promise<Drawing | null> {
    try {
        const electronAPI = getElectronAPI();
        if (!electronAPI) {
            return null;
        }
        
        const result = await electronAPI.drawings.load(id);
        if (result.success && result.drawing) {
            return result.drawing;
        }
        return null;
    } catch (error: any) {
        console.error('Failed to get drawing:', error.message);
        return null;
    }
}

export async function saveDrawing(drawing: Drawing): Promise<Drawing | null> {
    try {
        const electronAPI = getElectronAPI();
        if (!electronAPI) {
            return drawing;
        }
        
        const updatedDrawing = {
            ...drawing,
            updatedAt: new Date().toISOString(),
            createdAt: drawing.createdAt || new Date().toISOString()
        };
        
        const result = await electronAPI.drawings.save(updatedDrawing);
        if (result.success && result.drawing) {
            return result.drawing;
        }
        return updatedDrawing;
    } catch (error: any) {
        console.error('Failed to save drawing:', error);
        return drawing;
    }
}

// ========== PLANNER ==========
export interface TimeBlock {
    id: string;
    startTime: string; // HH:MM format
    endTime: string; // HH:MM format
    plannedDuration: number; // minutes
    actualDuration?: number; // minutes
    context: 'coding' | 'review' | 'meeting' | 'thinking' | 'writing';
    description?: string;
}

export interface PlannerTask {
    id: string;
    title: string;
    status: 'todo' | 'in-progress' | 'done' | 'blocked';
    priority: 'P0' | 'P1' | 'P2' | 'low' | 'medium' | 'high';
    estimatedTime?: number; // minutes
    actualTime?: number; // minutes
    notes?: string;
    dependency?: string; // Blocker/dependency note
    time?: string; // Optional time (HH:MM format) - kept for backward compatibility
    completed?: boolean; // Kept for backward compatibility
    // New innovative features
    tags?: string[]; // Tags for categorization
    category?: string; // Task category
    recurring?: {
        frequency: 'daily' | 'weekly' | 'monthly';
        daysOfWeek?: number[]; // 0-6, Sunday-Saturday
        endDate?: string; // YYYY-MM-DD
    };
    subtasks?: PlannerTask[]; // Nested subtasks
    linkedNoteId?: string; // Link to a note
    pomodoroCount?: number; // Number of pomodoros completed
    scheduledTime?: string; // HH:MM format for scheduling
}

export interface PlannerReflection {
    whatWentWell?: string;
    whatDidnt?: string;
    whatBlocked?: string;
    carryForwardTasks?: string[];
}

export interface Habit {
    id: string;
    name: string;
    icon?: string;
    color?: string;
    createdAt?: string; // When habit was created
    updatedAt?: string;
    // Note: completed status is stored separately in completions.json
}

export interface PlannerEntry {
    id?: string;
    date: string; // YYYY-MM-DD
    // Daily Overview
    energyLevel?: 'low' | 'medium' | 'high';
    workMode?: 'deep-work' | 'meetings' | 'mixed';
    priorities?: string[]; // Top 1-3 MITs
    // Time Blocks
    timeBlocks?: TimeBlock[];
    // Enhanced Tasks
    tasks: PlannerTask[];
    // Notes / Scratchpad
    scratchpad?: string;
    notes?: string; // Kept for backward compatibility
    // End-of-Day Reflection
    reflection?: PlannerReflection;
    // New innovative features
    habits?: Habit[]; // Daily habits to track (deprecated - now stored separately)
    createdAt?: string;
    updatedAt?: string;
}

export async function getPlannerEntries(startDate?: string, endDate?: string): Promise<PlannerEntry[]> {
    try {
        const electronAPI = getElectronAPI();
        if (!electronAPI) {
            return [];
        }
        
        if (electronAPI.planner && electronAPI.planner.getEntries) {
            const result = await electronAPI.planner.getEntries(startDate, endDate);
            if (result.success && result.entries) {
                return result.entries;
            }
        }
        return [];
    } catch (error: any) {
        console.error('Failed to get planner entries:', error.message);
        return [];
    }
}

export async function getPlannerEntry(date: string): Promise<PlannerEntry | null> {
    try {
        const electronAPI = getElectronAPI();
        if (!electronAPI) {
            return null;
        }
        
        if (electronAPI.planner && electronAPI.planner.get) {
            const result = await electronAPI.planner.get(date);
            if (result.success && result.entry) {
                return result.entry;
            }
        }
        return null;
    } catch (error: any) {
        console.error('Failed to get planner entry:', error.message);
        return null;
    }
}

export async function savePlannerEntry(entry: PlannerEntry): Promise<PlannerEntry | null> {
    try {
        const electronAPI = getElectronAPI();
        if (!electronAPI) {
            return entry;
        }
        
        if (electronAPI.planner && electronAPI.planner.save) {
            const result = await electronAPI.planner.save(entry);
            if (result.success && result.entry) {
                return result.entry;
            }
        }
        return entry;
    } catch (error: any) {
        console.error('Failed to save planner entry:', error);
        return entry;
    }
}

export async function deletePlannerEntry(date: string): Promise<boolean> {
    try {
        const electronAPI = getElectronAPI();
        if (!electronAPI) {
            return false;
        }
        
        if (electronAPI.planner && electronAPI.planner.delete) {
            const result = await electronAPI.planner.delete(date);
            return result.success || false;
        }
        return false;
    } catch (error: any) {
        console.error('Failed to delete planner entry:', error);
        return false;
    }
}

export async function deleteDrawing(id: string): Promise<boolean> {
    try {
        const electronAPI = getElectronAPI();
        if (!electronAPI) {
            return false;
        }
        
        const result = await electronAPI.drawings.delete(id);
        return result.success || false;
    } catch (error: any) {
        console.error('Failed to delete drawing:', error);
        return false;
    }
}

// ========== HABITS ==========
export async function getAllHabits(): Promise<Habit[]> {
    try {
        const electronAPI = getElectronAPI();
        if (!electronAPI) {
            return [];
        }
        
        if (electronAPI.habits && electronAPI.habits.getAll) {
            const result = await electronAPI.habits.getAll();
            if (result.success && result.habits) {
                return result.habits;
            }
        }
        return [];
    } catch (error: any) {
        console.error('Failed to get habits:', error.message);
        return [];
    }
}

export async function getHabit(habitId: string): Promise<Habit | null> {
    try {
        const electronAPI = getElectronAPI();
        if (!electronAPI) {
            return null;
        }
        
        if (electronAPI.habits && electronAPI.habits.get) {
            const result = await electronAPI.habits.get(habitId);
            if (result.success && result.habit) {
                return result.habit;
            }
        }
        return null;
    } catch (error: any) {
        console.error('Failed to get habit:', error.message);
        return null;
    }
}

export async function saveHabit(habit: Habit): Promise<Habit | null> {
    try {
        const electronAPI = getElectronAPI();
        if (!electronAPI) {
            return habit;
        }
        
        if (electronAPI.habits && electronAPI.habits.save) {
            const result = await electronAPI.habits.save(habit);
            if (result.success && result.habit) {
                return result.habit;
            }
        }
        return habit;
    } catch (error: any) {
        console.error('Failed to save habit:', error);
        return habit;
    }
}

export async function deleteHabit(habitId: string): Promise<boolean> {
    try {
        const electronAPI = getElectronAPI();
        if (!electronAPI) {
            return false;
        }
        
        if (electronAPI.habits && electronAPI.habits.delete) {
            const result = await electronAPI.habits.delete(habitId);
            return result.success || false;
        }
        return false;
    } catch (error: any) {
        console.error('Failed to delete habit:', error);
        return false;
    }
}

export async function getHabitCompletions(habitId: string, startDate?: string, endDate?: string): Promise<Record<string, boolean>> {
    try {
        const electronAPI = getElectronAPI();
        if (!electronAPI) {
            return {};
        }
        
        if (electronAPI.habits && electronAPI.habits.getCompletions) {
            const result = await electronAPI.habits.getCompletions(habitId, startDate, endDate);
            if (result.success && result.completions) {
                return result.completions;
            }
        }
        return {};
    } catch (error: any) {
        console.error('Failed to get habit completions:', error.message);
        return {};
    }
}

export async function getAllHabitCompletions(startDate?: string, endDate?: string): Promise<Record<string, Record<string, boolean>>> {
    try {
        const electronAPI = getElectronAPI();
        if (!electronAPI) {
            return {};
        }
        
        if (electronAPI.habits && electronAPI.habits.getAllCompletions) {
            const result = await electronAPI.habits.getAllCompletions(startDate, endDate);
            if (result.success && result.completions) {
                return result.completions;
            }
        }
        return {};
    } catch (error: any) {
        console.error('Failed to get all habit completions:', error.message);
        return {};
    }
}

export async function setHabitCompletion(habitId: string, date: string, completed: boolean): Promise<boolean> {
    try {
        const electronAPI = getElectronAPI();
        if (!electronAPI) {
            return false;
        }
        
        if (electronAPI.habits && electronAPI.habits.setCompletion) {
            const result = await electronAPI.habits.setCompletion(habitId, date, completed);
            return result.success || false;
        }
        return false;
    } catch (error: any) {
        console.error('Failed to set habit completion:', error);
        return false;
    }
}

// ========== HISTORY ==========
export interface HistoryEntry {
    id?: string;
    type: 'schema' | 'js-snippet' | 'uml' | 'api';
    jsonInput?: string;
    code?: string;
    schemaType?: 'typescript' | 'zod' | 'prisma' | 'mongoose';
    output: string;
    umlCode?: string;
    apiRequest?: any;
    apiResponse?: any;
    createdAt?: string;
    updatedAt?: string;
}

export async function getHistory(type?: string, limit?: number): Promise<HistoryEntry[]> {
    // TODO: Implement with file storage
    return [];
}

export async function addHistoryEntry(entry: Omit<HistoryEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<boolean> {
    // TODO: Implement with file storage
    return true;
}

export async function deleteHistoryEntry(id: string): Promise<boolean> {
    // TODO: Implement with file storage
    return true;
}

// ========== SNIPPETS ==========
export interface Snippet {
    id?: string;
    name: string;
    code: string;
    createdAt?: string;
    updatedAt?: string;
}

export async function getSnippets(): Promise<Snippet[]> {
    // TODO: Implement with file storage
    return [];
}

export async function saveSnippet(snippet: Snippet): Promise<Snippet | null> {
    // TODO: Implement with file storage
    return snippet;
}

export async function deleteSnippet(id: string): Promise<boolean> {
    // TODO: Implement with file storage
    return true;
}

