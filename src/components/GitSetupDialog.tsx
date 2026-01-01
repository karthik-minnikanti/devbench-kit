import { useState } from 'react';

interface GitSetupDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: () => void;
}

export function GitSetupDialog({ isOpen, onClose, onComplete }: GitSetupDialogProps) {
    const [repoPath, setRepoPath] = useState<string>('');
    const [initNewRepo, setInitNewRepo] = useState<boolean>(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!repoPath.trim()) {
            setError('Please enter a repository path');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const electronAPI = (window as any).electronAPI;
            if (!electronAPI) {
                setError('Electron API not available');
                setLoading(false);
                return;
            }

            if (initNewRepo) {
                // Initialize new repository
                const result = await electronAPI.git.initRepo(repoPath.trim());
                if (result.success) {
                    onComplete();
                } else {
                    setError(result.error || 'Failed to initialize repository');
                }
            } else {
                // Use existing repository
                const checkResult = await electronAPI.git.checkIfRepo(repoPath.trim());
                if (!checkResult.success || !checkResult.isRepo) {
                    setError('Path is not a Git repository');
                    setLoading(false);
                    return;
                }

                const result = await electronAPI.git.setRepoPath(repoPath.trim());
                if (result.success) {
                    onComplete();
                } else {
                    setError(result.error || 'Failed to set repository path');
                }
            }
        } catch (err: any) {
            setError(err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[var(--color-background)] rounded-lg shadow-xl w-full max-w-md mx-4 border border-[var(--color-border)]">
                <div className="p-6">
                    <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-4">
                        Setup Git Repository
                    </h2>
                    
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                                Repository Path
                            </label>
                            <input
                                type="text"
                                value={repoPath}
                                onChange={(e) => setRepoPath(e.target.value)}
                                placeholder="/path/to/git/repo"
                                className="w-full px-3 py-2 rounded border border-[var(--color-border)] bg-[var(--color-card)] text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                                disabled={loading}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    checked={initNewRepo}
                                    onChange={() => setInitNewRepo(true)}
                                    disabled={loading}
                                    className="text-[var(--color-primary)]"
                                />
                                <span className="text-sm text-[var(--color-text-primary)]">
                                    Initialize new Git repository
                                </span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="radio"
                                    checked={!initNewRepo}
                                    onChange={() => setInitNewRepo(false)}
                                    disabled={loading}
                                    className="text-[var(--color-primary)]"
                                />
                                <span className="text-sm text-[var(--color-text-primary)]">
                                    Use existing Git repository
                                </span>
                            </label>
                        </div>

                        {error && (
                            <div className="p-3 rounded bg-red-500/10 text-red-500 text-sm border border-red-500/20">
                                {error}
                            </div>
                        )}

                        <div className="flex gap-2 justify-end">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={loading}
                                className="px-4 py-2 rounded bg-[var(--color-muted)] text-[var(--color-text-primary)] text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading || !repoPath.trim()}
                                className="px-4 py-2 rounded bg-[var(--color-primary)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                            >
                                {loading ? 'Setting up...' : 'Continue'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}



