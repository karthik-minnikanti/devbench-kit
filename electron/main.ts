import { app, BrowserWindow, ipcMain, dialog, session } from 'electron';
import * as http from 'http';
import * as https from 'https';
import { URL } from 'url';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import * as fs from 'fs/promises';
import { exec, spawn, ChildProcess, execSync } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { createRequire } from 'module';
import vm from 'node:vm';
import { fileStorage } from './fileStorage';
import { gitService } from './gitService';
import { gitRepoStore } from './gitRepoStore';
import { k8sService } from './k8sService';
import { k8sClusterStore } from './k8sClusterStore';
import { dockerService } from './dockerService';
import { terminalService } from './terminalService';
import { terminalHistoryStore } from './terminalHistoryStore';
import { kubectlPath, kubectlSpawnEnv } from './terminalShell';
import { getArchMismatchWarning } from './archMismatch';
import {
    getAutoUpdateStatus,
    isAutoUpdateEnabled,
    isBenignUpdateError,
} from './autoUpdaterConfig';

const execAsync = promisify(exec);

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function checkForUpdatesSafely(context: string): void {
    autoUpdater.checkForUpdates().catch((err) => {
        if (isBenignUpdateError(err)) {
            console.warn(`[AutoUpdater] Update metadata unavailable (${context}):`, err.message);
            return;
        }
        console.error(`[AutoUpdater] Error checking for updates (${context}):`, err);
    });
}

if (!isDev && process.platform === 'darwin') {
    app.setAsDefaultProtocolClient('devbench');
} else if (!isDev) {
    app.setAsDefaultProtocolClient('devbench');
}

async function createWindow() {
    // Resolve preload path - both dev and prod use preload.mjs
    let preloadPath = path.resolve(__dirname, 'preload.mjs');
    console.log('[Main] Preload path:', preloadPath);
    console.log('[Main] __dirname:', __dirname);
    console.log('[Main] isDev:', isDev);

    // Verify preload file exists, try alternatives if not found
    try {
        await fs.access(preloadPath);
        console.log('[Main] Preload file exists at:', preloadPath);
    } catch (error) {
        console.warn('[Main] Preload file not found at:', preloadPath);
        // Try alternative paths
        const alternatives = [
            path.resolve(__dirname, 'preload.js'),
            path.resolve(__dirname, 'preload.mjs'),
            path.join(__dirname, 'preload.js'),
            path.join(__dirname, 'preload.mjs'),
        ];

        for (const altPath of alternatives) {
            try {
                await fs.access(altPath);
                preloadPath = altPath;
                console.log('[Main] Found preload file at alternative path:', preloadPath);
                break;
            } catch {
                // Continue trying
            }
        }

        // Final check
        try {
            await fs.access(preloadPath);
        } catch {
            console.error('[Main] Could not find preload file in any location');
        }
    }

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        show: false,
        title: 'DevBench',
        webPreferences: {
            preload: preloadPath,
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            webSecurity: true,
            allowRunningInsecureContent: false,
            webviewTag: true, // Enable webview tag for draw.io
        },
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
        icon: path.join(__dirname, '../public/logo.svg'),
    });

    gitService.setStateChangeListener((state) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('git:sync-state', state);
        }
    });

    // Listen for preload errors
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
        console.error('[Main] Failed to load:', errorCode, errorDescription, validatedURL);
    });

    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
        if (message.includes('[Preload]') || message.includes('Electron API')) {
            console.log(`[Renderer ${level}]:`, message);
        }
    });

    // Log when preload script is loaded
    mainWindow.webContents.on('did-attach-webview', () => {
        console.log('[Main] Webview attached');
    });

    mainWindow.webContents.on('dom-ready', () => {
        console.log('[Main] DOM ready, checking for electronAPI...');
        mainWindow?.webContents.executeJavaScript(`
            console.log('[Renderer] window.electronAPI exists:', typeof window.electronAPI !== 'undefined');
            if (window.electronAPI) {
                console.log('[Renderer] electronAPI methods:', Object.keys(window.electronAPI));
            }
        `).catch(err => console.error('[Main] Failed to execute script:', err));
    });

    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    mainWindow.once('ready-to-show', () => {
        if (mainWindow) {
            mainWindow.show();
        }
    });

    mainWindow.on('close', () => {
        if (mainWindow) {
            terminalService.destroyAllForWebContents(mainWindow.webContents);
        }
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Remove CORS headers (origin, referer, host) ONLY for external API client requests
    // Keep them for backend API calls (localhost:3001) so CORS works properly
    const ses = session.defaultSession;
    
    // Handler for all HTTP/HTTPS requests
    ses.webRequest.onBeforeSendHeaders(
        { urls: ['http://*/*', 'https://*/*'] },
        (details, callback) => {
            try {
                const url = details.url.toLowerCase();
                
                // Check if this is a backend API call (should keep origin for CORS)
                const isBackendApiCall = 
                    url.includes('localhost:3001') || 
                    url.includes('127.0.0.1:3001') ||
                    url.includes('localhost:3000') ||
                    url.includes('127.0.0.1:3000') ||
                    url.includes('devbench.in/api/') ||
                    url.includes('dev-api.devbench.in');
                
                // Only remove CORS headers for external API client requests (not backend calls)
                if (!isBackendApiCall && details.requestHeaders) {
                    // Remove CORS-related headers for external APIs
                    const headers = { ...details.requestHeaders };
                    delete headers['origin'];
                    delete headers['referer'];
                    delete headers['host'];
                    delete headers['Origin'];
                    delete headers['Referer'];
                    delete headers['Host'];
                    delete headers['user-agent'];
                    delete headers['User-Agent'];
                    
                    // Log for debugging (only in development)
                    if (isDev) {
                        console.log(`[CORS] Removed origin headers for external API: ${details.url}`);
                    }
                    
                    callback({ requestHeaders: headers });
                } else {
                    // Keep headers for backend API calls
                    if (isDev) {
                        console.log(`[CORS] Keeping origin headers for backend API: ${details.url}`);
                    }
                    callback({ requestHeaders: details.requestHeaders });
                }
            } catch (error) {
                console.error('[CORS] Error in webRequest handler:', error);
                // If there's an error, just pass through the headers
                callback({ requestHeaders: details.requestHeaders });
            }
        }
    );
    
    // Also handle response headers to ensure CORS doesn't block
    ses.webRequest.onHeadersReceived(
        { urls: ['http://*/*', 'https://*/*'] },
        (details, callback) => {
            const url = details.url.toLowerCase();
            const isBackendApiCall = 
                url.includes('localhost:3001') || 
                url.includes('127.0.0.1:3001') ||
                url.includes('localhost:3000') ||
                url.includes('127.0.0.1:3000') ||
                url.includes('devbench.in/api/') ||
                url.includes('dev-api.devbench.in');
            
            // For external APIs, we can't modify response headers, but we can log
            if (!isBackendApiCall && isDev) {
                console.log(`[CORS] Response received for external API: ${details.url}`);
            }
            
            callback({ responseHeaders: details.responseHeaders });
        }
    );
}

// Configure auto-updater
if (isAutoUpdateEnabled()) {
    autoUpdater.setFeedURL({
        provider: 'github',
        owner: 'karthik-minnikanti',
        repo: 'devbench-kit',
    });
    
    // Platform-specific update settings
    if (process.platform === 'darwin') {
        // macOS: Works with DMG, but code signing recommended for best experience
        autoUpdater.allowPrerelease = false;
    } else if (process.platform === 'win32') {
        // Windows: Works with NSIS installer and portable
        autoUpdater.allowPrerelease = false;
    } else if (process.platform === 'linux') {
        // Linux: Limited support, works best with AppImage
        // Note: deb/rpm packages may have limited auto-update support
        autoUpdater.allowPrerelease = false;
    }
    
    autoUpdater.autoDownload = false; // Don't auto-download, let user decide
    autoUpdater.autoInstallOnAppQuit = true; // Install on app quit if downloaded
    
    // Update check interval (check every 4 hours)
    setInterval(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            checkForUpdatesSafely('interval');
        }
    }, 4 * 60 * 60 * 1000); // 4 hours
}

