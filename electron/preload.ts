import { contextBridge, ipcRenderer } from 'electron';

console.log('[Preload] Preload script loaded');

try {
    contextBridge.exposeInMainWorld('electronAPI', {
        config: {
            get: () => ipcRenderer.invoke('config:get'),
            set: (config: any) => ipcRenderer.invoke('config:set', config),
        },
        history: {
            get: () => ipcRenderer.invoke('history:get'),
            add: (entry: any) => ipcRenderer.invoke('history:add', entry),
        },
        project: {
            open: () => ipcRenderer.invoke('project:open'),
            save: (project: any, filePath?: string) =>
                ipcRenderer.invoke('project:save', project, filePath),
        },
        license: {
            validate: (licenseKey?: string) =>
                ipcRenderer.invoke('license:validate', licenseKey),
        },
        snippets: {
            get: () => ipcRenderer.invoke('snippets:get'),
            save: (snippet: any, id?: string) => ipcRenderer.invoke('snippets:save', snippet, id),
            delete: (id: string) => ipcRenderer.invoke('snippets:delete', id),
            load: (id: string) => ipcRenderer.invoke('snippets:load', id),
        },
        npm: {
            install: (packageName: string) => ipcRenderer.invoke('npm:install', packageName),
            list: () => ipcRenderer.invoke('npm:list'),
        },
        docker: {
            list: () => ipcRenderer.invoke('docker:list'),
            logs: (containerId: string, tail?: number) => ipcRenderer.invoke('docker:logs', containerId, tail),
            stopLogs: (containerId: string) => ipcRenderer.invoke('docker:stopLogs', containerId),
            start: (containerId: string) => ipcRenderer.invoke('docker:start', containerId),
            stop: (containerId: string) => ipcRenderer.invoke('docker:stop', containerId),
            restart: (containerId: string) => ipcRenderer.invoke('docker:restart', containerId),
            pause: (containerId: string) => ipcRenderer.invoke('docker:pause', containerId),
            unpause: (containerId: string) => ipcRenderer.invoke('docker:unpause', containerId),
            remove: (containerId: string, force?: boolean) => ipcRenderer.invoke('docker:remove', containerId, force),
            exec: (containerId: string, command: string) => ipcRenderer.invoke('docker:exec', containerId, command),
            shell: (containerId: string, shell?: string) => ipcRenderer.invoke('docker:shell', containerId, shell),
            shellInput: (containerId: string, input: string) => ipcRenderer.invoke('docker:shell:input', containerId, input),
            shellStop: (containerId: string) => ipcRenderer.invoke('docker:shell:stop', containerId),
            // Images
            images: () => ipcRenderer.invoke('docker:images'),
            pullImage: (imageName: string) => ipcRenderer.invoke('docker:pullImage', imageName),
            removeImage: (imageId: string, force?: boolean) => ipcRenderer.invoke('docker:removeImage', imageId, force),
            inspectImage: (imageId: string) => ipcRenderer.invoke('docker:inspectImage', imageId),
            // Volumes
            volumes: () => ipcRenderer.invoke('docker:volumes'),
            createVolume: (name: string, driver?: string, options?: Record<string, string>) => ipcRenderer.invoke('docker:createVolume', name, driver, options),
            removeVolume: (volumeName: string) => ipcRenderer.invoke('docker:removeVolume', volumeName),
            inspectVolume: (volumeName: string) => ipcRenderer.invoke('docker:inspectVolume', volumeName),
            // Networks
            networks: () => ipcRenderer.invoke('docker:networks'),
            createNetwork: (name: string, driver?: string, options?: Record<string, any>) => ipcRenderer.invoke('docker:createNetwork', name, driver, options),
            removeNetwork: (networkId: string) => ipcRenderer.invoke('docker:removeNetwork', networkId),
            inspectNetwork: (networkId: string) => ipcRenderer.invoke('docker:inspectNetwork', networkId),
            // Files
            listFiles: (containerId: string, path?: string) => ipcRenderer.invoke('docker:listFiles', containerId, path),
            // New intelligent features
            diagnose: (containerId: string) => ipcRenderer.invoke('docker:diagnose', containerId),
            analyzeExit: (containerId: string) => ipcRenderer.invoke('docker:analyze-exit', containerId),
            stats: (containerId: string) => ipcRenderer.invoke('docker:stats', containerId),
            analyzeImage: (imageId: string) => ipcRenderer.invoke('docker:analyze-image', imageId),
            analyzeNetworking: (containerId: string) => ipcRenderer.invoke('docker:analyze-networking', containerId),
            analyzeCompose: (composePath?: string) => ipcRenderer.invoke('docker:analyze-compose', composePath),
            search: (query: { image?: string; status?: string; name?: string; exited?: boolean }) => ipcRenderer.invoke('docker:search', query),
            containerInfo: (containerId: string) => ipcRenderer.invoke('docker:container-info', containerId),
        },
        jsRunner: {
            execute: (code: string, timeoutMs?: number) => ipcRenderer.invoke('jsRunner:execute', code, timeoutMs),
        },
        onLicenseValidated: (callback: (data: any) => void) => {
            ipcRenderer.on('license:validated', (_event: any, data: any) => callback(data));
        },
        onLicenseInvalid: (callback: (data: any) => void) => {
            ipcRenderer.on('license:invalid', (_event: any, data: any) => callback(data));
        },
        onDockerLog: (callback: (data: any) => void) => {
            ipcRenderer.on('docker:log', (_event: any, data: any) => callback(data));
        },
        onDockerShellOutput: (callback: (data: any) => void) => {
            ipcRenderer.on('docker:shell:output', (_event: any, data: any) => callback(data));
        },
        onDockerExecOutput: (callback: (data: any) => void) => {
            ipcRenderer.on('docker:exec:output', (_event: any, data: any) => callback(data));
        },
        onDockerExecExit: (callback: (data: any) => void) => {
            ipcRenderer.on('docker:exec:exit', (_event: any, data: any) => callback(data));
        },
        k8s: {
            contexts: () => ipcRenderer.invoke('k8s:contexts'),
            currentContext: () => ipcRenderer.invoke('k8s:current-context'),
            useContext: (context: string) => ipcRenderer.invoke('k8s:use-context', context),
            importConfig: (configPath: string) => ipcRenderer.invoke('k8s:import-config', configPath),
            pods: (namespace?: string) => ipcRenderer.invoke('k8s:pods', namespace),
            namespaces: () => ipcRenderer.invoke('k8s:namespaces'),
            logs: (podName: string, namespace: string, tail?: number, container?: string) => ipcRenderer.invoke('k8s:logs', podName, namespace, tail, container),
            stopLogs: (podName: string, namespace: string) => ipcRenderer.invoke('k8s:stop-logs', podName, namespace),
            previousLogs: (podName: string, namespace: string, container?: string, tail?: number) => ipcRenderer.invoke('k8s:previous-logs', podName, namespace, container, tail),
            exec: (podName: string, namespace: string, command: string) => ipcRenderer.invoke('k8s:exec', podName, namespace, command),
            execInput: (podName: string, namespace: string, input: string) => ipcRenderer.invoke('k8s:exec:input', podName, namespace, input),
            execStop: (podName: string, namespace: string) => ipcRenderer.invoke('k8s:exec:stop', podName, namespace),
            shell: (podName: string, namespace: string, shell?: string) => ipcRenderer.invoke('k8s:shell', podName, namespace, shell),
            shellInput: (podName: string, namespace: string, input: string) => ipcRenderer.invoke('k8s:shell:input', podName, namespace, input),
            shellStop: (podName: string, namespace: string) => ipcRenderer.invoke('k8s:shell:stop', podName, namespace),
            command: (command: string) => ipcRenderer.invoke('k8s:command', command),
            // New intelligent features
            diagnose: (podName: string, namespace: string) => ipcRenderer.invoke('k8s:diagnose', podName, namespace),
            timeline: (namespace: string, podName?: string) => ipcRenderer.invoke('k8s:timeline', namespace, podName),
            dependencyGraph: (namespace: string) => ipcRenderer.invoke('k8s:dependency-graph', namespace),
            events: (namespace?: string, fieldSelector?: string) => ipcRenderer.invoke('k8s:events', namespace, fieldSelector),
            search: (query: { image?: string; envVar?: string; labelSelector?: string; namespace?: string }) => ipcRenderer.invoke('k8s:search', query),
            scale: (name: string, namespace: string, replicas: number, environment?: string) => ipcRenderer.invoke('k8s:scale', name, namespace, replicas, environment),
            restartPod: (name: string, namespace: string, environment?: string) => ipcRenderer.invoke('k8s:restart-pod', name, namespace, environment),
            rolloutRestart: (name: string, namespace: string, environment?: string) => ipcRenderer.invoke('k8s:rollout-restart', name, namespace, environment),
            deployments: (namespace?: string) => ipcRenderer.invoke('k8s:deployments', namespace),
            services: (namespace?: string) => ipcRenderer.invoke('k8s:services', namespace),
            configMaps: (namespace?: string) => ipcRenderer.invoke('k8s:configmaps', namespace),
            secrets: (namespace?: string) => ipcRenderer.invoke('k8s:secrets', namespace),
        },
        onK8sLog: (callback: (data: any) => void) => {
            ipcRenderer.on('k8s:log', (_event: any, data: any) => callback(data));
        },
        onK8sShellOutput: (callback: (data: any) => void) => {
            ipcRenderer.on('k8s:shell:output', (_event: any, data: any) => callback(data));
        },
        onK8sExecOutput: (callback: (data: any) => void) => {
            ipcRenderer.on('k8s:exec:output', (_event: any, data: any) => callback(data));
        },
        onK8sExecExit: (callback: (data: any) => void) => {
            ipcRenderer.on('k8s:exec:exit', (_event: any, data: any) => callback(data));
        },
        notes: {
            list: () => ipcRenderer.invoke('notes:list'),
            save: (note: any) => ipcRenderer.invoke('notes:save', note),
            delete: (noteId: string) => ipcRenderer.invoke('notes:delete', noteId),
            load: (noteId: string) => ipcRenderer.invoke('notes:load', noteId),
        },
        drawings: {
            list: () => ipcRenderer.invoke('drawings:list'),
            save: (drawing: any) => ipcRenderer.invoke('drawings:save', drawing),
            delete: (drawingId: string) => ipcRenderer.invoke('drawings:delete', drawingId),
            load: (drawingId: string) => ipcRenderer.invoke('drawings:load', drawingId),
        },
        window: {
            minimize: () => ipcRenderer.invoke('window:minimize'),
            maximize: () => ipcRenderer.invoke('window:maximize'),
            close: () => ipcRenderer.invoke('window:close'),
            openPlanner: () => ipcRenderer.invoke('window:openPlanner'),
        },
        planner: {
            get: (date: string) => ipcRenderer.invoke('planner:get', date),
            getEntries: (startDate?: string, endDate?: string) => ipcRenderer.invoke('planner:getEntries', startDate, endDate),
            save: (entry: any) => ipcRenderer.invoke('planner:save', entry),
            delete: (date: string) => ipcRenderer.invoke('planner:delete', date),
            broadcastUpdate: (date: string) => ipcRenderer.invoke('planner:broadcastUpdate', date),
            onUpdate: (callback: (date: string) => void) => {
                ipcRenderer.on('planner:update', (_event: any, date: string) => callback(date));
            },
        },
        habits: {
            getAll: () => ipcRenderer.invoke('habits:getAll'),
            get: (habitId: string) => ipcRenderer.invoke('habits:get', habitId),
            save: (habit: any) => ipcRenderer.invoke('habits:save', habit),
            delete: (habitId: string) => ipcRenderer.invoke('habits:delete', habitId),
            getCompletions: (habitId: string, startDate?: string, endDate?: string) => ipcRenderer.invoke('habits:getCompletions', habitId, startDate, endDate),
            getAllCompletions: (startDate?: string, endDate?: string) => ipcRenderer.invoke('habits:getAllCompletions', startDate, endDate),
            setCompletion: (habitId: string, date: string, completed: boolean) => ipcRenderer.invoke('habits:setCompletion', habitId, date, completed),
        },
        auth: {
            openOAuth: (url: string) => ipcRenderer.invoke('auth:openOAuth', url),
        },
        dialog: {
            saveFile: (options: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) =>
                ipcRenderer.invoke('dialog:saveFile', options),
        },
        file: {
            writeImage: (filePath: string, base64Data: string) =>
                ipcRenderer.invoke('file:writeImage', filePath, base64Data),
        },
        apiClient: {
            request: (requestData: any) => ipcRenderer.invoke('api-client:request', requestData),
            get: () => ipcRenderer.invoke('apiclient:get'),
            getRequest: (id: string) => ipcRenderer.invoke('apiclient:getRequest', id),
            saveRequest: (request: any) => ipcRenderer.invoke('apiclient:saveRequest', request),
            deleteRequest: (id: string) => ipcRenderer.invoke('apiclient:deleteRequest', id),
            save: (requests: any[]) => ipcRenderer.invoke('apiclient:save', requests),
        },
        folders: {
            get: (parentId?: string | null) => ipcRenderer.invoke('folders:get', parentId),
            save: (folder: any) => ipcRenderer.invoke('folders:save', folder),
            delete: (folderId: string) => ipcRenderer.invoke('folders:delete', folderId),
        },
        git: {
            getRepoPath: () => ipcRenderer.invoke('git:getRepoPath'),
            setRepoPath: (repoPath: string) => ipcRenderer.invoke('git:setRepoPath', repoPath),
            initRepo: (repoPath: string) => ipcRenderer.invoke('git:initRepo', repoPath),
            checkIfRepo: (repoPath: string) => ipcRenderer.invoke('git:checkIfRepo', repoPath),
            sync: (filePaths?: string[], commitMessage?: string) => ipcRenderer.invoke('git:sync', filePaths, commitMessage),
            status: () => ipcRenderer.invoke('git:status'),
            pull: () => ipcRenderer.invoke('git:pull'),
        },
        updater: {
            checkForUpdates: () => ipcRenderer.invoke('updater:checkForUpdates'),
            downloadUpdate: () => ipcRenderer.invoke('updater:downloadUpdate'),
            quitAndInstall: () => ipcRenderer.invoke('updater:quitAndInstall'),
            getAppVersion: () => ipcRenderer.invoke('updater:getAppVersion'),
            onCheckingForUpdate: (callback: () => void) => {
                ipcRenderer.on('updater:checking-for-update', () => callback());
            },
            onUpdateAvailable: (callback: (info: any) => void) => {
                ipcRenderer.on('updater:update-available', (_event: any, info: any) => callback(info));
            },
            onUpdateNotAvailable: (callback: (info: any) => void) => {
                ipcRenderer.on('updater:update-not-available', (_event: any, info: any) => callback(info));
            },
            onUpdateError: (callback: (error: any) => void) => {
                ipcRenderer.on('updater:error', (_event: any, error: any) => callback(error));
            },
            onDownloadProgress: (callback: (progress: any) => void) => {
                ipcRenderer.on('updater:download-progress', (_event: any, progress: any) => callback(progress));
            },
            onUpdateDownloaded: (callback: (info: any) => void) => {
                ipcRenderer.on('updater:update-downloaded', (_event: any, info: any) => callback(info));
            },
        },
    });

    console.log('[Preload] Electron API exposed successfully');
} catch (error) {
    console.error('[Preload] Failed to expose Electron API:', error);
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
                diagnose: (containerId: string) => Promise<any>;
                analyzeExit: (containerId: string) => Promise<any>;
                stats: (containerId: string) => Promise<any>;
                analyzeImage: (imageId: string) => Promise<any>;
                analyzeNetworking: (containerId: string) => Promise<any>;
                analyzeCompose: (composePath?: string) => Promise<any>;
                search: (query: { image?: string; status?: string; name?: string; exited?: boolean }) => Promise<any>;
                containerInfo: (containerId: string) => Promise<any>;
            };
            k8s: {
                contexts: () => Promise<any>;
                currentContext: () => Promise<any>;
                useContext: (context: string) => Promise<any>;
                importConfig: (configPath: string) => Promise<any>;
                pods: (namespace?: string) => Promise<any>;
                namespaces: () => Promise<any>;
                logs: (podName: string, namespace: string, tail?: number, container?: string) => Promise<any>;
                stopLogs: (podName: string, namespace: string) => Promise<any>;
                previousLogs: (podName: string, namespace: string, container?: string, tail?: number) => Promise<any>;
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
            auth: {
                openOAuth: (url: string) => Promise<string>;
            };
            folders: {
                get: (parentId?: string | null) => Promise<any>;
                save: (folder: any) => Promise<any>;
                delete: (folderId: string) => Promise<any>;
            };
            git: {
                getRepoPath: () => Promise<any>;
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


