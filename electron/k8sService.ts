import * as k8s from '@kubernetes/client-node';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';

/**
 * Production-grade Kubernetes service layer for DevBench
 * Provides intelligent analysis, diagnosis, and safe actions
 */

export interface K8sResource {
    kind: string;
    name: string;
    namespace?: string;
    metadata: any;
    spec?: any;
    status?: any;
}

export interface PodDiagnostic {
    podName: string;
    namespace: string;
    status: 'healthy' | 'warning' | 'critical' | 'unknown';
    rootCause?: string;
    evidence: string[];
    suggestedFixes: string[];
    resourceUsage?: {
        cpu?: { request?: string; limit?: string; usage?: string; throttled?: boolean };
        memory?: { request?: string; limit?: string; usage?: string; oomKilled?: boolean };
    };
    restartCount: number;
    lastRestart?: Date;
    events: K8sEvent[];
}

export interface K8sEvent {
    type: 'Normal' | 'Warning';
    reason: string;
    message: string;
    timestamp: Date;
    source: string;
    count?: number;
    firstTimestamp?: Date;
    lastTimestamp?: Date;
}

export interface TimelineEvent {
    timestamp: Date;
    type: 'deployment' | 'config' | 'secret' | 'scale' | 'image' | 'crash' | 'other';
    source: string;
    resource: string;
    namespace: string;
    description: string;
    severity: 'info' | 'warning' | 'error';
    metadata?: any;
}

export interface DependencyNode {
    id: string;
    type: 'ingress' | 'service' | 'pod' | 'deployment' | 'statefulset';
    name: string;
    namespace: string;
    status: 'healthy' | 'warning' | 'broken';
    metadata?: any;
}

export interface DependencyEdge {
    from: string;
    to: string;
    type: 'routes' | 'selects' | 'manages';
    status: 'healthy' | 'broken';
    issue?: string;
}

export interface DependencyGraph {
    nodes: DependencyNode[];
    edges: DependencyEdge[];
}

export class K8sService {
    private kc: k8s.KubeConfig;
    private k8sApi: k8s.CoreV1Api;
    private appsV1Api: k8s.AppsV1Api;
    private networkingV1Api: k8s.NetworkingV1Api;
    private batchV1Api: k8s.BatchV1Api;
    private customObjectsApi: k8s.CustomObjectsApi;
    private watch: k8s.Watch;
    private initialized: boolean = false;

    constructor() {
        this.kc = new k8s.KubeConfig();
        this.watch = new k8s.Watch(this.kc);
    }

    /**
     * Initialize Kubernetes client with kubeconfig or in-cluster config
     */
    async initialize(kubeconfigPath?: string): Promise<void> {
        try {
            if (kubeconfigPath) {
                this.kc.loadFromFile(kubeconfigPath);
            } else {
                // Try in-cluster first, fallback to default kubeconfig
                try {
                    this.kc.loadFromCluster();
                } catch {
                    const defaultPath = path.join(os.homedir(), '.kube', 'config');
                    this.kc.loadFromFile(defaultPath);
                }
            }

            this.k8sApi = this.kc.makeApiClient(k8s.CoreV1Api);
            this.appsV1Api = this.kc.makeApiClient(k8s.AppsV1Api);
            this.networkingV1Api = this.kc.makeApiClient(k8s.NetworkingV1Api);
            this.batchV1Api = this.kc.makeApiClient(k8s.BatchV1Api);
            this.customObjectsApi = this.kc.makeApiClient(k8s.CustomObjectsApi);

            this.initialized = true;
        } catch (error: any) {
            throw new Error(`Failed to initialize Kubernetes client: ${error.message}`);
        }
    }

    /**
     * Get current context
     */
    getCurrentContext(): string {
        return this.kc.getCurrentContext();
    }

    /**
     * Get all contexts
     */
    getContexts(): string[] {
        return this.kc.getContexts().map(ctx => ctx.name);
    }

    /**
     * Set current context
     */
    setContext(contextName: string): void {
        this.kc.setCurrentContext(contextName);
        // Reinitialize APIs with new context
        this.k8sApi = this.kc.makeApiClient(k8s.CoreV1Api);
        this.appsV1Api = this.kc.makeApiClient(k8s.AppsV1Api);
        this.networkingV1Api = this.kc.makeApiClient(k8s.NetworkingV1Api);
        this.batchV1Api = this.kc.makeApiClient(k8s.BatchV1Api);
    }

