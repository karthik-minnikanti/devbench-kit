import simpleGit from 'simple-git';
import type { SimpleGit, SimpleGitOptions } from 'simple-git';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface GitStatus {
    isRepo: boolean;
    hasChanges: boolean;
    ahead: number;
    behind: number;
    currentBranch?: string;
}

class GitService {
    private git: SimpleGit | null = null;
    private repoPath: string | null = null;
    private syncDebounceTimer: NodeJS.Timeout | null = null;
    private pendingChanges: Set<string> = new Set();

    async initialize(repoPath: string): Promise<{ success: boolean; error?: string }> {
        try {
            // Normalize path
            const normalizedPath = path.resolve(repoPath);
            
            // Check if directory exists
            try {
                const stats = await fs.stat(normalizedPath);
                if (!stats.isDirectory()) {
                    return { success: false, error: 'Path is not a directory' };
                }
            } catch {
                // Directory doesn't exist, create it
                await fs.mkdir(normalizedPath, { recursive: true });
            }

            // Check if it's already a Git repo
            const gitDir = path.join(normalizedPath, '.git');
            let isRepo = false;
            try {
                const gitStats = await fs.stat(gitDir);
                isRepo = gitStats.isDirectory();
            } catch {
                // Not a Git repo
            }

            // Initialize Git options
            const options: Partial<SimpleGitOptions> = {
                baseDir: normalizedPath,
                binary: 'git',
                maxConcurrentProcesses: 1,
            };

            this.git = simpleGit(options);
            this.repoPath = normalizedPath;

            // If not a repo, initialize it
            if (!isRepo) {
                await this.git.init();
                // Create initial .gitignore
                const gitignorePath = path.join(normalizedPath, '.gitignore');
                const gitignoreContent = `# DevBench data files
*.log
.DS_Store
node_modules/
`;
                await fs.writeFile(gitignorePath, gitignoreContent, 'utf-8');
                // Initial commit
                await this.git.add('.gitignore');
                await this.git.commit('Initial commit: DevBench setup');
            }

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

    async addFiles(filePaths: string[]): Promise<{ success: boolean; error?: string }> {
        if (!this.git) {
            return { success: false, error: 'Git not initialized' };
        }

        try {
            // Add files relative to repo path
            const relativePaths = filePaths.map(filePath => {
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

    async commit(message: string): Promise<{ success: boolean; error?: string }> {
        if (!this.git) {
            return { success: false, error: 'Git not initialized' };
        }

        try {
            await this.git.commit(message);
            return { success: true };
        } catch (error: any) {
            // If there's nothing to commit, that's okay
            if (error.message && error.message.includes('nothing to commit')) {
                return { success: true };
            }
            return { success: false, error: error.message || String(error) };
        }
    }

    async push(): Promise<{ success: boolean; error?: string }> {
        if (!this.git) {
            return { success: false, error: 'Git not initialized' };
        }

        try {
            const branchSummary = await this.git.branchLocal();
            const currentBranch = branchSummary.current;
            
            if (!currentBranch) {
                return { success: false, error: 'No branch checked out' };
            }

            // Check if remote exists
            const remotes = await this.git.getRemotes(true);
            if (remotes.length === 0) {
                // No remote configured, that's okay - just return success
                return { success: true };
            }

            await this.git.push('origin', currentBranch);
            return { success: true };
        } catch (error: any) {
            // If there's no upstream branch, that's okay for now
            if (error.message && (
                error.message.includes('no upstream branch') ||
                error.message.includes('no tracking information')
            )) {
                return { success: true };
            }
            return { success: false, error: error.message || String(error) };
        }
    }

    async pull(): Promise<{ success: boolean; error?: string; hasConflicts?: boolean }> {
        if (!this.git) {
            return { success: false, error: 'Git not initialized' };
        }

        try {
            const branchSummary = await this.git.branchLocal();
            const currentBranch = branchSummary.current;
            
            if (!currentBranch) {
                return { success: false, error: 'No branch checked out' };
            }

            // Check if remote exists
            const remotes = await this.git.getRemotes(true);
            if (remotes.length === 0) {
                return { success: true };
            }

            await this.git.pull('origin', currentBranch);
            return { success: true };
        } catch (error: any) {
            // Check for merge conflicts
            if (error.message && error.message.includes('conflict')) {
                return { success: false, error: error.message, hasConflicts: true };
            }
            return { success: false, error: error.message || String(error) };
        }
    }

    async sync(filePaths: string[], commitMessage?: string): Promise<{ success: boolean; error?: string }> {
        if (!this.git) {
            return { success: false, error: 'Git not initialized' };
        }

        try {
            // First, check if we're behind remote and pull if needed
            // This prevents conflicts when pushing
            const status = await this.getStatus();
            if (status.behind > 0) {
                const pullResult = await this.pull();
                if (!pullResult.success && pullResult.hasConflicts) {
                    // If there are conflicts, we can't proceed
                    return { success: false, error: 'Merge conflicts detected. Please resolve manually before syncing.' };
                }
                // If pull failed for other reasons, log but continue (might be network issue)
                if (!pullResult.success) {
                    console.warn('Pull failed, but continuing with sync:', pullResult.error);
                }
            }

            // Add only the specific files we want to sync
            const addResult = await this.addFiles(filePaths);
            if (!addResult.success) {
                return addResult;
            }

            // Commit
            const message = commitMessage || `Update: ${filePaths.length} file(s) changed`;
            const commitResult = await this.commit(message);
            if (!commitResult.success) {
                return commitResult;
            }

            // Push
            const pushResult = await this.push();
            return pushResult;
        } catch (error: any) {
            return { success: false, error: error.message || String(error) };
        }
    }

    // Debounced sync - batches multiple changes
    // Reduced delay for faster sync after user stops typing (300ms = quick but still batches rapid changes)
    async debouncedSync(filePath: string, commitMessage?: string, delayMs: number = 300): Promise<void> {
        this.pendingChanges.add(filePath);

        // Clear existing timer
        if (this.syncDebounceTimer) {
            clearTimeout(this.syncDebounceTimer);
        }

        // Set new timer
        this.syncDebounceTimer = setTimeout(async () => {
            const filesToSync = Array.from(this.pendingChanges);
            this.pendingChanges.clear();
            
            if (filesToSync.length > 0) {
                const message = commitMessage || `Update: ${filesToSync.length} file(s) changed`;
                await this.sync(filesToSync, message);
            }
        }, delayMs);
    }

    getRepoPath(): string | null {
        return this.repoPath;
    }

    isInitialized(): boolean {
        return this.git !== null && this.repoPath !== null;
    }
}

export const gitService = new GitService();