app.whenReady().then(async () => {
    await loadPersistedGitRepo();
    await createWindow();

    // Check for updates on startup (only in production)
    if (isAutoUpdateEnabled() && mainWindow) {
        // Wait a bit before checking to ensure window is ready
        setTimeout(() => {
            checkForUpdatesSafely('startup');
        }, 3000);
    }

    app.on('activate', async () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            await createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

function getUserDataPath(filename: string): string {
    return path.join(app.getPath('userData'), filename);
}

async function loadPersistedGitRepo(): Promise<void> {
    const savedPath = await gitRepoStore.getRepoPath();
    if (!savedPath) {
        return;
    }

    try {
        const stats = await fs.stat(savedPath);
        if (!stats.isDirectory()) {
            await gitRepoStore.clearRepoPath();
            return;
        }
    } catch {
        console.warn('[Git] Saved repository path no longer exists:', savedPath);
        await gitRepoStore.clearRepoPath();
        return;
    }

    const result = await fileStorage.initialize(savedPath);
    if (!result.success) {
        console.warn('[Git] Failed to restore saved repository:', result.error);
    }
}

async function persistGitRepoPath(repoPath: string): Promise<void> {
    await gitRepoStore.setRepoPath(repoPath);
}

// Window control handlers
ipcMain.handle('window:minimize', () => {
    if (mainWindow) {
        mainWindow.minimize();
    }
});

ipcMain.handle('window:maximize', () => {
    if (mainWindow) {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    }
});

ipcMain.handle('window:close', () => {
    if (mainWindow) {
        mainWindow.close();
    }
});

// Planner window handler
let plannerWindow: BrowserWindow | null = null;

ipcMain.handle('window:openPlanner', async () => {
    // If planner window already exists, focus it
    if (plannerWindow && !plannerWindow.isDestroyed()) {
        plannerWindow.focus();
        return;
    }

    // Resolve preload path
    let preloadPath = path.resolve(__dirname, 'preload.mjs');
    try {
        await fs.access(preloadPath);
    } catch {
        const alternatives = [
            path.resolve(__dirname, 'preload.js'),
            path.resolve(__dirname, 'preload.mjs'),
            path.join(__dirname, 'preload.js'),
            path.join(__dirname, 'preload.mjs'),
        ];
        for (const altPath of alternatives) {
            try {
                await fs.access(altPath);
                preloadPath = altPath;
                break;
            } catch {
                // Continue trying
            }
        }
    }

    plannerWindow = new BrowserWindow({
        width: 600,
        height: 800,
        show: false,
        title: 'Daily Planner - DevBench',
        webPreferences: {
            preload: preloadPath,
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
            webSecurity: true,
        },
        frame: true, // Show frame for draggability
        titleBarStyle: process.platform === 'darwin' ? 'default' : 'default',
        icon: path.join(__dirname, '../public/logo.svg'),
    });

    if (isDev) {
        plannerWindow.loadURL('http://localhost:5173/planner.html');
    } else {
        plannerWindow.loadFile(path.join(__dirname, '../dist/planner.html'));
    }

    plannerWindow.once('ready-to-show', () => {
        if (plannerWindow) {
            plannerWindow.show();
        }
    });

    plannerWindow.on('closed', () => {
        plannerWindow = null;
    });
});

// Planner update broadcast handler
ipcMain.handle('planner:broadcastUpdate', async (_event: any, date: string) => {
    // Broadcast to all windows (main window and planner window)
    const allWindows = BrowserWindow.getAllWindows();
    allWindows.forEach(window => {
        if (!window.isDestroyed()) {
            window.webContents.send('planner:update', date);
        }
    });
});

// OAuth window handler
ipcMain.handle('auth:openOAuth', async (_event: any, url: string) => {
    return new Promise((resolve, reject) => {
        const oauthWindow = new BrowserWindow({
            width: 500,
            height: 600,
            show: true,
            modal: true,
            parent: mainWindow || undefined,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
            },
        });

        oauthWindow.loadURL(url);

        // Intercept navigation BEFORE it happens to catch callback URLs
        oauthWindow.webContents.on('will-navigate', (event: any, navigationUrl: string) => {
            if (handleOAuthCallback(navigationUrl, oauthWindow, resolve, reject)) {
                event.preventDefault(); // Prevent navigation if callback was handled
            }
        });

        // Monitor redirects for callback URL
        oauthWindow.webContents.on('will-redirect', (event: any, navigationUrl: string) => {
            if (handleOAuthCallback(navigationUrl, oauthWindow, resolve, reject)) {
                event.preventDefault(); // Prevent redirect if callback was handled
            }
        });

        // Monitor for navigation changes (fallback)
        oauthWindow.webContents.on('did-navigate', (event: any, navigationUrl: string) => {
            handleOAuthCallback(navigationUrl, oauthWindow, resolve, reject);
        });

        // Also check when page finishes loading (fallback)
        oauthWindow.webContents.on('did-finish-load', () => {
            const currentUrl = oauthWindow.webContents.getURL();
            handleOAuthCallback(currentUrl, oauthWindow, resolve, reject);
        });

        // Handle window close
        oauthWindow.on('closed', () => {
            reject(new Error('OAuth window was closed'));
        });

        // Timeout after 5 minutes
        setTimeout(() => {
            if (!oauthWindow.isDestroyed()) {
                oauthWindow.close();
                reject(new Error('OAuth timeout'));
            }
        }, 5 * 60 * 1000);
    });
});

function handleOAuthCallback(url: string, oauthWindow: BrowserWindow, resolve: (value: string) => void, reject: (error: Error) => void): boolean {
    try {
        const urlObj = new URL(url);
        console.log('[OAuth] Checking URL:', url);

        const isCallback =
            urlObj.protocol === 'devbench:' ||
            urlObj.pathname.includes('/auth/callback') ||
            urlObj.searchParams.has('token');

        // Check if this is the callback URL with a token
        if (isCallback) {
            const token = urlObj.searchParams.get('token');
            if (token) {
                console.log('[OAuth] Token received, closing window');
                oauthWindow.close();
                resolve(token);
                return true; // Indicate that callback was handled
            } else if (urlObj.pathname.includes('/auth/error')) {
                console.log('[OAuth] Error callback received');
                oauthWindow.close();
                reject(new Error('OAuth authentication failed'));
                return true; // Indicate that callback was handled
            }
        }
    } catch (error) {
        // URL parsing failed, ignore
        console.error('[OAuth] Error parsing URL:', error);
    }
    return false; // Callback was not handled
}

// File save dialog handler
ipcMain.handle('dialog:saveFile', async (_event: any, options: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) => {
    if (!mainWindow) {
        return { canceled: true };
    }

    try {
        const result = await dialog.showSaveDialog(mainWindow, {
            defaultPath: options.defaultPath || 'uml-diagram.png',
            filters: options.filters || [
                { name: 'PNG Image', extensions: ['png'] },
                { name: 'All Files', extensions: ['*'] },
            ],
        });

        return result;
    } catch (error) {
        console.error('Save dialog error:', error);
        return { canceled: true, error: String(error) };
    }
});

// File write handler for saving images
ipcMain.handle('file:writeImage', async (_event: any, filePath: string, base64Data: string) => {
    try {
        const buffer = Buffer.from(base64Data, 'base64');
        await fs.writeFile(filePath, buffer);
        return { success: true };
    } catch (error) {
        return { success: false, error: String(error) };
    }
});

// Config handlers
ipcMain.handle('config:get', async () => {
    try {
        const configPath = getUserDataPath('config.json');
        const data = await fs.readFile(configPath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        return { theme: 'light' as const };
    }
});

ipcMain.handle('config:set', async (_event: any, config: any) => {
    try {
        const configPath = getUserDataPath('config.json');
        await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
        return { success: true };
    } catch (error) {
        return { success: false, error: String(error) };
    }
});

// History handlers
ipcMain.handle('history:get', async () => {
    try {
        const historyPath = getUserDataPath('history.json');
        const data = await fs.readFile(historyPath, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        return { entries: [] };
    }
});

ipcMain.handle('history:add', async (_event: any, entry: any) => {
    try {
        const historyPath = getUserDataPath('history.json');
        let history: { entries: any[] };

        try {
            const data = await fs.readFile(historyPath, 'utf-8');
            history = JSON.parse(data);
        } catch {
            history = { entries: [] };
        }

        history.entries.unshift({
            ...entry,
            timestamp: new Date().toISOString(),
        });

        if (history.entries.length > 100) {
            history.entries = history.entries.slice(0, 100);
        }

        await fs.writeFile(historyPath, JSON.stringify(history, null, 2), 'utf-8');
        return { success: true };
    } catch (error) {
        return { success: false, error: String(error) };
    }
});

// Project handlers
ipcMain.handle('project:open', async () => {
    if (!mainWindow) return { success: false, error: 'No window' };

    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
            { name: 'DevBench Projects', extensions: ['devbench'] },
            { name: 'All Files', extensions: ['*'] },
        ],
    });

    if (result.canceled) {
        return { success: false, canceled: true };
    }

    try {
        const filePath = result.filePaths[0];
        const data = await fs.readFile(filePath, 'utf-8');
        const project = JSON.parse(data);
        return { success: true, project, filePath };
    } catch (error) {
        return { success: false, error: String(error) };
    }
});

ipcMain.handle('project:save', async (_event: any, project: any, filePath?: string) => {
    if (!mainWindow) return { success: false, error: 'No window' };

    let targetPath = filePath;

    if (!targetPath) {
        const result = await dialog.showSaveDialog(mainWindow, {
            filters: [
                { name: 'DevBench Projects', extensions: ['devbench'] },
            ],
            defaultPath: 'project.devbench',
        });

        if (result.canceled) {
            return { success: false, canceled: true };
        }

        targetPath = result.filePath || '';
        if (targetPath && !targetPath.endsWith('.devbench')) {
            targetPath += '.devbench';
        }
    }

    try {
        await fs.writeFile(targetPath, JSON.stringify(project, null, 2), 'utf-8');
        return { success: true, filePath: targetPath };
    } catch (error) {
        return { success: false, error: String(error) };
    }
});

// License handlers
ipcMain.handle('license:validate', async (_event: any, licenseKey?: string) => {
    const configPath = getUserDataPath('config.json');
    let config: any;

    try {
        const data = await fs.readFile(configPath, 'utf-8');
        config = JSON.parse(data);
    } catch {
        config = {
            theme: 'light',
            licenseStatus: 'free',
            dailyGenerations: 0,
            lastGenerationDate: null,
        };
    }

    if (licenseKey && licenseKey.trim().length > 0) {
        config.licenseStatus = 'pro';
        config.licenseKey = licenseKey;
        await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

        if (mainWindow) {
            mainWindow.webContents.send('license:validated', { status: 'pro' });
        }

        return { success: true, status: 'pro' };
    }

    const today = new Date().toDateString();
    const lastDate = config.lastGenerationDate;

    if (lastDate !== today) {
        config.dailyGenerations = 0;
        config.lastGenerationDate = today;
    }

    const isWithinLimit = config.dailyGenerations < 10;

    if (mainWindow) {
        if (isWithinLimit) {
            mainWindow.webContents.send('license:validated', {
                status: 'free',
                remaining: 10 - config.dailyGenerations
            });
        } else {
            mainWindow.webContents.send('license:invalid', {
                message: 'Daily limit reached. Upgrade to Pro for unlimited generations.'
            });
        }
    }

    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

    return {
        success: isWithinLimit,
        status: 'free',
        remaining: isWithinLimit ? 10 - config.dailyGenerations : 0
    };
});

// Snippets handlers
ipcMain.handle('snippets:get', async () => {
    try {
        const snippetsPath = getUserDataPath('snippets.json');
        try {
            const data = await fs.readFile(snippetsPath, 'utf-8');
            return JSON.parse(data);
        } catch {
            return { snippets: [] };
        }
    } catch (error) {
        return { snippets: [] };
    }
});

ipcMain.handle('snippets:save', async (_event: any, snippet: any, id?: string) => {
    try {
        const snippetsPath = getUserDataPath('snippets.json');
        let snippetsData: { snippets: any[] };

        try {
            const data = await fs.readFile(snippetsPath, 'utf-8');
            snippetsData = JSON.parse(data);
        } catch {
            snippetsData = { snippets: [] };
        }

        const now = new Date().toISOString();
        if (id) {
            const index = snippetsData.snippets.findIndex(s => s.id === id);
            if (index >= 0) {
                snippetsData.snippets[index] = {
                    ...snippetsData.snippets[index],
                    ...snippet,
                    updatedAt: now,
                };
            } else {
                return { success: false, error: 'Snippet not found' };
            }
        } else {
            const newSnippet = {
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                ...snippet,
                createdAt: now,
                updatedAt: now,
            };
            snippetsData.snippets.push(newSnippet);
        }

        await fs.writeFile(snippetsPath, JSON.stringify(snippetsData, null, 2), 'utf-8');
        const savedSnippet = id
            ? snippetsData.snippets.find(s => s.id === id)
            : snippetsData.snippets[snippetsData.snippets.length - 1];

        return { success: true, snippet: savedSnippet };
    } catch (error) {
        return { success: false, error: String(error) };
    }
});

ipcMain.handle('snippets:delete', async (_event: any, id: string) => {
    try {
        const snippetsPath = getUserDataPath('snippets.json');
        let snippetsData: { snippets: any[] };

        try {
            const data = await fs.readFile(snippetsPath, 'utf-8');
            snippetsData = JSON.parse(data);
        } catch {
            return { success: false };
        }

        snippetsData.snippets = snippetsData.snippets.filter(s => s.id !== id);
        await fs.writeFile(snippetsPath, JSON.stringify(snippetsData, null, 2), 'utf-8');
        return { success: true };
    } catch (error) {
        return { success: false, error: String(error) };
    }
});

ipcMain.handle('snippets:load', async (_event: any, id: string) => {
    try {
        const snippetsPath = getUserDataPath('snippets.json');
        const data = await fs.readFile(snippetsPath, 'utf-8');
        const snippetsData = JSON.parse(data);
        const snippet = snippetsData.snippets.find((s: any) => s.id === id);
        return { success: true, snippet: snippet || null };
    } catch (error) {
        return { success: false, error: String(error) };
    }
});

// NPM package handlers
ipcMain.handle('npm:install', async (_event: any, packageName: string) => {
    try {
        const userDataDir = app.getPath('userData');
        const packageJsonPath = path.join(userDataDir, 'package.json');

        try {
            await fs.access(packageJsonPath);
        } catch {
            await fs.writeFile(packageJsonPath, JSON.stringify({
                name: 'schema-studio-snippets',
                version: '1.0.0',
                dependencies: {}
            }, null, 2), 'utf-8');
        }

        const { stdout, stderr } = await execAsync(
            `npm install ${packageName} --save`,
            { cwd: userDataDir }
        );

        return { success: true, output: stdout, error: stderr || null };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('npm:list', async () => {
    try {
        const userDataDir = app.getPath('userData');
        const packageJsonPath = path.join(userDataDir, 'package.json');
        try {
            const data = await fs.readFile(packageJsonPath, 'utf-8');
            const packageJson = JSON.parse(data);
            return { success: true, packages: Object.keys(packageJson.dependencies || {}) };
        } catch {
            return { success: true, packages: [] };
        }
    } catch (error) {
        return { success: false, error: String(error) };
    }
});

// JavaScript execution handler
function formatJsRunnerArg(value: unknown): string {
    if (value === undefined) return 'undefined';
    if (value === null) return 'null';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
        return String(value);
    }
    if (typeof value === 'symbol') return value.toString();
    if (typeof value === 'function') return value.toString();
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value, null, 2);
        } catch {
            try {
                const nodeRequire = createRequire(import.meta.url);
                const util = nodeRequire('util') as typeof import('util');
                return util.inspect(value, { depth: 5, colors: false, breakLength: 120 });
            } catch {
                return Object.prototype.toString.call(value);
            }
        }
    }
    return String(value);
}

function createJsRunnerConsole(consoleOutput: string[]) {
    const write = (prefix: string, args: unknown[]) => {
        const line = args.map(formatJsRunnerArg).join(' ');
        consoleOutput.push(prefix ? `${prefix}${line}` : line);
    };

    return {
        log: (...args: unknown[]) => write('', args),
        info: (...args: unknown[]) => write('INFO: ', args),
        warn: (...args: unknown[]) => write('WARN: ', args),
        error: (...args: unknown[]) => write('ERROR: ', args),
        debug: (...args: unknown[]) => write('DEBUG: ', args),
    };
}