    /**
     * Load kubeconfig from file and merge with existing
     */
    async importKubeconfig(configPath: string): Promise<void> {
        const configContent = await fs.readFile(configPath, 'utf-8');
        const defaultPath = path.join(os.homedir(), '.kube', 'config');
        
        // Ensure .kube directory exists
        await fs.mkdir(path.dirname(defaultPath), { recursive: true });
        
        // Merge configs
        let existingContent = '';
        try {
            existingContent = await fs.readFile(defaultPath, 'utf-8');
        } catch {
            // Config doesn't exist, create new one
        }
        
        const merged = existingContent ? `${existingContent}\n---\n${configContent}` : configContent;
        await fs.writeFile(defaultPath, merged, 'utf-8');
        
        // Reload config
        this.kc.loadFromFile(defaultPath);
        this.k8sApi = this.kc.makeApiClient(k8s.CoreV1Api);
        this.appsV1Api = this.kc.makeApiClient(k8s.AppsV1Api);
        this.networkingV1Api = this.kc.makeApiClient(k8s.NetworkingV1Api);
        this.batchV1Api = this.kc.makeApiClient(k8s.BatchV1Api);
    }

    /**
     * Get all namespaces
     */
    async getNamespaces(): Promise<k8s.V1Namespace[]> {
        this.ensureInitialized();
        const response = await this.k8sApi.listNamespace();
        return response.body.items;
    }

    /**
     * Get all nodes
     */
    async getNodes(): Promise<k8s.V1Node[]> {
        this.ensureInitialized();
        const response = await this.k8sApi.listNode();
        return response.body.items;
    }

    /**
     * Get pods (optionally filtered by namespace)
     */
    async getPods(namespace?: string): Promise<k8s.V1Pod[]> {
        this.ensureInitialized();
        const response = namespace
            ? await this.k8sApi.listNamespacedPod(namespace)
            : await this.k8sApi.listPodForAllNamespaces();
        return response.body.items;
    }

    /**
     * Get deployments
     */
    async getDeployments(namespace?: string): Promise<k8s.V1Deployment[]> {
        this.ensureInitialized();
        const response = namespace
            ? await this.appsV1Api.listNamespacedDeployment(namespace)
            : await this.appsV1Api.listDeploymentForAllNamespaces();
        return response.body.items;
    }

    /**
     * Get StatefulSets
     */
    async getStatefulSets(namespace?: string): Promise<k8s.V1StatefulSet[]> {
        this.ensureInitialized();
        const response = namespace
            ? await this.appsV1Api.listNamespacedStatefulSet(namespace)
            : await this.appsV1Api.listStatefulSetForAllNamespaces();
        return response.body.items;
    }

    /**
     * Get Jobs
     */
    async getJobs(namespace?: string): Promise<k8s.V1Job[]> {
        this.ensureInitialized();
        const response = namespace
            ? await this.batchV1Api.listNamespacedJob(namespace)
            : await this.batchV1Api.listJobForAllNamespaces();
        return response.body.items;
    }

    /**
     * Get CronJobs
     */
    async getCronJobs(namespace?: string): Promise<k8s.V1CronJob[]> {
        this.ensureInitialized();
        const response = namespace
            ? await this.batchV1Api.listNamespacedCronJob(namespace)
            : await this.batchV1Api.listCronJobForAllNamespaces();
        return response.body.items;
    }

    /**
     * Get Services
     */
    async getServices(namespace?: string): Promise<k8s.V1Service[]> {
        this.ensureInitialized();
        const response = namespace
            ? await this.k8sApi.listNamespacedService(namespace)
            : await this.k8sApi.listServiceForAllNamespaces();
        return response.body.items;
    }

    /**
     * Get Ingress resources
     */
    async getIngresses(namespace?: string): Promise<k8s.V1Ingress[]> {
        this.ensureInitialized();
        const response = namespace
            ? await this.networkingV1Api.listNamespacedIngress(namespace)
            : await this.networkingV1Api.listIngressForAllNamespaces();
        return response.body.items;
    }

    /**
     * Get ConfigMaps
     */
    async getConfigMaps(namespace?: string): Promise<k8s.V1ConfigMap[]> {
        this.ensureInitialized();
        const response = namespace
            ? await this.k8sApi.listNamespacedConfigMap(namespace)
            : await this.k8sApi.listConfigMapForAllNamespaces();
        return response.body.items;
    }

