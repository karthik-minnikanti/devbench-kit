import { app, clipboard } from 'electron';
import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';

export type PasswordStrength = 'weak' | 'fair' | 'good' | 'strong';

export interface VaultEntry {
    id: string;
    title: string;
    username: string;
    password: string;
    domain: string;
    notes: string;
    favorite: boolean;
    createdAt: number;
    updatedAt: number;
    lastUsedAt?: number;
    passwordFingerprint?: string;
    strength?: PasswordStrength;
}

export interface VaultEntrySummary {
    id: string;
    title: string;
    username: string;
    domain: string;
    notes: string;
    favorite: boolean;
    createdAt: number;
    updatedAt: number;
    lastUsedAt?: number;
    passwordLength: number;
    strength: PasswordStrength;
    reusedCount: number;
}

interface VaultPayload {
    entries: VaultEntry[];
}

interface VaultFile {
    version: 1;
    kdf: 'scrypt';
    kdfParams: { N: number; r: number; p: number; keyLen: number };
    salt: string;
    iv: string;
    tag: string;
    ciphertext: string;
}

const KDF_PARAMS = { N: 16384, r: 8, p: 1, keyLen: 32 } as const;
const CLIPBOARD_CLEAR_MS = 30_000;
const COMMON_PASSWORDS = new Set([
    'password', 'password1', 'password123', '123456', '12345678', 'qwerty',
    'abc123', 'letmein', 'welcome', 'admin', 'iloveyou', 'monkey', 'dragon',
]);

function fingerprint(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
}

export function scorePassword(password: string): PasswordStrength {
    if (!password) return 'weak';
    const lower = password.toLowerCase();
    if (COMMON_PASSWORDS.has(lower) || password.length < 8) return 'weak';
    let charset = 0;
    if (/[a-z]/.test(password)) charset += 26;
    if (/[A-Z]/.test(password)) charset += 26;
    if (/\d/.test(password)) charset += 10;
    if (/[^A-Za-z0-9]/.test(password)) charset += 24;
    const entropy = password.length * Math.log2(Math.max(charset, 1));
    if (entropy < 36) return 'weak';
    if (entropy < 50) return 'fair';
    if (entropy < 70) return 'good';
    return 'strong';
}

function toSummary(entry: VaultEntry, reusedCount: number): VaultEntrySummary {
    return {
        id: entry.id,
        title: entry.title,
        username: entry.username,
        domain: entry.domain,
        notes: entry.notes,
        favorite: entry.favorite,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        lastUsedAt: entry.lastUsedAt,
        passwordLength: entry.password?.length ?? 0,
        strength: entry.strength || scorePassword(entry.password),
        reusedCount,
    };
}

function reuseMap(entries: VaultEntry[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const entry of entries) {
        const fp = entry.passwordFingerprint || fingerprint(entry.password || '');
        if (!entry.password) continue;
        counts.set(fp, (counts.get(fp) || 0) + 1);
    }
    return counts;
}

class VaultStore {
    private key: Buffer | null = null;
    private payload: VaultPayload | null = null;
    private clipboardTimer: NodeJS.Timeout | null = null;
    private lastCopied = '';

    private vaultPath(): string {
        return path.join(app.getPath('userData'), 'vault.enc');
    }

    async exists(): Promise<boolean> {
        try {
            await fs.access(this.vaultPath());
            return true;
        } catch {
            return false;
        }
    }

    isUnlocked(): boolean {
        return this.key !== null && this.payload !== null;
    }

    async status() {
        return {
            exists: await this.exists(),
            unlocked: this.isUnlocked(),
            count: this.payload?.entries.length ?? 0,
        };
    }

    private deriveKey(password: string, salt: Buffer): Buffer {
        return crypto.scryptSync(password, salt, KDF_PARAMS.keyLen, {
            N: KDF_PARAMS.N,
            r: KDF_PARAMS.r,
            p: KDF_PARAMS.p,
            maxmem: 64 * 1024 * 1024,
        });
    }

