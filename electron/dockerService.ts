import Docker from 'dockerode';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

/**
 * Production-grade Docker service layer for DevBench
 * Provides intelligent analysis, diagnosis, and safe actions
 */

export interface ContainerInfo {
    id: string;
    name: string;
    image: string;
    status: string;
    state: 'running' | 'exited' | 'created' | 'restarting' | 'paused' | 'dead';
    exitCode?: number;
    finishedAt?: Date;
    startedAt?: Date;
    restartCount: number;
    entrypoint?: string[];
    cmd?: string[];
    env?: Record<string, string>; // Masked values
    mounts: Array<{
        type: string;
        source: string;
        destination: string;
        mode?: string;
    }>;
    networkMode: string;
    portBindings: Array<{
        containerPort: string;
        hostPort?: string;
        protocol: string;
    }>;
    memoryLimit?: number;
    cpuLimit?: number;
    workingDir?: string;
    user?: string;
}

export interface ContainerDiagnostic {
    containerId: string;
    containerName: string;
    status: 'healthy' | 'warning' | 'critical' | 'unknown';
    rootCause?: string;
    evidence: string[];
    suggestedFixes: string[];
    exitCode?: number;
    exitReason?: string;
    lastError?: string;
    resourceIssues?: {
        oomKilled?: boolean;
        memoryLimit?: number;
        memoryUsage?: number;
        cpuThrottled?: boolean;
    };
    restartCount: number;
    confidence: 'high' | 'medium' | 'low';
}

export interface ImageAnalysis {
    id: string;
    tags: string[];
    size: number;
    sizeHuman: string;
    baseImage?: string;
    layers: Array<{
        id: string;
        size: number;
        created: Date;
        command?: string;
    }>;
    issues: string[];
    recommendations: string[];
    architecture?: string;
    os?: string;
}

export interface NetworkDiagnostic {
    containerId: string;
    containerName: string;
    exposedPorts: string[];
    publishedPorts: string[];
    networkMode: string;
    issues: string[];
    recommendations: string[];
}

export interface ComposeService {
    name: string;
    image?: string;
    build?: string;
    dependsOn?: string[];
    networks?: string[];
    volumes?: string[];
    ports?: string[];
    environment?: Record<string, string>;
    restart?: string;
    status?: 'running' | 'stopped' | 'exited';
}

export interface ComposeAnalysis {
    services: ComposeService[];
    dependencies: Array<{ from: string; to: string; type: string }>;
    issues: string[];
    recommendations: string[];
}

export class DockerService {
    private docker: Docker | null = null;
    private initialized: boolean = false;

    constructor() {
        // Will initialize on first use
    }

    /**
     * Initialize Docker client
     */
    async initialize(): Promise<void> {
        try {
            // Try Docker socket first (Unix/Mac)
            const socketPath = '/var/run/docker.sock';
            try {
                await fs.access(socketPath);
                this.docker = new Docker({ socketPath });
            } catch {
                // Try Windows named pipe or TCP
                this.docker = new Docker();
            }

            // Test connection
            await this.docker.ping();
            this.initialized = true;
        } catch (error: any) {
            throw new Error(`Failed to connect to Docker: ${error.message}`);
        }
    }