    /**
     * Get Secrets (metadata only, values masked)
     */
    async getSecrets(namespace?: string): Promise<any[]> {
        this.ensureInitialized();
        const response = namespace
            ? await this.k8sApi.listNamespacedSecret(namespace)
            : await this.k8sApi.listSecretForAllNamespaces();
        
        // Mask secret values for security
        return response.body.items.map(secret => ({
            ...secret,
            data: secret.data ? Object.keys(secret.data).reduce((acc, key) => {
                acc[key] = '***MASKED***';
                return acc;
            }, {} as any) : undefined,
        }));
    }

    /**
     * Get events for a namespace or pod
     */
    async getEvents(namespace?: string, fieldSelector?: string): Promise<K8sEvent[]> {
        this.ensureInitialized();
        try {
            const response = namespace
                ? await this.k8sApi.listNamespacedEvent(
                    namespace,
                    undefined, // pretty
                    undefined, // allowWatchBookmarks
                    undefined, // continue
                    fieldSelector, // fieldSelector
                    undefined, // labelSelector
                    undefined, // limit
                    undefined, // resourceVersion
                    undefined, // resourceVersionMatch
                    undefined, // timeoutSeconds
                    undefined  // watch
                )
                : await this.k8sApi.listEventForAllNamespaces(
                    undefined, // allowWatchBookmarks
                    undefined, // continue
                    fieldSelector, // fieldSelector
                    undefined, // labelSelector
                    undefined, // limit
                    undefined, // resourceVersion
                    undefined, // resourceVersionMatch
                    undefined, // timeoutSeconds
                    undefined  // watch
                );
            
            return response.body.items.map(event => ({
                type: event.type || 'Normal',
                reason: event.reason || '',
                message: event.message || '',
                timestamp: event.lastTimestamp ? new Date(event.lastTimestamp) : new Date(),
                source: event.source?.component || 'unknown',
                count: event.count,
                firstTimestamp: event.firstTimestamp ? new Date(event.firstTimestamp) : undefined,
                lastTimestamp: event.lastTimestamp ? new Date(event.lastTimestamp) : undefined,
            }));
        } catch (error: any) {
            // If events API fails, return empty array
            console.error('Failed to fetch events:', error);
            return [];
        }
    }

    /**
     * Get pod logs
     */
    async getPodLogs(podName: string, namespace: string, container?: string, tailLines: number = 100): Promise<string> {
        this.ensureInitialized();
        const response = await this.k8sApi.readNamespacedPodLog(
            podName,
            namespace,
            container,
            false, // follow
            undefined, // limitBytes
            undefined, // pretty
            undefined, // previous (for previous container instance)
            tailLines
        );
        return response.body;
    }

    /**
     * Get previous container logs (for crashed containers)
     */
    async getPreviousPodLogs(podName: string, namespace: string, container?: string, tailLines: number = 100): Promise<string> {
        this.ensureInitialized();
        const response = await this.k8sApi.readNamespacedPodLog(
            podName,
            namespace,
            container,
            false,
            undefined,
            undefined,
            true, // previous = true
            tailLines
        );
        return response.body;
    }