function createJsRunnerSandboxPromise(
    nativePromise: PromiseConstructor,
    pending: Set<Promise<unknown>>,
): PromiseConstructor {
    let suppressTracking = false;

    const track = <T>(promise: Promise<T>): Promise<T> => {
        pending.add(promise as Promise<unknown>);
        suppressTracking = true;
        try {
            nativePromise.prototype.then.call(
                promise,
                () => {
                    pending.delete(promise as Promise<unknown>);
                },
                () => {
                    pending.delete(promise as Promise<unknown>);
                },
            );
        } finally {
            suppressTracking = false;
        }
        return promise;
    };

    class TrackedPromise extends nativePromise<unknown> {
        constructor(
            executor: (
                resolve: (value: unknown) => void,
                reject: (reason?: unknown) => void,
            ) => void,
        ) {
            super(executor);
            if (!suppressTracking) {
                track(this);
            }
        }
    }

    TrackedPromise.all = ((...args: Parameters<typeof nativePromise.all>) =>
        track(nativePromise.all(...args))) as typeof Promise.all;
    TrackedPromise.race = ((...args: Parameters<typeof nativePromise.race>) =>
        track(nativePromise.race(...args))) as typeof Promise.race;
    TrackedPromise.allSettled = ((...args: Parameters<typeof nativePromise.allSettled>) =>
        track(nativePromise.allSettled(...args))) as typeof Promise.allSettled;
    TrackedPromise.resolve = ((value?: unknown) =>
        track(nativePromise.resolve(value))) as typeof Promise.resolve;
    TrackedPromise.reject = ((reason?: unknown) =>
        track(nativePromise.reject(reason))) as typeof Promise.reject;
    const nativeAny = (nativePromise as PromiseConstructor & { any?: typeof Promise.all }).any;
    if (typeof nativeAny === 'function') {
        (TrackedPromise as PromiseConstructor & { any?: typeof Promise.all }).any = ((
            ...args: Parameters<typeof nativeAny>
        ) => track(nativeAny(...args))) as typeof Promise.all;
    }

    return TrackedPromise as typeof Promise;
}

async function waitForJsRunnerPendingPromises(
    pending: Set<Promise<unknown>>,
    deadlineAt: number,
    nativePromise: PromiseConstructor,
    timeoutMs: number,
) {
    if (pending.size === 0) {
        return;
    }

    const remainingMs = () => Math.max(0, deadlineAt - Date.now());
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
        await nativePromise.race([
            nativePromise.allSettled([...pending]),
            new nativePromise<void>((_, reject) => {
                const scheduleTimeout = () => {
                    const ms = remainingMs();
                    if (ms <= 0) {
                        reject(
                            new Error(
                                `Execution timeout after ${timeoutMs}ms while waiting for async work to finish`,
                            ),
                        );
                        return;
                    }
                    timeoutId = setTimeout(scheduleTimeout, Math.min(ms, 50));
                };
                scheduleTimeout();
            }),
        ]);
    } finally {
        if (timeoutId !== undefined) {
            clearTimeout(timeoutId);
        }
        pending.clear();
    }
}

ipcMain.handle('jsRunner:execute', async (_event: any, code: string, timeoutMs: number = 5000) => {
    const startTime = Date.now();
    let output = '';
    let error: string | null = null;

    try {
        const userDataDir = app.getPath('userData');
        const userNodeModulesPath = path.join(userDataDir, 'node_modules');

        const consoleOutput: string[] = [];
        const pendingPromises = new Set<Promise<unknown>>();

        const customConsole = createJsRunnerConsole(consoleOutput);

        // Create a require function for ES module context
        // Use a dummy file path in userData to create require relative to that directory
        const dummyFilePath = path.join(userDataDir, 'dummy.js');
        const nodeRequire = createRequire(dummyFilePath);
        const Module = nodeRequire('module');

        // Create a custom require function that resolves modules from userData/node_modules
        const customRequire = (moduleName: string) => {
            try {
                // First try to resolve from user's node_modules
                const resolvedPath = Module._resolveFilename(moduleName, {
                    id: userDataDir,
                    filename: path.join(userDataDir, 'index.js'),
                    paths: [userNodeModulesPath, userDataDir, ...Module._nodeModulePaths(userDataDir)],
                });
                return nodeRequire(resolvedPath);
            } catch (err: any) {
                try {
                    // Try with the userData require function
                    return nodeRequire(moduleName);
                } catch (e) {
                    // Last resort: try with the main process require
                    try {
                        const mainRequire = createRequire(import.meta.url);
                        return mainRequire(moduleName);
                    } catch (e2) {
                        throw new Error(`Cannot find module '${moduleName}'. Install it using: npm install ${moduleName}`);
                    }
                }
            }
        };

        const previousConsole = global.console;
        const previousStdoutWrite = process.stdout.write.bind(process.stdout);
        const previousStderrWrite = process.stderr.write.bind(process.stderr);

        const captureStreamWrite = (chunk: unknown) => {
            const text =
                typeof chunk === 'string'
                    ? chunk
                    : Buffer.isBuffer(chunk)
                      ? chunk.toString('utf8')
                      : String(chunk);
            if (text.trim()) {
                for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
                    if (line.trim()) {
                        consoleOutput.push(line);
                    }
                }
            }
            return true;
        };

        const sandbox: vm.Context = {
            console: customConsole,
            require: customRequire,
            setTimeout,
            clearTimeout,
            setInterval,
            clearInterval,
            setImmediate,
            clearImmediate,
            Buffer,
            process,
            URL,
            URLSearchParams,
            TextEncoder,
            TextDecoder,
        };
        sandbox.Promise = createJsRunnerSandboxPromise(Promise, pendingPromises);
        sandbox.global = sandbox;

        const wrappedCode = `"use strict";\n(async () => {\n${code}\n})();`;
        const script = new vm.Script(wrappedCode, {
            filename: path.join(userDataDir, 'js-runner.js'),
        });

        const executePromise = (async () => {
            global.console = customConsole as unknown as Console;
            process.stdout.write = captureStreamWrite as typeof process.stdout.write;
            process.stderr.write = captureStreamWrite as typeof process.stderr.write;

            try {
                const returnValue = await script.runInNewContext(sandbox, {
                    timeout: timeoutMs,
                });
                if (returnValue !== undefined) {
                    consoleOutput.push(formatJsRunnerArg(returnValue));
                }

                await waitForJsRunnerPendingPromises(
                    pendingPromises,
                    startTime + timeoutMs,
                    Promise,
                    timeoutMs,
                );
            } finally {
                global.console = previousConsole;
                process.stdout.write = previousStdoutWrite;
                process.stderr.write = previousStderrWrite;
            }
        })();

        const timeoutPromise = new Promise<void>((_, reject) => {
            setTimeout(() => reject(new Error(`Execution timeout after ${timeoutMs}ms`)), timeoutMs);
        });

        await Promise.race([executePromise, timeoutPromise]);
        output = consoleOutput.join('\n').trim();
        if (!output && !error) {
            output = 'Code executed successfully (no output)';
        }
    } catch (err) {
        error = err instanceof Error ? err.message : String(err);
    }

    const executionTime = Date.now() - startTime;

    return {
        output,
        error,
        executionTime,
    };
});

// Initialize Docker service on startup
(async () => {
    try {
        await dockerService.initialize();
    } catch (error) {
        console.warn('Docker service not available:', error);
    }
})();

// Docker handlers
ipcMain.handle('docker:list', async () => {
    try {
        await dockerService.initialize();
        const containers = await dockerService.getContainers(true);
        // Convert to legacy format for compatibility
        const legacyContainers = containers.map(c => ({
            ID: c.id,
            Names: c.name,
            Image: c.image,
            Status: c.status,
            State: c.state,
            CreatedAt: c.startedAt?.toISOString() || '',
            Ports: c.portBindings.map(p => `${p.hostPort || ''}:${p.containerPort}`).join(', '),
        }));
        return { success: true, containers: legacyContainers };
    } catch (error: any) {
        return { success: false, error: error.message || String(error), containers: [] };
    }
});

ipcMain.handle('docker:logs', async (_event: any, containerId: string, tail: number = 100) => {
    return new Promise((resolve) => {
        const logs: string[] = [];
        const logProcess = spawn('docker', ['logs', '--tail', String(tail), '--follow', containerId]);

        logProcess.stdout.on('data', (data) => {
            const lines = data.toString().split('\n').filter((line: string) => line.trim());
            lines.forEach((line: string) => {
                logs.push(line);
                if (mainWindow) {
                    mainWindow.webContents.send('docker:log', { containerId, line });
                }
            });
        });

        logProcess.stderr.on('data', (data) => {
            const line = data.toString();
            logs.push(`ERROR: ${line}`);
            if (mainWindow) {
                mainWindow.webContents.send('docker:log', { containerId, line: `ERROR: ${line}` });
            }
        });

        logProcess.on('error', (error) => {
            resolve({ success: false, error: error.message });
        });

        // Store process reference for cleanup
        (logProcess as any).containerId = containerId;
        if (!(global as any).dockerLogProcesses) {
            (global as any).dockerLogProcesses = new Map();
        }
        (global as any).dockerLogProcesses.set(containerId, logProcess);

        resolve({ success: true, processId: containerId });
    });
});