    /**
     * Get all containers
     */
    async getContainers(all: boolean = true): Promise<ContainerInfo[]> {
        this.ensureInitialized();
        
        const containers = await this.docker!.listContainers({ all });
        
        return Promise.all(containers.map(async (container) => {
            const details = await this.docker!.getContainer(container.Id).inspect();
            
            // Mask environment variables
            const env: Record<string, string> = {};
            if (details.Config.Env) {
                for (const envVar of details.Config.Env) {
                    const [key, ...valueParts] = envVar.split('=');
                    const value = valueParts.join('=');
                    // Mask sensitive values
                    if (key.toLowerCase().includes('password') || 
                        key.toLowerCase().includes('secret') ||
                        key.toLowerCase().includes('key') ||
                        key.toLowerCase().includes('token')) {
                        env[key] = '***MASKED***';
                    } else {
                        env[key] = value;
                    }
                }
            }

            // Parse port bindings
            const portBindings: Array<{ containerPort: string; hostPort?: string; protocol: string }> = [];
            if (details.NetworkSettings?.Ports) {
                for (const [containerPort, hostConfigs] of Object.entries(details.NetworkSettings.Ports)) {
                    const [port, protocol] = containerPort.split('/');
                    const hostPort = hostConfigs?.[0]?.HostPort;
                    portBindings.push({
                        containerPort: port,
                        hostPort,
                        protocol: protocol || 'tcp',
                    });
                }
            }

            // Parse mounts
            const mounts = (details.Mounts || []).map(mount => ({
                type: mount.Type,
                source: mount.Source,
                destination: mount.Destination,
                mode: mount.Mode,
            }));

            // Get memory limit
            let memoryLimit: number | undefined;
            if (details.HostConfig?.Memory) {
                memoryLimit = details.HostConfig.Memory;
            }

            return {
                id: container.Id,
                name: container.Names[0]?.replace(/^\//, '') || container.Id.substring(0, 12),
                image: container.Image,
                status: container.Status,
                state: container.State as ContainerInfo['state'],
                exitCode: details.State.ExitCode !== 0 ? details.State.ExitCode : undefined,
                finishedAt: details.State.FinishedAt ? new Date(details.State.FinishedAt) : undefined,
                startedAt: details.State.StartedAt ? new Date(details.State.StartedAt) : undefined,
                restartCount: details.RestartCount || 0,
                entrypoint: details.Config.Entrypoint,
                cmd: details.Config.Cmd,
                env,
                mounts,
                networkMode: details.HostConfig?.NetworkMode || 'default',
                portBindings,
                memoryLimit,
                workingDir: details.Config.WorkingDir,
                user: details.Config.User,
            };
        }));
    }

    /**
     * Get container logs
     */
    async getContainerLogs(containerId: string, tail: number = 100, follow: boolean = false): Promise<string> {
        this.ensureInitialized();
        
        const container = this.docker!.getContainer(containerId);
        
        return new Promise((resolve, reject) => {
            container.logs({
                stdout: true,
                stderr: true,
                tail,
                follow,
                timestamps: false,
            }, (err, stream) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                if (!stream) {
                    resolve('');
                    return;
                }
                
                let logs = '';
                stream.on('data', (chunk: Buffer) => {
                    logs += chunk.toString('utf-8');
                });
                stream.on('end', () => resolve(logs));
                stream.on('error', reject);
                
                if (!follow) {
                    setTimeout(() => {
                        stream.destroy();
                        resolve(logs);
                    }, 100);
                }
            });
        });
    }

    /**
     * Analyze container exit and logs
     */
    async analyzeContainerExit(containerId: string): Promise<{
        exitCode: number;
        exitReason: string;
        lastError?: string;
        errorLines: string[];
    }> {
        this.ensureInitialized();
        
        const container = this.docker!.getContainer(containerId);
        const details = await container.inspect();
        const exitCode = details.State.ExitCode || 0;
        
        // Get recent logs
        const logs = await this.getContainerLogs(containerId, 50, false);
        const logLines = logs.split('\n').filter(line => line.trim());
        
        // Extract error patterns
        const errorLines = logLines.filter(line => 
            line.toLowerCase().includes('error') ||
            line.toLowerCase().includes('fatal') ||
            line.toLowerCase().includes('exception') ||
            line.toLowerCase().includes('panic') ||
            line.toLowerCase().includes('failed')
        );

        const lastError = errorLines.length > 0 ? errorLines[errorLines.length - 1] : undefined;

        // Determine exit reason
        let exitReason = 'Unknown';
        if (exitCode === 0) {
            exitReason = 'Clean exit';
        } else if (exitCode === 137) {
            exitReason = 'OOMKilled (out of memory)';
        } else if (exitCode === 126) {
            exitReason = 'Command not executable';
        } else if (exitCode === 127) {
            exitReason = 'Command not found';
        } else if (exitCode === 1) {
            exitReason = 'Application error';
        } else if (exitCode > 128) {
            const signal = exitCode - 128;
            if (signal === 9) {
                exitReason = 'SIGKILL (forcefully killed)';
            } else if (signal === 15) {
                exitReason = 'SIGTERM (graceful shutdown)';
            } else {
                exitReason = `Signal ${signal}`;
            }
        } else {
            exitReason = `Exit code ${exitCode}`;
        }

        return {
            exitCode,
            exitReason,
            lastError,
            errorLines,
        };
    }

