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
                contexts: () => Promise<any>;
                currentContext: () => Promise<any>;
                useContext: (context: string) => Promise<any>;
                importConfig: (configPath: string) => Promise<any>;
                pods: (namespace?: string) => Promise<any>;
                namespaces: () => Promise<any>;
                logs: (podName: string, namespace: string, tail?: number) => Promise<any>;
                stopLogs: (podName: string, namespace: string) => Promise<any>;
                exec: (podName: string, namespace: string, command: string) => Promise<any>;
                execInput: (podName: string, namespace: string, input: string) => Promise<any>;
                execStop: (podName: string, namespace: string) => Promise<any>;
                shell: (podName: string, namespace: string, shell?: string) => Promise<any>;
                shellInput: (podName: string, namespace: string, input: string) => Promise<any>;
                shellStop: (podName: string, namespace: string) => Promise<any>;
                command: (command: string) => Promise<any>;
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
                getRepoPath: () => Promise<{ success: boolean; repoPath?: string; error?: string }>;
                setRepoPath: (repoPath: string) => Promise<any>;
                initRepo: (repoPath: string) => Promise<any>;
                checkIfRepo: (repoPath: string) => Promise<any>;
                sync: (filePaths?: string[], commitMessage?: string) => Promise<any>;
                status: () => Promise<any>;
                pull: () => Promise<any>;
            };
            updater: {
                checkForUpdates: () => Promise<any>;
                downloadUpdate: () => Promise<any>;
                quitAndInstall: () => Promise<any>;
                getAppVersion: () => Promise<any>;
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
        };
    }
}

