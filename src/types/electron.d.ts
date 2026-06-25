export { };

// Declare webview tag for Electron
declare namespace JSX {
    interface IntrinsicElements {
        webview: React.DetailedHTMLProps<React.WebViewHTMLAttributes<HTMLWebViewElement> & {
            src?: string;
            allowpopups?: string | boolean;
            webpreferences?: string;
            onDidAttach?: () => void;
        }, HTMLWebViewElement>;
    }
}

interface HTMLWebViewElement extends HTMLElement {
    contentWindow?: Window;
    src: string;
    allowpopups?: string | boolean;
    webpreferences?: string;
    addEventListener(type: 'did-attach', listener: () => void): void;
    getURL: () => string;
    loadURL: (url: string) => void;
    send: (channel: string, ...args: any[]) => void;
    executeJavaScript: (code: string) => Promise<any>;
}

declare global {
    interface K8sClusterProfile {
        id: string;
        name: string;
        kubeconfigPath: string;
        context: string;
        defaultNamespace?: string;
        sourceType: 'managed' | 'system';
        createdAt: string;
        lastUsedAt?: string;
    }

    interface Window {
        electronAPI: {
            config: {
                get: () => Promise<any>;
                set: (config: any) => Promise<any>;
            };
            history: {
                get: () => Promise<any>;
                add: (entry: any) => Promise<any>;
            };
            project: {
                open: () => Promise<any>;
                save: (project: any, filePath?: string) => Promise<any>;
            };
            license: {
                validate: (licenseKey?: string) => Promise<any>;
            };
            snippets: {
                get: () => Promise<any>;
                save: (snippet: any, id?: string) => Promise<any>;
                delete: (id: string) => Promise<any>;
                load: (id: string) => Promise<any>;
            };
            npm: {
                install: (packageName: string) => Promise<any>;
                list: () => Promise<any>;
            };
            jsRunner: {
                execute: (code: string, timeoutMs?: number) => Promise<any>;
            };
            terminal: {
                create: (options: {
                    kind: 'local' | 'k8s' | 'docker';
                    shell?: string;
                    cwd?: string;
                    podName?: string;
                    namespace?: string;
                    container?: string;
                    containerId?: string;
                    cols?: number;
                    rows?: number;
                }) => Promise<{ success: boolean; sessionId?: string; error?: string }>;
                write: (sessionId: string, data: string) => Promise<{ success: boolean; error?: string }>;
                resize: (sessionId: string, cols: number, rows: number) => Promise<{ success: boolean; error?: string }>;
                destroy: (sessionId: string) => Promise<{ success: boolean; error?: string }>;
                addCommand: (scope: string, command: string) => Promise<{ success: boolean; error?: string }>;
                getCommands: (
                    scope: string,
                    query?: string,
                    limit?: number,
                ) => Promise<{
                    success: boolean;
                    commands: { command: string; scope: string; timestamp: string }[];
                    error?: string;
                }>;
                clearCommands: (scope?: string) => Promise<{ success: boolean; error?: string }>;
                addSession: (session: {
                    id: string;
                    title: string;
                    scope: string;
                    kind: 'local' | 'k8s' | 'docker';
                    config: Record<string, unknown>;
                }) => Promise<{ success: boolean; session?: any; error?: string }>;
                listSessions: (limit?: number) => Promise<{
                    success: boolean;
                    sessions: {
                        id: string;
                        title: string;
                        scope: string;
                        kind: 'local' | 'k8s' | 'docker';
                        config: Record<string, unknown>;
                        startedAt: string;
                        lastActiveAt: string;
                        closedAt?: string;
                    }[];
                    error?: string;
                }>;
                touchSession: (id: string) => Promise<{ success: boolean; session?: any; error?: string }>;
                updateSession: (
                    id: string,
                    patch: { title?: string },
                ) => Promise<{ success: boolean; session?: any; error?: string }>;
                closeSession: (id: string) => Promise<{ success: boolean; session?: any; error?: string }>;
                removeSession: (id: string) => Promise<{ success: boolean; error?: string }>;
            };
            onTerminalData: (
                callback: (data: { sessionId: string; data: string }) => void,
            ) => () => void;
            onTerminalExit: (
                callback: (data: { sessionId: string; exitCode: number }) => void,
            ) => () => void;
            docker: {
                list: () => Promise<any>;
                logs: (containerId: string, tail?: number) => Promise<any>;
                stopLogs: (containerId: string) => Promise<any>;
                start: (containerId: string) => Promise<any>;
                stop: (containerId: string) => Promise<any>;
                restart: (containerId: string) => Promise<any>;
                exec: (containerId: string, command: string) => Promise<any>;
                execInput: (containerId: string, input: string) => Promise<any>;
                execStop: (containerId: string) => Promise<any>;
                shell: (containerId: string, shell?: string) => Promise<any>;
                shellInput: (containerId: string, input: string) => Promise<any>;
                shellStop: (containerId: string) => Promise<any>;
            };
            k8s: {
                clusters: {
                    list: () => Promise<{ success: boolean; clusters: K8sClusterProfile[]; activeClusterId: string | null; error?: string }>;
                    getActive: () => Promise<{ success: boolean; cluster: K8sClusterProfile | null; error?: string }>;
                    add: (payload: { name: string; configPath: string; context: string; defaultNamespace?: string }) => Promise<{ success: boolean; cluster?: K8sClusterProfile; error?: string }>;
                    activate: (clusterId: string) => Promise<{ success: boolean; cluster?: K8sClusterProfile; auth?: { success?: boolean; required?: boolean; error?: string }; error?: string }>;
                    remove: (clusterId: string) => Promise<{ success: boolean; activeCluster?: K8sClusterProfile | null; error?: string }>;
                    update: (payload: { id: string; name?: string; context?: string; defaultNamespace?: string }) => Promise<{ success: boolean; cluster?: K8sClusterProfile; error?: string }>;
                };
                pickKubeconfig: () => Promise<{ success: boolean; canceled?: boolean; filePath?: string; contexts?: string[]; defaultContext?: string; error?: string }>;
                contextsFromFile: (configPath: string) => Promise<{ success: boolean; contexts?: string[]; defaultContext?: string; error?: string }>;
                contexts: () => Promise<any>;
                currentContext: () => Promise<any>;
                useContext: (context: string) => Promise<any>;
                authenticate: () => Promise<any>;
                importConfig: (configPath: string) => Promise<any>;
                pods: (namespace?: string, options?: { metrics?: boolean }) => Promise<any>;
                namespaces: () => Promise<any>;
                logs: (podName: string, namespace: string, tail?: number, container?: string) => Promise<any>;
                stopLogs: (podName: string, namespace: string) => Promise<any>;
                portForward: (
                    podName: string,
                    namespace: string,
                    localPort: number,
                    remotePort: number,
                    address?: string,
                ) => Promise<{ success: boolean; forwardId?: string; localPort?: number; remotePort?: number; address?: string; error?: string }>;
                stopPortForward: (forwardId: string) => Promise<{ success: boolean; error?: string }>;
                stopPodPortForwards: (podName: string, namespace: string) => Promise<{ success: boolean; error?: string }>;
                exec: (podName: string, namespace: string, command: string) => Promise<any>;
                execInput: (podName: string, namespace: string, input: string) => Promise<any>;
                execStop: (podName: string, namespace: string) => Promise<any>;
                shell: (podName: string, namespace: string, shell?: string) => Promise<any>;
                shellInput: (podName: string, namespace: string, input: string) => Promise<any>;
                shellStop: (podName: string, namespace: string) => Promise<any>;
                command: (command: string) => Promise<any>;
                diagnose: (podName: string, namespace: string) => Promise<any>;
                timeline: (namespace: string, podName?: string) => Promise<any>;
                dependencyGraph: (namespace: string) => Promise<any>;
                events: (namespace?: string, fieldSelector?: string) => Promise<any>;
                search: (query: { image?: string; envVar?: string; labelSelector?: string; namespace?: string }) => Promise<any>;
                scale: (name: string, namespace: string, replicas: number, environment?: string) => Promise<any>;
                restartPod: (name: string, namespace: string, environment?: string) => Promise<any>;
                rolloutRestart: (name: string, namespace: string, environment?: string) => Promise<any>;
                deployments: (namespace?: string) => Promise<any>;
                services: (namespace?: string) => Promise<any>;
                configMaps: (namespace?: string) => Promise<any>;
                secrets: (namespace?: string) => Promise<any>;
                secretData: (
                    namespace: string,
                    name: string,
                ) => Promise<{ success: boolean; data?: Record<string, string>; error?: string }>;
                nodes: () => Promise<any>;
                statefulSets: (namespace?: string) => Promise<any>;
                jobs: (namespace?: string) => Promise<any>;
                cronJobs: (namespace?: string) => Promise<any>;
                ingresses: (namespace?: string) => Promise<any>;
                daemonSets: (namespace?: string) => Promise<any>;
                replicaSets: (namespace?: string) => Promise<any>;
            };
            notes: {
                list: () => Promise<any>;
                save: (note: any) => Promise<any>;
                delete: (noteId: string) => Promise<any>;
                load: (noteId: string) => Promise<any>;
            };
            drawings: {
                list: () => Promise<any>;
                save: (drawing: any) => Promise<any>;
                delete: (drawingId: string) => Promise<any>;
                load: (drawingId: string) => Promise<any>;
            };
            window: {
                minimize: () => Promise<void>;
                maximize: () => Promise<void>;
                close: () => Promise<void>;
                openPlanner: () => Promise<void>;
            };
            planner: {
                get: (date: string) => Promise<any>;
                getEntries: (startDate?: string, endDate?: string) => Promise<any>;
                save: (entry: any) => Promise<any>;
                delete: (date: string) => Promise<any>;
                broadcastUpdate: (date: string) => Promise<void>;
                onUpdate: (callback: (date: string) => void) => void;
            };
            habits: {
                getAll: () => Promise<any>;
                get: (habitId: string) => Promise<any>;
                save: (habit: any) => Promise<any>;
                delete: (habitId: string) => Promise<any>;
                getCompletions: (habitId: string, startDate?: string, endDate?: string) => Promise<any>;
                getAllCompletions: (startDate?: string, endDate?: string) => Promise<any>;
                setCompletion: (habitId: string, date: string, completed: boolean) => Promise<any>;
            };
            apiClient: {
                request: (requestData: any) => Promise<any>;
                get: () => Promise<any>;
                getRequest: (id: string) => Promise<any>;
                saveRequest: (request: any) => Promise<any>;
                deleteRequest: (id: string) => Promise<any>;
                save: (requests: any[]) => Promise<any>;
                getHistory: () => Promise<any>;
                saveHistory: (history: any[]) => Promise<any>;
                getConsoleLogs: () => Promise<any>;
                saveConsoleLogs: (logs: any[]) => Promise<any>;
                getEnvironments: () => Promise<any>;
                saveEnvironments: (data: { environments: any[]; activeEnvironmentId: string | null }) => Promise<any>;
            };
            folders: {
                get: (parentId?: string | null) => Promise<any>;
                save: (folder: any) => Promise<any>;
                delete: (folderId: string) => Promise<any>;
            };
            git: {
                getRepoPath: () => Promise<any>;
                pickRepoPath: () => Promise<{ success: boolean; repoPath?: string; canceled?: boolean; error?: string }>;
                setRepoPath: (repoPath: string) => Promise<any>;
                initRepo: (repoPath: string) => Promise<any>;
                checkIfRepo: (repoPath: string) => Promise<any>;
                sync: (filePaths?: string[], commitMessage?: string) => Promise<any>;
                status: () => Promise<any>;
                pull: () => Promise<any>;
                getSyncState: () => Promise<{
                    success: boolean;
                    state?: {
                        isRepo: boolean;
                        isOnline: boolean;
                        isSyncing: boolean;
                        pendingFileCount: number;
                        unpushedCommits: number;
                        hasUncommittedChanges: boolean;
                        lastError: string | null;
                    };
                    error?: string;
                }>;
                retryPendingSync: () => Promise<any>;
                onSyncStateChange: (callback: (state: any) => void) => void;
            };
            app: {
                getArchMismatch: () => Promise<{
                    mismatch?: boolean;
                    appArch?: string;
                    machineArch?: string;
                    message?: string;
                    releasesUrl?: string;
                } | null>;
            };
            updater: {
                checkForUpdates: () => Promise<any>;
                downloadUpdate: () => Promise<any>;
                quitAndInstall: () => Promise<any>;
                getAppVersion: () => Promise<any>;
                getStatus: () => Promise<{
                    enabled: boolean;
                    checksEnabled: boolean;
                    autoInstallSupported: boolean;
                    signing: string;
                    hint?: string;
                }>;
                onCheckingForUpdate: (callback: () => void) => void;
                onUpdateAvailable: (callback: (info: any) => void) => void;
                onUpdateNotAvailable: (callback: (info: any) => void) => void;
                onUpdateError: (callback: (error: any) => void) => void;
                onDownloadProgress: (callback: (progress: any) => void) => void;
                onUpdateDownloaded: (callback: (info: any) => void) => void;
            };
            auth: {
                openOAuth: (url: string) => Promise<string>;
            };
            dialog: {
                saveFile: (options: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) => Promise<{ canceled: boolean; filePath?: string; error?: string }>;
            };
            file: {
                writeImage: (filePath: string, base64Data: string) => Promise<{ success: boolean; error?: string }>;
            };
            onLicenseValidated: (callback: (data: any) => void) => void;
            onLicenseInvalid: (callback: (data: any) => void) => void;
            onDockerLog: (callback: (data: any) => void) => void;
            onDockerShellOutput: (callback: (data: any) => void) => void;
            onDockerExecOutput: (callback: (data: any) => void) => void;
            onDockerExecExit: (callback: (data: any) => void) => void;
            onK8sLog: (callback: (data: any) => void) => void;
            onK8sShellOutput: (callback: (data: any) => void) => void;
            onK8sExecOutput: (callback: (data: any) => void) => void;
            onK8sExecExit: (callback: (data: any) => void) => void;
            onK8sPortForwardExit: (
                callback: (data: { forwardId: string; exitCode?: number; error?: string }) => void,
            ) => () => void;
            onK8sPortForwardMessage: (
                callback: (data: { forwardId: string; message: string }) => void,
            ) => () => void;
        };
    }
}