ipcMain.handle('docker:stopLogs', async (_event: any, containerId: string) => {
    try {
        const processes = (global as any).dockerLogProcesses;
        if (processes && processes.has(containerId)) {
            const process = processes.get(containerId);
            process.kill();
            processes.delete(containerId);
            return { success: true };
        }
        return { success: false, error: 'Log process not found' };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('docker:start', async (_event: any, containerId: string) => {
    try {
        await dockerService.initialize();
        await dockerService.startContainer(containerId);
        return { success: true, output: 'Container started', error: null };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('docker:stop', async (_event: any, containerId: string) => {
    try {
        await dockerService.initialize();
        await dockerService.stopContainer(containerId);
        return { success: true, output: 'Container stopped', error: null };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('docker:restart', async (_event: any, containerId: string) => {
    try {
        await dockerService.initialize();
        await dockerService.restartContainer(containerId);
        return { success: true, output: 'Container restarted', error: null };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('docker:exec', async (_event: any, containerId: string, initialCommand: string) => {
    return new Promise((resolve) => {
        // Start an interactive shell session
        const execProcess = spawn('docker', ['exec', '-i', containerId, 'sh'], {
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        // Store initial command to send after process starts
        (execProcess as any).initialCommand = initialCommand;

        execProcess.stdout.on('data', (data) => {
            if (mainWindow) {
                mainWindow.webContents.send('docker:exec:output', { containerId, data: data.toString() });
            }
        });

        execProcess.stderr.on('data', (data) => {
            if (mainWindow) {
                mainWindow.webContents.send('docker:exec:output', { containerId, data: data.toString() });
            }
        });

        execProcess.on('error', (error) => {
            resolve({ success: false, error: error.message });
        });

        execProcess.on('exit', (code) => {
            if (mainWindow) {
                mainWindow.webContents.send('docker:exec:exit', { containerId, code });
            }
        });

        // Send initial command if provided
        if (initialCommand.trim()) {
            // Wait a bit for shell to be ready, then send initial command
            setTimeout(() => {
                execProcess.stdin.write(initialCommand + '\n');
            }, 100);
        }

        // Store process reference
        if (!(global as any).dockerExecProcesses) {
            (global as any).dockerExecProcesses = new Map();
        }
        (global as any).dockerExecProcesses.set(containerId, execProcess);

        resolve({ success: true, processId: containerId });
    });
});

ipcMain.handle('docker:exec:input', async (_event: any, containerId: string, input: string) => {
    try {
        const processes = (global as any).dockerExecProcesses;
        if (processes && processes.has(containerId)) {
            const process = processes.get(containerId);
            process.stdin.write(input);
            return { success: true };
        }
        return { success: false, error: 'Exec process not found' };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('docker:exec:stop', async (_event: any, containerId: string) => {
    try {
        const processes = (global as any).dockerExecProcesses;
        if (processes && processes.has(containerId)) {
            const process = processes.get(containerId);
            process.kill();
            processes.delete(containerId);
            return { success: true };
        }
        return { success: false, error: 'Exec process not found' };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('docker:shell', async (_event: any, containerId: string, shell: string = '/bin/sh') => {
    return new Promise((resolve) => {
        const shellProcess = spawn('docker', ['exec', '-i', containerId, shell], {
            stdio: ['pipe', 'pipe', 'pipe'],
        });

        shellProcess.stdout.on('data', (data) => {
            if (mainWindow) {
                mainWindow.webContents.send('docker:shell:output', { containerId, data: data.toString() });
            }
        });

        shellProcess.stderr.on('data', (data) => {
            if (mainWindow) {
                mainWindow.webContents.send('docker:shell:output', { containerId, data: data.toString() });
            }
        });

        shellProcess.on('error', (error) => {
            resolve({ success: false, error: error.message });
        });

        // Store process reference
        if (!(global as any).dockerShellProcesses) {
            (global as any).dockerShellProcesses = new Map();
        }
        (global as any).dockerShellProcesses.set(containerId, shellProcess);

        resolve({ success: true, processId: containerId });
    });
});

ipcMain.handle('docker:shell:input', async (_event: any, containerId: string, input: string) => {
    try {
        const processes = (global as any).dockerShellProcesses;
        if (processes && processes.has(containerId)) {
            const process = processes.get(containerId);
            process.stdin.write(input);
            return { success: true };
        }
        return { success: false, error: 'Shell process not found' };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('docker:shell:stop', async (_event: any, containerId: string) => {
    try {
        const processes = (global as any).dockerShellProcesses;
        if (processes && processes.has(containerId)) {
            const process = processes.get(containerId);
            process.kill();
            processes.delete(containerId);
            return { success: true };
        }
        return { success: false, error: 'Shell process not found' };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

// New intelligent Docker handlers
ipcMain.handle('docker:diagnose', async (_event: any, containerId: string) => {
    try {
        await dockerService.initialize();
        const diagnostic = await dockerService.diagnoseContainer(containerId);
        return { success: true, diagnostic };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('docker:analyze-exit', async (_event: any, containerId: string) => {
    try {
        await dockerService.initialize();
        const analysis = await dockerService.analyzeContainerExit(containerId);
        return { success: true, analysis };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('docker:stats', async (_event: any, containerId: string) => {
    try {
        await dockerService.initialize();
        const stats = await dockerService.getContainerStats(containerId);
        return { success: true, stats };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('docker:analyze-image', async (_event: any, imageId: string) => {
    try {
        await dockerService.initialize();
        const analysis = await dockerService.analyzeImage(imageId);
        return { success: true, analysis };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('docker:analyze-networking', async (_event: any, containerId: string) => {
    try {
        await dockerService.initialize();
        const analysis = await dockerService.analyzeNetworking(containerId);
        return { success: true, analysis };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('docker:search', async (_event: any, query: { image?: string; status?: string; name?: string; exited?: boolean }) => {
    try {
        await dockerService.initialize();
        const containers = await dockerService.searchContainers(query);
        return { success: true, containers };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('docker:container-info', async (_event: any, containerId: string) => {
    try {
        await dockerService.initialize();
        const containers = await dockerService.getContainers(true);
        const container = containers.find(c => c.id === containerId || c.id.startsWith(containerId));
        return { success: true, container };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('docker:analyze-compose', async (_event: any, composePath?: string) => {
    try {
        await dockerService.initialize();
        const analysis = await dockerService.analyzeCompose(composePath);
        return { success: true, analysis };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

// Images handlers
ipcMain.handle('docker:images', async () => {
    try {
        await dockerService.initialize();
        const images = await dockerService.getImages();
        return { success: true, images };
    } catch (error: any) {
        return { success: false, error: error.message || String(error), images: [] };
    }
});

ipcMain.handle('docker:pullImage', async (_event: any, imageName: string) => {
    try {
        await dockerService.initialize();
        await dockerService.pullImage(imageName);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('docker:removeImage', async (_event: any, imageId: string, force: boolean = false) => {
    try {
        await dockerService.initialize();
        await dockerService.removeImage(imageId, force);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('docker:inspectImage', async (_event: any, imageId: string) => {
    try {
        await dockerService.initialize();
        const image = await dockerService.inspectImage(imageId);
        return { success: true, image };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

// Volumes handlers
ipcMain.handle('docker:volumes', async () => {
    try {
        await dockerService.initialize();
        const volumes = await dockerService.getVolumes();
        return { success: true, volumes };
    } catch (error: any) {
        return { success: false, error: error.message || String(error), volumes: [] };
    }
});

ipcMain.handle('docker:createVolume', async (_event: any, name: string, driver?: string, options?: Record<string, string>) => {
    try {
        await dockerService.initialize();
        const volume = await dockerService.createVolume(name, driver, options);
        return { success: true, volume };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('docker:removeVolume', async (_event: any, volumeName: string) => {
    try {
        await dockerService.initialize();
        await dockerService.removeVolume(volumeName);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('docker:inspectVolume', async (_event: any, volumeName: string) => {
    try {
        await dockerService.initialize();
        const volume = await dockerService.inspectVolume(volumeName);
        return { success: true, volume };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

// Networks handlers
ipcMain.handle('docker:networks', async () => {
    try {
        await dockerService.initialize();
        const networks = await dockerService.getNetworks();
        return { success: true, networks };
    } catch (error: any) {
        return { success: false, error: error.message || String(error), networks: [] };
    }
});

ipcMain.handle('docker:createNetwork', async (_event: any, name: string, driver: string = 'bridge', options?: Record<string, any>) => {
    try {
        await dockerService.initialize();
        const network = await dockerService.createNetwork(name, driver, options);
        return { success: true, network };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('docker:removeNetwork', async (_event: any, networkId: string) => {
    try {
        await dockerService.initialize();
        await dockerService.removeNetwork(networkId);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('docker:inspectNetwork', async (_event: any, networkId: string) => {
    try {
        await dockerService.initialize();
        const network = await dockerService.inspectNetwork(networkId);
        return { success: true, network };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

// Additional container actions
ipcMain.handle('docker:pause', async (_event: any, containerId: string) => {
    try {
        await dockerService.initialize();
        await dockerService.pauseContainer(containerId);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('docker:unpause', async (_event: any, containerId: string) => {
    try {
        await dockerService.initialize();
        await dockerService.unpauseContainer(containerId);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('docker:remove', async (_event: any, containerId: string, force: boolean = false) => {
    try {
        await dockerService.initialize();
        await dockerService.removeContainer(containerId, force);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('docker:listFiles', async (_event: any, containerId: string, path: string = '/') => {
    try {
        await dockerService.initialize();
        const files = await dockerService.listContainerFiles(containerId, path);
        return { success: true, files };
    } catch (error: any) {
        return { success: false, error: error.message || String(error), files: [] };
    }
});

// Initialize K8s service on startup (will retry on first use if it fails)
let k8sInitialized = false;

function getKubectlContextArgs(active?: { kubeconfigPath?: string; context?: string } | null): string[] {
    const args: string[] = [];
    if (active?.kubeconfigPath) {
        args.push('--kubeconfig', active.kubeconfigPath);
    }
    try {
        const context = active?.context || k8sService.getCurrentContext();
        if (context) {
            args.push('--context', context);
        }
    } catch {
        /* ignore */
    }
    return args;
}

async function activateK8sFromStore(clusterId?: string) {
    if (clusterId) {
        await k8sClusterStore.setActiveCluster(clusterId);
    } else {
        await k8sClusterStore.ensureDefaultCluster();
    }

    const active = await k8sClusterStore.getActiveCluster();
    if (active) {
        await k8sService.initialize(active.kubeconfigPath, active.context);
        k8sInitialized = true;
        return active;
    }

    await k8sService.initialize();
    k8sInitialized = true;
    return null;
}

async function authenticateActiveK8sCluster() {
    await activateK8sFromStore();
    return k8sService.ensureAuthenticated();
}

// Kubernetes cluster registry handlers
ipcMain.handle('k8s:clusters:list', async () => {
    try {
        await k8sClusterStore.ensureDefaultCluster();
        const clusters = await k8sClusterStore.listClusters();
        const active = await k8sClusterStore.getActiveCluster();
        return { success: true, clusters, activeClusterId: active?.id ?? null };
    } catch (error: any) {
        return { success: false, error: error.message || String(error), clusters: [], activeClusterId: null };
    }
});

ipcMain.handle('k8s:clusters:getActive', async () => {
    try {
        const cluster = await k8sClusterStore.getActiveCluster();
        return { success: true, cluster };
    } catch (error: any) {
        return { success: false, error: error.message || String(error), cluster: null };
    }
});

ipcMain.handle('k8s:clusters:add', async (_event: any, payload: {
    name: string;
    configPath: string;
    context: string;
    defaultNamespace?: string;
}) => {
    try {
        const cluster = await k8sClusterStore.addCluster(
            payload.name,
            payload.configPath,
            payload.context,
            payload.defaultNamespace
        );
        await k8sService.initialize(cluster.kubeconfigPath, cluster.context);
        k8sInitialized = true;
        return { success: true, cluster };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('k8s:clusters:activate', async (_event: any, clusterId: string) => {
    try {
        const cluster = await activateK8sFromStore(clusterId);
        const auth = await k8sService.ensureAuthenticated();
        return { success: auth.success, cluster, auth };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('k8s:clusters:remove', async (_event: any, clusterId: string) => {
    try {
        await k8sClusterStore.removeCluster(clusterId);
        const active = await activateK8sFromStore();
        return { success: true, activeCluster: active };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('k8s:clusters:update', async (_event: any, payload: {
    id: string;
    name?: string;
    context?: string;
    defaultNamespace?: string;
}) => {
    try {
        const cluster = await k8sClusterStore.updateCluster(payload.id, {
            name: payload.name,
            context: payload.context,
            defaultNamespace: payload.defaultNamespace,
        });
        const active = await k8sClusterStore.getActiveCluster();
        if (active?.id === cluster.id) {
            await k8sService.initialize(cluster.kubeconfigPath, cluster.context);
            k8sInitialized = true;
        }
        return { success: true, cluster };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('k8s:pickKubeconfig', async () => {
    if (!mainWindow) {
        return { success: false, error: 'No window' };
    }

    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
            { name: 'Kubeconfig', extensions: ['yaml', 'yml', 'conf', 'config'] },
            { name: 'All Files', extensions: ['*'] },
        ],
    });

    if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true };
    }

    const filePath = result.filePaths[0];
    try {
        const contexts = k8sService.getContextsFromFile(filePath);
        const defaultContext = k8sService.getDefaultContextFromFile(filePath);
        return { success: true, filePath, contexts, defaultContext };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('k8s:contextsFromFile', async (_event: any, configPath: string) => {
    try {
        const contexts = k8sService.getContextsFromFile(configPath);
        const defaultContext = k8sService.getDefaultContextFromFile(configPath);
        return { success: true, contexts, defaultContext };
    } catch (error: any) {
        return { success: false, error: error.message || String(error), contexts: [] };
    }
});

// Kubernetes handlers
ipcMain.handle('k8s:contexts', async () => {
    try {
        await activateK8sFromStore();
        const contexts = k8sService.getContexts();
        return { success: true, contexts };
    } catch (error: any) {
        return { success: false, error: error.message || String(error), contexts: [] };
    }
});

ipcMain.handle('k8s:current-context', async () => {
    try {
        await activateK8sFromStore();
        const context = k8sService.getCurrentContext();
        const active = await k8sClusterStore.getActiveCluster();
        return { success: true, context, activeCluster: active, error: null };
    } catch (error: any) {
        return { success: false, error: error.message || String(error), context: null };
    }
});

ipcMain.handle('k8s:use-context', async (_event: any, context: string) => {
    try {
        await activateK8sFromStore();
        k8sService.setContext(context);
        const active = await k8sClusterStore.getActiveCluster();
        if (active) {
            await k8sClusterStore.updateCluster(active.id, { context });
        }
        const auth = await k8sService.ensureAuthenticated();
        return {
            success: auth.success,
            output: auth.success ? `Switched to context: ${context}` : undefined,
            error: auth.error ?? null,
            auth,
        };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('k8s:authenticate', async () => {
    try {
        k8sService.invalidateAuth();
        const auth = await authenticateActiveK8sCluster();
        return { success: auth.success, auth };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('k8s:import-config', async (_event: any, configPath: string) => {
    try {
        const contexts = k8sService.getContextsFromFile(configPath);
        const context = k8sService.getDefaultContextFromFile(configPath) || contexts[0];
        if (!context) {
            return { success: false, error: 'No contexts found in kubeconfig' };
        }
        const name = path.basename(configPath).replace(/\.(yaml|yml|conf|config)$/i, '') || context;
        const cluster = await k8sClusterStore.addCluster(name, configPath, context);
        await k8sService.initialize(cluster.kubeconfigPath, cluster.context);
        k8sInitialized = true;
        return { success: true, cluster };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('k8s:pods', async (_event: any, namespace?: string, options?: { metrics?: boolean }) => {
    try {
        await activateK8sFromStore();
        const pods = await k8sService.getPods(namespace);
        const metrics = options?.metrics ? await k8sService.getPodMetrics(namespace) : {};
        return { success: true, pods: pods.map(p => p), metrics };
    } catch (error: any) {
        return { success: false, error: error.message || String(error), pods: [], metrics: {} };
    }
});

ipcMain.handle('k8s:namespaces', async () => {
    try {
        await activateK8sFromStore();
        const namespaces = await k8sService.getNamespaces();
        return { success: true, namespaces: namespaces.map(ns => ns) };
    } catch (error: any) {
        return { success: false, error: error.message || String(error), namespaces: [] };
    }
});

// PTY terminal handlers (full interactive terminal via xterm + node-pty)
ipcMain.handle('terminal:create', async (event, options) => {
    try {
        if (options?.kind === 'k8s') {
            const active = await activateK8sFromStore();
            options.kubectlContextArgs = getKubectlContextArgs(active);
            if (active?.kubeconfigPath) {
                options.kubeconfigPath = active.kubeconfigPath;
            }
        }
        return terminalService.create(event.sender, options);
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('terminal:write', async (_event, sessionId: string, data: string) => {
    return terminalService.write(sessionId, data);
});

ipcMain.handle('terminal:resize', async (_event, sessionId: string, cols: number, rows: number) => {
    return terminalService.resize(sessionId, cols, rows);
});

ipcMain.handle('terminal:destroy', async (_event, sessionId: string) => {
    return terminalService.destroy(sessionId);
});

ipcMain.handle('terminal:history:addCommand', async (_event, scope: string, command: string) => {
    try {
        await terminalHistoryStore.addCommand(scope, command);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('terminal:history:getCommands', async (_event, scope: string, query?: string, limit?: number) => {
    try {
        const commands = await terminalHistoryStore.getCommands(scope, query ?? '', limit ?? 100);
        return { success: true, commands };
    } catch (error: any) {
        return { success: false, error: error.message || String(error), commands: [] };
    }
});

ipcMain.handle('terminal:history:clearCommands', async (_event, scope?: string) => {
    try {
        await terminalHistoryStore.clearCommands(scope);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('terminal:history:addSession', async (_event, session: any) => {
    try {
        const now = new Date().toISOString();
        await terminalHistoryStore.addSession({
            id: session.id,
            title: session.title,
            scope: session.scope,
            kind: session.kind,
            config: session.config ?? {},
            startedAt: now,
            lastActiveAt: now,
        });
        const saved = (await terminalHistoryStore.listSessions(1)).find((s) => s.id === session.id);
        return { success: true, session: saved ?? session };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('terminal:history:listSessions', async (_event, limit?: number) => {
    try {
        const sessions = await terminalHistoryStore.listSessions(limit ?? 30);
        return { success: true, sessions };
    } catch (error: any) {
        return { success: false, error: error.message || String(error), sessions: [] };
    }
});

ipcMain.handle('terminal:history:touchSession', async (_event, id: string) => {
    try {
        const session = await terminalHistoryStore.updateSession(id, {
            lastActiveAt: new Date().toISOString(),
            closedAt: undefined,
        });
        return { success: true, session };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle(
    'terminal:history:updateSession',
    async (_event, id: string, patch: { title?: string }) => {
        try {
            const session = await terminalHistoryStore.updateSession(id, {
                ...patch,
                lastActiveAt: new Date().toISOString(),
            });
            return { success: true, session };
        } catch (error: any) {
            return { success: false, error: error.message || String(error) };
        }
    },
);

ipcMain.handle('terminal:history:closeSession', async (_event, id: string) => {
    try {
        const session = await terminalHistoryStore.updateSession(id, {
            closedAt: new Date().toISOString(),
        });
        return { success: true, session };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('terminal:history:removeSession', async (_event, id: string) => {
    try {
        await terminalHistoryStore.removeSession(id);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('k8s:logs', async (_event: any, podName: string, namespace: string, tail: number = 100, container?: string) => {
    try {
        await activateK8sFromStore();
        // For streaming logs, we still use kubectl for now (K8s client doesn't support streaming easily)
        // But we can get initial logs from the service
        const initialLogs = await k8sService.getPodLogs(podName, namespace, container, tail);
        
        // Send initial logs
        if (mainWindow && initialLogs) {
            const lines = initialLogs.split('\n');
            lines.forEach((line: string) => {
                if (line.trim()) {
                    mainWindow!.webContents.send('k8s:log', { podName, namespace, line });
                }
            });
        }

        // Start streaming with kubectl (for now - can be improved later)
        return new Promise((resolve) => {
            const logProcess = spawn(
                kubectlPath(),
                [...getKubectlContextArgs(), 'logs', '-f', `--tail=${tail}`, podName, '-n', namespace, ...(container ? ['-c', container] : [])],
                { env: kubectlSpawnEnv() },
            );

            logProcess.stdout.on('data', (data) => {
                const lines = data.toString().split('\n').filter((line: string) => line.trim());
                lines.forEach((line: string) => {
                    if (mainWindow) {
                        mainWindow.webContents.send('k8s:log', { podName, namespace, line });
                    }
                });
            });

            logProcess.stderr.on('data', (data) => {
                const line = data.toString();
                if (mainWindow) {
                    mainWindow.webContents.send('k8s:log', { podName, namespace, line: `ERROR: ${line}` });
                }
            });

            logProcess.on('error', (error) => {
                resolve({ success: false, error: error.message });
            });

            const processId = `${namespace}/${podName}`;
            if (!(global as any).k8sLogProcesses) {
                (global as any).k8sLogProcesses = new Map();
            }
            (global as any).k8sLogProcesses.set(processId, logProcess);

            resolve({ success: true, processId });
        });
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('k8s:stop-logs', async (_event: any, podName: string, namespace: string) => {
    try {
        const processId = `${namespace}/${podName}`;
        const processes = (global as any).k8sLogProcesses;
        if (processes && processes.has(processId)) {
            const process = processes.get(processId);
            process.kill();
            processes.delete(processId);
            return { success: true };
        }
        return { success: false, error: 'Log process not found' };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

function getK8sPortForwardMap(): Map<string, import('child_process').ChildProcess> {
    if (!(global as any).k8sPortForwardProcesses) {
        (global as any).k8sPortForwardProcesses = new Map();
    }
    return (global as any).k8sPortForwardProcesses;
}

function k8sPortForwardId(namespace: string, podName: string, localPort: number): string {
    return `${namespace}/${podName}:${localPort}`;
}

ipcMain.handle(
    'k8s:port-forward',
    async (
        _event: any,
        podName: string,
        namespace: string,
        localPort: number,
        remotePort: number,
        address: string = '127.0.0.1',
    ) => {
        try {
            await activateK8sFromStore();
            const forwardId = k8sPortForwardId(namespace, podName, localPort);
            const map = getK8sPortForwardMap();
            if (map.has(forwardId)) {
                return { success: false, error: 'Port forward already active for this local port' };
            }

            if (localPort > 0 && localPort < 1024) {
                const suggested = localPort === 80 ? 8080 : localPort === 443 ? 8443 : localPort + 10000;
                return {
                    success: false,
                    error: `Local port ${localPort} requires admin rights. Try ${suggested} instead (forwards to pod port ${remotePort}).`,
                };
            }

            const pfArgs = [
                ...getKubectlContextArgs(),
                'port-forward',
                '--address',
                address,
                `pod/${podName}`,
                '-n',
                namespace,
                `${localPort}:${remotePort}`,
            ];

            return await new Promise<{
                success: boolean;
                forwardId?: string;
                localPort?: number;
                remotePort?: number;
                address?: string;
                error?: string;
            }>((resolve) => {
                const pfProcess = spawn(kubectlPath(), pfArgs, { env: kubectlSpawnEnv() });
                let settled = false;
                let stderrBuf = '';

                const finish = (result: {
                    success: boolean;
                    forwardId?: string;
                    localPort?: number;
                    remotePort?: number;
                    address?: string;
                    error?: string;
                }) => {
                    if (settled) return;
                    settled = true;
                    clearTimeout(readyTimeout);
                    resolve(result);
                };

                const readyTimeout = setTimeout(() => {
                    if (pfProcess.exitCode !== null) return;
                    map.set(forwardId, pfProcess);
                    finish({ success: true, forwardId, localPort, remotePort, address });
                }, 500);

                pfProcess.stderr.on('data', (data) => {
                    const message = data.toString();
                    stderrBuf += message;
                    const trimmed = message.trim();
                    if (mainWindow && trimmed) {
                        mainWindow.webContents.send('k8s:port-forward:message', { forwardId, message: trimmed });
                    }
                    if (
                        trimmed.includes('Unable to listen') ||
                        trimmed.includes('unable to forward') ||
                        trimmed.includes('not found') ||
                        trimmed.includes('error:') ||
                        trimmed.includes('Error from server')
                    ) {
                        pfProcess.kill();
                        map.delete(forwardId);
                        finish({ success: false, error: trimmed });
                    } else if (trimmed.includes('Forwarding from')) {
                        map.set(forwardId, pfProcess);
                        finish({ success: true, forwardId, localPort, remotePort, address });
                    }
                });

                pfProcess.on('error', (error) => {
                    map.delete(forwardId);
                    finish({ success: false, error: error.message });
                    if (mainWindow) {
                        mainWindow.webContents.send('k8s:port-forward:exit', {
                            forwardId,
                            error: error.message,
                        });
                    }
                });

                pfProcess.on('exit', (code) => {
                    map.delete(forwardId);
                    const errorMessage =
                        code !== 0 && code !== null
                            ? stderrBuf.trim() || `Port forward exited with code ${code}`
                            : undefined;
                    if (!settled) {
                        finish({ success: false, error: errorMessage || 'Port forward failed to start' });
                    }
                    if (mainWindow) {
                        mainWindow.webContents.send('k8s:port-forward:exit', {
                            forwardId,
                            exitCode: code ?? undefined,
                            error: errorMessage,
                        });
                    }
                });
            });
        } catch (error: any) {
            return { success: false, error: error.message || String(error) };
        }
    },
);

ipcMain.handle('k8s:stop-port-forward', async (_event: any, forwardId: string) => {
    try {
        const map = getK8sPortForwardMap();
        if (map.has(forwardId)) {
            map.get(forwardId)!.kill();
            map.delete(forwardId);
            return { success: true };
        }
        return { success: false, error: 'Port forward not found' };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('k8s:stop-pod-port-forwards', async (_event: any, podName: string, namespace: string) => {
    try {
        const prefix = `${namespace}/${podName}:`;
        const map = getK8sPortForwardMap();
        for (const [id, proc] of map.entries()) {
            if (id.startsWith(prefix)) {
                proc.kill();
                map.delete(id);
            }
        }
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('k8s:exec', async (_event: any, podName: string, namespace: string, initialCommand: string) => {
    return new Promise((resolve) => {
        // Start an interactive shell session
        const execProcess = spawn(
            kubectlPath(),
            [...getKubectlContextArgs(), 'exec', '-i', podName, '-n', namespace, '--', 'sh'],
            { stdio: ['pipe', 'pipe', 'pipe'], env: kubectlSpawnEnv() },
        );

        // Store initial command to send after process starts
        (execProcess as any).initialCommand = initialCommand;

        execProcess.stdout.on('data', (data) => {
            if (mainWindow) {
                mainWindow.webContents.send('k8s:exec:output', { podName, namespace, data: data.toString() });
            }
        });

        execProcess.stderr.on('data', (data) => {
            if (mainWindow) {
                mainWindow.webContents.send('k8s:exec:output', { podName, namespace, data: data.toString() });
            }
        });

        execProcess.on('error', (error) => {
            resolve({ success: false, error: error.message });
        });

        execProcess.on('exit', (code) => {
            if (mainWindow) {
                mainWindow.webContents.send('k8s:exec:exit', { podName, namespace, code });
            }
        });

        // Send initial command if provided
        if (initialCommand.trim()) {
            // Wait a bit for shell to be ready, then send initial command
            setTimeout(() => {
                execProcess.stdin.write(initialCommand + '\n');
            }, 100);
        }

        const processId = `${namespace}/${podName}`;
        if (!(global as any).k8sExecProcesses) {
            (global as any).k8sExecProcesses = new Map();
        }
        (global as any).k8sExecProcesses.set(processId, execProcess);

        resolve({ success: true, processId });
    });
});

ipcMain.handle('k8s:exec:input', async (_event: any, podName: string, namespace: string, input: string) => {
    try {
        const processId = `${namespace}/${podName}`;
        const processes = (global as any).k8sExecProcesses;
        if (processes && processes.has(processId)) {
            const process = processes.get(processId);
            process.stdin.write(input);
            return { success: true };
        }
        return { success: false, error: 'Exec process not found' };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('k8s:exec:stop', async (_event: any, podName: string, namespace: string) => {
    try {
        const processId = `${namespace}/${podName}`;
        const processes = (global as any).k8sExecProcesses;
        if (processes && processes.has(processId)) {
            const process = processes.get(processId);
            process.kill();
            processes.delete(processId);
            return { success: true };
        }
        return { success: false, error: 'Exec process not found' };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('k8s:shell', async (_event: any, podName: string, namespace: string, shell: string = '/bin/sh') => {
    return new Promise((resolve) => {
        const shellProcess = spawn(
            kubectlPath(),
            [...getKubectlContextArgs(), 'exec', '-i', podName, '-n', namespace, '--', shell],
            { stdio: ['pipe', 'pipe', 'pipe'], env: kubectlSpawnEnv() },
        );

        shellProcess.stdout.on('data', (data) => {
            if (mainWindow) {
                mainWindow.webContents.send('k8s:shell:output', { podName, namespace, data: data.toString() });
            }
        });

        shellProcess.stderr.on('data', (data) => {
            if (mainWindow) {
                mainWindow.webContents.send('k8s:shell:output', { podName, namespace, data: data.toString() });
            }
        });

        shellProcess.on('error', (error) => {
            resolve({ success: false, error: error.message });
        });

        const processId = `${namespace}/${podName}`;
        if (!(global as any).k8sShellProcesses) {
            (global as any).k8sShellProcesses = new Map();
        }
        (global as any).k8sShellProcesses.set(processId, shellProcess);

        resolve({ success: true, processId });
    });
});

ipcMain.handle('k8s:shell:input', async (_event: any, podName: string, namespace: string, input: string) => {
    try {
        const processId = `${namespace}/${podName}`;
        const processes = (global as any).k8sShellProcesses;
        if (processes && processes.has(processId)) {
            const process = processes.get(processId);
            process.stdin.write(input);
            return { success: true };
        }
        return { success: false, error: 'Shell process not found' };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('k8s:shell:stop', async (_event: any, podName: string, namespace: string) => {
    try {
        const processId = `${namespace}/${podName}`;
        const processes = (global as any).k8sShellProcesses;
        if (processes && processes.has(processId)) {
            const process = processes.get(processId);
            process.kill();
            processes.delete(processId);
            return { success: true };
        }
        return { success: false, error: 'Shell process not found' };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('k8s:command', async (_event: any, command: string) => {
    try {
        await activateK8sFromStore();
        const contextArgs = getKubectlContextArgs().join(' ');
        const { stdout, stderr } = await execAsync(
            `"${kubectlPath()}" ${contextArgs} ${command}`.replace(/\s+/g, ' ').trim(),
            { env: kubectlSpawnEnv() },
        );
        return { success: !stderr, output: stdout, error: stderr || null };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

// New intelligent K8s handlers
ipcMain.handle('k8s:diagnose', async (_event: any, podName: string, namespace: string) => {
    try {
        await activateK8sFromStore();
        const diagnostic = await k8sService.diagnosePod(podName, namespace);
        return { success: true, diagnostic };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('k8s:timeline', async (_event: any, namespace: string, podName?: string) => {
    try {
        await activateK8sFromStore();
        const timeline = await k8sService.getTimeline(namespace, podName);
        return { success: true, timeline };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('k8s:dependency-graph', async (_event: any, namespace: string) => {
    try {
        await activateK8sFromStore();
        const graph = await k8sService.getDependencyGraph(namespace);
        return { success: true, graph };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('k8s:events', async (_event: any, namespace?: string, fieldSelector?: string) => {
    try {
        await activateK8sFromStore();
        const events = await k8sService.getEvents(namespace, fieldSelector);
        return { success: true, events };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('k8s:search', async (_event: any, query: { image?: string; envVar?: string; labelSelector?: string; namespace?: string }) => {
    try {
        await activateK8sFromStore();
        const results = await k8sService.search(query);
        return { success: true, results };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('k8s:scale', async (_event: any, name: string, namespace: string, replicas: number, environment?: string) => {
    try {
        await activateK8sFromStore();
        await k8sService.scaleDeployment(name, namespace, replicas, environment);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('k8s:restart-pod', async (_event: any, name: string, namespace: string, environment?: string) => {
    try {
        await activateK8sFromStore();
        const result = await k8sService.restartPod(name, namespace, environment);
        return { success: true, ...result };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('k8s:rollout-restart', async (_event: any, name: string, namespace: string, environment?: string) => {
    try {
        await activateK8sFromStore();
        await k8sService.rolloutRestart(name, namespace, environment);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('k8s:deployments', async (_event: any, namespace?: string) => {
    try {
        await activateK8sFromStore();
        const deployments = await k8sService.getDeployments(namespace);
        return { success: true, deployments: deployments.map(d => d) };
    } catch (error: any) {
        return { success: false, error: error.message || String(error), deployments: [] };
    }
});

ipcMain.handle('k8s:services', async (_event: any, namespace?: string) => {
    try {
        await activateK8sFromStore();
        const services = await k8sService.getServices(namespace);
        return { success: true, services: services.map(s => s) };
    } catch (error: any) {
        return { success: false, error: error.message || String(error), services: [] };
    }
});

ipcMain.handle('k8s:configmaps', async (_event: any, namespace?: string) => {
    try {
        await activateK8sFromStore();
        const configMaps = await k8sService.getConfigMaps(namespace);
        return { success: true, configMaps: configMaps.map(cm => cm) };
    } catch (error: any) {
        return { success: false, error: error.message || String(error), configMaps: [] };
    }
});

ipcMain.handle('k8s:secrets', async (_event: any, namespace?: string) => {
    try {
        await activateK8sFromStore();
        const secrets = await k8sService.getSecrets(namespace);
        return { success: true, secrets: secrets.map(s => s) };
    } catch (error: any) {
        return { success: false, error: error.message || String(error), secrets: [] };
    }
});

ipcMain.handle('k8s:secret-data', async (_event: any, namespace: string, name: string) => {
    try {
        await activateK8sFromStore();
        const data = await k8sService.getSecretData(namespace, name);
        return { success: true, data };
    } catch (error: any) {
        return { success: false, error: error.message || String(error), data: {} };
    }
});

ipcMain.handle('k8s:nodes', async () => {
    try {
        await activateK8sFromStore();
        const nodes = await k8sService.getNodes();
        return { success: true, nodes: nodes.map(n => n) };
    } catch (error: any) {
        return { success: false, error: error.message || String(error), nodes: [] };
    }
});

ipcMain.handle('k8s:statefulsets', async (_event: any, namespace?: string) => {
    try {
        await activateK8sFromStore();
        const statefulSets = await k8sService.getStatefulSets(namespace);
        return { success: true, statefulSets: statefulSets.map(s => s) };
    } catch (error: any) {
        return { success: false, error: error.message || String(error), statefulSets: [] };
    }
});

ipcMain.handle('k8s:jobs', async (_event: any, namespace?: string) => {
    try {
        await activateK8sFromStore();
        const jobs = await k8sService.getJobs(namespace);
        return { success: true, jobs: jobs.map(j => j) };
    } catch (error: any) {
        return { success: false, error: error.message || String(error), jobs: [] };
    }
});

ipcMain.handle('k8s:cronjobs', async (_event: any, namespace?: string) => {
    try {
        await activateK8sFromStore();
        const cronJobs = await k8sService.getCronJobs(namespace);
        return { success: true, cronJobs: cronJobs.map(c => c) };
    } catch (error: any) {
        return { success: false, error: error.message || String(error), cronJobs: [] };
    }
});

ipcMain.handle('k8s:ingresses', async (_event: any, namespace?: string) => {
    try {
        await activateK8sFromStore();
        const ingresses = await k8sService.getIngresses(namespace);
        return { success: true, ingresses: ingresses.map(i => i) };
    } catch (error: any) {
        return { success: false, error: error.message || String(error), ingresses: [] };
    }
});

ipcMain.handle('k8s:daemonsets', async (_event: any, namespace?: string) => {
    try {
        await activateK8sFromStore();
        const daemonSets = await k8sService.getDaemonSets(namespace);
        return { success: true, daemonSets: daemonSets.map(d => d) };
    } catch (error: any) {
        return { success: false, error: error.message || String(error), daemonSets: [] };
    }
});

ipcMain.handle('k8s:replicasets', async (_event: any, namespace?: string) => {
    try {
        await activateK8sFromStore();
        const replicaSets = await k8sService.getReplicaSets(namespace);
        return { success: true, replicaSets: replicaSets.map(r => r) };
    } catch (error: any) {
        return { success: false, error: error.message || String(error), replicaSets: [] };
    }
});

ipcMain.handle('k8s:previous-logs', async (_event: any, podName: string, namespace: string, container?: string, tail: number = 100) => {
    try {
        await activateK8sFromStore();
        const logs = await k8sService.getPreviousPodLogs(podName, namespace, container, tail);
        return { success: true, logs };
    } catch (error: any) {
        return { success: false, error: error.message || String(error), logs: '' };
    }
});

// Notes handlers
ipcMain.handle('notes:list', async () => {
    try {
        if (!fileStorage.isInitialized()) {
            return { success: true, notes: [] };
        }
        const notes = await fileStorage.getNotes();
        return { success: true, notes };
    } catch (error: any) {
        return { success: false, error: error.message || String(error), notes: [] };
    }
});

ipcMain.handle('notes:save', async (_event: any, note: any) => {
    try {
        if (!fileStorage.isInitialized()) {
            return { success: false, error: 'File storage not initialized' };
        }
        const result = await fileStorage.saveNote(note);
        if (result.success) {
            return { success: true, note: result.note };
        }
        return result;
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('notes:delete', async (_event: any, noteId: string) => {
    try {
        if (!fileStorage.isInitialized()) {
            return { success: false, error: 'File storage not initialized' };
        }
        return await fileStorage.deleteNote(noteId);
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('notes:load', async (_event: any, noteId: string) => {
    try {
        if (!fileStorage.isInitialized()) {
            return { success: true, note: null };
        }
        const notes = await fileStorage.getNotes();
        const note = notes.find((n: any) => String(n.id || n._id || '') === String(noteId));
        return { success: true, note: note || null };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

// Drawings handlers
ipcMain.handle('drawings:list', async () => {
    try {
        if (!fileStorage.isInitialized()) {
            return { success: true, drawings: [] };
        }
        const drawings = await fileStorage.getDrawings();
        return { success: true, drawings };
    } catch (error: any) {
        return { success: false, error: error.message || String(error), drawings: [] };
    }
});

ipcMain.handle('drawings:save', async (_event: any, drawing: any) => {
    try {
        if (!fileStorage.isInitialized()) {
            return { success: false, error: 'File storage not initialized' };
        }
        const result = await fileStorage.saveDrawing(drawing);
        if (result.success) {
            return { success: true, drawing: result.drawing };
        }
        return result;
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('drawings:delete', async (_event: any, drawingId: string) => {
    try {
        if (!fileStorage.isInitialized()) {
            return { success: false, error: 'File storage not initialized' };
        }
        return await fileStorage.deleteDrawing(drawingId);
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('drawings:load', async (_event: any, drawingId: string) => {
    try {
        if (!fileStorage.isInitialized()) {
            return { success: true, drawing: null };
        }
        const drawing = await fileStorage.getDrawing(drawingId);
        return { success: true, drawing: drawing || null };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

// Git handlers
ipcMain.handle('git:getRepoPath', async () => {
    try {
        const repoPath = gitService.getRepoPath();
        return { success: true, repoPath };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('git:pickRepoPath', async () => {
    if (!mainWindow) {
        return { success: false, error: 'No window' };
    }

    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory', 'createDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
        return { success: false, canceled: true };
    }

    return { success: true, repoPath: result.filePaths[0] };
});

ipcMain.handle('git:setRepoPath', async (_event: any, repoPath: string) => {
    try {
        const result = await fileStorage.initialize(repoPath);
        if (result.success) {
            await persistGitRepoPath(repoPath);
        }
        return result;
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('git:initRepo', async (_event: any, repoPath: string) => {
    try {
        const result = await gitService.initialize(repoPath);
        if (result.success) {
            const storageResult = await fileStorage.initialize(repoPath);
            if (storageResult.success) {
                await persistGitRepoPath(repoPath);
                return result;
            }
            return storageResult;
        }
        return result;
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('git:checkIfRepo', async (_event: any, repoPath: string) => {
    try {
        const isRepo = await gitService.checkIfRepo(repoPath);
        return { success: true, isRepo };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('git:sync', async (_event: any, filePaths?: string[], commitMessage?: string) => {
    try {
        if (!gitService.isInitialized()) {
            return { success: false, error: 'Git not initialized' };
        }
        if (!filePaths || filePaths.length === 0) {
            return await gitService.syncAll(commitMessage);
        }
        return await gitService.sync(filePaths, commitMessage);
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('git:getSyncState', async () => {
    try {
        const state = await gitService.getSyncState();
        return { success: true, state };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('git:retryPendingSync', async () => {
    try {
        if (!gitService.isInitialized()) {
            return { success: false, error: 'Git not initialized' };
        }
        return await gitService.retryPendingSync();
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('git:status', async () => {
    try {
        const status = await gitService.getStatus();
        return { success: true, status };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('git:pull', async () => {
    try {
        if (!gitService.isInitialized()) {
            return { success: false, error: 'Git not initialized' };
        }
        const result = await gitService.pull();
        return result;
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

// Folders handlers
ipcMain.handle('folders:get', async (_event: any, parentId?: string | null) => {
    try {
        if (!fileStorage.isInitialized()) {
            return { success: true, folders: [] };
        }
        const folders = await fileStorage.getFolders();
        // Filter by parentId on client side (fileStorage doesn't support parentId filtering yet)
        const filtered = parentId !== undefined 
            ? folders.filter((f: any) => {
                if (parentId === null) {
                    return !f.parentId || f.parentId === null;
                }
                return f.parentId === parentId;
            })
            : folders;
        return { success: true, folders: filtered };
    } catch (error: any) {
        return { success: false, error: error.message || String(error), folders: [] };
    }
});

ipcMain.handle('folders:save', async (_event: any, folder: any) => {
    try {
        if (!fileStorage.isInitialized()) {
            return { success: false, error: 'File storage not initialized' };
        }
        const result = await fileStorage.saveFolder(folder);
        if (result.success) {
            return { success: true, folder: result.folder };
        }
        return result;
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('folders:delete', async (_event: any, folderId: string) => {
    try {
        if (!fileStorage.isInitialized()) {
            return { success: false, error: 'File storage not initialized' };
        }
        return await fileStorage.deleteFolder(folderId);
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

// Planner handlers
ipcMain.handle('planner:get', async (_event: any, date: string) => {
    try {
        if (!fileStorage.isInitialized()) {
            return { success: true, entry: null };
        }
        const entry = await fileStorage.getPlannerEntry(date);
        return { success: true, entry: entry || null };
    } catch (error: any) {
        return { success: false, error: error.message || String(error), entry: null };
    }
});

ipcMain.handle('planner:save', async (_event: any, entry: any) => {
    try {
        if (!fileStorage.isInitialized()) {
            return { success: false, error: 'File storage not initialized' };
        }
        const result = await fileStorage.savePlannerEntry(entry);
        if (result.success) {
            return { success: true, entry: result.entry };
        }
        return result;
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('planner:delete', async (_event: any, date: string) => {
    try {
        if (!fileStorage.isInitialized()) {
            return { success: false, error: 'File storage not initialized' };
        }
        return await fileStorage.deletePlannerEntry(date);
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('planner:getEntries', async (_event: any, startDate?: string, endDate?: string) => {
    try {
        if (!fileStorage.isInitialized()) {
            return { success: true, entries: [] };
        }
        const entries = await fileStorage.getPlannerEntries(startDate, endDate);
        return { success: true, entries };
    } catch (error: any) {
        return { success: false, error: error.message || String(error), entries: [] };
    }
});

// Habit handlers
ipcMain.handle('habits:getAll', async () => {
    try {
        if (!fileStorage.isInitialized()) {
            return { success: true, habits: [] };
        }
        const habits = await fileStorage.getAllHabits();
        return { success: true, habits };
    } catch (error: any) {
        return { success: false, error: error.message || String(error), habits: [] };
    }
});

ipcMain.handle('habits:get', async (_event: any, habitId: string) => {
    try {
        if (!fileStorage.isInitialized()) {
            return { success: true, habit: null };
        }
        const habit = await fileStorage.getHabit(habitId);
        return { success: true, habit: habit || null };
    } catch (error: any) {
        return { success: false, error: error.message || String(error), habit: null };
    }
});

ipcMain.handle('habits:save', async (_event: any, habit: any) => {
    try {
        if (!fileStorage.isInitialized()) {
            return { success: false, error: 'File storage not initialized' };
        }
        const result = await fileStorage.saveHabit(habit);
        if (result.success) {
            return { success: true, habit: result.habit };
        }
        return result;
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('habits:delete', async (_event: any, habitId: string) => {
    try {
        if (!fileStorage.isInitialized()) {
            return { success: false, error: 'File storage not initialized' };
        }
        return await fileStorage.deleteHabit(habitId);
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('habits:getCompletions', async (_event: any, habitId: string, startDate?: string, endDate?: string) => {
    try {
        if (!fileStorage.isInitialized()) {
            return { success: true, completions: {} };
        }
        const completions = await fileStorage.getHabitCompletions(habitId, startDate, endDate);
        return { success: true, completions };
    } catch (error: any) {
        return { success: false, error: error.message || String(error), completions: {} };
    }
});

ipcMain.handle('habits:getAllCompletions', async (_event: any, startDate?: string, endDate?: string) => {
    try {
        if (!fileStorage.isInitialized()) {
            return { success: true, completions: {} };
        }
        const completions = await fileStorage.getAllHabitCompletions(startDate, endDate);
        return { success: true, completions };
    } catch (error: any) {
        return { success: false, error: error.message || String(error), completions: {} };
    }
});

ipcMain.handle('habits:setCompletion', async (_event: any, habitId: string, date: string, completed: boolean) => {
    try {
        if (!fileStorage.isInitialized()) {
            return { success: false, error: 'File storage not initialized' };
        }
        return await fileStorage.setHabitCompletion(habitId, date, completed);
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

// API Client handlers
ipcMain.handle('apiclient:get', async () => {
    try {
        if (!fileStorage.isInitialized()) {
            return { success: true, requests: [] };
        }
        const requests = await fileStorage.getApiRequests();
        return { success: true, requests };
    } catch (error: any) {
        return { success: false, error: error.message || String(error), requests: [] };
    }
});

ipcMain.handle('apiclient:getRequest', async (_event: any, id: string) => {
    try {
        if (!fileStorage.isInitialized()) {
            return { success: true, request: null };
        }
        const request = await fileStorage.getApiRequest(id);
        return { success: true, request };
    } catch (error: any) {
        return { success: false, error: error.message || String(error), request: null };
    }
});

ipcMain.handle('apiclient:saveRequest', async (_event: any, request: any) => {
    try {
        if (!fileStorage.isInitialized()) {
            return { success: false, error: 'File storage not initialized' };
        }
        return await fileStorage.saveApiRequest(request);
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('apiclient:deleteRequest', async (_event: any, id: string) => {
    try {
        if (!fileStorage.isInitialized()) {
            return { success: false, error: 'File storage not initialized' };
        }
        return await fileStorage.deleteApiRequest(id);
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('apiclient:save', async (_event: any, requests: any[]) => {
    try {
        if (!fileStorage.isInitialized()) {
            return { success: false, error: 'File storage not initialized' };
        }
        return await fileStorage.saveApiRequests(requests);
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

// API Client History handlers
ipcMain.handle('apiclient:getHistory', async () => {
    try {
        if (!fileStorage.isInitialized()) {
            return { success: false, error: 'File storage not initialized' };
        }
        const history = await fileStorage.getApiHistory();
        return { success: true, history };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('apiclient:saveHistory', async (_event: any, history: any[]) => {
    try {
        if (!fileStorage.isInitialized()) {
            return { success: false, error: 'File storage not initialized' };
        }
        return await fileStorage.saveApiHistory(history);
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

// API Client Console Logs handlers
ipcMain.handle('apiclient:getConsoleLogs', async () => {
    try {
        if (!fileStorage.isInitialized()) {
            return { success: false, error: 'File storage not initialized' };
        }
        const logs = await fileStorage.getApiConsoleLogs();
        return { success: true, logs };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('apiclient:saveConsoleLogs', async (_event: any, logs: any[]) => {
    try {
        if (!fileStorage.isInitialized()) {
            return { success: false, error: 'File storage not initialized' };
        }
        return await fileStorage.saveApiConsoleLogs(logs);
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

// API Client Environments handlers
ipcMain.handle('apiclient:getEnvironments', async () => {
    try {
        if (!fileStorage.isInitialized()) {
            return { success: false, error: 'File storage not initialized' };
        }
        const data = await fileStorage.getApiEnvironments();
        return { success: true, ...data };
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

ipcMain.handle('apiclient:saveEnvironments', async (_event: any, data: { environments: any[]; activeEnvironmentId: string | null }) => {
    try {
        if (!fileStorage.isInitialized()) {
            return { success: false, error: 'File storage not initialized' };
        }
        return await fileStorage.saveApiEnvironments(data);
    } catch (error: any) {
        return { success: false, error: error.message || String(error) };
    }
});

// IPC handler for API client requests - uses Node's http/https to bypass CORS
function rejectApiClientRequest(
    reject: (reason?: unknown) => void,
    message: string,
    code?: string,
) {
    const error = new Error(message) as NodeJS.ErrnoException;
    if (code) {
        error.code = code;
    }
    reject(error);
}

ipcMain.handle('api-client:request', async (_event: any, requestData: any) => {
    return new Promise((resolve, reject) => {
        try {
            const {
                method,
                url,
                headers = {},
                queryParams = [],
                bodyType,
                body: requestBody,
                formData,
                binaryData,
                timeout = 30000,
                sslVerification = true,
            } = requestData;

            // Validate URL
            if (!url || typeof url !== 'string') {
                return rejectApiClientRequest(reject, 'Invalid URL', 'EINVAL');
            }

            // Build final URL with query parameters
            let finalUrl = url;
            if (queryParams && Array.isArray(queryParams)) {
                const enabledParams = queryParams.filter((p: any) => p.enabled && p.key);
                if (enabledParams.length > 0) {
                    try {
                        const urlObj = new URL(url);
                        enabledParams.forEach((param: any) => {
                            urlObj.searchParams.set(param.key, param.value);
                        });
                        finalUrl = urlObj.toString();
                    } catch {
                        // Manual construction for relative URLs
                        const existingQueryIndex = url.indexOf('?');
                        const baseUrl = existingQueryIndex >= 0 ? url.substring(0, existingQueryIndex) : url;
                        const existingParams = existingQueryIndex >= 0
                            ? new URLSearchParams(url.substring(existingQueryIndex + 1))
                            : new URLSearchParams();

                        enabledParams.forEach((param: any) => {
                            existingParams.set(param.key, param.value);
                        });

                        const queryString = existingParams.toString();
                        finalUrl = queryString ? `${baseUrl}?${queryString}` : baseUrl;
                    }
                }
            }

            // Parse URL
            const urlObj = new URL(finalUrl);
            const isHttps = urlObj.protocol === 'https:';
            const client = isHttps ? https : http;

            // Prepare headers - remove origin-related headers
            const requestHeaders: Record<string, string> = { ...headers };
            delete requestHeaders['origin'];
            delete requestHeaders['referer'];
            delete requestHeaders['host'];
            delete requestHeaders['user-agent'];

            // Normalize Cookie header
            if (requestHeaders['cookie']) {
                requestHeaders['Cookie'] = requestHeaders['cookie'];
                delete requestHeaders['cookie'];
            }

            // Prepare request body
            let requestBodyData: Buffer | string | undefined = undefined;
            const contentType = requestHeaders['Content-Type'] || requestHeaders['content-type'] || '';

            if (bodyType === 'form-data' && formData && Array.isArray(formData)) {
                const boundary = `----WebKitFormBoundary${Math.random().toString(36).substring(2, 15)}`;
                const parts: Buffer[] = [];

                formData.forEach((field: any) => {
                    if (field.enabled && field.key) {
                        if (field.type === 'file' && field.value) {
                            try {
                                const base64Data = field.value.includes(',') ? field.value.split(',')[1] : field.value;
                                const buffer = Buffer.from(base64Data, 'base64');
                                const filename = field.key || 'file';
                                const contentType = field.value.match(/data:([^;]+)/)?.[1] || 'application/octet-stream';

                                parts.push(
                                    Buffer.from(
                                        `--${boundary}\r\n` +
                                        `Content-Disposition: form-data; name="${field.key}"; filename="${filename}"\r\n` +
                                        `Content-Type: ${contentType}\r\n\r\n`,
                                        'utf-8'
                                    )
                                );
                                parts.push(buffer);
                                parts.push(Buffer.from('\r\n', 'utf-8'));
                            } catch (e) {
                                console.error('Error processing file:', e);
                            }
                        } else {
                            parts.push(
                                Buffer.from(
                                    `--${boundary}\r\n` +
                                    `Content-Disposition: form-data; name="${field.key}"\r\n\r\n` +
                                    `${field.value}\r\n`,
                                    'utf-8'
                                )
                            );
                        }
                    }
                });

                parts.push(Buffer.from(`--${boundary}--\r\n`, 'utf-8'));
                requestBodyData = Buffer.concat(parts);
                requestHeaders['Content-Type'] = `multipart/form-data; boundary=${boundary}`;
            } else if (bodyType === 'x-www-form-urlencoded' && formData && Array.isArray(formData)) {
                const params = new URLSearchParams();
                formData.forEach((field: any) => {
                    if (field.enabled && field.type === 'text' && field.key) {
                        params.append(field.key, field.value);
                    }
                });
                requestBodyData = params.toString();
                requestHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
            } else if (bodyType === 'binary' && binaryData) {
                try {
                    const base64Data = binaryData.includes(',') ? binaryData.split(',')[1] : binaryData;
                    requestBodyData = Buffer.from(base64Data, 'base64');
                    requestHeaders['Content-Type'] = 'application/octet-stream';
                } catch (e) {
                    return rejectApiClientRequest(reject, 'Invalid binary data', 'EINVAL');
                }
            } else if (bodyType === 'raw' || bodyType === 'json') {
                requestBodyData = requestBody;
                if (bodyType === 'json' && !contentType.includes('application/json')) {
                    requestHeaders['Content-Type'] = 'application/json';
                }
            } else if (requestBody) {
                requestBodyData = requestBody;
            }

            // Make the request
            const startTime = Date.now();
            const options: https.RequestOptions & { hostname: string; port: string | number; path: string; method: string; headers: Record<string, string> } = {
                hostname: urlObj.hostname,
                port: urlObj.port || (isHttps ? 443 : 80),
                path: urlObj.pathname + urlObj.search,
                method,
                headers: requestHeaders,
            };

            if (isHttps) {
                options.rejectUnauthorized = sslVerification !== false;
            }

            const req = client.request(options, (res) => {
                const responseHeaders: Record<string, string> = {};
                Object.keys(res.headers).forEach((key) => {
                    const value = res.headers[key];
                    if (value) {
                        responseHeaders[key] = Array.isArray(value) ? value.join(', ') : value;
                    }
                });

                const chunks: Buffer[] = [];
                res.on('data', (chunk) => {
                    chunks.push(chunk);
                });

                res.on('end', () => {
                    const time = Date.now() - startTime;
                    const responseBuffer = Buffer.concat(chunks);
                    const responseContentType = res.headers['content-type'] || '';
                    const contentTypeLower = responseContentType.toLowerCase();

                    let responseData: any;

                    // Check if it's binary data
                    const isBinary = contentTypeLower.startsWith('image/') ||
                        contentTypeLower.startsWith('application/octet-stream') ||
                        contentTypeLower.includes('application/pdf') ||
                        contentTypeLower.includes('video/') ||
                        contentTypeLower.includes('audio/');

                    if (isBinary) {
                        // Binary data - convert to base64 data URL
                        responseData = `data:${responseContentType || 'application/octet-stream'};base64,${responseBuffer.toString('base64')}`;
                    } else {
                        const responseText = responseBuffer.toString('utf-8');

                        if (contentTypeLower.includes('application/json') || contentTypeLower.includes('application/vnd.api+json')) {
                            try {
                                responseData = JSON.parse(responseText);
                            } catch {
                                responseData = responseText;
                            }
                        } else if (contentTypeLower.includes('text/html') ||
                            contentTypeLower.includes('text/') ||
                            contentTypeLower.includes('application/xml') ||
                            contentTypeLower.includes('text/xml') ||
                            contentTypeLower.includes('application/javascript')) {
                            responseData = responseText;
                        } else {
                            // Try to detect JSON
                            const trimmedText = responseText.trim();
                            if ((trimmedText.startsWith('{') && trimmedText.endsWith('}')) ||
                                (trimmedText.startsWith('[') && trimmedText.endsWith(']'))) {
                                try {
                                    responseData = JSON.parse(responseText);
                                } catch {
                                    responseData = responseText;
                                }
                            } else {
                                responseData = responseText;
                            }
                        }
                    }

                    resolve({
                        status: res.statusCode || 200,
                        statusText: res.statusMessage || 'OK',
                        headers: responseHeaders,
                        data: responseData,
                        time,
                    });
                });
            });

            req.on('error', (error: any) => {
                // Extract specific error information
                const errorCode = error.code || '';
                const errorMessage = error.message || 'Request failed';
                
                // Create a more descriptive error message
                let errorMsg = errorMessage;
                if (errorCode) {
                    // Map common error codes to user-friendly messages
                    const errorCodeMap: Record<string, string> = {
                        'ECONNREFUSED': 'Connection refused - The server refused the connection',
                        'ENOTFOUND': 'Host not found - DNS lookup failed',
                        'ETIMEDOUT': 'Connection timeout - The server did not respond in time',
                        'ECONNRESET': 'Connection reset - The connection was closed by the server',
                        'EHOSTUNREACH': 'Host unreachable - The host cannot be reached',
                        'EAI_AGAIN': 'DNS lookup failed - Temporary DNS resolution failure',
                        'EPIPE': 'Broken pipe - Connection was closed unexpectedly',
                        'ECANCELED': 'Request canceled',
                    };
                    
                    const friendlyMessage = errorCodeMap[errorCode] || errorCode;
                    errorMsg = `${friendlyMessage} (${errorCode})`;
                }
                
                // Ensure we're rejecting with a serializable object
                rejectApiClientRequest(reject, String(errorMsg), String(errorCode || '') || undefined);
            });

            req.setTimeout(timeout, () => {
                req.destroy();
                rejectApiClientRequest(
                    reject,
                    `Request timeout after ${timeout}ms`,
                    'ETIMEDOUT',
                );
            });

            // Write request body if present
            if (requestBodyData !== undefined && ['POST', 'PUT', 'PATCH'].includes(method)) {
                if (Buffer.isBuffer(requestBodyData)) {
                    req.write(requestBodyData);
                } else {
                    req.write(requestBodyData);
                }
            }

            req.end();
        } catch (error: any) {
            const errorCode = error.code || '';
            const errorMessage = error.message || 'Failed to make request';
            let errorMsg = errorMessage;
            
            if (errorCode) {
                const errorCodeMap: Record<string, string> = {
                    'EINVAL': 'Invalid URL or parameters',
                    'ENOTFOUND': 'Host not found - DNS lookup failed',
                };
                const friendlyMessage = errorCodeMap[errorCode] || errorCode;
                errorMsg = `${friendlyMessage} (${errorCode})`;
            }
            
            // Ensure we're rejecting with a serializable object
            rejectApiClientRequest(reject, String(errorMsg), String(errorCode || '') || undefined);
        }
    });
});

// Auto-updater IPC handlers
ipcMain.handle('updater:checkForUpdates', async () => {
    if (isDev) {
        return { error: 'Updates are disabled in development mode' };
    }
    if (!isAutoUpdateEnabled()) {
        return { error: 'Auto-update is not configured for this build' };
    }
    try {
        const result = await autoUpdater.checkForUpdates();
        return {
            updateInfo: result?.updateInfo ? {
                version: result.updateInfo.version,
                releaseDate: result.updateInfo.releaseDate,
                releaseNotes: result.updateInfo.releaseNotes,
            } : null,
            downloadPromise: result?.downloadPromise ? true : false,
        };
    } catch (error: any) {
        if (isBenignUpdateError(error)) {
            return { error: 'No update metadata is published for this release yet' };
        }
        return { error: error.message || 'Failed to check for updates' };
    }
});

ipcMain.handle('updater:downloadUpdate', async () => {
    if (isDev) {
        return { error: 'Updates are disabled in development mode' };
    }
    if (!isAutoUpdateEnabled()) {
        return { error: 'Auto-update is not available for this build' };
    }
    try {
        await autoUpdater.downloadUpdate();
        return { success: true };
    } catch (error: any) {
        return { error: error.message || 'Failed to download update' };
    }
});

ipcMain.handle('updater:quitAndInstall', () => {
    if (isDev) {
        return { error: 'Updates are disabled in development mode' };
    }
    if (!isAutoUpdateEnabled()) {
        return { error: 'Auto-update is not available for this build' };
    }
    autoUpdater.quitAndInstall(false, true);
    return { success: true };
});

ipcMain.handle('updater:getAppVersion', () => {
    return { version: app.getVersion() };
});

ipcMain.handle('updater:getStatus', () => {
    return getAutoUpdateStatus();
});

ipcMain.handle('app:getArchMismatch', () => {
    return getArchMismatchWarning();
});

// Auto-updater event listeners
if (isAutoUpdateEnabled()) {
    autoUpdater.on('checking-for-update', () => {
        console.log('[AutoUpdater] Checking for update...');
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('updater:checking-for-update');
        }
    });

    autoUpdater.on('update-available', (info) => {
        console.log('[AutoUpdater] Update available:', info.version);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('updater:update-available', {
                version: info.version,
                releaseDate: info.releaseDate,
                releaseNotes: info.releaseNotes,
            });
        }
    });

    autoUpdater.on('update-not-available', (info) => {
        console.log('[AutoUpdater] Update not available. Current version is latest.');
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('updater:update-not-available', {
                version: info.version,
            });
        }
    });

    autoUpdater.on('error', (err) => {
        if (isBenignUpdateError(err)) {
            console.warn('[AutoUpdater] Update metadata unavailable:', err.message);
            return;
        }
        console.error('[AutoUpdater] Error:', err);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('updater:error', {
                message: err.message || 'An error occurred while checking for updates',
            });
        }
    });

    autoUpdater.on('download-progress', (progressObj) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('updater:download-progress', {
                percent: progressObj.percent,
                transferred: progressObj.transferred,
                total: progressObj.total,
            });
        }
    });

    autoUpdater.on('update-downloaded', (info) => {
        console.log('[AutoUpdater] Update downloaded:', info.version);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('updater:update-downloaded', {
                version: info.version,
                releaseDate: info.releaseDate,
                releaseNotes: info.releaseNotes,
            });
        }
    });
}