    private encryptWithPassword(payload: VaultPayload, masterPassword: string): VaultFile {
        const salt = crypto.randomBytes(16);
        const key = this.deriveKey(masterPassword, salt);
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
        const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
        const tag = cipher.getAuthTag();
        return {
            version: 1,
            kdf: 'scrypt',
            kdfParams: { ...KDF_PARAMS },
            salt: salt.toString('base64'),
            iv: iv.toString('base64'),
            tag: tag.toString('base64'),
            ciphertext: ciphertext.toString('base64'),
        };
    }

    private decrypt(file: VaultFile, masterPassword: string): { payload: VaultPayload; key: Buffer } {
        const salt = Buffer.from(file.salt, 'base64');
        const key = this.deriveKey(masterPassword, salt);
        const iv = Buffer.from(file.iv, 'base64');
        const tag = Buffer.from(file.tag, 'base64');
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(tag);
        const plaintext = Buffer.concat([
            decipher.update(Buffer.from(file.ciphertext, 'base64')),
            decipher.final(),
        ]);
        const payload = JSON.parse(plaintext.toString('utf8')) as VaultPayload;
        if (!Array.isArray(payload.entries)) {
            payload.entries = [];
        }
        return { payload, key };
    }

    private async persistUnlocked(): Promise<void> {
        if (!this.key || !this.payload) {
            throw new Error('Vault is locked');
        }
        const file = JSON.parse(await fs.readFile(this.vaultPath(), 'utf8')) as VaultFile;
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', this.key, iv);
        const plaintext = Buffer.from(JSON.stringify(this.payload), 'utf8');
        const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
        const next: VaultFile = {
            version: 1,
            kdf: 'scrypt',
            kdfParams: file.kdfParams || { ...KDF_PARAMS },
            salt: file.salt,
            iv: iv.toString('base64'),
            tag: cipher.getAuthTag().toString('base64'),
            ciphertext: ciphertext.toString('base64'),
        };
        await fs.writeFile(this.vaultPath(), JSON.stringify(next), 'utf8');
    }

    async setup(masterPassword: string) {
        if (await this.exists()) {
            return { success: false, error: 'Vault already exists' };
        }
        if (!masterPassword || masterPassword.length < 8) {
            return { success: false, error: 'Master password must be at least 8 characters' };
        }
        const payload: VaultPayload = { entries: [] };
        const file = this.encryptWithPassword(payload, masterPassword);
        await fs.mkdir(path.dirname(this.vaultPath()), { recursive: true });
        await fs.writeFile(this.vaultPath(), JSON.stringify(file), 'utf8');
        const unlocked = this.decrypt(file, masterPassword);
        this.key = unlocked.key;
        this.payload = unlocked.payload;
        return { success: true, ...await this.status() };
    }

    async unlock(masterPassword: string) {
        if (!(await this.exists())) {
            return { success: false, error: 'No vault found' };
        }
        try {
            const raw = await fs.readFile(this.vaultPath(), 'utf8');
            const file = JSON.parse(raw) as VaultFile;
            const unlocked = this.decrypt(file, masterPassword);
            this.key = unlocked.key;
            this.payload = unlocked.payload;
            return { success: true, ...await this.status() };
        } catch {
            return { success: false, error: 'Wrong master password' };
        }
    }

    lock() {
        this.key = null;
        this.payload = null;
        return { success: true, unlocked: false };
    }

    async changeMasterPassword(currentPassword: string, nextPassword: string) {
        if (!nextPassword || nextPassword.length < 8) {
            return { success: false, error: 'New master password must be at least 8 characters' };
        }
        const unlocked = await this.unlock(currentPassword);
        if (!unlocked.success || !this.payload) {
            return { success: false, error: unlocked.error || 'Wrong master password' };
        }
        const file = this.encryptWithPassword(this.payload, nextPassword);
        await fs.writeFile(this.vaultPath(), JSON.stringify(file), 'utf8');
        const again = this.decrypt(file, nextPassword);
        this.key = again.key;
        this.payload = again.payload;
        return { success: true };
    }

    private requireUnlocked(): VaultPayload {
        if (!this.payload || !this.key) {
            throw new Error('Vault is locked');
        }
        return this.payload;
    }

