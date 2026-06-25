import simpleGit from 'simple-git';
import type { SimpleGit, SimpleGitOptions } from 'simple-git';
import * as path from 'path';
import * as fs from 'fs/promises';
import { net } from 'electron';

export interface GitStatus {
    isRepo: boolean;
    hasChanges: boolean;
    ahead: number;
    behind: number;
    currentBranch?: string;
}

export interface GitSyncState {
    isRepo: boolean;
    isOnline: boolean;
    isSyncing: boolean;
    pendingFileCount: number;
    unpushedCommits: number;
    hasUncommittedChanges: boolean;
    lastError: string | null;
}

export interface GitSyncResult {
    success: boolean;
    error?: string;
    hasConflicts?: boolean;
}

type SyncStateListener = (state: GitSyncState) => void;

function isNetworkError(message: string): boolean {
    const lower = message.toLowerCase();
    return (
        lower.includes('network') ||
        lower.includes('enotfound') ||
        lower.includes('etimedout') ||
        lower.includes('econnrefused') ||
        lower.includes('could not resolve') ||
        lower.includes('unable to access') ||
        lower.includes('failed to connect') ||
        lower.includes('connection timed out') ||
        lower.includes('the internet connection appears to be offline')
    );
}

class GitService {
    private git: SimpleGit | null = null;
    private repoPath: string | null = null;
    private syncDebounceTimer: NodeJS.Timeout | null = null;
    private retryTimer: NodeJS.Timeout | null = null;
    /** Files waiting to be committed and pushed */
    private pendingChanges: Set<string> = new Set();
    /** Push failed after a local commit — retry push only */
    private pushPending = false;
    private isSyncing = false;
    private lastSyncError: string | null = null;
    private stateListener: SyncStateListener | null = null;

    setStateChangeListener(listener: SyncStateListener | null): void {
        this.stateListener = listener;
    }

    private isOnline(): boolean {
        return net.isOnline();
    }

    private scheduleRetry(delayMs = 5000): void {
        if (this.retryTimer) {
            clearTimeout(this.retryTimer);
        }
        this.retryTimer = setTimeout(() => {
            void this.retryPendingSync();
        }, delayMs);
    }

    private async emitStateChange(): Promise<void> {
        if (!this.stateListener) {
            return;
        }
        try {
            this.stateListener(await this.getSyncState());
        } catch (error) {
            console.error('[GitService] Failed to emit sync state:', error);
        }
    }

    async getSyncState(): Promise<GitSyncState> {
        const status = await this.getStatus();
        return {
            isRepo: status.isRepo,
            isOnline: this.isOnline(),
            isSyncing: this.isSyncing,
            pendingFileCount: this.pendingChanges.size,
            unpushedCommits: status.ahead,
            hasUncommittedChanges: status.hasChanges,
            lastError: this.lastSyncError,
        };
    }

