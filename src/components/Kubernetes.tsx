import { useState, useEffect, useRef } from 'react';
import { Editor } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

interface Pod {
    metadata: {
        name: string;
        namespace: string;
        creationTimestamp: string;
    };
    status: {
        phase: string;
        containerStatuses?: Array<{
            ready: boolean;
            state: any;
        }>;
    };
    spec: {
        containers: Array<{
            name: string;
            image: string;
        }>;
    };
}

interface Namespace {
    metadata: {
        name: string;
    };
}

export function Kubernetes() {
    const [contexts, setContexts] = useState<string[]>([]);
    const [currentContext, setCurrentContext] = useState<string>('');
    const [namespaces, setNamespaces] = useState<Namespace[]>([]);
    const [selectedNamespace, setSelectedNamespace] = useState<string>('default');
    const [pods, setPods] = useState<Pod[]>([]);
    const [selectedPod, setSelectedPod] = useState<{ name: string; namespace: string } | null>(null);
    const [logs, setLogs] = useState<string>('');
    const [shellOutput, setShellOutput] = useState<string>('');
    const [shellInput, setShellInput] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [isShellActive, setIsShellActive] = useState(false);
    const [viewMode, setViewMode] = useState<'logs' | 'shell' | 'exec'>('logs');
    const [execCommand, setExecCommand] = useState<string>('');
    const [execOutput, setExecOutput] = useState<string>('');
    const [execInput, setExecInput] = useState<string>('');
    const [isExecActive, setIsExecActive] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const execOutputRef = useRef<HTMLDivElement>(null);
    const shellOutputRef = useRef<HTMLDivElement>(null);
    const logsEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
    const isStreamingRef = useRef(false);
    const viewModeRef = useRef<'logs' | 'shell' | 'exec'>('logs');
    const previousLogLengthRef = useRef(0);
    const [showScrollTop, setShowScrollTop] = useState(false);
    const [diagnostic, setDiagnostic] = useState<any>(null);
    const [timeline, setTimeline] = useState<any[]>([]);
    const [dependencyGraph, setDependencyGraph] = useState<any>(null);
    const [mainView, setMainView] = useState<'pods' | 'diagnostics' | 'timeline' | 'graph'>('pods');
    const [searchQuery, setSearchQuery] = useState<{ image?: string; envVar?: string; labelSelector?: string }>({});

    useEffect(() => {
        if (!window.electronAPI) return;
        loadContexts();
        loadCurrentContext();
    }, []);

    useEffect(() => {
        if (currentContext) {
            loadNamespaces();
        }
    }, [currentContext]);

    useEffect(() => {
        if (selectedNamespace) {
            loadPods();
            const interval = setInterval(loadPods, 5000);
            return () => clearInterval(interval);
        }
    }, [selectedNamespace]);

    useEffect(() => {
        if (!window.electronAPI) return;

        const handleLog = (data: { podName: string; namespace: string; line: string }) => {
            if (selectedPod && data.podName === selectedPod.name && data.namespace === selectedPod.namespace) {
                setLogs(prev => prev + data.line + '\n');
            }
        };

        const handleShellOutput = (data: { podName: string; namespace: string; data: string }) => {
            if (selectedPod && data.podName === selectedPod.name && data.namespace === selectedPod.namespace) {
                setShellOutput(prev => prev + data.data);
                // Auto-scroll to bottom
                setTimeout(() => {
                    if (shellOutputRef.current) {
                        shellOutputRef.current.scrollTop = shellOutputRef.current.scrollHeight;
                    }
                }, 10);
            }
        };

        const handleExecOutput = (data: { podName: string; namespace: string; data: string }) => {
            if (selectedPod && data.podName === selectedPod.name && data.namespace === selectedPod.namespace) {
                setExecOutput(prev => prev + data.data);
                // Auto-scroll to bottom
                setTimeout(() => {
                    if (execOutputRef.current) {
                        execOutputRef.current.scrollTop = execOutputRef.current.scrollHeight;
                    }
                }, 10);
            }
        };

        const handleExecExit = (data: { podName: string; namespace: string; code: number }) => {
            if (selectedPod && data.podName === selectedPod.name && data.namespace === selectedPod.namespace) {
                setIsExecActive(false);
                setExecOutput(prev => prev + `\n[Process exited with code ${data.code}]\n`);
            }
        };

        window.electronAPI.onK8sLog(handleLog);
        window.electronAPI.onK8sShellOutput(handleShellOutput);
        window.electronAPI.onK8sExecOutput(handleExecOutput);
        window.electronAPI.onK8sExecExit(handleExecExit);
    }, [selectedPod]);

    // Update refs when streaming state changes
    useEffect(() => {
        isStreamingRef.current = isStreaming;
    }, [isStreaming]);

    useEffect(() => {
        viewModeRef.current = viewMode;
    }, [viewMode]);

    // Watch logs and auto-scroll (like tail -f)
    useEffect(() => {
        if (logsEditorRef.current && isStreaming && viewMode === 'logs' && logs) {
            const currentLength = logs.length;
            // Only scroll if logs have actually changed (new content added)
            if (currentLength !== previousLogLengthRef.current) {
                previousLogLengthRef.current = currentLength;
                // Use requestAnimationFrame for smooth scrolling
                requestAnimationFrame(() => {
                    if (logsEditorRef.current) {
                        const model = logsEditorRef.current.getModel();
                        if (model) {
                            const lineCount = model.getLineCount();
                            if (lineCount > 0) {
                                logsEditorRef.current.revealLine(lineCount);
                                logsEditorRef.current.setScrollTop(Number.MAX_SAFE_INTEGER);
                            }
                        }
                    }
                });
            }
        }
    }, [logs, isStreaming, viewMode]);

    // Cleanup model listener when component unmounts
    useEffect(() => {
        return () => {
            if (logsEditorRef.current && (logsEditorRef.current as any).__logDisposable) {
                (logsEditorRef.current as any).__logDisposable.dispose();
            }
        };
    }, []);

    const loadContexts = async () => {
        if (!window.electronAPI) return;
        try {
            const result = await window.electronAPI.k8s.contexts();
            if (result.success) {
                setContexts(result.contexts || []);
            }
        } catch (err) {
            console.error('Failed to load contexts:', err);
        }
    };

    const loadCurrentContext = async () => {
        if (!window.electronAPI) return;
        try {
            const result = await window.electronAPI.k8s.currentContext();
            if (result.success) {
                setCurrentContext(result.context || '');
            }
        } catch (err) {
            console.error('Failed to load current context:', err);
        }
    };

    const handleContextChange = async (context: string) => {
        if (!window.electronAPI) return;
        try {
            const result = await window.electronAPI.k8s.useContext(context);
            if (result.success) {
                setCurrentContext(context);
                await loadNamespaces();
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to switch context');
        }
    };

    const loadNamespaces = async () => {
        if (!window.electronAPI) return;
        try {
            const result = await window.electronAPI.k8s.namespaces();
            if (result.success) {
                setNamespaces(result.namespaces || []);
                if (result.namespaces && result.namespaces.length > 0) {
                    const defaultNs = result.namespaces.find((ns: Namespace) => ns.metadata.name === 'default');
                    setSelectedNamespace(defaultNs ? 'default' : result.namespaces[0].metadata.name);
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load namespaces');
        }
    };

    const loadPods = async () => {
        if (!window.electronAPI) return;
        try {
            const result = await window.electronAPI.k8s.pods(selectedNamespace);
            if (result.success) {
                setPods(result.pods || []);
                setError(null);
            } else {
                setError(result.error || 'Failed to load pods');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load pods');
        }
    };

    const handleImportConfig = async () => {
        if (!window.electronAPI) return;

        const result = await window.electronAPI.project.open();
        if (result && result.filePath) {
            try {
                const importResult = await window.electronAPI.k8s.importConfig(result.filePath);
                if (importResult.success) {
                    await loadContexts();
                    await loadCurrentContext();
                    alert('Kubeconfig imported successfully!');
                } else {
                    setError(importResult.error || 'Failed to import config');
                }
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to import config');
            }
        }
    };

    const handleSelectPod = async (pod: Pod) => {
        const podInfo = { name: pod.metadata.name, namespace: pod.metadata.namespace };

        if (selectedPod && selectedPod.name === podInfo.name && selectedPod.namespace === podInfo.namespace && isStreaming) {
            await stopLogs();
            setSelectedPod(null);
            setLogs('');
            setIsStreaming(false);
            setDiagnostic(null);
        } else {
            if (selectedPod) {
                if (isStreaming) await stopLogs();
                if (isShellActive) handleStopShell();
                if (isExecActive) await handleStopExec();
            }
            setSelectedPod(podInfo);
            setLogs('');
            setShellOutput('');
            setExecOutput('');
            setViewMode('logs');
            await startLogs(podInfo.name, podInfo.namespace);
            await loadDiagnostic(podInfo.name, podInfo.namespace);
        }
    };

    const loadDiagnostic = async (podName: string, namespace: string) => {
        if (!window.electronAPI) return;
        try {
            const result = await window.electronAPI.k8s.diagnose(podName, namespace);
            if (result.success) {
                setDiagnostic(result.diagnostic);
            }
        } catch (err) {
            console.error('Failed to load diagnostic:', err);
        }
    };

    const loadTimeline = async () => {
        if (!window.electronAPI || !selectedNamespace) return;
        try {
            const result = await window.electronAPI.k8s.timeline(selectedNamespace, selectedPod?.name);
            if (result.success) {
                setTimeline(result.timeline || []);
            }
        } catch (err) {
            console.error('Failed to load timeline:', err);
        }
    };

    const loadDependencyGraph = async () => {
        if (!window.electronAPI || !selectedNamespace) return;
        try {
            const result = await window.electronAPI.k8s.dependencyGraph(selectedNamespace);
            if (result.success) {
                setDependencyGraph(result.graph);
            }
        } catch (err) {
            console.error('Failed to load dependency graph:', err);
        }
    };

    const handleSearch = async () => {
        if (!window.electronAPI) return;
        try {
            const result = await window.electronAPI.k8s.search({
                ...searchQuery,
                namespace: selectedNamespace,
            });
            if (result.success) {
                // Update pods list with search results
                setPods(result.results.pods || []);
            }
        } catch (err) {
            console.error('Search failed:', err);
        }
    };

    const startLogs = async (podName: string, namespace: string) => {
        if (!window.electronAPI) return;

        setLoading(true);
        setIsStreaming(false);
        setError(null);

        try {
            const result = await window.electronAPI.k8s.logs(podName, namespace, 100);
            if (result.success) {
                setIsStreaming(true);
                setViewMode('logs');
            } else {
                setError(result.error || 'Failed to start log streaming');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to start logs');
        } finally {
            setLoading(false);
        }
    };

    const stopLogs = async () => {
        if (!window.electronAPI || !selectedPod) return;

        try {
            await window.electronAPI.k8s.stopLogs(selectedPod.name, selectedPod.namespace);
            setIsStreaming(false);
        } catch (err) {
            console.error('Failed to stop logs:', err);
        }
    };

    const handleStartShell = async () => {
        if (!window.electronAPI || !selectedPod) return;

        setLoading(true);
        setShellOutput('');
        setViewMode('shell');

        try {
            const result = await window.electronAPI.k8s.shell(selectedPod.name, selectedPod.namespace, '/bin/sh');
            if (result.success) {
                setIsShellActive(true);
                // Auto-scroll after initialization
                setTimeout(() => {
                    if (shellOutputRef.current) {
                        shellOutputRef.current.scrollTop = shellOutputRef.current.scrollHeight;
                    }
                }, 100);
            } else {
                setError(result.error || 'Failed to start shell');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to start shell');
        } finally {
            setLoading(false);
        }
    };

    const handleShellInput = async (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && window.electronAPI && selectedPod && isShellActive) {
            const command = shellInput + '\n';
            const cmd = shellInput;
            setShellInput('');
            setShellOutput(prev => {
                const prompt = prev.includes('\n') ? '\n' : '';
                return prev + prompt + cmd + '\n';
            });

            try {
                await window.electronAPI.k8s.shellInput(selectedPod.name, selectedPod.namespace, command);
                // Auto-scroll after sending command
                setTimeout(() => {
                    if (shellOutputRef.current) {
                        shellOutputRef.current.scrollTop = shellOutputRef.current.scrollHeight;
                    }
                }, 10);
            } catch (err) {
                console.error('Failed to send shell input:', err);
            }
        }
    };

    const handleStopShell = async () => {
        if (!window.electronAPI || !selectedPod) return;

        try {
            await window.electronAPI.k8s.shellStop(selectedPod.name, selectedPod.namespace);
            setIsShellActive(false);
            setViewMode('logs');
        } catch (err) {
            console.error('Failed to stop shell:', err);
        }
    };

    const handleStartExec = async () => {
        if (!window.electronAPI || !selectedPod) return;

        setLoading(true);
        setExecOutput('');
        setViewMode('exec');

        try {
            const command = execCommand.trim() || '';
            const result = await window.electronAPI.k8s.exec(selectedPod.name, selectedPod.namespace, command);
            if (result.success) {
                setIsExecActive(true);
                // Initialize with empty output
                setExecOutput('');
                // Auto-scroll after initialization
                setTimeout(() => {
                    if (execOutputRef.current) {
                        execOutputRef.current.scrollTop = execOutputRef.current.scrollHeight;
                    }
                }, 100);
            } else {
                setError(result.error || 'Failed to start exec');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to start exec');
        } finally {
            setLoading(false);
        }
    };

    const handleExecInput = async (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && window.electronAPI && selectedPod && isExecActive) {
            const input = execInput + '\n';
            const command = execInput;
            setExecInput('');
            setExecOutput(prev => {
                const prompt = prev.includes('\n') ? '\n' : '';
                return prev + prompt + command + '\n';
            });

            try {
                await window.electronAPI.k8s.execInput(selectedPod.name, selectedPod.namespace, input);
                // Auto-scroll after sending command
                setTimeout(() => {
                    if (execOutputRef.current) {
                        execOutputRef.current.scrollTop = execOutputRef.current.scrollHeight;
                    }
                }, 10);
            } catch (err) {
                console.error('Failed to send exec input:', err);
            }
        }
    };

    const handleStopExec = async () => {
        if (!window.electronAPI || !selectedPod) return;

        try {
            await window.electronAPI.k8s.execStop(selectedPod.name, selectedPod.namespace);
            setIsExecActive(false);
            setViewMode('logs');
        } catch (err) {
            console.error('Failed to stop exec:', err);
        }
    };

    const getStatusColor = (phase: string) => {
        switch (phase.toLowerCase()) {
            case 'running':
                return 'bg-green-500';
            case 'pending':
                return 'bg-yellow-500';
            case 'succeeded':
                return 'bg-blue-500';
            case 'failed':
                return 'bg-red-500';
            default:
                return 'bg-gray-400';
        }
    };

    return (
        <div className="h-full flex flex-col bg-[var(--color-background)]">
            <div className="px-6 py-3 border-b border-[var(--color-border)] bg-[var(--color-card)] flex-shrink-0">
                <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-4">
                    <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                        Kubernetes
                    </div>
                    <select
                        value={currentContext}
                        onChange={(e) => handleContextChange(e.target.value)}
                        className="px-3 py-1.5 rounded-lg text-sm border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-primary)]"
                    >
                        {contexts.map(ctx => (
                            <option key={ctx} value={ctx}>{ctx}</option>
                        ))}
                    </select>
                    <select
                        value={selectedNamespace}
                        onChange={(e) => setSelectedNamespace(e.target.value)}
                        className="px-3 py-1.5 rounded-lg text-sm border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-primary)]"
                    >
                        {namespaces.map(ns => (
                            <option key={ns.metadata.name} value={ns.metadata.name}>
                                {ns.metadata.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleImportConfig}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)] transition-colors duration-200"
                    >
                        Import Config
                    </button>
                    <button
                        onClick={loadPods}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)] transition-colors duration-200"
                    >
                        Refresh
                    </button>
                </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => { setMainView('pods'); loadPods(); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            mainView === 'pods' 
                                ? 'bg-[var(--color-primary)] text-white' 
                                : 'bg-[var(--color-muted)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]'
                        }`}
                    >
                        Pods
                    </button>
                    <button
                        onClick={() => { setMainView('diagnostics'); if (selectedPod) loadDiagnostic(selectedPod.name, selectedPod.namespace); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            mainView === 'diagnostics' 
                                ? 'bg-[var(--color-primary)] text-white' 
                                : 'bg-[var(--color-muted)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]'
                        }`}
                    >
                        Diagnostics
                    </button>
                    <button
                        onClick={() => { setMainView('timeline'); loadTimeline(); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            mainView === 'timeline' 
                                ? 'bg-[var(--color-primary)] text-white' 
                                : 'bg-[var(--color-muted)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]'
                        }`}
                    >
                        Timeline
                    </button>
                    <button
                        onClick={() => { setMainView('graph'); loadDependencyGraph(); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            mainView === 'graph' 
                                ? 'bg-[var(--color-primary)] text-white' 
                                : 'bg-[var(--color-muted)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]'
                        }`}
                    >
                        Dependencies
                    </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Pod List / Sidebar */}
                {mainView === 'pods' && (
                    <div className="w-80 flex-shrink-0 border-r border-[var(--color-border)] bg-[var(--color-card)] overflow-y-auto">
                        <div className="p-4 space-y-2">
                            {error && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
                                    {error}
                                </div>
                            )}

                            {pods.length === 0 ? (
                                <div className="text-center py-8 text-[var(--color-text-tertiary)] text-sm">
                                    No pods found
                                </div>
                            ) : (
                                pods.map((pod) => (
                                    <div
                                        key={`${pod.metadata.namespace}/${pod.metadata.name}`}
                                        className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${selectedPod?.name === pod.metadata.name && selectedPod?.namespace === pod.metadata.namespace
                                                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                                                : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                                            }`}
                                        onClick={() => handleSelectPod(pod)}
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                                                    {pod.metadata.name}
                                                </div>
                                                <div className="text-xs text-[var(--color-text-secondary)] mt-1">
                                                    {pod.spec.containers[0]?.image || 'N/A'}
                                                </div>
                                            </div>
                                            <div className={`w-2 h-2 rounded-full ${getStatusColor(pod.status.phase)} ml-2 flex-shrink-0`}></div>
                                        </div>

                                        <div className="text-xs text-[var(--color-text-secondary)]">
                                            {pod.status.phase} • {pod.metadata.namespace}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* Diagnostics View */}
                {mainView === 'diagnostics' && selectedPod && (
                    <div className="w-80 flex-shrink-0 border-r border-[var(--color-border)] bg-[var(--color-card)] overflow-y-auto p-4">
                        <div className="mb-4">
                            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
                                Pod Diagnostics
                            </h3>
                            <div className="text-xs text-[var(--color-text-secondary)]">
                                {selectedPod.name} ({selectedPod.namespace})
                            </div>
                        </div>
                        {diagnostic ? (
                            <div className="space-y-4">
                                <div className={`p-3 rounded-lg border ${
                                    diagnostic.status === 'healthy' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' :
                                    diagnostic.status === 'warning' ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' :
                                    'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                                }`}>
                                    <div className="text-sm font-semibold mb-1">
                                        Status: {diagnostic.status.toUpperCase()}
                                    </div>
                                    {diagnostic.rootCause && (
                                        <div className="text-xs mt-2">
                                            <div className="font-semibold mb-1">Root Cause:</div>
                                            <div>{diagnostic.rootCause}</div>
                                        </div>
                                    )}
                                </div>
                                {diagnostic.evidence && diagnostic.evidence.length > 0 && (
                                    <div>
                                        <div className="text-xs font-semibold mb-2">Evidence:</div>
                                        <ul className="space-y-1">
                                            {diagnostic.evidence.map((ev: string, idx: number) => (
                                                <li key={idx} className="text-xs text-[var(--color-text-secondary)]">• {ev}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {diagnostic.suggestedFixes && diagnostic.suggestedFixes.length > 0 && (
                                    <div>
                                        <div className="text-xs font-semibold mb-2">Suggested Fixes:</div>
                                        <ul className="space-y-1">
                                            {diagnostic.suggestedFixes.map((fix: string, idx: number) => (
                                                <li key={idx} className="text-xs text-green-600 dark:text-green-400">✓ {fix}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {diagnostic.restartCount > 0 && (
                                    <div className="text-xs text-[var(--color-text-secondary)]">
                                        <span className="font-semibold">Restart Count:</span> {diagnostic.restartCount}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-sm text-[var(--color-text-secondary)]">
                                Loading diagnostics...
                            </div>
                        )}
                    </div>
                )}

                {/* Timeline View */}
                {mainView === 'timeline' && (
                    <div className="w-80 flex-shrink-0 border-r border-[var(--color-border)] bg-[var(--color-card)] overflow-y-auto p-4">
                        <div className="mb-4">
                            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
                                Change Timeline
                            </h3>
                            <div className="text-xs text-[var(--color-text-secondary)]">
                                {selectedNamespace}
                            </div>
                        </div>
                        {timeline.length > 0 ? (
                            <div className="space-y-3">
                                {timeline.slice(0, 50).map((event: any, idx: number) => (
                                    <div key={idx} className="border-l-2 pl-3 pb-3 border-[var(--color-border)]">
                                        <div className="text-xs text-[var(--color-text-secondary)]">
                                            {new Date(event.timestamp).toLocaleString()}
                                        </div>
                                        <div className={`text-xs font-semibold mt-1 ${
                                            event.severity === 'error' ? 'text-red-600 dark:text-red-400' :
                                            event.severity === 'warning' ? 'text-yellow-600 dark:text-yellow-400' :
                                            'text-[var(--color-text-secondary)]'
                                        }`}>
                                            {event.type.toUpperCase()}
                                        </div>
                                        <div className="text-xs text-[var(--color-text-primary)] mt-1">
                                            {event.description}
                                        </div>
                                        <div className="text-xs text-[var(--color-text-secondary)] mt-1">
                                            {event.resource} • {event.source}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-sm text-[var(--color-text-secondary)]">
                                No timeline events found
                            </div>
                        )}
                    </div>
                )}

                {/* Dependency Graph View */}
                {mainView === 'graph' && (
                    <div className="w-80 flex-shrink-0 border-r border-[var(--color-border)] bg-[var(--color-card)] overflow-y-auto p-4">
                        <div className="mb-4">
                            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
                                Dependency Graph
                            </h3>
                            <div className="text-xs text-[var(--color-text-secondary)]">
                                {selectedNamespace}
                            </div>
                        </div>
                        {dependencyGraph ? (
                            <div className="space-y-3">
                                <div>
                                    <div className="text-xs font-semibold mb-2">Nodes ({dependencyGraph.nodes?.length || 0}):</div>
                                    <div className="space-y-2">
                                        {dependencyGraph.nodes?.map((node: any, idx: number) => (
                                            <div key={idx} className={`p-2 rounded border text-xs ${
                                                node.status === 'healthy' ? 'bg-green-50 dark:bg-green-900/20 border-green-200' :
                                                node.status === 'warning' ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200' :
                                                'bg-red-50 dark:bg-red-900/20 border-red-200'
                                            }`}>
                                                <div className="font-semibold text-[var(--color-text-primary)]">{node.name}</div>
                                                <div className="text-[var(--color-text-secondary)]">{node.type}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xs font-semibold mb-2">Connections ({dependencyGraph.edges?.length || 0}):</div>
                                    <div className="space-y-1">
                                        {dependencyGraph.edges?.map((edge: any, idx: number) => (
                                            <div key={idx} className="text-xs text-[var(--color-text-secondary)]">
                                                {edge.from.split('-').pop()} → {edge.to.split('-').pop()} ({edge.type})
                                                {edge.issue && (
                                                    <span className="text-red-600 dark:text-red-400 ml-1">⚠ {edge.issue}</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-sm text-[var(--color-text-secondary)]">
                                Loading dependency graph...
                            </div>
                        )}
                    </div>
                )}

                {/* Logs/Shell Viewer */}
                <div className="flex-1 flex flex-col overflow-hidden bg-[var(--color-background)]">
                    {selectedPod ? (
                        <>
                            <div className="px-6 py-3 border-b border-[var(--color-border)] bg-[var(--color-card)] flex-shrink-0">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                                            {selectedPod.name} ({selectedPod.namespace})
                                        </div>
                                        {diagnostic && (
                                            <div className={`px-2 py-1 rounded text-xs font-semibold ${
                                                diagnostic.status === 'healthy' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                                                diagnostic.status === 'warning' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' :
                                                'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                            }`}>
                                                {diagnostic.status.toUpperCase()}
                                            </div>
                                        )}
                                        {isStreaming && viewMode === 'logs' && (
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                                <span className="text-xs text-[var(--color-text-secondary)]">Live</span>
                                            </div>
                                        )}
                                    </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => {
                                            setViewMode('logs');
                                            if (!isStreaming) {
                                                startLogs(selectedPod.name, selectedPod.namespace);
                                            }
                                        }}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${viewMode === 'logs'
                                                ? 'bg-[var(--color-primary)] text-white'
                                                : 'bg-[var(--color-muted)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]'
                                            }`}
                                    >
                                        Logs
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (isShellActive) {
                                                handleStopShell();
                                            } else {
                                                handleStartShell();
                                            }
                                        }}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${viewMode === 'shell'
                                                ? 'bg-[var(--color-primary)] text-white'
                                                : 'bg-[var(--color-muted)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]'
                                            }`}
                                    >
                                        {isShellActive ? 'Stop Shell' : 'Shell'}
                                    </button>
                                    <button
                                        onClick={() => setViewMode('exec')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${viewMode === 'exec'
                                                ? 'bg-[var(--color-primary)] text-white'
                                                : 'bg-[var(--color-muted)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]'
                                            }`}
                                    >
                                        Exec
                                    </button>
                                    {(isStreaming || isShellActive || isExecActive) && (
                                        <button
                                            onClick={() => {
                                                if (isStreaming) stopLogs();
                                                if (isShellActive) handleStopShell();
                                                if (isExecActive) handleStopExec();
                                                setSelectedPod(null);
                                                setLogs('');
                                                setShellOutput('');
                                                setExecOutput('');
                                            }}
                                            className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--color-text-secondary)] bg-[var(--color-muted)] hover:bg-[var(--color-border)] transition-colors"
                                        >
                                            Close
                                        </button>
                                    )}
                                </div>
                                </div>
                            </div>

                            {viewMode === 'logs' && (
                                <div className="flex-1 flex flex-col">
                                    {diagnostic && diagnostic.status !== 'healthy' && (
                                        <div className={`border-b p-4 ${
                                            diagnostic.status === 'warning' ? 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800' :
                                            'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                                        }`}>
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="text-sm font-semibold mb-1">
                                                        {diagnostic.rootCause || `Pod Status: ${diagnostic.status}`}
                                                    </div>
                                                    {diagnostic.evidence && diagnostic.evidence.length > 0 && (
                                                        <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                                                            {diagnostic.evidence.slice(0, 2).join(' • ')}
                                                        </div>
                                                    )}
                                                    {diagnostic.suggestedFixes && diagnostic.suggestedFixes.length > 0 && (
                                                        <div className="text-xs">
                                                            <span className="font-semibold">Quick Fix:</span> {diagnostic.suggestedFixes[0]}
                                                        </div>
                                                    )}
                                                </div>
                                                <button
                                                    onClick={() => { setMainView('diagnostics'); }}
                                                    className="ml-4 px-3 py-1 text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                                                >
                                                    View Details
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    <div className="flex-1 relative">
                                        <Editor
                                            height="100%"
                                            width="100%"
                                            defaultLanguage="plaintext"
                                            value={logs || (loading ? 'Loading logs...' : '// No logs yet')}
                                            theme={document.documentElement.classList.contains('dark') ? 'vs-dark' : 'light'}
                                            onChange={(value) => {
                                                // Auto-scroll when value changes (new logs arrive)
                                                if (logsEditorRef.current && isStreamingRef.current && viewModeRef.current === 'logs' && value) {
                                                    requestAnimationFrame(() => {
                                                        if (logsEditorRef.current) {
                                                            const model = logsEditorRef.current.getModel();
                                                            if (model) {
                                                                const lineCount = model.getLineCount();
                                                                if (lineCount > 0) {
                                                                    logsEditorRef.current.revealLine(lineCount);
                                                                    logsEditorRef.current.setScrollTop(Number.MAX_SAFE_INTEGER);
                                                                }
                                                            }
                                                        }
                                                    });
                                                }
                                            }}
                                            onMount={(editor) => {
                                                logsEditorRef.current = editor;
                                                const model = editor.getModel();
                                                
                                                if (model) {
                                                    // Also listen to model content changes as backup
                                                    const disposable = model.onDidChangeContent(() => {
                                                        if (isStreamingRef.current && viewModeRef.current === 'logs') {
                                                            requestAnimationFrame(() => {
                                                                const lineCount = model.getLineCount();
                                                                if (lineCount > 0) {
                                                                    editor.revealLine(lineCount);
                                                                    editor.setScrollTop(Number.MAX_SAFE_INTEGER);
                                                                }
                                                            });
                                                        }
                                                    });
                                                    
                                                    // Store disposable for cleanup
                                                    (editor as any).__logDisposable = disposable;
                                                    
                                                    // Initial scroll to bottom
                                                    requestAnimationFrame(() => {
                                                        const lineCount = model.getLineCount();
                                                        if (lineCount > 0) {
                                                            editor.revealLine(lineCount);
                                                            editor.setScrollTop(Number.MAX_SAFE_INTEGER);
                                                        }
                                                    });
                                                }
                                            }}
                                            options={{
                                                readOnly: true,
                                                minimap: { enabled: false },
                                                fontSize: 13,
                                                wordWrap: 'on',
                                                padding: { top: 16, bottom: 16 },
                                                automaticLayout: true,
                                                scrollBeyondLastLine: false,
                                            }}
                                        />
                                    </div>
                                </div>
                            )}

                            {viewMode === 'shell' && (
                                <div className="flex-1 flex flex-col relative bg-gray-900 dark:bg-gray-900">
                                    <div
                                        ref={shellOutputRef}
                                        className="flex-1 overflow-auto p-4 font-mono text-sm"
                                        onScroll={(e) => {
                                            const target = e.target as HTMLDivElement;
                                            setShowScrollTop(target.scrollTop > 100);
                                        }}
                                        style={{
                                            color: '#a8e6cf',
                                            lineHeight: '1.6',
                                        }}
                                    >
                                        <pre className="whitespace-pre-wrap" style={{ margin: 0 }}>
                                            {shellOutput || (loading ? 'Starting shell...' : '// Shell output will appear here')}
                                        </pre>
                                    </div>
                                    {showScrollTop && (
                                        <button
                                            onClick={() => {
                                                if (shellOutputRef.current) {
                                                    shellOutputRef.current.scrollTop = 0;
                                                }
                                            }}
                                            className="absolute top-4 right-4 px-3 py-1.5 bg-gray-800/90 hover:bg-gray-700 text-white text-xs rounded-lg border border-gray-700 transition-colors z-10"
                                        >
                                            ↑ Top
                                        </button>
                                    )}
                                    <div className="border-t border-gray-700 p-2 flex items-center gap-2 bg-gray-900/50">
                                        <span className="text-green-400 font-semibold">➜</span>
                                        <input
                                            type="text"
                                            value={shellInput}
                                            onChange={(e) => setShellInput(e.target.value)}
                                            onKeyDown={handleShellInput}
                                            disabled={!isShellActive}
                                            className="flex-1 bg-transparent text-white outline-none font-mono text-sm"
                                            placeholder={isShellActive ? "Enter command..." : "Shell not active"}
                                        />
                                    </div>
                                </div>
                            )}

                            {viewMode === 'exec' && (
                                <div className="flex-1 flex flex-col relative bg-gray-900 dark:bg-gray-900">
                                    {!isExecActive && (
                                        <div className="p-4 border-b border-gray-700 flex gap-2">
                                            <input
                                                type="text"
                                                value={execCommand}
                                                onChange={(e) => setExecCommand(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleStartExec()}
                                                placeholder="Optional: Enter initial command (or leave empty for shell)..."
                                                className="flex-1 px-3 py-2 bg-gray-800 text-white rounded border border-gray-700 focus:border-primary-500 focus:outline-none"
                                            />
                                            <button
                                                onClick={handleStartExec}
                                                disabled={loading}
                                                className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Start Shell
                                            </button>
                                        </div>
                                    )}
                                    <div
                                        ref={execOutputRef}
                                        className="flex-1 overflow-auto p-4 font-mono text-sm"
                                        onScroll={(e) => {
                                            const target = e.target as HTMLDivElement;
                                            setShowScrollTop(target.scrollTop > 100);
                                        }}
                                        style={{
                                            color: '#a8e6cf',
                                            lineHeight: '1.6',
                                        }}
                                    >
                                        <pre className="whitespace-pre-wrap" style={{ margin: 0 }}>
                                            {execOutput || (loading ? 'Starting shell...' : isExecActive ? '' : '// Click "Start Shell" to begin interactive session')}
                                        </pre>
                                    </div>
                                    {showScrollTop && (
                                        <button
                                            onClick={() => {
                                                if (execOutputRef.current) {
                                                    execOutputRef.current.scrollTop = 0;
                                                }
                                            }}
                                            className="absolute top-4 right-4 px-3 py-1.5 bg-gray-800/90 hover:bg-gray-700 text-white text-xs rounded-lg border border-gray-700 transition-colors z-10"
                                        >
                                            ↑ Top
                                        </button>
                                    )}
                                    {isExecActive && (
                                        <div className="border-t border-gray-700 p-2 flex items-center gap-2 bg-gray-900/50">
                                            <span className="text-green-400 font-semibold">➜</span>
                                            <input
                                                type="text"
                                                value={execInput}
                                                onChange={(e) => setExecInput(e.target.value)}
                                                onKeyDown={handleExecInput}
                                                autoFocus
                                                className="flex-1 bg-transparent text-white outline-none font-mono text-sm"
                                                placeholder="Enter command..."
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center bg-[var(--color-background)]">
                            <div className="text-center">
                                <div className="text-[var(--color-text-tertiary)] text-lg mb-2">☸️</div>
                                <div className="text-[var(--color-text-secondary)] text-sm">
                                    Select a pod to view logs or open shell
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

