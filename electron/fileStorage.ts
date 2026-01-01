import * as path from 'path';
import * as fs from 'fs/promises';
import { randomUUID } from 'crypto';
import { gitService } from './gitService';

export interface StorageConfig {
    repoPath: string;
}

class FileStorageService {
    private config: StorageConfig | null = null;
    private syncEnabled: boolean = true;
    private folderCache: Map<string, any> = new Map();

    // Generate UUID v4
    private generateUUID(): string {
        return randomUUID();
    }

    async initialize(repoPath: string): Promise<{ success: boolean; error?: string }> {
        try {
            // Initialize Git service
            const gitResult = await gitService.initialize(repoPath);
            if (!gitResult.success) {
                return gitResult;
            }

            this.config = { repoPath: path.resolve(repoPath) };
            
            // Ensure directory structure exists
            await this.ensureDirectoryStructure();
            
            // Load folder cache
            await this.refreshFolderCache();
            
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message || String(error) };
        }
    }

    private async ensureDirectoryStructure(): Promise<void> {
        if (!this.config) return;

        const dirs = [
            'notes',
            'drawings',
            'apiclient',
            'folders',
            'planner',
            'habits',
            'history',
            'snippets',
        ];

        for (const dir of dirs) {
            const dirPath = path.join(this.config.repoPath, dir);
            try {
                await fs.mkdir(dirPath, { recursive: true });
            } catch (error) {
                console.error(`Failed to create directory ${dir}:`, error);
            }
        }
    }

    // Sanitize folder name for file system
    private sanitizeFolderName(name: string): string {
        // Replace invalid characters with underscores
        return name.replace(/[<>:"/\\|?*]/g, '_').trim();
    }

    // Build folder path from folder hierarchy
    private async buildFolderPath(folderId: string | null | undefined, baseType: string): Promise<string> {
        if (!folderId) {
            return path.join(this.config!.repoPath, baseType);
        }

        // Refresh folder cache to ensure we have latest data
        await this.refreshFolderCache();
        
        const folders = await this.getFolders();
        const folderPath: string[] = [];
        let currentFolderId: string | null = folderId;
        const visited = new Set<string>(); // Prevent infinite loops

        // Build path from leaf to root
        while (currentFolderId && !visited.has(currentFolderId)) {
            visited.add(currentFolderId);
            const folder = folders.find((f: any) => f.id === currentFolderId);
            if (!folder) {
                console.warn(`Folder with id ${currentFolderId} not found`);
                break;
            }
            
            folderPath.unshift(this.sanitizeFolderName(folder.name));
            currentFolderId = folder.parentId;
        }

        return path.join(this.config!.repoPath, baseType, ...folderPath);
    }

    // Refresh folder cache
    private async refreshFolderCache(): Promise<void> {
        try {
            // Ensure folders directory exists
            const foldersDir = path.join(this.config!.repoPath, 'folders');
            await fs.mkdir(foldersDir, { recursive: true });
            
            const foldersFile = path.join(foldersDir, 'folders.json');
            const content = await fs.readFile(foldersFile, 'utf-8');
            const data = JSON.parse(content);
            const folders = data.folders || [];
            
            this.folderCache.clear();
            folders.forEach((f: any) => {
                this.folderCache.set(f.id, f);
            });
        } catch (error) {
            // File might not exist yet - that's okay
            this.folderCache.clear();
        }
    }

    private getFilePath(type: string, id?: string, folderId?: string | null): string {
        if (!this.config) {
            throw new Error('File storage not initialized');
        }

        switch (type) {
            case 'note':
                return path.join(this.config.repoPath, 'notes', `${id}.json`);
            case 'drawing':
                return path.join(this.config.repoPath, 'drawings', `${id}.json`);
            case 'apiclient':
                if (id) {
                    return path.join(this.config.repoPath, 'apiclient', `${id}.json`);
                }
                return path.join(this.config.repoPath, 'apiclient');
            case 'folders':
                return path.join(this.config.repoPath, 'folders', 'folders.json');
            case 'planner':
                return path.join(this.config.repoPath, 'planner', `${id}.json`);
            case 'history':
                return path.join(this.config.repoPath, 'history', 'history.json');
            case 'snippets':
                return path.join(this.config.repoPath, 'snippets', 'snippets.json');
            default:
                throw new Error(`Unknown storage type: ${type}`);
        }
    }

    // Get file path with folder structure
    private async getFilePathWithFolder(type: string, id: string, folderId?: string | null): Promise<string> {
        if (!this.config) {
            throw new Error('File storage not initialized');
        }

        const folderPath = await this.buildFolderPath(folderId, type);
        await fs.mkdir(folderPath, { recursive: true });
        return path.join(folderPath, `${id}.json`);
    }

    // Recursively read all JSON files from a directory
    private async readFilesRecursively(dirPath: string): Promise<any[]> {
        const items: any[] = [];
        
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                
                if (entry.isDirectory()) {
                    // Recursively read subdirectories
                    const subItems = await this.readFilesRecursively(fullPath);
                    items.push(...subItems);
                } else if (entry.isFile() && entry.name.endsWith('.json')) {
                    try {
                        const content = await fs.readFile(fullPath, 'utf-8');
                        const item = JSON.parse(content);
                        items.push(item);
                    } catch (error) {
                        console.error(`Failed to read file ${fullPath}:`, error);
                    }
                }
            }
        } catch (error) {
            // Directory might not exist
        }
        
        return items;
    }

    private async triggerSync(filePath: string, type: string): Promise<void> {
        if (!this.syncEnabled || !gitService.isInitialized()) {
            return;
        }

        try {
            const relativePath = path.relative(gitService.getRepoPath() || '', filePath);
            await gitService.debouncedSync(relativePath, `Update ${type}`);
        } catch (error) {
            console.error('Failed to trigger sync:', error);
        }
    }

    // Notes
    async getNotes(): Promise<any[]> {
        const notesDir = path.join(this.config!.repoPath, 'notes');
        return this.readFilesRecursively(notesDir);
    }

    async saveNote(note: any): Promise<{ success: boolean; note?: any; error?: string }> {
        try {
            if (!note.id) {
                // Generate a UUID v4 for note ID
                note.id = this.generateUUID();
            }
            
            // Check if note exists and has a different folderId (need to move file)
            const existingNote = await this.getNote(note.id);
            if (existingNote && existingNote.folderId !== note.folderId) {
                // Delete old file location
                const oldPath = await this.getFilePathWithFolder('notes', note.id, existingNote.folderId);
                try {
                    await fs.unlink(oldPath);
                } catch {}
            }
            
            const filePath = await this.getFilePathWithFolder('notes', note.id, note.folderId);
            await fs.writeFile(filePath, JSON.stringify(note, null, 2), 'utf-8');
            await this.triggerSync(filePath, 'note');
            
            return { success: true, note };
        } catch (error: any) {
            return { success: false, error: error.message || String(error) };
        }
    }

    async deleteNote(noteId: string, folderId?: string | null): Promise<{ success: boolean; error?: string }> {
        try {
            // First try to find the note to get its folderId
            const note = await this.getNote(noteId);
            if (note) {
                const filePath = await this.getFilePathWithFolder('notes', noteId, note.folderId);
                await fs.unlink(filePath);
                await this.triggerSync(filePath, 'note');
                return { success: true };
            }
            
            // If not found, try with provided folderId
            if (folderId !== undefined) {
                const filePath = await this.getFilePathWithFolder('notes', noteId, folderId);
                await fs.unlink(filePath);
                await this.triggerSync(filePath, 'note');
                return { success: true };
            }
            
            return { success: false, error: 'Note not found' };
        } catch (error: any) {
            return { success: false, error: error.message || String(error) };
        }
    }

    async getNote(id: string, folderId?: string | null): Promise<any | null> {
        // First try with provided folderId
        if (folderId !== undefined) {
            try {
                const filePath = await this.getFilePathWithFolder('notes', id, folderId);
                const content = await fs.readFile(filePath, 'utf-8');
                return JSON.parse(content);
            } catch (error) {
                // Continue to search all locations
            }
        }
        
        // Search all notes to find by id
        const notes = await this.getNotes();
        return notes.find((n: any) => n.id === id) || null;
    }

    // Drawings
    async getDrawings(): Promise<any[]> {
        const drawingsDir = path.join(this.config!.repoPath, 'drawings');
        return this.readFilesRecursively(drawingsDir);
    }

    async getDrawing(id: string, folderId?: string | null): Promise<any | null> {
        // First try with provided folderId
        if (folderId !== undefined) {
            try {
                const filePath = await this.getFilePathWithFolder('drawings', id, folderId);
                const content = await fs.readFile(filePath, 'utf-8');
                return JSON.parse(content);
            } catch (error) {
                // Continue to search all locations
            }
        }
        
        // Search all drawings to find by id
        const drawings = await this.getDrawings();
        return drawings.find((d: any) => d.id === id) || null;
    }

    async saveDrawing(drawing: any): Promise<{ success: boolean; drawing?: any; error?: string }> {
        try {
            if (!drawing.id) {
                // Generate UUID v4 for drawing ID
                drawing.id = this.generateUUID();
            }
            
            // Ensure we have required fields
            if (!drawing.createdAt) {
                drawing.createdAt = new Date().toISOString();
            }
            drawing.updatedAt = new Date().toISOString();
            
            // Check if drawing exists and has a different folderId (need to move file)
            const existingDrawing = await this.getDrawing(drawing.id);
            if (existingDrawing) {
                // Preserve createdAt if it exists
                if (existingDrawing.createdAt) {
                    drawing.createdAt = existingDrawing.createdAt;
                }
                
                // If folderId changed, delete old file location
                const existingFolderId = existingDrawing.folderId === undefined ? null : existingDrawing.folderId;
                const newFolderId = drawing.folderId === undefined ? null : drawing.folderId;
                
                if (existingFolderId !== newFolderId) {
                    const oldPath = await this.getFilePathWithFolder('drawings', drawing.id, existingFolderId);
                    try {
                        await fs.unlink(oldPath);
                    } catch (err) {
                        // Old file might not exist, that's okay
                        console.warn(`Failed to delete old drawing file: ${oldPath}`, err);
                    }
                }
            }
            
            const filePath = await this.getFilePathWithFolder('drawings', drawing.id, drawing.folderId);
            await fs.writeFile(filePath, JSON.stringify(drawing, null, 2), 'utf-8');
            await this.triggerSync(filePath, 'drawing');
            
            return { success: true, drawing };
        } catch (error: any) {
            console.error('[FileStorage] Failed to save drawing:', error);
            return { success: false, error: error.message || String(error) };
        }
    }

    async deleteDrawing(drawingId: string, folderId?: string | null): Promise<{ success: boolean; error?: string }> {
        try {
            // First try to find the drawing to get its folderId
            const drawing = await this.getDrawing(drawingId);
            if (drawing) {
                const filePath = await this.getFilePathWithFolder('drawings', drawingId, drawing.folderId);
                await fs.unlink(filePath);
                await this.triggerSync(filePath, 'drawing');
                return { success: true };
            }
            
            // If not found, try with provided folderId
            if (folderId !== undefined) {
                const filePath = await this.getFilePathWithFolder('drawings', drawingId, folderId);
                await fs.unlink(filePath);
                await this.triggerSync(filePath, 'drawing');
                return { success: true };
            }
            
            return { success: false, error: 'Drawing not found' };
        } catch (error: any) {
            return { success: false, error: error.message || String(error) };
        }
    }

    // API Client
    async getApiRequests(): Promise<any[]> {
        try {
            const apiclientDir = this.getFilePath('apiclient');
            const files = await fs.readdir(apiclientDir);
            const requests: any[] = [];
            
            for (const file of files) {
                if (file.endsWith('.json') && file !== 'requests.json') {
                    try {
                        const filePath = path.join(apiclientDir, file);
                        const content = await fs.readFile(filePath, 'utf-8');
                        const request = JSON.parse(content);
                        requests.push(request);
                    } catch (err) {
                        console.error(`Failed to read API request file ${file}:`, err);
                    }
                }
            }
            
            // Try to migrate old requests.json if it exists
            try {
                const oldFilePath = path.join(apiclientDir, 'requests.json');
                const oldContent = await fs.readFile(oldFilePath, 'utf-8');
                const oldData = JSON.parse(oldContent);
                if (oldData.requests && oldData.requests.length > 0) {
                    // Migrate old requests to individual files
                    for (const request of oldData.requests) {
                        if (request.id) {
                            const newFilePath = path.join(apiclientDir, `${request.id}.json`);
                            await fs.writeFile(newFilePath, JSON.stringify(request, null, 2), 'utf-8');
                            requests.push(request);
                        }
                    }
                    // Remove old file after migration
                    await fs.unlink(oldFilePath);
                }
            } catch (err) {
                // Old file doesn't exist or migration failed, ignore
            }
            
            return requests;
        } catch (error) {
            return [];
        }
    }

    async getApiRequest(id: string): Promise<any | null> {
        try {
            const filePath = this.getFilePath('apiclient', id);
            const content = await fs.readFile(filePath, 'utf-8');
            return JSON.parse(content);
        } catch (error) {
            return null;
        }
    }

    async saveApiRequest(request: any): Promise<{ success: boolean; error?: string }> {
        try {
            if (!request.id) {
                return { success: false, error: 'Request ID is required' };
            }
            const filePath = this.getFilePath('apiclient', request.id);
            await fs.writeFile(filePath, JSON.stringify(request, null, 2), 'utf-8');
            await this.triggerSync(filePath, 'apiclient');
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message || String(error) };
        }
    }

    async deleteApiRequest(id: string): Promise<{ success: boolean; error?: string }> {
        try {
            const filePath = this.getFilePath('apiclient', id);
            await fs.unlink(filePath);
            await this.triggerSync(filePath, 'apiclient');
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message || String(error) };
        }
    }

    // Legacy method for backward compatibility - saves all requests individually
    async saveApiRequests(requests: any[]): Promise<{ success: boolean; error?: string }> {
        try {
            const errors: string[] = [];
            for (const request of requests) {
                const result = await this.saveApiRequest(request);
                if (!result.success) {
                    errors.push(result.error || 'Unknown error');
                }
            }
            if (errors.length > 0) {
                return { success: false, error: `Failed to save some requests: ${errors.join(', ')}` };
            }
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message || String(error) };
        }
    }

    // API Client History
    async getApiHistory(): Promise<any[]> {
        try {
            const filePath = path.join(this.config.repoPath, 'apiclient', 'history.json');
            const content = await fs.readFile(filePath, 'utf-8');
            return JSON.parse(content);
        } catch (error: any) {
            if ((error as any).code === 'ENOENT') {
                return [];
            }
            console.error('Failed to get API history:', error);
            return [];
        }
    }

    async saveApiHistory(history: any[]): Promise<{ success: boolean; error?: string }> {
        try {
            const filePath = path.join(this.config.repoPath, 'apiclient', 'history.json');
            await fs.writeFile(filePath, JSON.stringify(history, null, 2), 'utf-8');
            await this.triggerSync(filePath, 'apiclient');
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message || String(error) };
        }
    }

    // API Client Console Logs
    async getApiConsoleLogs(): Promise<any[]> {
        try {
            const filePath = path.join(this.config.repoPath, 'apiclient', 'console.json');
            const content = await fs.readFile(filePath, 'utf-8');
            return JSON.parse(content);
        } catch (error: any) {
            if ((error as any).code === 'ENOENT') {
                return [];
            }
            console.error('Failed to get API console logs:', error);
            return [];
        }
    }

    async saveApiConsoleLogs(logs: any[]): Promise<{ success: boolean; error?: string }> {
        try {
            const filePath = path.join(this.config.repoPath, 'apiclient', 'console.json');
            await fs.writeFile(filePath, JSON.stringify(logs, null, 2), 'utf-8');
            await this.triggerSync(filePath, 'apiclient');
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message || String(error) };
        }
    }

    // API Client Environments
    async getApiEnvironments(): Promise<{ environments: any[]; activeEnvironmentId: string | null }> {
        try {
            const filePath = path.join(this.config.repoPath, 'apiclient', 'environments.json');
            const content = await fs.readFile(filePath, 'utf-8');
            return JSON.parse(content);
        } catch (error: any) {
            if ((error as any).code === 'ENOENT') {
                return { environments: [], activeEnvironmentId: null };
            }
            console.error('Failed to get API environments:', error);
            return { environments: [], activeEnvironmentId: null };
        }
    }

    async saveApiEnvironments(data: { environments: any[]; activeEnvironmentId: string | null }): Promise<{ success: boolean; error?: string }> {
        try {
            const filePath = path.join(this.config.repoPath, 'apiclient', 'environments.json');
            await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
            await this.triggerSync(filePath, 'apiclient');
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message || String(error) };
        }
    }

    // Folders
    async getFolders(): Promise<any[]> {
        try {
            // Ensure folders directory exists
            const foldersDir = path.join(this.config!.repoPath, 'folders');
            await fs.mkdir(foldersDir, { recursive: true });
            
            const filePath = this.getFilePath('folders');
            const content = await fs.readFile(filePath, 'utf-8');
            const data = JSON.parse(content);
            const folders = data.folders || [];
            
            // Update cache
            this.folderCache.clear();
            folders.forEach((f: any) => {
                this.folderCache.set(f.id, f);
            });
            
            return folders;
        } catch (error) {
            // If file doesn't exist, return empty array (first time setup)
            return [];
        }
    }

    async saveFolder(folder: any): Promise<{ success: boolean; folder?: any; error?: string }> {
        try {
            // Ensure folders directory exists
            const foldersDir = path.join(this.config!.repoPath, 'folders');
            await fs.mkdir(foldersDir, { recursive: true });
            
            const folders = await this.getFolders();
            const existingIndex = folders.findIndex((f: any) => f.id === folder.id);
            
            if (existingIndex >= 0) {
                const oldFolder = folders[existingIndex];
                folders[existingIndex] = folder;
                
                // If folder name changed, we need to move files
                if (oldFolder.name !== folder.name) {
                    await this.moveFolderFiles(oldFolder, folder);
                }
            } else {
                if (!folder.id) {
                    folder.id = Date.now().toString();
                }
                folders.push(folder);
                
                // Create folder directories for new folder
                const notesPath = await this.buildFolderPath(folder.id, 'notes');
                const drawingsPath = await this.buildFolderPath(folder.id, 'drawings');
                await fs.mkdir(notesPath, { recursive: true });
                await fs.mkdir(drawingsPath, { recursive: true });
            }
            
            const filePath = this.getFilePath('folders');
            await fs.writeFile(filePath, JSON.stringify({ folders }, null, 2), 'utf-8');
            await this.refreshFolderCache();
            await this.triggerSync(filePath, 'folder');
            
            console.log(`[FileStorage] Saved folder: ${folder.name} (${folder.id})`);
            return { success: true, folder };
        } catch (error: any) {
            console.error(`[FileStorage] Failed to save folder:`, error);
            return { success: false, error: error.message || String(error) };
        }
    }

    // Move files when folder name changes
    private async moveFolderFiles(oldFolder: any, newFolder: any): Promise<void> {
        const oldPath = await this.buildFolderPath(oldFolder.id, 'notes');
        const newPath = await this.buildFolderPath(newFolder.id, 'notes');
        
        try {
            // Move notes
            if (await this.directoryExists(oldPath)) {
                await fs.rename(oldPath, newPath);
            }
            
            // Move drawings
            const oldDrawingsPath = await this.buildFolderPath(oldFolder.id, 'drawings');
            const newDrawingsPath = await this.buildFolderPath(newFolder.id, 'drawings');
            if (await this.directoryExists(oldDrawingsPath)) {
                await fs.rename(oldDrawingsPath, newDrawingsPath);
            }
        } catch (error) {
            console.error('Failed to move folder files:', error);
        }
    }

    private async directoryExists(dirPath: string): Promise<boolean> {
        try {
            const stats = await fs.stat(dirPath);
            return stats.isDirectory();
        } catch {
            return false;
        }
    }

    async deleteFolder(folderId: string): Promise<{ success: boolean; error?: string }> {
        try {
            const folders = await this.getFolders();
            const filtered = folders.filter((f: any) => f.id !== folderId);
            
            // Delete folder directories
            const notesPath = await this.buildFolderPath(folderId, 'notes');
            const drawingsPath = await this.buildFolderPath(folderId, 'drawings');
            
            try {
                await fs.rm(notesPath, { recursive: true, force: true });
            } catch {}
            
            try {
                await fs.rm(drawingsPath, { recursive: true, force: true });
            } catch {}
            
            const filePath = this.getFilePath('folders');
            await fs.writeFile(filePath, JSON.stringify({ folders: filtered }, null, 2), 'utf-8');
            await this.refreshFolderCache();
            await this.triggerSync(filePath, 'folder');
            
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message || String(error) };
        }
    }

    // Planner
    async getPlannerEntry(date: string): Promise<any | null> {
        try {
            const filePath = this.getFilePath('planner', date);
            const content = await fs.readFile(filePath, 'utf-8');
            return JSON.parse(content);
        } catch (error) {
            return null;
        }
    }

    async getPlannerEntries(startDate?: string, endDate?: string): Promise<any[]> {
        const plannerDir = path.join(this.config!.repoPath, 'planner');
        try {
            const files = await fs.readdir(plannerDir);
            const entries: any[] = [];
            
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const date = file.replace('.json', '');
                    if (startDate && date < startDate) continue;
                    if (endDate && date > endDate) continue;
                    
                    try {
                        const filePath = path.join(plannerDir, file);
                        const content = await fs.readFile(filePath, 'utf-8');
                        const entry = JSON.parse(content);
                        entries.push(entry);
                    } catch (error) {
                        console.error(`Failed to read planner entry ${file}:`, error);
                    }
                }
            }
            
            return entries;
        } catch (error) {
            return [];
        }
    }

    async savePlannerEntry(entry: any): Promise<{ success: boolean; entry?: any; error?: string }> {
        try {
            const filePath = this.getFilePath('planner', entry.date);
            await fs.writeFile(filePath, JSON.stringify(entry, null, 2), 'utf-8');
            await this.triggerSync(filePath, 'planner');
            return { success: true, entry };
        } catch (error: any) {
            return { success: false, error: error.message || String(error) };
        }
    }

    async deletePlannerEntry(date: string): Promise<{ success: boolean; error?: string }> {
        try {
            const filePath = this.getFilePath('planner', date);
            await fs.unlink(filePath);
            await this.triggerSync(filePath, 'planner');
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message || String(error) };
        }
    }

    // History
    async getHistory(): Promise<any[]> {
        try {
            const filePath = this.getFilePath('history');
            const content = await fs.readFile(filePath, 'utf-8');
            const data = JSON.parse(content);
            return data.entries || [];
        } catch (error) {
            return [];
        }
    }

    async saveHistoryEntry(entry: any): Promise<{ success: boolean; error?: string }> {
        try {
            const entries = await this.getHistory();
            entries.push(entry);
            
            const filePath = this.getFilePath('history');
            await fs.writeFile(filePath, JSON.stringify({ entries }, null, 2), 'utf-8');
            await this.triggerSync(filePath, 'history');
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message || String(error) };
        }
    }

    async deleteHistoryEntry(id: string): Promise<{ success: boolean; error?: string }> {
        try {
            const entries = await this.getHistory();
            const filtered = entries.filter((e: any) => e.id !== id);
            
            const filePath = this.getFilePath('history');
            await fs.writeFile(filePath, JSON.stringify({ entries: filtered }, null, 2), 'utf-8');
            await this.triggerSync(filePath, 'history');
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message || String(error) };
        }
    }

    // Snippets
    async getSnippets(): Promise<any[]> {
        try {
            const filePath = this.getFilePath('snippets');
            const content = await fs.readFile(filePath, 'utf-8');
            const data = JSON.parse(content);
            return data.snippets || [];
        } catch (error) {
            return [];
        }
    }

    async saveSnippet(snippet: any): Promise<{ success: boolean; snippet?: any; error?: string }> {
        try {
            const snippets = await this.getSnippets();
            const existingIndex = snippets.findIndex((s: any) => s.id === snippet.id);
            
            if (existingIndex >= 0) {
                snippets[existingIndex] = snippet;
            } else {
                if (!snippet.id) {
                    snippet.id = Date.now().toString();
                }
                snippets.push(snippet);
            }
            
            const filePath = this.getFilePath('snippets');
            await fs.writeFile(filePath, JSON.stringify({ snippets }, null, 2), 'utf-8');
            await this.triggerSync(filePath, 'snippet');
            
            return { success: true, snippet };
        } catch (error: any) {
            return { success: false, error: error.message || String(error) };
        }
    }

    async deleteSnippet(snippetId: string): Promise<{ success: boolean; error?: string }> {
        try {
            const snippets = await this.getSnippets();
            const filtered = snippets.filter((s: any) => s.id !== snippetId);
            
            const filePath = this.getFilePath('snippets');
            await fs.writeFile(filePath, JSON.stringify({ snippets: filtered }, null, 2), 'utf-8');
            await this.triggerSync(filePath, 'snippet');
            
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message || String(error) };
        }
    }

    getRepoPath(): string | null {
        return this.config?.repoPath || null;
    }

    isInitialized(): boolean {
        return this.config !== null;
    }

    setSyncEnabled(enabled: boolean): void {
        this.syncEnabled = enabled;
    }

    // ========== HABITS ==========
    
    async getAllHabits(): Promise<any[]> {
        const habitsDir = path.join(this.config!.repoPath, 'habits');
        try {
            const files = await fs.readdir(habitsDir);
            const habits: any[] = [];
            
            for (const file of files) {
                if (file.endsWith('.json') && file !== 'completions.json') {
                    try {
                        const filePath = path.join(habitsDir, file);
                        const content = await fs.readFile(filePath, 'utf-8');
                        const habit = JSON.parse(content);
                        habits.push(habit);
                    } catch (error) {
                        console.error(`Failed to read habit ${file}:`, error);
                    }
                }
            }
            
            return habits;
        } catch (error) {
            return [];
        }
    }

    async getHabit(habitId: string): Promise<any | null> {
        try {
            const filePath = this.getFilePath('habits', habitId);
            const content = await fs.readFile(filePath, 'utf-8');
            return JSON.parse(content);
        } catch (error) {
            return null;
        }
    }

    async saveHabit(habit: any): Promise<{ success: boolean; habit?: any; error?: string }> {
        try {
            if (!habit.id) {
                habit.id = this.generateUUID();
            }
            
            if (!habit.createdAt) {
                habit.createdAt = new Date().toISOString();
            }
            
            habit.updatedAt = new Date().toISOString();
            
            const filePath = this.getFilePath('habits', habit.id);
            await fs.writeFile(filePath, JSON.stringify(habit, null, 2), 'utf-8');
            await this.triggerSync(filePath, 'habit');
            
            return { success: true, habit };
        } catch (error: any) {
            return { success: false, error: error.message || String(error) };
        }
    }

    async deleteHabit(habitId: string): Promise<{ success: boolean; error?: string }> {
        try {
            const filePath = this.getFilePath('habits', habitId);
            await fs.unlink(filePath);
            
            // Also remove from completions
            await this.removeHabitCompletions(habitId);
            
            await this.triggerSync(filePath, 'habit');
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message || String(error) };
        }
    }

    // Habit completions are stored in a separate file: habits/completions.json
    // Structure: { "habitId": { "date": true/false, ... }, ... }
    async getHabitCompletions(habitId: string, startDate?: string, endDate?: string): Promise<Record<string, boolean>> {
        try {
            const completionsFile = path.join(this.config!.repoPath, 'habits', 'completions.json');
            const content = await fs.readFile(completionsFile, 'utf-8');
            const allCompletions = JSON.parse(content);
            const habitCompletions = allCompletions[habitId] || {};
            
            if (startDate || endDate) {
                const filtered: Record<string, boolean> = {};
                Object.keys(habitCompletions).forEach(date => {
                    if (startDate && date < startDate) return;
                    if (endDate && date > endDate) return;
                    filtered[date] = habitCompletions[date];
                });
                return filtered;
            }
            
            return habitCompletions;
        } catch (error) {
            return {};
        }
    }

    async getAllHabitCompletions(startDate?: string, endDate?: string): Promise<Record<string, Record<string, boolean>>> {
        try {
            const completionsFile = path.join(this.config!.repoPath, 'habits', 'completions.json');
            const content = await fs.readFile(completionsFile, 'utf-8');
            const allCompletions = JSON.parse(content);
            
            if (startDate || endDate) {
                const filtered: Record<string, Record<string, boolean>> = {};
                Object.keys(allCompletions).forEach(habitId => {
                    const habitCompletions = allCompletions[habitId] || {};
                    const filteredCompletions: Record<string, boolean> = {};
                    Object.keys(habitCompletions).forEach(date => {
                        if (startDate && date < startDate) return;
                        if (endDate && date > endDate) return;
                        filteredCompletions[date] = habitCompletions[date];
                    });
                    if (Object.keys(filteredCompletions).length > 0) {
                        filtered[habitId] = filteredCompletions;
                    }
                });
                return filtered;
            }
            
            return allCompletions;
        } catch (error) {
            return {};
        }
    }

    async setHabitCompletion(habitId: string, date: string, completed: boolean): Promise<{ success: boolean; error?: string }> {
        try {
            const completionsFile = path.join(this.config!.repoPath, 'habits', 'completions.json');
            
            let allCompletions: Record<string, Record<string, boolean>> = {};
            try {
                const content = await fs.readFile(completionsFile, 'utf-8');
                allCompletions = JSON.parse(content);
            } catch (error) {
                // File doesn't exist yet, create it
                allCompletions = {};
            }
            
            if (!allCompletions[habitId]) {
                allCompletions[habitId] = {};
            }
            
            if (completed) {
                allCompletions[habitId][date] = true;
            } else {
                delete allCompletions[habitId][date];
            }
            
            await fs.writeFile(completionsFile, JSON.stringify(allCompletions, null, 2), 'utf-8');
            await this.triggerSync(completionsFile, 'habit');
            
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message || String(error) };
        }
    }

    async removeHabitCompletions(habitId: string): Promise<void> {
        try {
            const completionsFile = path.join(this.config!.repoPath, 'habits', 'completions.json');
            const content = await fs.readFile(completionsFile, 'utf-8');
            const allCompletions = JSON.parse(content);
            
            delete allCompletions[habitId];
            
            await fs.writeFile(completionsFile, JSON.stringify(allCompletions, null, 2), 'utf-8');
            await this.triggerSync(completionsFile, 'habit');
        } catch (error) {
            // File might not exist, ignore
        }
    }
}

export const fileStorage = new FileStorageService();
