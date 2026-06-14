import { app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';

interface GitRepoStoreData {
    repoPath: string | null;
}

export class GitRepoStore {
    private storePath: string;

    constructor() {
        this.storePath = path.join(app.getPath('userData'), 'git-repo.json');
    }

    private async load(): Promise<GitRepoStoreData> {
        try {
            const raw = await fs.readFile(this.storePath, 'utf-8');
            const parsed = JSON.parse(raw) as GitRepoStoreData;
            return {
                repoPath: typeof parsed.repoPath === 'string' ? parsed.repoPath : null,
            };
        } catch {
            return { repoPath: null };
        }
    }

    private async save(data: GitRepoStoreData): Promise<void> {
        await fs.writeFile(this.storePath, JSON.stringify(data, null, 2), 'utf-8');
    }

    async getRepoPath(): Promise<string | null> {
        const data = await this.load();
        return data.repoPath;
    }

    async setRepoPath(repoPath: string): Promise<void> {
        await this.save({ repoPath: path.resolve(repoPath) });
    }

    async clearRepoPath(): Promise<void> {
        await this.save({ repoPath: null });
    }
}

export const gitRepoStore = new GitRepoStore();