    /**
     * Diagnose a pod - comprehensive analysis
     */
    async diagnosePod(podName: string, namespace: string): Promise<PodDiagnostic> {
        this.ensureInitialized();
        
        const pod = await this.k8sApi.readNamespacedPod(podName, namespace);
        const podData = pod.body;
        
        const events = await this.getEvents(namespace, `involvedObject.name=${podName}`);
        const diagnostic: PodDiagnostic = {
            podName,
            namespace,
            status: 'unknown',
            evidence: [],
            suggestedFixes: [],
            restartCount: 0,
            events: events,
        };

        // Analyze container statuses
        if (podData.status?.containerStatuses) {
            for (const containerStatus of podData.status.containerStatuses) {
                diagnostic.restartCount += containerStatus.restartCount || 0;
                
                // Check for OOM kills
                if (containerStatus.lastState?.terminated?.reason === 'OOMKilled') {
                    diagnostic.status = 'critical';
                    diagnostic.rootCause = 'Container killed due to memory limit exceeded';
                    diagnostic.evidence.push(`Container ${containerStatus.name} was OOMKilled`);
                    diagnostic.suggestedFixes.push('Increase memory limit');
                    diagnostic.suggestedFixes.push('Check for memory leaks in application');
                }
                
                // Check for crash loop
                if (containerStatus.state?.waiting?.reason === 'CrashLoopBackOff') {
                    diagnostic.status = 'critical';
                    diagnostic.rootCause = 'Container is crash looping';
                    diagnostic.evidence.push(`Container ${containerStatus.name} is in CrashLoopBackOff state`);
                    diagnostic.suggestedFixes.push('Check container logs for errors');
                    diagnostic.suggestedFixes.push('Verify application configuration');
                }
                
                // Check for image pull errors
                if (containerStatus.state?.waiting?.reason === 'ImagePullBackOff' || 
                    containerStatus.state?.waiting?.reason === 'ErrImagePull') {
                    diagnostic.status = 'critical';
                    diagnostic.rootCause = 'Failed to pull container image';
                    diagnostic.evidence.push(`Image pull failed: ${containerStatus.state.waiting.message || 'Unknown error'}`);
                    diagnostic.suggestedFixes.push('Verify image name and tag');
                    diagnostic.suggestedFixes.push('Check image pull secrets');
                    diagnostic.suggestedFixes.push('Verify registry access');
                }
            }
        }

        // Analyze resource requests/limits
        if (podData.spec?.containers) {
            for (const container of podData.spec.containers) {
                const resources = container.resources;
                if (resources) {
                    if (!diagnostic.resourceUsage) {
                        diagnostic.resourceUsage = {};
                    }
                    
                    diagnostic.resourceUsage.cpu = {
                        request: resources.requests?.cpu,
                        limit: resources.limits?.cpu,
                    };
                    
                    diagnostic.resourceUsage.memory = {
                        request: resources.requests?.memory,
                        limit: resources.limits?.memory,
                    };
                }
            }
        }

        // Analyze events for additional issues
        for (const event of events) {
            if (event.type === 'Warning') {
                if (event.reason === 'Failed') {
                    diagnostic.evidence.push(`Warning: ${event.message}`);
                    if (diagnostic.status === 'unknown') {
                        diagnostic.status = 'warning';
                    }
                }
            }
            
            // Check for probe failures
            if (event.reason === 'Unhealthy' || event.message.includes('probe')) {
                diagnostic.evidence.push(`Health probe failed: ${event.message}`);
                diagnostic.suggestedFixes.push('Check health probe configuration');
                diagnostic.suggestedFixes.push('Verify application health endpoint');
            }
        }

        // Determine overall status if not already set
        if (diagnostic.status === 'unknown') {
            const phase = podData.status?.phase;
            if (phase === 'Running') {
                diagnostic.status = 'healthy';
            } else if (phase === 'Pending') {
                diagnostic.status = 'warning';
                diagnostic.evidence.push('Pod is in Pending state');
            } else if (phase === 'Failed') {
                diagnostic.status = 'critical';
                if (!diagnostic.rootCause) {
                    diagnostic.rootCause = 'Pod has failed';
                }
            }
        }

        return diagnostic;
    }

    /**
     * Build change timeline for a pod or namespace
     */
    async getTimeline(namespace: string, podName?: string): Promise<TimelineEvent[]> {
        this.ensureInitialized();
        const timeline: TimelineEvent[] = [];

        // Get deployments
        const deployments = await this.getDeployments(namespace);
        for (const deployment of deployments) {
            if (podName && !deployment.metadata?.name.includes(podName.split('-')[0])) {
                continue;
            }
            
            timeline.push({
                timestamp: new Date(deployment.metadata?.creationTimestamp || Date.now()),
                type: 'deployment',
                source: 'deployment',
                resource: deployment.metadata?.name || '',
                namespace: namespace,
                description: `Deployment ${deployment.metadata?.name} created`,
                severity: 'info',
                metadata: {
                    replicas: deployment.spec?.replicas,
                    image: deployment.spec?.template.spec?.containers[0]?.image,
                },
            });
        }

        // Get ConfigMap changes (approximate - K8s doesn't track history)
        const configMaps = await this.getConfigMaps(namespace);
        for (const cm of configMaps) {
            timeline.push({
                timestamp: new Date(cm.metadata?.creationTimestamp || Date.now()),
                type: 'config',
                source: 'configmap',
                resource: cm.metadata?.name || '',
                namespace: namespace,
                description: `ConfigMap ${cm.metadata?.name} exists`,
                severity: 'info',
            });
        }

        // Get events
        const events = await this.getEvents(namespace, podName ? `involvedObject.name=${podName}` : undefined);
        for (const event of events) {
            let type: TimelineEvent['type'] = 'other';
            let severity: TimelineEvent['severity'] = event.type === 'Warning' ? 'warning' : 'info';
            
            if (event.reason.includes('Created') || event.reason.includes('Started')) {
                type = 'deployment';
            } else if (event.reason.includes('Killing') || event.reason.includes('Failed')) {
                type = 'crash';
                severity = 'error';
            }
            
            timeline.push({
                timestamp: event.timestamp,
                type,
                source: event.source,
                resource: podName || 'unknown',
                namespace: namespace,
                description: event.message,
                severity,
            });
        }

        // Sort by timestamp
        timeline.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        
        return timeline;
    }