    /**
     * Get container resource usage
     */
    async getContainerStats(containerId: string): Promise<{
        cpuUsage: number;
        memoryUsage: number;
        memoryLimit?: number;
        memoryPercent?: number;
    }> {
        this.ensureInitialized();
        
        try {
            const container = this.docker!.getContainer(containerId);
            const stats: any = await new Promise((resolve, reject) => {
                container.stats({ stream: false }, (err, data) => {
                    if (err) reject(err);
                    else resolve(data);
                });
            });
            
            const cpuDelta = (stats.cpu_stats?.cpu_usage?.total_usage || 0) - (stats.precpu_stats?.cpu_usage?.total_usage || 0);
            const systemDelta = (stats.cpu_stats?.system_cpu_usage || 0) - (stats.precpu_stats?.system_cpu_usage || 0);
            const cpuPercent = systemDelta > 0 ? (cpuDelta / systemDelta) * 100 : 0;

            const memoryUsage = stats.memory_stats?.usage || 0;
            const memoryLimit = stats.memory_stats?.limit || undefined;
            const memoryPercent = memoryLimit ? (memoryUsage / memoryLimit) * 100 : undefined;

            return {
                cpuUsage: cpuPercent,
                memoryUsage,
                memoryLimit,
                memoryPercent,
            };
        } catch (error: any) {
            // Container might be stopped, return defaults
            return {
                cpuUsage: 0,
                memoryUsage: 0,
            };
        }
    }