    list(): { success: boolean; entries?: VaultEntrySummary[]; error?: string } {
        try {
            const payload = this.requireUnlocked();
            const counts = reuseMap(payload.entries);
            const entries = payload.entries
                .map((entry) => {
                    const fp = entry.passwordFingerprint || fingerprint(entry.password || '');
                    return toSummary(entry, Math.max((counts.get(fp) || 1) - 1, 0));
                })
                .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
            return { success: true, entries };
        } catch (error: any) {
            return { success: false, error: error.message || String(error) };
        }
    }

    get(id: string): { success: boolean; entry?: VaultEntry; error?: string } {
        try {
            const payload = this.requireUnlocked();
            const entry = payload.entries.find((item) => item.id === id);
            if (!entry) return { success: false, error: 'Login not found' };
            return { success: true, entry: { ...entry } };
        } catch (error: any) {
            return { success: false, error: error.message || String(error) };
        }
    }

    async save(input: Partial<VaultEntry> & { title?: string; username?: string; password?: string; domain?: string }) {
        try {
            const payload = this.requireUnlocked();
            const now = Date.now();
            const existing = input.id ? payload.entries.find((item) => item.id === input.id) : undefined;
            const password = input.password ?? existing?.password ?? '';
            const entry: VaultEntry = {
                id: existing?.id || crypto.randomUUID(),
                title: (input.title ?? existing?.title ?? '').trim() || hostnameFromDomain(input.domain ?? existing?.domain ?? '') || 'Untitled login',
                username: (input.username ?? existing?.username ?? '').trim(),
                password,
                domain: (input.domain ?? existing?.domain ?? '').trim(),
                notes: input.notes ?? existing?.notes ?? '',
                favorite: input.favorite ?? existing?.favorite ?? false,
                createdAt: existing?.createdAt || now,
                updatedAt: now,
                lastUsedAt: input.lastUsedAt ?? existing?.lastUsedAt,
                passwordFingerprint: fingerprint(password),
                strength: scorePassword(password),
            };
            if (existing) {
                payload.entries = payload.entries.map((item) => (item.id === entry.id ? entry : item));
            } else {
                payload.entries.unshift(entry);
            }
            await this.persistUnlocked();
            return { success: true, entry: this.get(entry.id).entry, summary: this.list().entries?.find((item) => item.id === entry.id) };
        } catch (error: any) {
            return { success: false, error: error.message || String(error) };
        }
    }

    async remove(id: string) {
        try {
            const payload = this.requireUnlocked();
            const before = payload.entries.length;
            payload.entries = payload.entries.filter((item) => item.id !== id);
            if (payload.entries.length === before) {
                return { success: false, error: 'Login not found' };
            }
            await this.persistUnlocked();
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message || String(error) };
        }
    }

    async copyField(id: string, field: 'password' | 'username' | 'domain') {
        try {
            const payload = this.requireUnlocked();
            const entry = payload.entries.find((item) => item.id === id);
            if (!entry) return { success: false, error: 'Login not found' };
            const value = entry[field] || '';
            if (!value) return { success: false, error: `No ${field} to copy` };
            clipboard.writeText(value);
            this.lastCopied = value;
            if (this.clipboardTimer) clearTimeout(this.clipboardTimer);
            if (field === 'password') {
                this.clipboardTimer = setTimeout(() => {
                    if (clipboard.readText() === this.lastCopied) {
                        clipboard.clear();
                    }
                    this.lastCopied = '';
                }, CLIPBOARD_CLEAR_MS);
                entry.lastUsedAt = Date.now();
                await this.persistUnlocked();
            }
            return {
                success: true,
                field,
                clearsInMs: field === 'password' ? CLIPBOARD_CLEAR_MS : undefined,
            };
        } catch (error: any) {
            return { success: false, error: error.message || String(error) };
        }
    }
}

function hostnameFromDomain(domain: string): string {
    if (!domain) return '';
    try {
        const url = domain.includes('://') ? new URL(domain) : new URL(`https://${domain}`);
        return url.hostname.replace(/^www\./, '');
    } catch {
        return domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    }
}

export const vaultStore = new VaultStore();
