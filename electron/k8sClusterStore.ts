import { app } from 'electron';
import * as k8s from '@kubernetes/client-node';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

export interface K8sClusterProfile {
    id: string;
    name: string;
    kubeconfigPath: string;
    context: string;
    defaultNamespace?: string;
    sourceType: 'managed' | 'system';
    createdAt: string;
    lastUsedAt?: string;
}

export interface K8sClusterStoreData {
    activeClusterId: string | null;
    clusters: K8sClusterProfile[];
}

export class K8sClusterStore {
    private storePath: string;
    private configsDir: string;

    constructor() {
        const base = path.join(app.getPath('userData'), 'k8s');
        this.storePath = path.join(base, 'clusters.json');
        this.configsDir = path.join(base, 'configs');
    }

    private async ensureDirs(): Promise<void> {
        await fs.mkdir(this.configsDir, { recursive: true });
    }

    async load(): Promise<K8sClusterStoreData> {
        await this.ensureDirs();
        try {
            const raw = await fs.readFile(this.storePath, 'utf-8');
            const parsed = JSON.parse(raw) as K8sClusterStoreData;
            return {
                activeClusterId: parsed.activeClusterId ?? null,
                clusters: parsed.clusters ?? [],
            };
        } catch {
            return { activeClusterId: null, clusters: [] };
        }
    }

    async save(data: K8sClusterStoreData): Promise<void> {
        await this.ensureDirs();
        await fs.writeFile(this.storePath, JSON.stringify(data, null, 2), 'utf-8');
    }

    async listClusters(): Promise<K8sClusterProfile[]> {
        const data = await this.load();
        return data.clusters;
    }

    async getActiveCluster(): Promise<K8sClusterProfile | null> {
        const data = await this.load();
        if (!data.activeClusterId) {
            return null;
        }
        return data.clusters.find(c => c.id === data.activeClusterId) ?? null;
    }

    async addCluster(
        name: string,
        sourceConfigPath: string,
        context: string,
        defaultNamespace?: string
    ): Promise<K8sClusterProfile> {
        const data = await this.load();
        const id = `cluster-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const destPath = path.join(this.configsDir, `${id}.yaml`);
        await fs.copyFile(sourceConfigPath, destPath);

        const cluster: K8sClusterProfile = {
            id,
            name: name.trim() || context,
            kubeconfigPath: destPath,
            context,
            defaultNamespace,
            sourceType: 'managed',
            createdAt: new Date().toISOString(),
            lastUsedAt: new Date().toISOString(),
        };

        data.clusters.push(cluster);
        data.activeClusterId = id;
        await this.save(data);
        return cluster;
    }

    async removeCluster(id: string): Promise<K8sClusterProfile | null> {
        const data = await this.load();
        const cluster = data.clusters.find(c => c.id === id);
        if (!cluster) {
            return null;
        }

        if (cluster.sourceType === 'managed') {
            try {
                await fs.unlink(cluster.kubeconfigPath);
            } catch {
                // ignore missing file
            }
        }

        data.clusters = data.clusters.filter(c => c.id !== id);
        if (data.activeClusterId === id) {
            data.activeClusterId = data.clusters[0]?.id ?? null;
        }
        await this.save(data);
        return cluster;
    }

    async setActiveCluster(id: string): Promise<K8sClusterProfile> {
        const data = await this.load();
        const cluster = data.clusters.find(c => c.id === id);
        if (!cluster) {
            throw new Error('Cluster not found');
        }
        cluster.lastUsedAt = new Date().toISOString();
        data.activeClusterId = id;
        await this.save(data);
        return cluster;
    }

    async updateCluster(
        id: string,
        updates: Partial<Pick<K8sClusterProfile, 'name' | 'context' | 'defaultNamespace'>>
    ): Promise<K8sClusterProfile> {
        const data = await this.load();
        const cluster = data.clusters.find(c => c.id === id);
        if (!cluster) {
            throw new Error('Cluster not found');
        }
        if (updates.name !== undefined) {
            cluster.name = updates.name.trim() || cluster.context;
        }
        if (updates.context !== undefined) {
            cluster.context = updates.context;
        }
        if (updates.defaultNamespace !== undefined) {
            cluster.defaultNamespace = updates.defaultNamespace || undefined;
        }
        await this.save(data);
        return cluster;
    }

    async ensureDefaultCluster(): Promise<K8sClusterProfile | null> {
        const data = await this.load();
        if (data.clusters.length > 0) {
            return this.getActiveCluster();
        }

        const defaultPath = path.join(os.homedir(), '.kube', 'config');
        try {
            await fs.access(defaultPath);
        } catch {
            return null;
        }

        const context = K8sClusterStore.getDefaultContextFromFile(defaultPath);
        const cluster: K8sClusterProfile = {
            id: 'system-kubeconfig',
            name: context ? `System (${context})` : 'System kubeconfig',
            kubeconfigPath: defaultPath,
            context: context || K8sClusterStore.getContextsFromFile(defaultPath)[0] || 'default',
            sourceType: 'system',
            createdAt: new Date().toISOString(),
            lastUsedAt: new Date().toISOString(),
        };

        data.clusters.push(cluster);
        data.activeClusterId = cluster.id;
        await this.save(data);
        return cluster;
    }

    static getContextsFromFile(configPath: string): string[] {
        const kc = new k8s.KubeConfig();
        kc.loadFromFile(configPath);
        return kc.getContexts().map(ctx => ctx.name);
    }

    static getDefaultContextFromFile(configPath: string): string {
        const kc = new k8s.KubeConfig();
        kc.loadFromFile(configPath);
        return kc.getCurrentContext();
    }
}

export const k8sClusterStore = new K8sClusterStore();