    async initialize(repoPath: string): Promise<{ success: boolean; error?: string }> {
        try {
            const normalizedPath = path.resolve(repoPath);

            try {
                const stats = await fs.stat(normalizedPath);
                if (!stats.isDirectory()) {
                    return { success: false, error: 'Path is not a directory' };
                }
            } catch {
                await fs.mkdir(normalizedPath, { recursive: true });
            }

            const gitDir = path.join(normalizedPath, '.git');
            let isRepo = false;
            try {
                const gitStats = await fs.stat(gitDir);
                isRepo = gitStats.isDirectory();
            } catch {
                // Not a Git repo
            }

            const options: Partial<SimpleGitOptions> = {
                baseDir: normalizedPath,
                binary: 'git',
                maxConcurrentProcesses: 1,
            };

            this.git = simpleGit(options);
            this.repoPath = normalizedPath;

            if (!isRepo) {
                await this.git.init();
                const gitignorePath = path.join(normalizedPath, '.gitignore');
                const gitignoreContent = `# DevBench data files
*.log
.DS_Store
node_modules/
`;
                await fs.writeFile(gitignorePath, gitignoreContent, 'utf-8');
                await this.git.add('.gitignore');
                await this.git.commit('Initial commit: DevBench setup');
            }

            void this.emitStateChange();
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message || String(error) };
        }
    }

    async checkIfRepo(repoPath: string): Promise<boolean> {
        try {
            const normalizedPath = path.resolve(repoPath);
            const gitDir = path.join(normalizedPath, '.git');
            const stats = await fs.stat(gitDir);
            return stats.isDirectory();
        } catch {
            return false;
        }
    }

    async getStatus(): Promise<GitStatus> {
        if (!this.git || !this.repoPath) {
            return { isRepo: false, hasChanges: false, ahead: 0, behind: 0 };
        }

        try {
            const status = await this.git.status();
            const branchSummary = await this.git.branchLocal();

            return {
                isRepo: true,
                hasChanges: status.files.length > 0,
                ahead: status.ahead || 0,
                behind: status.behind || 0,
                currentBranch: branchSummary.current,
            };
        } catch (error) {
            console.error('Failed to get Git status:', error);
            return { isRepo: false, hasChanges: false, ahead: 0, behind: 0 };
        }
    }

    async addFiles(filePaths: string[]): Promise<GitSyncResult> {
        if (!this.git) {
            return { success: false, error: 'Git not initialized' };
        }

        if (filePaths.length === 0) {
            return { success: true };
        }

        try {
            const relativePaths = filePaths.map((filePath) => {
                if (this.repoPath && path.isAbsolute(filePath)) {
                    return path.relative(this.repoPath, filePath);
                }
                return filePath;
            });

            await this.git.add(relativePaths);
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message || String(error) };
        }
    }

    async commit(message: string): Promise<GitSyncResult> {
        if (!this.git) {
            return { success: false, error: 'Git not initialized' };
        }

        try {
            await this.git.commit(message);
            return { success: true };
        } catch (error: any) {
            if (error.message && error.message.includes('nothing to commit')) {
                return { success: true };
            }
            return { success: false, error: error.message || String(error) };
        }
    }

    async push(): Promise<GitSyncResult> {
        if (!this.git) {
            return { success: false, error: 'Git not initialized' };
        }

        try {
            const branchSummary = await this.git.branchLocal();
            const currentBranch = branchSummary.current;

            if (!currentBranch) {
                return { success: false, error: 'No branch checked out' };
            }

            const remotes = await this.git.getRemotes(true);
            if (remotes.length === 0) {
                this.pushPending = false;
                return { success: true };
            }

            await this.git.push('origin', currentBranch);
            this.pushPending = false;
            this.lastSyncError = null;
            return { success: true };
        } catch (error: any) {
            if (
                error.message &&
                (error.message.includes('no upstream branch') ||
                    error.message.includes('no tracking information'))
            ) {
                this.pushPending = false;
                return { success: true };
            }
            return { success: false, error: error.message || String(error) };
        }
    }

    async pull(): Promise<GitSyncResult> {
        if (!this.git) {
            return { success: false, error: 'Git not initialized' };
        }

        try {
            const branchSummary = await this.git.branchLocal();
            const currentBranch = branchSummary.current;

            if (!currentBranch) {
                return { success: false, error: 'No branch checked out' };
            }

            const remotes = await this.git.getRemotes(true);
            if (remotes.length === 0) {
                return { success: true };
            }

            await this.git.pull('origin', currentBranch);
            return { success: true };
        } catch (error: any) {
            if (error.message && error.message.includes('conflict')) {
                return { success: false, error: error.message, hasConflicts: true };
            }
            return { success: false, error: error.message || String(error) };
        }
    }

    async sync(filePaths: string[], commitMessage?: string): Promise<GitSyncResult> {
        if (!this.git) {
            return { success: false, error: 'Git not initialized' };
        }

        if (!this.isOnline()) {
            filePaths.forEach((filePath) => this.pendingChanges.add(filePath));
            this.lastSyncError = 'Offline — saved locally, Git sync will retry when online';
            void this.emitStateChange();
            return { success: false, error: this.lastSyncError };
        }

        this.isSyncing = true;
        this.lastSyncError = null;
        void this.emitStateChange();

        try {
            const status = await this.getStatus();
            if (status.behind > 0) {
                const pullResult = await this.pull();
                if (!pullResult.success && pullResult.hasConflicts) {
                    this.lastSyncError =
                        'Merge conflicts detected. Please resolve manually before syncing.';
                    return pullResult;
                }
                if (!pullResult.success) {
                    console.warn('[GitService] Pull failed, continuing with sync:', pullResult.error);
                }
            }

            const addResult = await this.addFiles(filePaths);
            if (!addResult.success) {
                this.lastSyncError = addResult.error || 'Failed to stage files';
                filePaths.forEach((filePath) => this.pendingChanges.add(filePath));
                this.scheduleRetry();
                return addResult;
            }

            const message = commitMessage || `Update: ${filePaths.length} file(s) changed`;
            const commitResult = await this.commit(message);
            if (!commitResult.success) {
                this.lastSyncError = commitResult.error || 'Failed to commit';
                filePaths.forEach((filePath) => this.pendingChanges.add(filePath));
                this.scheduleRetry();
                return commitResult;
            }

            const pushResult = await this.push();
            if (!pushResult.success) {
                this.pushPending = true;
                this.lastSyncError = pushResult.error || 'Failed to push';
                if (pushResult.error && isNetworkError(pushResult.error)) {
                    this.scheduleRetry();
                }
                return pushResult;
            }

            filePaths.forEach((filePath) => this.pendingChanges.delete(filePath));
            this.lastSyncError = null;
            return { success: true };
        } catch (error: any) {
            const message = error.message || String(error);
            this.lastSyncError = message;
            filePaths.forEach((filePath) => this.pendingChanges.add(filePath));
            if (isNetworkError(message)) {
                this.scheduleRetry();
            }
            return { success: false, error: message };
        } finally {
            this.isSyncing = false;
            void this.emitStateChange();
        }
    }

    /** Sync all uncommitted files, or push if only local commits are pending. */
    async syncAll(commitMessage?: string): Promise<GitSyncResult> {
        if (!this.git) {
            return { success: false, error: 'Git not initialized' };
        }

        const status = await this.getStatus();
        const changedFiles =
            this.git && this.repoPath
                ? (await this.git.status()).files.map((file) => file.path)
                : [];

        const pendingFiles = Array.from(this.pendingChanges);
        const filesToSync = Array.from(new Set([...changedFiles, ...pendingFiles]));

        if (filesToSync.length > 0) {
            return this.sync(filesToSync, commitMessage || `Sync: ${filesToSync.length} file(s) changed`);
        }

        if (this.pushPending || status.ahead > 0) {
            if (!this.isOnline()) {
                this.lastSyncError = 'Offline — commits saved locally, push will retry when online';
                void this.emitStateChange();
                return { success: false, error: this.lastSyncError };
            }

            this.isSyncing = true;
            void this.emitStateChange();
            try {
                const pushResult = await this.push();
                if (!pushResult.success) {
                    this.pushPending = true;
                    this.lastSyncError = pushResult.error || 'Failed to push';
                    if (pushResult.error && isNetworkError(pushResult.error)) {
                        this.scheduleRetry();
                    }
                }
                return pushResult;
            } finally {
                this.isSyncing = false;
                void this.emitStateChange();
            }
        }

        this.lastSyncError = null;
        void this.emitStateChange();
        return { success: true };
    }

    async retryPendingSync(): Promise<GitSyncResult> {
        if (!this.git || this.isSyncing) {
            return { success: true };
        }

        if (!this.isOnline()) {
            return { success: false, error: 'Still offline' };
        }

        return this.syncAll('Retry pending Git sync');
    }

    debouncedSync(filePath: string, commitMessage?: string, delayMs: number = 300): void {
        this.pendingChanges.add(filePath);

        if (this.syncDebounceTimer) {
            clearTimeout(this.syncDebounceTimer);
        }

        this.syncDebounceTimer = setTimeout(() => {
            const filesToSync = Array.from(this.pendingChanges);
            if (filesToSync.length === 0) {
                return;
            }

            const message = commitMessage || `Update: ${filesToSync.length} file(s) changed`;
            void this.sync(filesToSync, message).then((result) => {
                if (result.success) {
                    filesToSync.forEach((file) => this.pendingChanges.delete(file));
                    void this.emitStateChange();
                }
            });
        }, delayMs);

        void this.emitStateChange();
    }

    getRepoPath(): string | null {
        return this.repoPath;
    }

    isInitialized(): boolean {
        return this.git !== null && this.repoPath !== null;
    }
}

export const gitService = new GitService();
