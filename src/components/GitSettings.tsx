import { useState, useEffect } from 'react';

interface GitStatus {
    isRepo: boolean;
    hasChanges: boolean;
    ahead: number;
    behind: number;
    currentBranch?: string;
}

export function GitSettings() {
    const [repoPath, setRepoPath] = useState<string>('');
    const [status, setStatus] = useState<GitStatus | null>(null);
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [pulling, setPulling] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        loadRepoPath();
        loadStatus();
        
        // Refresh status every 5 seconds
        const interval = setInterval(() => {
            loadStatus();
        }, 5000);
        
        return () => clearInterval(interval);
    }, []);

    const loadRepoPath = async () => {
        try {
            const electronAPI = (window as any).electronAPI;
            if (electronAPI) {
                const result = await electronAPI.git.getRepoPath();
                if (result.success && result.repoPath) {
                    setRepoPath(result.repoPath);
                }
            }
        } catch (error) {
            console.error('Failed to load repo path:', error);
        }
    };

    const loadStatus = async () => {
        try {
            const electronAPI = (window as any).electronAPI;
            if (electronAPI) {
                const result = await electronAPI.git.status();
                if (result.success && result.status) {
                    setStatus(result.status);
                }
            }
        } catch (error) {
            console.error('Failed to load Git status:', error);
        }
    };

    const handleChangeRepoPath = async () => {
        setLoading(true);
        setMessage(null);
        try {
            const electronAPI = (window as any).electronAPI;
            if (electronAPI && electronAPI.dialog) {
                // Use dialog to select directory
                const result = await electronAPI.dialog.saveFile({
                    defaultPath: repoPath,
                });
                // Note: This is a workaround - we need a directory picker
                // For now, user will need to type the path
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Failed to change repo path' });
        } finally {
            setLoading(false);
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        setMessage(null);
        try {
            const electronAPI = (window as any).electronAPI;
            if (electronAPI) {
                const result = await electronAPI.git.sync();
                if (result.success) {
                    setMessage({ type: 'success', text: 'Synced successfully' });
                    await loadStatus();
                } else {
                    setMessage({ type: 'error', text: result.error || 'Failed to sync' });
                }
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Failed to sync' });
        } finally {
            setSyncing(false);
        }
    };

    const handlePull = async () => {
        setPulling(true);
        setMessage(null);
        try {
            const electronAPI = (window as any).electronAPI;
            if (electronAPI) {
                const result = await electronAPI.git.pull();
                if (result.success) {
                    setMessage({ type: 'success', text: 'Pulled latest changes' });
                    await loadStatus();
                } else {
                    if (result.hasConflicts) {
                        setMessage({ type: 'error', text: 'Merge conflicts detected. Please resolve manually.' });
                    } else {
                        setMessage({ type: 'error', text: result.error || 'Failed to pull' });
                    }
                }
            }
        } catch (error: any) {
            setMessage({ type: 'error', text: error.message || 'Failed to pull' });
        } finally {
            setPulling(false);
        }
    };

    return (
        <div className="p-6 space-y-6">
            <div>
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
                    Git Repository Settings
                </h2>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                            Repository Path
                        </label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={repoPath}
                                onChange={(e) => setRepoPath(e.target.value)}
                                placeholder="/path/to/git/repo"
                                className="flex-1 px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                            />
                            <button
                                onClick={handleChangeRepoPath}
                                disabled={loading}
                                className="px-4 py-2 rounded bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                            >
                                {loading ? 'Loading...' : 'Change'}
                            </button>
                        </div>
                    </div>

                    {status && (
                        <div className="p-4 rounded border border-[var(--color-border)] bg-[var(--color-card)]">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-[var(--color-text-secondary)]">Status:</span>
                                    <span className={`text-sm font-medium ${
                                        status.hasChanges ? 'text-yellow-500' : 'text-green-500'
                                    }`}>
                                        {status.hasChanges ? 'Uncommitted changes' : 'Up to date'}
                                    </span>
                                </div>
                                {status.currentBranch && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-[var(--color-text-secondary)]">Branch:</span>
                                        <span className="text-sm text-[var(--color-text-primary)]">{status.currentBranch}</span>
                                    </div>
                                )}
                                {status.ahead > 0 && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-[var(--color-text-secondary)]">Ahead:</span>
                                        <span className="text-sm text-[var(--color-text-primary)]">{status.ahead} commit(s)</span>
                                    </div>
                                )}
                                {status.behind > 0 && (
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-[var(--color-text-secondary)]">Behind:</span>
                                        <span className="text-sm text-[var(--color-text-primary)]">{status.behind} commit(s)</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="flex gap-2">
                        <button
                            onClick={handleSync}
                            disabled={syncing || !status?.hasChanges}
                            className="px-4 py-2 rounded bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                            {syncing ? 'Syncing...' : 'Sync Now'}
                        </button>
                        <button
                            onClick={handlePull}
                            disabled={pulling}
                            className="px-4 py-2 rounded bg-[var(--color-muted)] text-[var(--color-text-primary)] text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                        >
                            {pulling ? 'Pulling...' : 'Pull Latest'}
                        </button>
                    </div>

                    {message && (
                        <div className={`p-3 rounded text-sm ${
                            message.type === 'success' 
                                ? 'bg-green-500/10 text-green-500 border border-green-500/20'
                                : 'bg-red-500/10 text-red-500 border border-red-500/20'
                        }`}>
                            {message.text}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}



