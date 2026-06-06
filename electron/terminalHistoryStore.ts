import { app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface TerminalCommandRecord {
    command: string;
    scope: string;
    timestamp: string;
}

export interface TerminalSessionRecord {
    id: string;
    title: string;
    scope: string;
    kind: 'local' | 'k8s' | 'docker';
    config: Record<string, unknown>;
    startedAt: string;
    lastActiveAt: string;
    closedAt?: string;
}

interface TerminalHistoryData {
    commands: TerminalCommandRecord[];
    sessions: TerminalSessionRecord[];
}

const MAX_COMMANDS = 500;
const MAX_SESSIONS = 40;

export class TerminalHistoryStore {
    private storePath: string;

    constructor() {
        this.storePath = path.join(app.getPath('userData'), 'terminal-history.json');
    }

    private async load(): Promise<TerminalHistoryData> {
        try {
            const raw = await fs.readFile(this.storePath, 'utf-8');
            const parsed = JSON.parse(raw) as TerminalHistoryData;
            return {
                commands: parsed.commands ?? [],
                sessions: parsed.sessions ?? [],
            };
        } catch {
            return { commands: [], sessions: [] };
        }
    }

    private async save(data: TerminalHistoryData): Promise<void> {
        await fs.mkdir(path.dirname(this.storePath), { recursive: true });
        await fs.writeFile(this.storePath, JSON.stringify(data, null, 2), 'utf-8');
    }

    async addCommand(scope: string, command: string): Promise<void> {
        const trimmed = command.trim();
        if (!trimmed || trimmed.startsWith(' ') || trimmed.length > 2000) {
            return;
        }

        const data = await this.load();
        const now = new Date().toISOString();
        const withoutDup = data.commands.filter(
            (entry) => !(entry.scope === scope && entry.command === trimmed),
        );
        withoutDup.unshift({ command: trimmed, scope, timestamp: now });
        data.commands = withoutDup.slice(0, MAX_COMMANDS);
        await this.save(data);
    }

    async getCommands(
        scope: string,
        query = '',
        limit = 100,
    ): Promise<TerminalCommandRecord[]> {
        const data = await this.load();
        const q = query.trim().toLowerCase();
        return data.commands
            .filter((entry) => entry.scope === scope)
            .filter((entry) => !q || entry.command.toLowerCase().includes(q))
            .slice(0, limit);
    }

    async clearCommands(scope?: string): Promise<void> {
        const data = await this.load();
        data.commands = scope
            ? data.commands.filter((entry) => entry.scope !== scope)
            : [];
        await this.save(data);
    }

    async addSession(session: TerminalSessionRecord): Promise<void> {
        const data = await this.load();
        data.sessions = [session, ...data.sessions.filter((s) => s.id !== session.id)].slice(
            0,
            MAX_SESSIONS,
        );
        await this.save(data);
    }

    async updateSession(
        id: string,
        patch: Partial<TerminalSessionRecord>,
    ): Promise<TerminalSessionRecord | null> {
        const data = await this.load();
        const index = data.sessions.findIndex((s) => s.id === id);
        if (index < 0) {
            return null;
        }
        data.sessions[index] = { ...data.sessions[index], ...patch };
        await this.save(data);
        return data.sessions[index];
    }

    async listSessions(limit = 30): Promise<TerminalSessionRecord[]> {
        const data = await this.load();
        return data.sessions.slice(0, limit);
    }

    async removeSession(id: string): Promise<void> {
        const data = await this.load();
        data.sessions = data.sessions.filter((s) => s.id !== id);
        await this.save(data);
    }
}

export const terminalHistoryStore = new TerminalHistoryStore();