    /**
     * Build dependency graph for a namespace
     */
    async getDependencyGraph(namespace: string): Promise<DependencyGraph> {
        this.ensureInitialized();
        const nodes: DependencyNode[] = [];
        const edges: DependencyEdge[] = [];

        // Get all resources
        const [ingresses, services, pods, deployments] = await Promise.all([
            this.getIngresses(namespace),
            this.getServices(namespace),
            this.getPods(namespace),
            this.getDeployments(namespace),
        ]);

        // Add ingress nodes
        for (const ingress of ingresses) {
            nodes.push({
                id: `ingress-${ingress.metadata?.name}`,
                type: 'ingress',
                name: ingress.metadata?.name || '',
                namespace: namespace,
                status: 'healthy',
            });
        }

        // Add service nodes
        for (const service of services) {
            const endpoints = await this.k8sApi.readNamespacedEndpoints(
                service.metadata?.name || '',
                namespace
            ).catch(() => null);
            
            const hasEndpoints = endpoints?.body.subsets && endpoints.body.subsets.length > 0;
            
            nodes.push({
                id: `service-${service.metadata?.name}`,
                type: 'service',
                name: service.metadata?.name || '',
                namespace: namespace,
                status: hasEndpoints ? 'healthy' : 'broken',
            });

            // Link ingress to service
            if (ingresses.some(ing => 
                ing.spec?.rules?.some(rule => 
                    rule.http?.paths?.some(path => path.backend.service?.name === service.metadata?.name)
                )
            )) {
                const ingress = ingresses.find(ing => 
                    ing.spec?.rules?.some(rule => 
                        rule.http?.paths?.some(path => path.backend.service?.name === service.metadata?.name)
                    )
                );
                
                if (ingress) {
                    edges.push({
                        from: `ingress-${ingress.metadata?.name}`,
                        to: `service-${service.metadata?.name}`,
                        type: 'routes',
                        status: hasEndpoints ? 'healthy' : 'broken',
                        issue: hasEndpoints ? undefined : 'Service has no endpoints',
                    });
                }
            }

            // Link service to pods via selectors
            const selector = service.spec?.selector;
            if (selector) {
                const matchingPods = pods.filter(pod => {
                    const labels = pod.metadata?.labels || {};
                    return Object.keys(selector).every(key => labels[key] === selector[key]);
                });

                for (const pod of matchingPods) {
                    const podId = `pod-${pod.metadata?.name}`;
                    
                    // Add pod node if not already added
                    if (!nodes.find(n => n.id === podId)) {
                        const phase = pod.status?.phase || 'Unknown';
                        nodes.push({
                            id: podId,
                            type: 'pod',
                            name: pod.metadata?.name || '',
                            namespace: namespace,
                            status: phase === 'Running' ? 'healthy' : phase === 'Failed' ? 'broken' : 'warning',
                        });
                    }

                    edges.push({
                        from: `service-${service.metadata?.name}`,
                        to: podId,
                        type: 'selects',
                        status: matchingPods.length > 0 ? 'healthy' : 'broken',
                    });
                }

                if (matchingPods.length === 0) {
                    edges.push({
                        from: `service-${service.metadata?.name}`,
                        to: `service-${service.metadata?.name}`,
                        type: 'selects',
                        status: 'broken',
                        issue: 'No pods match service selector',
                    });
                }
            }
        }

        // Link deployments to pods
        for (const deployment of deployments) {
            const deploymentId = `deployment-${deployment.metadata?.name}`;
            nodes.push({
                id: deploymentId,
                type: 'deployment',
                name: deployment.metadata?.name || '',
                namespace: namespace,
                status: 'healthy',
            });

            const selector = deployment.spec?.selector?.matchLabels;
            if (selector) {
                const matchingPods = pods.filter(pod => {
                    const labels = pod.metadata?.labels || {};
                    return Object.keys(selector).every(key => labels[key] === selector[key]);
                });

                for (const pod of matchingPods) {
                    const podId = `pod-${pod.metadata?.name}`;
                    edges.push({
                        from: deploymentId,
                        to: podId,
                        type: 'manages',
                        status: 'healthy',
                    });
                }
            }
        }

        return { nodes, edges };
    }

