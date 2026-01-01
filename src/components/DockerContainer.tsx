import { useState, useEffect, useRef } from 'react';
import { Editor } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

interface Container {
    ID: string;
    Names: string;
    Image: string;
    Status: string;
    State: string;
    CreatedAt: string;
    Ports: string;
}

export function DockerContainer() {
    const [containers, setContainers] = useState<Container[]>([]);
    const [selectedContainer, setSelectedContainer] = useState<string | null>(null);
    const [logs, setLogs] = useState<string>('');
    const [shellOutput, setShellOutput] = useState<string>('');
    const [shellInput, setShellInput] = useState<string>('');
    const [execCommand, setExecCommand] = useState<string>('');
    const [execOutput, setExecOutput] = useState<string>('');
    const [execInput, setExecInput] = useState<string>('');
    const [isExecActive, setIsExecActive] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isStreaming, setIsStreaming] = useState(false);
    const [isShellActive, setIsShellActive] = useState(false);
    const [viewMode, setViewMode] = useState<'logs' | 'shell' | 'exec'>('logs');
    const [error, setError] = useState<string | null>(null);
    const execOutputRef = useRef<HTMLDivElement>(null);
    const shellOutputRef = useRef<HTMLDivElement>(null);
    const logsEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
    const isStreamingRef = useRef(false);
    const viewModeRef = useRef<'logs' | 'shell' | 'exec'>('logs');
    const previousLogLengthRef = useRef(0);
    const [showScrollTop, setShowScrollTop] = useState(false);
    const [diagnostic, setDiagnostic] = useState<any>(null);
    const [containerInfo, setContainerInfo] = useState<any>(null);
    const [mainView, setMainView] = useState<'containers' | 'images' | 'volumes' | 'networks'>('containers');
    const [containerFilter, setContainerFilter] = useState<'all' | 'running' | 'stopped'>('all');
    const [containerSearch, setContainerSearch] = useState<string>('');
    const [containerDetailTab, setContainerDetailTab] = useState<'overview' | 'logs' | 'stats' | 'files' | 'inspect'>('overview');
    const [images, setImages] = useState<any[]>([]);
    const [volumes, setVolumes] = useState<any[]>([]);
    const [networks, setNetworks] = useState<any[]>([]);
    const [containerStats, setContainerStats] = useState<any>(null);
    const [containerFiles, setContainerFiles] = useState<any[]>([]);
    const [currentPath, setCurrentPath] = useState<string>('/');
    const [containerInspect, setContainerInspect] = useState<any>(null);

    useEffect(() => {
        loadContainers();
        if (mainView === 'images') loadImages();
        if (mainView === 'volumes') loadVolumes();
        if (mainView === 'networks') loadNetworks();
        const interval = setInterval(() => {
            loadContainers();
            if (mainView === 'images') loadImages();
            if (mainView === 'volumes') loadVolumes();
            if (mainView === 'networks') loadNetworks();
        }, 5000);
        return () => clearInterval(interval);
    }, [mainView]);

    useEffect(() => {
        if (!window.electronAPI) return;

        const handleLog = (data: { containerId: string; line: string }) => {
            if (data.containerId === selectedContainer) {
                setLogs(prev => prev + data.line + '\n');
            }
        };

        const handleShellOutput = (data: { containerId: string; data: string }) => {
            if (data.containerId === selectedContainer) {
                setShellOutput(prev => prev + data.data);
                // Auto-scroll to bottom
                setTimeout(() => {
                    if (shellOutputRef.current) {
                        shellOutputRef.current.scrollTop = shellOutputRef.current.scrollHeight;
                    }
                }, 10);
            }
        };

        const handleExecOutput = (data: { containerId: string; data: string }) => {
            if (data.containerId === selectedContainer) {
                setExecOutput(prev => prev + data.data);
                // Auto-scroll to bottom
                setTimeout(() => {
                    if (execOutputRef.current) {
                        execOutputRef.current.scrollTop = execOutputRef.current.scrollHeight;
                    }
                }, 10);
            }
        };

        const handleExecExit = (data: { containerId: string; code: number }) => {
            if (data.containerId === selectedContainer) {
                setIsExecActive(false);
                setExecOutput(prev => prev + `\n[Process exited with code ${data.code}]\n`);
            }
        };

        window.electronAPI.onDockerLog(handleLog);
        window.electronAPI.onDockerShellOutput(handleShellOutput);
        window.electronAPI.onDockerExecOutput(handleExecOutput);
        window.electronAPI.onDockerExecExit(handleExecExit);
    }, [selectedContainer]);

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

    const loadContainers = async () => {
        if (!window.electronAPI) return;

        try {
            const result = await window.electronAPI.docker.list();
            if (result.success) {
                setContainers(result.containers || []);
                setError(null);
            } else {
                setError(result.error || 'Failed to load containers');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load containers');
        }
    };

    const handleSelectContainer = async (containerId: string) => {
        if (selectedContainer === containerId && (isStreaming || isShellActive)) {
            // Stop streaming/shell if clicking the same container
            if (isStreaming) await stopLogs();
            if (isShellActive) await handleStopShell();
            setSelectedContainer(null);
            setLogs('');
            setShellOutput('');
            setDiagnostic(null);
            setContainerInfo(null);
        } else {
            // Stop previous logs/shell if any
            if (selectedContainer) {
                if (isStreaming) await stopLogs();
                if (isShellActive) await handleStopShell();
                if (isExecActive) await handleStopExec();
            }
            setSelectedContainer(containerId);
            setLogs('');
            setShellOutput('');
            setExecOutput('');
            setContainerDetailTab('overview');
            await loadDiagnostic(containerId);
            await loadContainerInfo(containerId);
        }
    };

    const loadDiagnostic = async (containerId: string) => {
        if (!window.electronAPI) return;
        try {
            const result = await (window.electronAPI as any).docker.diagnose(containerId);
            if (result.success) {
                setDiagnostic(result.diagnostic);
            }
        } catch (err) {
            console.error('Failed to load diagnostic:', err);
        }
    };

    const loadContainerInfo = async (containerId: string) => {
        if (!window.electronAPI) return;
        try {
            const result = await (window.electronAPI as any).docker.containerInfo(containerId);
            if (result.success) {
                setContainerInfo(result.container);
            }
        } catch (err) {
            console.error('Failed to load container info:', err);
        }
    };

    const loadImages = async () => {
        if (!window.electronAPI) return;
        try {
            const result = await (window.electronAPI as any).docker.images();
            if (result.success) {
                setImages(result.images || []);
            }
        } catch (err) {
            console.error('Failed to load images:', err);
        }
    };

    const loadVolumes = async () => {
        if (!window.electronAPI) return;
        try {
            const result = await (window.electronAPI as any).docker.volumes();
            if (result.success) {
                setVolumes(result.volumes || []);
            }
        } catch (err) {
            console.error('Failed to load volumes:', err);
        }
    };

    const loadNetworks = async () => {
        if (!window.electronAPI) return;
        try {
            const result = await (window.electronAPI as any).docker.networks();
            if (result.success) {
                setNetworks(result.networks || []);
            }
        } catch (err) {
            console.error('Failed to load networks:', err);
        }
    };

    const loadContainerStats = async (containerId: string) => {
        if (!window.electronAPI) return;
        try {
            const result = await (window.electronAPI as any).docker.stats(containerId);
            if (result.success) {
                setContainerStats(result.stats);
            }
        } catch (err) {
            console.error('Failed to load container stats:', err);
        }
    };

    const loadContainerFiles = async (containerId: string, path: string = '/') => {
        if (!window.electronAPI) return;
        try {
            const result = await (window.electronAPI as any).docker.listFiles(containerId, path);
            if (result.success) {
                setContainerFiles(result.files || []);
                setCurrentPath(path);
            }
        } catch (err) {
            console.error('Failed to load container files:', err);
        }
    };

    const loadContainerInspect = async (containerId: string) => {
        if (!window.electronAPI) return;
        try {
            const result = await (window.electronAPI as any).docker.containerInfo(containerId);
            if (result.success) {
                setContainerInspect(result.container);
            }
        } catch (err) {
            console.error('Failed to load container inspect:', err);
        }
    };

    const startLogs = async (containerId: string) => {
        if (!window.electronAPI) return;

        setLoading(true);
        setIsStreaming(false);
        setError(null);

        try {
            const result = await window.electronAPI.docker.logs(containerId, 100);
            if (result.success) {
                setIsStreaming(true);
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
        if (!window.electronAPI || !selectedContainer) return;

        try {
            await window.electronAPI.docker.stopLogs(selectedContainer);
            setIsStreaming(false);
        } catch (err) {
            console.error('Failed to stop logs:', err);
        }
    };

    const handleStartShell = async () => {
        if (!window.electronAPI || !selectedContainer) return;

        setLoading(true);
        setShellOutput('');
        setViewMode('shell');

        try {
            const result = await window.electronAPI.docker.shell(selectedContainer, '/bin/sh');
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
        if (e.key === 'Enter' && window.electronAPI && selectedContainer && isShellActive) {
            const command = shellInput + '\n';
            const cmd = shellInput;
            setShellInput('');
            setShellOutput(prev => {
                const prompt = prev.includes('\n') ? '\n' : '';
                return prev + prompt + cmd + '\n';
            });

            try {
                await window.electronAPI.docker.shellInput(selectedContainer, command);
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
        if (!window.electronAPI || !selectedContainer) return;

        try {
            await window.electronAPI.docker.shellStop(selectedContainer);
            setIsShellActive(false);
            setViewMode('logs');
        } catch (err) {
            console.error('Failed to stop shell:', err);
        }
    };

    const handleStartExec = async () => {
        if (!window.electronAPI || !selectedContainer) return;

        setLoading(true);
        setExecOutput('');
        setViewMode('exec');

        try {
            // If no command provided, just start a shell. Otherwise run command then drop into shell
            const command = execCommand.trim() || 'sh';
            const result = await window.electronAPI.docker.exec(selectedContainer, command);
            if (result.success) {
                setIsExecActive(true);
                if (execCommand.trim()) {
                    setExecOutput(`$ ${execCommand}\n`);
                } else {
                    setExecOutput('$ \n');
                }
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
        if (e.key === 'Enter' && window.electronAPI && selectedContainer && isExecActive) {
            const input = execInput + '\n';
            const command = execInput;
            setExecInput('');
            // Add prompt with command
            setExecOutput(prev => {
                const prompt = prev.includes('\n') ? '\n' : '';
                return prev + prompt + command + '\n';
            });

            try {
                await window.electronAPI.docker.execInput(selectedContainer, input);
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
        if (!window.electronAPI || !selectedContainer) return;

        try {
            await window.electronAPI.docker.execStop(selectedContainer);
            setIsExecActive(false);
            setViewMode('logs');
        } catch (err) {
            console.error('Failed to stop exec:', err);
        }
    };

    const handleContainerAction = async (action: 'start' | 'stop' | 'restart', containerId: string) => {
        if (!window.electronAPI) return;

        try {
            let result;
            switch (action) {
                case 'start':
                    result = await window.electronAPI.docker.start(containerId);
                    break;
                case 'stop':
                    result = await window.electronAPI.docker.stop(containerId);
                    break;
                case 'restart':
                    result = await window.electronAPI.docker.restart(containerId);
                    break;
            }

            if (result.success) {
                // Reload containers after action
                setTimeout(loadContainers, 500);
            } else {
                setError(result.error || `Failed to ${action} container`);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : `Failed to ${action} container`);
        }
    };

    const getStatusColor = (state: string) => {
        switch (state.toLowerCase()) {
            case 'running':
                return 'bg-green-500';
            case 'exited':
                return 'bg-[var(--color-text-tertiary)]';
            case 'created':
                return 'bg-[var(--color-primary)]';
            case 'restarting':
                return 'bg-yellow-500';
            default:
                return 'bg-[var(--color-text-secondary)]';
        }
    };

    const filteredContainers = containers.filter(container => {
        if (containerFilter === 'running' && container.State !== 'running') return false;
        if (containerFilter === 'stopped' && container.State === 'running') return false;
        if (containerSearch && !container.Names.toLowerCase().includes(containerSearch.toLowerCase()) &&
            !container.Image.toLowerCase().includes(containerSearch.toLowerCase())) {
            return false;
        }
        return true;
    });

    return (
        <div className="flex-1 flex flex-col bg-[var(--color-background)] overflow-hidden" style={{ minHeight: 0 }}>
            <div className="px-6 py-3 border-b border-[var(--color-border)] bg-[var(--color-card)] flex-shrink-0">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-4">
                        <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                            Docker
                        </div>
                        <div className="flex items-center gap-1 border border-[var(--color-border)] rounded-lg p-1">
                            <button
                                onClick={() => { setMainView('containers'); setSelectedContainer(null); }}
                                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${mainView === 'containers'
                                    ? 'bg-[var(--color-primary)] text-white'
                                    : 'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)]'
                                    }`}
                            >
                                Containers
                            </button>
                            <button
                                onClick={() => { setMainView('images'); setSelectedContainer(null); }}
                                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${mainView === 'images'
                                    ? 'bg-[var(--color-primary)] text-white'
                                    : 'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)]'
                                    }`}
                            >
                                Images
                            </button>
                            <button
                                onClick={() => { setMainView('volumes'); setSelectedContainer(null); }}
                                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${mainView === 'volumes'
                                    ? 'bg-[var(--color-primary)] text-white'
                                    : 'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)]'
                                    }`}
                            >
                                Volumes
                            </button>
                            <button
                                onClick={() => { setMainView('networks'); setSelectedContainer(null); }}
                                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${mainView === 'networks'
                                    ? 'bg-[var(--color-primary)] text-white'
                                    : 'bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)]'
                                    }`}
                            >
                                Networks
                            </button>
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            if (mainView === 'containers') loadContainers();
                            else if (mainView === 'images') loadImages();
                            else if (mainView === 'volumes') loadVolumes();
                            else if (mainView === 'networks') loadNetworks();
                        }}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-muted)] transition-colors duration-200"
                    >
                        Refresh
                    </button>
                </div>

                <div className="flex-1 flex overflow-hidden" style={{ minHeight: 0, height: 0 }}>
                    {/* Container List / Sidebar */}
                    {mainView === 'containers' && (
                        <div className="w-80 flex-shrink-0 border-r border-[var(--color-border)] bg-[var(--color-card)] flex flex-col" style={{ minHeight: 0, height: '100%', overflow: 'hidden' }}>
                            <div className="flex-1 p-4" style={{ minHeight: 0, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch' }}>
                                <div className="space-y-3">
                                    {/* Filter and Search */}
                                    <div className="space-y-2">
                                        <input
                                            type="text"
                                            placeholder="Search containers..."
                                            value={containerSearch}
                                            onChange={(e) => setContainerSearch(e.target.value)}
                                            className="w-full px-3 py-2 text-sm bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-primary)]"
                                        />
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => setContainerFilter('all')}
                                                className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${containerFilter === 'all'
                                                    ? 'bg-[var(--color-primary)] text-white'
                                                    : 'bg-[var(--color-muted)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]'
                                                    }`}
                                            >
                                                All
                                            </button>
                                            <button
                                                onClick={() => setContainerFilter('running')}
                                                className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${containerFilter === 'running'
                                                    ? 'bg-[var(--color-primary)] text-white'
                                                    : 'bg-[var(--color-muted)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]'
                                                    }`}
                                            >
                                                Running
                                            </button>
                                            <button
                                                onClick={() => setContainerFilter('stopped')}
                                                className={`flex-1 px-2 py-1 text-xs rounded transition-colors ${containerFilter === 'stopped'
                                                    ? 'bg-[var(--color-primary)] text-white'
                                                    : 'bg-[var(--color-muted)] text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]'
                                                    }`}
                                            >
                                                Stopped
                                            </button>
                                        </div>
                                    </div>

                                    {error && (
                                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-400">
                                            {error}
                                        </div>
                                    )}

                                    {filteredContainers.length === 0 ? (
                                        <div className="text-center py-8 text-[var(--color-text-tertiary)] text-sm">
                                            {containers.length === 0 ? 'No containers found' : 'No containers match your filter'}
                                        </div>
                                    ) : (
                                        filteredContainers.map((container) => (
                                            <div
                                                key={container.ID}
                                                className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${selectedContainer === container.ID
                                                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10'
                                                    : 'border-[var(--color-border)] hover:border-[var(--color-primary)]/50'
                                                    }`}
                                                onClick={() => handleSelectContainer(container.ID)}
                                            >
                                                <div className="flex items-start justify-between mb-2">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
                                                            {container.Names || container.ID.substring(0, 12)}
                                                        </div>
                                                        <div className="text-xs text-[var(--color-text-secondary)] mt-1 truncate">
                                                            {container.Image}
                                                        </div>
                                                    </div>
                                                    <div className={`w-2 h-2 rounded-full ${getStatusColor(container.State)} ml-2 flex-shrink-0`}></div>
                                                </div>

                                                <div className="text-xs text-[var(--color-text-secondary)] mb-2">
                                                    {container.Status}
                                                </div>

                                                <div className="flex items-center gap-2 mt-3 flex-wrap">
                                                    {container.State === 'running' ? (
                                                        <>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleContainerAction('stop', container.ID);
                                                                }}
                                                                className="px-2 py-1 text-xs font-medium text-[var(--color-text-secondary)] bg-[var(--color-muted)] rounded hover:bg-[var(--color-border)] transition-colors"
                                                            >
                                                                Stop
                                                            </button>
                                                            <button
                                                                onClick={async (e) => {
                                                                    e.stopPropagation();
                                                                    if (window.electronAPI) {
                                                                        const result = await (window.electronAPI as any).docker.pause(container.ID);
                                                                        if (result.success) {
                                                                            setTimeout(loadContainers, 500);
                                                                        }
                                                                    }
                                                                }}
                                                                className="px-2 py-1 text-xs font-medium text-[var(--color-text-secondary)] bg-[var(--color-muted)] rounded hover:bg-[var(--color-border)] transition-colors"
                                                            >
                                                                Pause
                                                            </button>
                                                        </>
                                                    ) : container.State === 'paused' ? (
                                                        <button
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                if (window.electronAPI) {
                                                                    const result = await (window.electronAPI as any).docker.unpause(container.ID);
                                                                    if (result.success) {
                                                                        setTimeout(loadContainers, 500);
                                                                    }
                                                                }
                                                            }}
                                                            className="px-2 py-1 text-xs font-medium text-white bg-[var(--color-primary)] rounded hover:opacity-90 transition-colors"
                                                        >
                                                            Unpause
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleContainerAction('start', container.ID);
                                                            }}
                                                            className="px-2 py-1 text-xs font-medium text-white bg-[var(--color-primary)] rounded hover:opacity-90 transition-colors"
                                                        >
                                                            Start
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleContainerAction('restart', container.ID);
                                                        }}
                                                        className="px-2 py-1 text-xs font-medium text-[var(--color-text-secondary)] bg-[var(--color-muted)] rounded hover:bg-[var(--color-border)] transition-colors"
                                                    >
                                                        Restart
                                                    </button>
                                                    <button
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            if (window.confirm('Are you sure you want to remove this container?')) {
                                                                if (window.electronAPI) {
                                                                    const result = await (window.electronAPI as any).docker.remove(container.ID, true);
                                                                    if (result.success) {
                                                                        if (selectedContainer === container.ID) {
                                                                            setSelectedContainer(null);
                                                                        }
                                                                        setTimeout(loadContainers, 500);
                                                                    } else {
                                                                        setError(result.error || 'Failed to remove container');
                                                                    }
                                                                }
                                                            }
                                                        }}
                                                        className="px-2 py-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Images View */}
                    {mainView === 'images' && (
                        <div className="flex-1 flex flex-col" style={{ minHeight: 0, minWidth: 0, height: '100%', overflow: 'hidden' }}>
                            <div className="flex-1 p-4" style={{ minHeight: 0, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch' }}>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Images</h3>
                                        <button
                                            onClick={async () => {
                                                const imageName = window.prompt('Enter image name to pull (e.g., nginx:latest):');
                                                if (imageName && window.electronAPI) {
                                                    try {
                                                        await (window.electronAPI as any).docker.pullImage(imageName);
                                                        loadImages();
                                                    } catch (err) {
                                                        setError(err instanceof Error ? err.message : 'Failed to pull image');
                                                    }
                                                }
                                            }}
                                            className="px-3 py-1.5 text-xs font-medium bg-[var(--color-primary)] text-white rounded hover:opacity-90 transition-colors"
                                        >
                                            Pull Image
                                        </button>
                                    </div>
                                    {images.length === 0 ? (
                                        <div className="text-center py-8 text-[var(--color-text-tertiary)] text-sm">
                                            No images found
                                        </div>
                                    ) : (
                                        images.map((image) => (
                                            <div key={image.id} className="p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)]">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                                                            {image.tags.join(', ') || '<none>'}
                                                        </div>
                                                        <div className="text-xs text-[var(--color-text-secondary)] mt-1">
                                                            {image.sizeHuman} • {image.id.substring(0, 12)}
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={async () => {
                                                            if (window.confirm('Are you sure you want to remove this image?')) {
                                                                if (window.electronAPI) {
                                                                    const result = await (window.electronAPI as any).docker.removeImage(image.id, true);
                                                                    if (result.success) {
                                                                        loadImages();
                                                                    } else {
                                                                        setError(result.error || 'Failed to remove image');
                                                                    }
                                                                }
                                                            }
                                                        }}
                                                        className="px-3 py-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Volumes View */}
                    {mainView === 'volumes' && (
                        <div className="flex-1 flex flex-col" style={{ minHeight: 0, minWidth: 0, height: '100%', overflow: 'hidden' }}>
                            <div className="flex-1 p-4" style={{ minHeight: 0, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch' }}>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Volumes</h3>
                                        <button
                                            onClick={async () => {
                                                const volumeName = window.prompt('Enter volume name:');
                                                if (volumeName && window.electronAPI) {
                                                    try {
                                                        await (window.electronAPI as any).docker.createVolume(volumeName);
                                                        loadVolumes();
                                                    } catch (err) {
                                                        setError(err instanceof Error ? err.message : 'Failed to create volume');
                                                    }
                                                }
                                            }}
                                            className="px-3 py-1.5 text-xs font-medium bg-[var(--color-primary)] text-white rounded hover:opacity-90 transition-colors"
                                        >
                                            Create Volume
                                        </button>
                                    </div>
                                    {volumes.length === 0 ? (
                                        <div className="text-center py-8 text-[var(--color-text-tertiary)] text-sm">
                                            No volumes found
                                        </div>
                                    ) : (
                                        volumes.map((volume) => (
                                            <div key={volume.name} className="p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)]">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                                                            {volume.name}
                                                        </div>
                                                        <div className="text-xs text-[var(--color-text-secondary)] mt-1">
                                                            {volume.driver} • {volume.mountpoint}
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={async () => {
                                                            if (window.confirm('Are you sure you want to remove this volume?')) {
                                                                if (window.electronAPI) {
                                                                    const result = await (window.electronAPI as any).docker.removeVolume(volume.name);
                                                                    if (result.success) {
                                                                        loadVolumes();
                                                                    } else {
                                                                        setError(result.error || 'Failed to remove volume');
                                                                    }
                                                                }
                                                            }
                                                        }}
                                                        className="px-3 py-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                                                    >
                                                        Remove
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Networks View */}
                    {mainView === 'networks' && (
                        <div className="flex-1 flex flex-col" style={{ minHeight: 0, minWidth: 0, height: '100%', overflow: 'hidden' }}>
                            <div className="flex-1 p-4" style={{ minHeight: 0, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch' }}>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Networks</h3>
                                        <button
                                            onClick={async () => {
                                                const networkName = window.prompt('Enter network name:');
                                                if (networkName && window.electronAPI) {
                                                    try {
                                                        await (window.electronAPI as any).docker.createNetwork(networkName);
                                                        loadNetworks();
                                                    } catch (err) {
                                                        setError(err instanceof Error ? err.message : 'Failed to create network');
                                                    }
                                                }
                                            }}
                                            className="px-3 py-1.5 text-xs font-medium bg-[var(--color-primary)] text-white rounded hover:opacity-90 transition-colors"
                                        >
                                            Create Network
                                        </button>
                                    </div>
                                    {networks.length === 0 ? (
                                        <div className="text-center py-8 text-[var(--color-text-tertiary)] text-sm">
                                            No networks found
                                        </div>
                                    ) : (
                                        networks.map((network) => (
                                            <div key={network.id} className="p-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)]">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                                                            {network.name}
                                                        </div>
                                                        <div className="text-xs text-[var(--color-text-secondary)] mt-1">
                                                            {network.driver} • {network.scope}
                                                        </div>
                                                    </div>
                                                    {network.name !== 'bridge' && network.name !== 'host' && network.name !== 'none' && (
                                                        <button
                                                            onClick={async () => {
                                                                if (window.confirm('Are you sure you want to remove this network?')) {
                                                                    if (window.electronAPI) {
                                                                        const result = await (window.electronAPI as any).docker.removeNetwork(network.id);
                                                                        if (result.success) {
                                                                            loadNetworks();
                                                                        } else {
                                                                            setError(result.error || 'Failed to remove network');
                                                                        }
                                                                    }
                                                                }
                                                            }}
                                                            className="px-3 py-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                                                        >
                                                            Remove
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Container Details - Only show when containers view is active and container is selected */}
                    {mainView === 'containers' && (
                        <div className="flex-1 flex flex-col overflow-hidden bg-[var(--color-background)]" style={{ minHeight: 0, minWidth: 0 }}>
                            {selectedContainer ? (
                                <>
                                    <div className="px-6 py-3 border-b border-[var(--color-border)] bg-[var(--color-card)] flex-shrink-0">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-3">
                                                <div className="text-sm font-semibold text-[var(--color-text-primary)]">
                                                    {containers.find(c => c.ID === selectedContainer)?.Names || selectedContainer.substring(0, 12)}
                                                </div>
                                                {diagnostic && (
                                                    <div className={`px-2 py-1 rounded text-xs font-semibold ${diagnostic.status === 'healthy' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                                                        diagnostic.status === 'warning' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' :
                                                            'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                                        }`}>
                                                        {diagnostic.status.toUpperCase()}
                                                    </div>
                                                )}
                                                {isStreaming && containerDetailTab === 'logs' && (
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                                        <span className="text-xs text-[var(--color-text-secondary)]">Live</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1 border-b border-[var(--color-border)]">
                                                <button
                                                    onClick={() => {
                                                        setContainerDetailTab('overview');
                                                        if (selectedContainer && !containerInfo) {
                                                            loadContainerInfo(selectedContainer);
                                                        }
                                                    }}
                                                    className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 ${containerDetailTab === 'overview'
                                                        ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                                                        : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                                                        }`}
                                                >
                                                    Overview
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setContainerDetailTab('logs');
                                                        if (!isStreaming) {
                                                            startLogs(selectedContainer);
                                                        }
                                                    }}
                                                    className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 ${containerDetailTab === 'logs'
                                                        ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                                                        : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                                                        }`}
                                                >
                                                    Logs
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setContainerDetailTab('stats');
                                                        if (selectedContainer) {
                                                            loadContainerStats(selectedContainer);
                                                        }
                                                    }}
                                                    className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 ${containerDetailTab === 'stats'
                                                        ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                                                        : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                                                        }`}
                                                >
                                                    Stats
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setContainerDetailTab('files');
                                                        if (selectedContainer) {
                                                            loadContainerFiles(selectedContainer, '/');
                                                        }
                                                    }}
                                                    className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 ${containerDetailTab === 'files'
                                                        ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                                                        : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                                                        }`}
                                                >
                                                    Files
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setContainerDetailTab('inspect');
                                                        if (selectedContainer) {
                                                            loadContainerInspect(selectedContainer);
                                                        }
                                                    }}
                                                    className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 ${containerDetailTab === 'inspect'
                                                        ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                                                        : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                                                        }`}
                                                >
                                                    Inspect
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (isStreaming) stopLogs();
                                                        if (isShellActive) handleStopShell();
                                                        if (isExecActive) handleStopExec();
                                                        setSelectedContainer(null);
                                                        setLogs('');
                                                        setShellOutput('');
                                                        setExecOutput('');
                                                    }}
                                                    className="ml-auto px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--color-text-secondary)] bg-[var(--color-muted)] hover:bg-[var(--color-border)] transition-colors"
                                                >
                                                    Close
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Overview Tab */}
                                    {containerDetailTab === 'overview' && (
                                        <div className="flex-1 overflow-y-auto p-6" style={{ minHeight: 0 }}>
                                            {containerInfo ? (
                                                <div className="space-y-6">
                                                    <div>
                                                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Container Information</h3>
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div>
                                                                <div className="text-xs text-[var(--color-text-secondary)] mb-1">Image</div>
                                                                <div className="text-sm text-[var(--color-text-primary)]">{containerInfo.image}</div>
                                                            </div>
                                                            <div>
                                                                <div className="text-xs text-[var(--color-text-secondary)] mb-1">Status</div>
                                                                <div className="text-sm text-[var(--color-text-primary)]">{containerInfo.status}</div>
                                                            </div>
                                                            <div>
                                                                <div className="text-xs text-[var(--color-text-secondary)] mb-1">Network Mode</div>
                                                                <div className="text-sm text-[var(--color-text-primary)]">{containerInfo.networkMode}</div>
                                                            </div>
                                                            <div>
                                                                <div className="text-xs text-[var(--color-text-secondary)] mb-1">Restart Count</div>
                                                                <div className="text-sm text-[var(--color-text-primary)]">{containerInfo.restartCount || 0}</div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {containerInfo.portBindings && containerInfo.portBindings.length > 0 && (
                                                        <div>
                                                            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Port Bindings</h3>
                                                            <div className="space-y-2">
                                                                {containerInfo.portBindings.map((binding: any, idx: number) => (
                                                                    <div key={idx} className="text-sm text-[var(--color-text-primary)] p-2 bg-[var(--color-muted)] rounded">
                                                                        {binding.hostPort ? `${binding.hostPort}:${binding.containerPort}/${binding.protocol}` : `${binding.containerPort}/${binding.protocol} (not published)`}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {containerInfo.mounts && containerInfo.mounts.length > 0 && (
                                                        <div>
                                                            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Volumes</h3>
                                                            <div className="space-y-2">
                                                                {containerInfo.mounts.map((mount: any, idx: number) => (
                                                                    <div key={idx} className="text-sm text-[var(--color-text-primary)] p-2 bg-[var(--color-muted)] rounded">
                                                                        {mount.source} → {mount.destination} ({mount.type})
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {diagnostic && (
                                                        <div>
                                                            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Diagnostics</h3>
                                                            <div className={`p-4 rounded-lg border ${diagnostic.status === 'healthy' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' :
                                                                diagnostic.status === 'warning' ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' :
                                                                    'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                                                                }`}>
                                                                <div className="text-sm font-semibold mb-2">Status: {diagnostic.status.toUpperCase()}</div>
                                                                {diagnostic.rootCause && <div className="text-xs mb-2">{diagnostic.rootCause}</div>}
                                                                {diagnostic.suggestedFixes && diagnostic.suggestedFixes.length > 0 && (
                                                                    <div className="text-xs">
                                                                        <div className="font-semibold mb-1">Suggested Fixes:</div>
                                                                        <ul className="list-disc list-inside">
                                                                            {diagnostic.suggestedFixes.map((fix: string, idx: number) => (
                                                                                <li key={idx}>{fix}</li>
                                                                            ))}
                                                                        </ul>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="text-center py-8 text-[var(--color-text-tertiary)]">Loading container information...</div>
                                            )}
                                        </div>
                                    )}

                                    {/* Logs Tab */}
                                    {containerDetailTab === 'logs' && (
                                        <div className="flex-1 flex flex-col" style={{ minHeight: 0 }}>
                                            {diagnostic && diagnostic.status !== 'healthy' && (
                                                <div className={`border-b p-4 ${diagnostic.status === 'warning' ? 'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800' :
                                                    'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                                                    }`}>
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex-1">
                                                            <div className="text-sm font-semibold mb-1">
                                                                {diagnostic.rootCause || `Container Status: ${diagnostic.status}`}
                                                            </div>
                                                            {diagnostic.exitReason && (
                                                                <div className="text-xs text-[var(--color-text-secondary)] mb-2">
                                                                    {diagnostic.exitReason}
                                                                </div>
                                                            )}
                                                            {diagnostic.evidence && diagnostic.evidence.length > 0 && (
                                                                <div className="text-xs text-[var(--color-text-secondary)] mb-2">
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
                                                            onClick={() => { setContainerDetailTab('overview'); }}
                                                            className="ml-4 px-3 py-1 text-xs bg-[var(--color-card)] border border-[var(--color-border)] rounded hover:bg-[var(--color-muted)]"
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
                                                        if (logsEditorRef.current && isStreamingRef.current && containerDetailTab === 'logs' && value) {
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
                                                                if (isStreamingRef.current && containerDetailTab === 'logs') {
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

                                    {/* Stats Tab */}
                                    {containerDetailTab === 'stats' && (
                                        <div className="flex-1 overflow-y-auto p-6" style={{ minHeight: 0 }}>
                                            {containerStats ? (
                                                <div className="space-y-4">
                                                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Resource Usage</h3>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="p-4 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg">
                                                            <div className="text-xs text-[var(--color-text-secondary)] mb-1">CPU Usage</div>
                                                            <div className="text-2xl font-semibold text-[var(--color-text-primary)]">
                                                                {containerStats.cpuUsage ? `${(containerStats.cpuUsage * 100).toFixed(1)}%` : 'N/A'}
                                                            </div>
                                                        </div>
                                                        <div className="p-4 bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg">
                                                            <div className="text-xs text-[var(--color-text-secondary)] mb-1">Memory Usage</div>
                                                            <div className="text-2xl font-semibold text-[var(--color-text-primary)]">
                                                                {containerStats.memoryPercent ? `${containerStats.memoryPercent.toFixed(1)}%` : 'N/A'}
                                                            </div>
                                                            {containerStats.memoryLimit && (
                                                                <div className="text-xs text-[var(--color-text-secondary)] mt-1">
                                                                    {((containerStats.memoryUsage || 0) / 1024 / 1024).toFixed(2)} MB / {((containerStats.memoryLimit || 0) / 1024 / 1024).toFixed(2)} MB
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-center py-8 text-[var(--color-text-tertiary)]">Loading stats...</div>
                                            )}
                                        </div>
                                    )}

                                    {/* Files Tab */}
                                    {containerDetailTab === 'files' && (
                                        <div className="flex-1 overflow-y-auto p-6" style={{ minHeight: 0 }}>
                                            <div className="mb-4 flex items-center gap-2">
                                                <button
                                                    onClick={() => {
                                                        const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
                                                        if (selectedContainer) {
                                                            loadContainerFiles(selectedContainer, parentPath);
                                                        }
                                                    }}
                                                    disabled={currentPath === '/'}
                                                    className="px-3 py-1 text-xs bg-[var(--color-muted)] rounded hover:bg-[var(--color-border)] disabled:opacity-50"
                                                >
                                                    ← Back
                                                </button>
                                                <div className="text-sm text-[var(--color-text-primary)]">{currentPath}</div>
                                            </div>
                                            {containerFiles.length > 0 ? (
                                                <div className="space-y-1">
                                                    {containerFiles.map((file: any, idx: number) => (
                                                        <div
                                                            key={idx}
                                                            onClick={() => {
                                                                if (file.type === 'directory' && selectedContainer) {
                                                                    loadContainerFiles(selectedContainer, `${currentPath === '/' ? '' : currentPath}/${file.name}`);
                                                                }
                                                            }}
                                                            className={`p-2 rounded cursor-pointer hover:bg-[var(--color-muted)] flex items-center gap-2 ${file.type === 'directory' ? 'cursor-pointer' : 'cursor-default'
                                                                }`}
                                                        >
                                                            <span>{file.type === 'directory' ? '📁' : '📄'}</span>
                                                            <span className="text-sm text-[var(--color-text-primary)]">{file.name}</span>
                                                            {file.size && (
                                                                <span className="text-xs text-[var(--color-text-secondary)] ml-auto">
                                                                    {((file.size || 0) / 1024).toFixed(2)} KB
                                                                </span>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="text-center py-8 text-[var(--color-text-tertiary)]">No files found</div>
                                            )}
                                        </div>
                                    )}

                                    {/* Inspect Tab */}
                                    {containerDetailTab === 'inspect' && (
                                        <div className="flex-1 overflow-hidden" style={{ minHeight: 0 }}>
                                            <Editor
                                                height="100%"
                                                width="100%"
                                                defaultLanguage="json"
                                                value={containerInspect ? JSON.stringify(containerInspect, null, 2) : 'Loading...'}
                                                theme={document.documentElement.classList.contains('dark') ? 'vs-dark' : 'light'}
                                                options={{
                                                    readOnly: true,
                                                    minimap: { enabled: false },
                                                    fontSize: 13,
                                                    wordWrap: 'on',
                                                    padding: { top: 16, bottom: 16 },
                                                    automaticLayout: true,
                                                }}
                                            />
                                        </div>
                                    )}

                                    {/* Shell View - Removed, use Exec tab instead */}
                                    {false && (
                                        <div className="flex-1 flex flex-col relative bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg overflow-hidden">
                                            <div
                                                ref={shellOutputRef}
                                                className="flex-1 overflow-auto p-4 font-mono text-sm custom-scrollbar"
                                                onScroll={(e) => {
                                                    const target = e.target as HTMLDivElement;
                                                    setShowScrollTop(target.scrollTop > 100);
                                                }}
                                                style={{
                                                    color: 'var(--color-text-primary)',
                                                    lineHeight: '1.6',
                                                    backgroundColor: 'var(--color-card)',
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
                                                    className="absolute top-4 right-4 px-3 py-1.5 bg-[var(--color-card)]/90 hover:bg-[var(--color-muted)] text-[var(--color-text-primary)] text-xs rounded-lg border border-[var(--color-border)] transition-colors z-10 shadow-soft"
                                                >
                                                    ↑ Top
                                                </button>
                                            )}
                                            <div className="border-t border-[var(--color-border)] p-2 flex items-center gap-2 bg-[var(--color-muted)]">
                                                <span className="text-[var(--color-primary)] font-semibold">➜</span>
                                                <input
                                                    type="text"
                                                    value={shellInput}
                                                    onChange={(e) => setShellInput(e.target.value)}
                                                    onKeyDown={handleShellInput}
                                                    disabled={!isShellActive}
                                                    className="flex-1 bg-transparent text-[var(--color-text-primary)] outline-none font-mono text-sm placeholder:text-[var(--color-text-tertiary)]"
                                                    placeholder={isShellActive ? "Enter command..." : "Shell not active"}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Exec View - Removed, functionality moved to Files tab */}
                                    {false && (
                                        <div className="flex-1 flex flex-col relative bg-[var(--color-card)] border border-[var(--color-border)] rounded-lg overflow-hidden">
                                            {!isExecActive && (
                                                <div className="p-4 border-b border-[var(--color-border)] flex gap-2 bg-[var(--color-muted)]">
                                                    <input
                                                        type="text"
                                                        value={execCommand}
                                                        onChange={(e) => setExecCommand(e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && handleStartExec()}
                                                        placeholder="Optional: Enter initial command (or leave empty for shell)..."
                                                        className="flex-1 px-3 py-2 bg-[var(--color-card)] text-[var(--color-text-primary)] rounded border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:outline-none placeholder:text-[var(--color-text-tertiary)]"
                                                    />
                                                    <button
                                                        onClick={handleStartExec}
                                                        disabled={loading}
                                                        className="px-4 py-2 bg-[var(--color-primary)] text-white rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                    >
                                                        Start Shell
                                                    </button>
                                                </div>
                                            )}
                                            <div
                                                ref={execOutputRef}
                                                className="flex-1 overflow-auto p-4 font-mono text-sm custom-scrollbar"
                                                onScroll={(e) => {
                                                    const target = e.target as HTMLDivElement;
                                                    setShowScrollTop(target.scrollTop > 100);
                                                }}
                                                style={{
                                                    color: 'var(--color-text-primary)',
                                                    lineHeight: '1.6',
                                                    backgroundColor: 'var(--color-card)',
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
                                                    className="absolute top-4 right-4 px-3 py-1.5 bg-[var(--color-card)]/90 hover:bg-[var(--color-muted)] text-[var(--color-text-primary)] text-xs rounded-lg border border-[var(--color-border)] transition-colors z-10 shadow-soft"
                                                >
                                                    ↑ Top
                                                </button>
                                            )}
                                            {isExecActive && (
                                                <div className="border-t border-[var(--color-border)] p-2 flex items-center gap-2 bg-[var(--color-muted)]">
                                                    <span className="text-[var(--color-primary)] font-semibold">➜</span>
                                                    <input
                                                        type="text"
                                                        value={execInput}
                                                        onChange={(e) => setExecInput(e.target.value)}
                                                        onKeyDown={handleExecInput}
                                                        autoFocus
                                                        className="flex-1 bg-transparent text-[var(--color-text-primary)] outline-none font-mono text-sm placeholder:text-[var(--color-text-tertiary)]"
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
                                        <div className="text-[var(--color-text-tertiary)] text-lg mb-2">🐳</div>
                                        <div className="text-[var(--color-text-secondary)] text-sm">
                                            Select a container to view logs or open shell
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