    /**
     * Diagnose a container
     */
    async diagnoseContainer(containerId: string): Promise<ContainerDiagnostic> {
        this.ensureInitialized();
        
        const container = this.docker!.getContainer(containerId);
        const details = await container.inspect();
        const containerName = details.Name.replace(/^\//, '');
        
        const diagnostic: ContainerDiagnostic = {
            containerId,
            containerName,
            status: 'unknown',
            evidence: [],
            suggestedFixes: [],
            restartCount: details.RestartCount || 0,
            confidence: 'medium',
        };

        // Analyze exit code
        if (details.State.Status === 'exited') {
            const exitAnalysis = await this.analyzeContainerExit(containerId);
            diagnostic.exitCode = exitAnalysis.exitCode;
            diagnostic.exitReason = exitAnalysis.exitReason;
            diagnostic.lastError = exitAnalysis.lastError;

            if (exitAnalysis.exitCode === 137) {
                diagnostic.status = 'critical';
                diagnostic.rootCause = 'Container was killed due to out of memory (OOMKilled)';
                diagnostic.evidence.push('Exit code 137 indicates OOMKilled');
                diagnostic.suggestedFixes.push('Increase memory limit');
                diagnostic.suggestedFixes.push('Optimize application memory usage');
                diagnostic.suggestedFixes.push('Add memory limits to prevent host system crashes');
                diagnostic.confidence = 'high';
            } else if (exitAnalysis.exitCode !== 0) {
                diagnostic.status = 'critical';
                diagnostic.rootCause = `Container exited with error: ${exitAnalysis.exitReason}`;
                diagnostic.evidence.push(`Exit code: ${exitAnalysis.exitCode}`);
                if (exitAnalysis.lastError) {
                    diagnostic.evidence.push(`Last error: ${exitAnalysis.lastError.substring(0, 200)}`);
                }
                diagnostic.suggestedFixes.push('Check application logs for errors');
                diagnostic.suggestedFixes.push('Verify environment variables are correct');
                diagnostic.suggestedFixes.push('Check if required files/dependencies are present');
                diagnostic.confidence = 'high';
            }
        }

        // Analyze restart count
        if (diagnostic.restartCount > 5) {
            diagnostic.status = diagnostic.status === 'unknown' ? 'warning' : diagnostic.status;
            diagnostic.evidence.push(`Container has restarted ${diagnostic.restartCount} times`);
            if (!diagnostic.rootCause) {
                diagnostic.rootCause = 'Container is in a restart loop';
            }
            diagnostic.suggestedFixes.push('Investigate why container keeps restarting');
            diagnostic.suggestedFixes.push('Check restart policy configuration');
        }

        // Analyze memory limits
        if (details.HostConfig?.Memory) {
            const memoryLimit = details.HostConfig.Memory;
            try {
                const stats = await this.getContainerStats(containerId);
                if (stats.memoryPercent && stats.memoryPercent > 90) {
                    diagnostic.status = diagnostic.status === 'unknown' ? 'warning' : diagnostic.status;
                    diagnostic.evidence.push(`Memory usage is at ${stats.memoryPercent.toFixed(1)}% of limit`);
                    diagnostic.resourceIssues = {
                        memoryLimit,
                        memoryUsage: stats.memoryUsage,
                        memoryPercent: stats.memoryPercent,
                    };
                    diagnostic.suggestedFixes.push('Consider increasing memory limit');
                }
            } catch {
                // Stats might not be available for stopped containers
            }
        } else {
            diagnostic.status = diagnostic.status === 'unknown' ? 'warning' : diagnostic.status;
            diagnostic.evidence.push('Container has no memory limit set');
            if (!diagnostic.rootCause) {
                diagnostic.rootCause = 'Container lacks memory limits, which can crash the host system';
            }
            diagnostic.suggestedFixes.push('Add memory limit to prevent host system crashes');
            diagnostic.suggestedFixes.push('Use --memory or memory limit in docker-compose.yml');
        }

        // Check if container is running
        if (details.State.Status === 'running') {
            if (diagnostic.status === 'unknown') {
                diagnostic.status = 'healthy';
            }
        }

        return diagnostic;
    }

    /**
     * Analyze Docker image
     */
    async analyzeImage(imageId: string): Promise<ImageAnalysis> {
        this.ensureInitialized();
        
        const image = this.docker!.getImage(imageId);
        const details = await image.inspect();
        const history = await image.history();

        const issues: string[] = [];
        const recommendations: string[] = [];

        // Calculate size
        const size = details.Size || 0;
        const sizeHuman = this.formatBytes(size);

        // Detect base image
        let baseImage: string | undefined;
        if (details.Config?.Image) {
            baseImage = details.Config.Image;
        } else if (history.length > 0) {
            const firstLayer = history[history.length - 1];
            if (firstLayer.CreatedBy) {
                const match = firstLayer.CreatedBy.match(/FROM\s+(\S+)/i);
                if (match) {
                    baseImage = match[1];
                }
            }
        }

        // Check for large image
        if (size > 1024 * 1024 * 1024) { // > 1GB
            issues.push(`Image size is very large: ${sizeHuman}`);
            recommendations.push('Consider using multi-stage builds');
            recommendations.push('Remove unnecessary dependencies');
            recommendations.push('Use .dockerignore to exclude files');
        }

        // Detect base image type
        if (baseImage) {
            if (baseImage.includes('alpine')) {
                recommendations.push('Using Alpine base image (good for small size)');
            } else if (baseImage.includes('distroless')) {
                recommendations.push('Using Distroless base image (good for security)');
            }
        }

        // Analyze layers
        const layers = history.map((layer, idx) => ({
            id: layer.Id || `layer-${idx}`,
            size: layer.Size || 0,
            created: new Date(layer.Created * 1000),
            command: layer.CreatedBy,
        }));

        // Check for duplicate large layers
        const layerSizes = layers.map(l => l.size);
        const largeLayers = layerSizes.filter(s => s > 50 * 1024 * 1024); // > 50MB
        if (largeLayers.length > 2) {
            issues.push('Multiple large layers detected');
            recommendations.push('Optimize layer ordering to leverage cache');
        }

        return {
            id: imageId,
            tags: details.RepoTags || [],
            size,
            sizeHuman,
            baseImage,
            layers,
            issues,
            recommendations,
            architecture: details.Architecture,
            os: details.Os,
        };
    }

    /**
     * Analyze container networking
     */
    async analyzeNetworking(containerId: string): Promise<NetworkDiagnostic> {
        this.ensureInitialized();
        
        const container = this.docker!.getContainer(containerId);
        const details = await container.inspect();
        const containerName = details.Name.replace(/^\//, '');

        const exposedPorts: string[] = [];
        const publishedPorts: string[] = [];
        const issues: string[] = [];
        const recommendations: string[] = [];

        // Get exposed ports
        if (details.Config.ExposedPorts) {
            exposedPorts.push(...Object.keys(details.Config.ExposedPorts));
        }

        // Get published ports
        if (details.NetworkSettings?.Ports) {
            for (const [containerPort, hostConfigs] of Object.entries(details.NetworkSettings.Ports)) {
                if (hostConfigs && hostConfigs.length > 0) {
                    publishedPorts.push(containerPort);
                } else {
                    issues.push(`Port ${containerPort} is exposed but not published to host`);
                    recommendations.push(`Use -p flag or ports in docker-compose: -p ${containerPort.split('/')[0]}:${containerPort.split('/')[0]}`);
                }
            }
        }

        // Check network mode
        const networkMode = details.HostConfig?.NetworkMode || 'bridge';
        if (networkMode === 'host') {
            recommendations.push('Using host network mode (ports are directly accessible)');
        }

        return {
            containerId,
            containerName,
            exposedPorts,
            publishedPorts,
            networkMode,
            issues,
            recommendations,
        };
    }

    /**
     * Search containers
     */
    async searchContainers(query: {
        image?: string;
        status?: string;
        name?: string;
        exited?: boolean;
    }): Promise<ContainerInfo[]> {
        const allContainers = await this.getContainers(true);
        
        return allContainers.filter(container => {
            if (query.image && !container.image.includes(query.image)) {
                return false;
            }
            if (query.status && container.state !== query.status) {
                return false;
            }
            if (query.name && !container.name.includes(query.name)) {
                return false;
            }
            if (query.exited !== undefined) {
                if (query.exited && container.state !== 'exited') {
                    return false;
                }
                if (!query.exited && container.state === 'exited') {
                    return false;
                }
            }
            return true;
        });
    }

    /**
     * Safe actions - Restart container
     */
    async restartContainer(containerId: string): Promise<void> {
        this.ensureInitialized();
        const container = this.docker!.getContainer(containerId);
        await container.restart();
    }

    /**
     * Safe actions - Start container
     */
    async startContainer(containerId: string): Promise<void> {
        this.ensureInitialized();
        const container = this.docker!.getContainer(containerId);
        await container.start();
    }

    /**
     * Safe actions - Stop container
     */
    async stopContainer(containerId: string): Promise<void> {
        this.ensureInitialized();
        const container = this.docker!.getContainer(containerId);
        await container.stop();
    }

    /**
     * Analyze Docker Compose (if present)
     */
    async analyzeCompose(composePath?: string): Promise<ComposeAnalysis> {
        this.ensureInitialized();
        
        // For now, analyze running containers to infer compose services
        // In a full implementation, you'd parse docker-compose.yml
        const containers = await this.getContainers(true);
        
        const services: ComposeService[] = [];
        const dependencies: Array<{ from: string; to: string; type: string }> = [];
        const issues: string[] = [];
        const recommendations: string[] = [];

        // Group containers by common prefixes (common compose pattern)
        const serviceGroups = new Map<string, ContainerInfo[]>();
        containers.forEach(container => {
            const nameParts = container.name.split('-');
            if (nameParts.length > 1) {
                const serviceName = nameParts[0];
                if (!serviceGroups.has(serviceName)) {
                    serviceGroups.set(serviceName, []);
                }
                serviceGroups.get(serviceName)!.push(container);
            }
        });

        // Convert to compose services
        serviceGroups.forEach((containerGroup, serviceName) => {
            const firstContainer = containerGroup[0];
            services.push({
                name: serviceName,
                image: firstContainer.image,
                status: firstContainer.state === 'running' ? 'running' : 
                        firstContainer.state === 'exited' ? 'exited' : 'stopped',
            });
        });

        // Check for issues
        services.forEach(service => {
            if (service.status === 'exited') {
                issues.push(`Service ${service.name} has exited`);
            }
        });

        if (services.length === 0) {
            recommendations.push('No Docker Compose services detected');
            recommendations.push('If using docker-compose, ensure containers follow naming conventions');
        }

        return {
            services,
            dependencies,
            issues,
            recommendations,
        };
    }

    /**
     * Format bytes to human readable
     */
    private formatBytes(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * Get all images
     */
    async getImages(): Promise<Array<{
        id: string;
        tags: string[];
        size: number;
        sizeHuman: string;
        created: Date;
    }>> {
        this.ensureInitialized();
        const images = await this.docker!.listImages();
        return images.map(img => ({
            id: img.Id,
            tags: img.RepoTags || ['<none>:<none>'],
            size: img.Size,
            sizeHuman: this.formatBytes(img.Size),
            created: new Date(img.Created * 1000),
        }));
    }

    /**
     * Pull image
     */
    async pullImage(imageName: string): Promise<void> {
        this.ensureInitialized();
        return new Promise((resolve, reject) => {
            this.docker!.pull(imageName, (err, stream) => {
                if (err) {
                    reject(err);
                    return;
                }
                this.docker!.modem.followProgress(stream, (err, output) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        });
    }

    /**
     * Remove image
     */
    async removeImage(imageId: string, force: boolean = false): Promise<void> {
        this.ensureInitialized();
        const image = this.docker!.getImage(imageId);
        await image.remove({ force });
    }

    /**
     * Inspect image
     */
    async inspectImage(imageId: string): Promise<any> {
        this.ensureInitialized();
        const image = this.docker!.getImage(imageId);
        return await image.inspect();
    }

    /**
     * Get all volumes
     */
    async getVolumes(): Promise<Array<{
        name: string;
        driver: string;
        mountpoint: string;
        created: Date;
        scope: string;
    }>> {
        this.ensureInitialized();
        const volumes = await this.docker!.listVolumes();
        return (volumes.Volumes || []).map(vol => ({
            name: vol.Name,
            driver: vol.Driver,
            mountpoint: vol.Mountpoint,
            created: new Date(vol.CreatedAt || Date.now()),
            scope: vol.Scope || 'local',
        }));
    }

    /**
     * Create volume
     */
    async createVolume(name: string, driver?: string, options?: Record<string, string>): Promise<any> {
        this.ensureInitialized();
        return await this.docker!.createVolume({
            Name: name,
            Driver: driver,
            DriverOpts: options,
        });
    }

    /**
     * Remove volume
     */
    async removeVolume(volumeName: string): Promise<void> {
        this.ensureInitialized();
        const volume = this.docker!.getVolume(volumeName);
        await volume.remove();
    }

    /**
     * Inspect volume
     */
    async inspectVolume(volumeName: string): Promise<any> {
        this.ensureInitialized();
        const volume = this.docker!.getVolume(volumeName);
        return await volume.inspect();
    }

    /**
     * Get all networks
     */
    async getNetworks(): Promise<Array<{
        id: string;
        name: string;
        driver: string;
        scope: string;
        ipam?: any;
        containers?: any;
        created: Date;
    }>> {
        this.ensureInitialized();
        const networks = await this.docker!.listNetworks();
        return networks.map(net => ({
            id: net.Id,
            name: net.Name,
            driver: net.Driver,
            scope: net.Scope || 'local',
            ipam: net.IPAM,
            containers: net.Containers,
            created: new Date(net.Created || Date.now()),
        }));
    }

    /**
     * Create network
     */
    async createNetwork(name: string, driver: string = 'bridge', options?: Record<string, any>): Promise<any> {
        this.ensureInitialized();
        return await this.docker!.createNetwork({
            Name: name,
            Driver: driver,
            Options: options,
        });
    }

    /**
     * Remove network
     */
    async removeNetwork(networkId: string): Promise<void> {
        this.ensureInitialized();
        const network = this.docker!.getNetwork(networkId);
        await network.remove();
    }

    /**
     * Inspect network
     */
    async inspectNetwork(networkId: string): Promise<any> {
        this.ensureInitialized();
        const network = this.docker!.getNetwork(networkId);
        return await network.inspect();
    }

    /**
     * Pause container
     */
    async pauseContainer(containerId: string): Promise<void> {
        this.ensureInitialized();
        const container = this.docker!.getContainer(containerId);
        await container.pause();
    }

    /**
     * Unpause container
     */
    async unpauseContainer(containerId: string): Promise<void> {
        this.ensureInitialized();
        const container = this.docker!.getContainer(containerId);
        await container.unpause();
    }

    /**
     * Remove container
     */
    async removeContainer(containerId: string, force: boolean = false): Promise<void> {
        this.ensureInitialized();
        const container = this.docker!.getContainer(containerId);
        await container.remove({ force });
    }

    /**
     * Get container stats (real-time)
     */
    async getContainerStatsStream(containerId: string): Promise<NodeJS.ReadableStream> {
        this.ensureInitialized();
        const container = this.docker!.getContainer(containerId);
        return await container.stats({ stream: true }) as unknown as NodeJS.ReadableStream;
    }

    /**
     * Get container filesystem (list files)
     */
    async listContainerFiles(containerId: string, path: string = '/'): Promise<Array<{
        name: string;
        type: 'file' | 'directory';
        size?: number;
    }>> {
        this.ensureInitialized();
        // Use docker exec to list files
        const container = this.docker!.getContainer(containerId);
        const exec = await container.exec({
            Cmd: ['ls', '-la', path],
            AttachStdout: true,
            AttachStderr: true,
        });
        
        return new Promise((resolve, reject) => {
            exec.start({ hijack: true, stdin: false }, (err, stream) => {
                if (err) {
                    reject(err);
                    return;
                }
                let output = '';
                stream?.on('data', (chunk: Buffer) => {
                    output += chunk.toString();
                });
                stream?.on('end', () => {
                    // Parse ls output
                    const lines = output.split('\n').filter(l => l.trim());
                    const files: Array<{ name: string; type: 'file' | 'directory'; size?: number }> = [];
                    lines.forEach(line => {
                        const parts = line.trim().split(/\s+/);
                        if (parts.length >= 9) {
                            const type = parts[0].startsWith('d') ? 'directory' : 'file';
                            const name = parts.slice(8).join(' ');
                            if (name && name !== '.' && name !== '..') {
                                files.push({
                                    name,
                                    type,
                                    size: type === 'file' ? parseInt(parts[4]) || 0 : undefined,
                                });
                            }
                        }
                    });
                    resolve(files);
                });
                stream?.on('error', reject);
            });
        });
    }

    private ensureInitialized(): void {
        if (!this.initialized) {
            throw new Error('Docker service not initialized. Call initialize() first.');
        }
    }
}

// Singleton instance
export const dockerService = new DockerService();