    /**
     * Auto-diagnose a failing pod
     */
    async autoDiagnose(podName: string, namespace: string): Promise<PodDiagnostic> {
        return this.diagnosePod(podName, namespace);
    }

    /**
     * Search for resources
     */
    async search(query: {
        image?: string;
        envVar?: string;
        labelSelector?: string;
        namespace?: string;
    }): Promise<{
        pods: k8s.V1Pod[];
        deployments: k8s.V1Deployment[];
        services: k8s.V1Service[];
    }> {
        this.ensureInitialized();
        
        const results = {
            pods: [] as k8s.V1Pod[],
            deployments: [] as k8s.V1Deployment[],
            services: [] as k8s.V1Service[],
        };

        // Search pods
        const pods = await this.getPods(query.namespace);
        for (const pod of pods) {
            let matches = true;
            
            if (query.image) {
                matches = pod.spec?.containers?.some(c => c.image?.includes(query.image)) || false;
            }
            
            if (query.envVar && matches) {
                matches = pod.spec?.containers?.some(c => 
                    c.env?.some(e => e.name === query.envVar)
                ) || false;
            }
            
            if (query.labelSelector && matches) {
                const [key, value] = query.labelSelector.split('=');
                matches = pod.metadata?.labels?.[key] === value;
            }
            
            if (matches) {
                results.pods.push(pod);
            }
        }

        // Search deployments
        const deployments = await this.getDeployments(query.namespace);
        for (const deployment of deployments) {
            let matches = true;
            
            if (query.image) {
                matches = deployment.spec?.template.spec?.containers?.some(c => 
                    c.image?.includes(query.image)
                ) || false;
            }
            
            if (query.envVar && matches) {
                matches = deployment.spec?.template.spec?.containers?.some(c => 
                    c.env?.some(e => e.name === query.envVar)
                ) || false;
            }
            
            if (matches) {
                results.deployments.push(deployment);
            }
        }

        // Search services
        const services = await this.getServices(query.namespace);
        if (query.labelSelector) {
            const [key, value] = query.labelSelector.split('=');
            results.services = services.filter(s => s.metadata?.labels?.[key] === value);
        } else {
            results.services = services;
        }

        return results;
    }

    /**
     * Safe actions - Scale deployment
     */
    async scaleDeployment(name: string, namespace: string, replicas: number, environment?: string): Promise<void> {
        this.ensureInitialized();
        
        // Guard: prevent scaling in production without explicit confirmation
        if (environment === 'production' || namespace.includes('prod')) {
            throw new Error('Cannot scale in production without explicit confirmation');
        }
        
        await this.appsV1Api.patchNamespacedDeployment(
            name,
            namespace,
            {
                spec: { replicas },
            },
            undefined,
            undefined,
            undefined,
            undefined,
            {
                headers: { 'Content-Type': 'application/merge-patch+json' },
            }
        );
    }

    /**
     * Safe actions - Restart pod
     */
    async restartPod(name: string, namespace: string, environment?: string): Promise<void> {
        this.ensureInitialized();
        
        if (environment === 'production' || namespace.includes('prod')) {
            throw new Error('Cannot restart pod in production without explicit confirmation');
        }
        
        await this.k8sApi.deleteNamespacedPod(name, namespace);
    }

    /**
     * Safe actions - Rollout restart deployment
     */
    async rolloutRestart(name: string, namespace: string, environment?: string): Promise<void> {
        this.ensureInitialized();
        
        if (environment === 'production' || namespace.includes('prod')) {
            throw new Error('Cannot restart deployment in production without explicit confirmation');
        }
        
        // Add annotation to trigger rollout restart
        const deployment = await this.appsV1Api.readNamespacedDeployment(name, namespace);
        const annotations = deployment.body.metadata?.annotations || {};
        annotations['kubectl.kubernetes.io/restartedAt'] = new Date().toISOString();
        
        await this.appsV1Api.patchNamespacedDeployment(
            name,
            namespace,
            {
                metadata: { annotations },
            },
            undefined,
            undefined,
            undefined,
            undefined,
            {
                headers: { 'Content-Type': 'application/merge-patch+json' },
            }
        );
    }

    private ensureInitialized(): void {
        if (!this.initialized) {
            throw new Error('Kubernetes service not initialized. Call initialize() first.');
        }
    }
}

// Singleton instance
export const k8sService = new K8sService();

