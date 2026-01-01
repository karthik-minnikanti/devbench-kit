import { useState, useEffect } from 'react';
import { Icon } from './Icon';

interface UpdateInfo {
    version: string;
    releaseDate?: string;
    releaseNotes?: string;
}

interface DownloadProgress {
    percent: number;
    transferred: number;
    total: number;
}

export function UpdateNotification() {
    const [updateAvailable, setUpdateAvailable] = useState<UpdateInfo | null>(null);
    const [downloading, setDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
    const [updateDownloaded, setUpdateDownloaded] = useState<UpdateInfo | null>(null);
    const [checking, setChecking] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [currentVersion, setCurrentVersion] = useState<string>('');

    useEffect(() => {
        // Get current version
        if (window.electronAPI?.updater?.getAppVersion) {
            window.electronAPI.updater.getAppVersion().then((result: any) => {
                if (result?.version) {
                    setCurrentVersion(result.version);
                }
            });
        }

        // Set up event listeners
        if (window.electronAPI?.updater) {
            const { updater } = window.electronAPI;

            updater.onCheckingForUpdate(() => {
                setChecking(true);
                setError(null);
            });

            updater.onUpdateAvailable((info: UpdateInfo) => {
                setChecking(false);
                setUpdateAvailable(info);
                setError(null);
            });

            updater.onUpdateNotAvailable(() => {
                setChecking(false);
                setError(null);
            });

            updater.onUpdateError((err: any) => {
                setChecking(false);
                setDownloading(false);
                setError(err?.message || 'Failed to check for updates');
            });

            updater.onDownloadProgress((progress: DownloadProgress) => {
                setDownloadProgress(progress);
            });

            updater.onUpdateDownloaded((info: UpdateInfo) => {
                setDownloading(false);
                setDownloadProgress(null);
                setUpdateDownloaded(info);
            });
        }
    }, []);

    const handleCheckForUpdates = async () => {
        if (!window.electronAPI?.updater?.checkForUpdates) return;
        
        setChecking(true);
        setError(null);
        try {
            const result = await window.electronAPI.updater.checkForUpdates();
            if (result?.error) {
                setError(result.error);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to check for updates');
        } finally {
            setChecking(false);
        }
    };

    const handleDownloadUpdate = async () => {
        if (!window.electronAPI?.updater?.downloadUpdate) return;
        
        setDownloading(true);
        setError(null);
        try {
            const result = await window.electronAPI.updater.downloadUpdate();
            if (result?.error) {
                setError(result.error);
                setDownloading(false);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to download update');
            setDownloading(false);
        }
    };

    const handleInstallUpdate = () => {
        if (!window.electronAPI?.updater?.quitAndInstall) return;
        window.electronAPI.updater.quitAndInstall();
    };

    const handleDismiss = () => {
        setUpdateAvailable(null);
        setUpdateDownloaded(null);
        setError(null);
        setDownloadProgress(null);
    };

    // Show update downloaded notification
    if (updateDownloaded) {
        return (
            <div className="fixed top-4 right-4 z-50 max-w-md bg-[var(--color-background)] border border-[var(--color-primary)] rounded-lg shadow-lg p-4 animate-slide-in-right">
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                        <Icon name="Download" className="w-5 h-5 text-[var(--color-primary)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
                            Update Ready to Install
                        </h3>
                        <p className="text-xs text-[var(--color-text-secondary)] mb-3">
                            Version {updateDownloaded.version} has been downloaded and is ready to install.
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={handleInstallUpdate}
                                className="px-3 py-1.5 bg-[var(--color-primary)] text-white rounded text-xs font-medium hover:opacity-90 transition-opacity"
                            >
                                Install & Restart
                            </button>
                            <button
                                onClick={handleDismiss}
                                className="px-3 py-1.5 bg-[var(--color-muted)] text-[var(--color-text-secondary)] rounded text-xs font-medium hover:bg-[var(--color-border)] transition-colors"
                            >
                                Later
                            </button>
                        </div>
                    </div>
                    <button
                        onClick={handleDismiss}
                        className="flex-shrink-0 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                    >
                        <Icon name="X" className="w-4 h-4" />
                    </button>
                </div>
            </div>
        );
    }

    // Show downloading notification
    if (downloading && downloadProgress) {
        return (
            <div className="fixed top-4 right-4 z-50 max-w-md bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg shadow-lg p-4">
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                        <Icon name="Download" className="w-5 h-5 text-[var(--color-primary)] animate-spin" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
                            Downloading Update
                        </h3>
                        <div className="mb-2">
                            <div className="w-full bg-[var(--color-muted)] rounded-full h-2">
                                <div
                                    className="bg-[var(--color-primary)] h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${downloadProgress.percent}%` }}
                                />
                            </div>
                            <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                                {Math.round(downloadProgress.percent)}% ({formatBytes(downloadProgress.transferred)} / {formatBytes(downloadProgress.total)})
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Show update available notification
    if (updateAvailable) {
        return (
            <div className="fixed top-4 right-4 z-50 max-w-md bg-[var(--color-background)] border border-[var(--color-primary)] rounded-lg shadow-lg p-4 animate-slide-in-right">
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                        <Icon name="Bell" className="w-5 h-5 text-[var(--color-primary)]" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
                            Update Available
                        </h3>
                        <p className="text-xs text-[var(--color-text-secondary)] mb-2">
                            Version {updateAvailable.version} is now available.
                            {currentVersion && (
                                <span className="block mt-1">Current version: {currentVersion}</span>
                            )}
                        </p>
                        {updateAvailable.releaseNotes && (
                            <div className="mb-3 p-2 bg-[var(--color-muted)] rounded text-xs text-[var(--color-text-secondary)] max-h-32 overflow-y-auto">
                                {updateAvailable.releaseNotes}
                            </div>
                        )}
                        <div className="flex gap-2">
                            <button
                                onClick={handleDownloadUpdate}
                                className="px-3 py-1.5 bg-[var(--color-primary)] text-white rounded text-xs font-medium hover:opacity-90 transition-opacity"
                            >
                                Download
                            </button>
                            <button
                                onClick={handleDismiss}
                                className="px-3 py-1.5 bg-[var(--color-muted)] text-[var(--color-text-secondary)] rounded text-xs font-medium hover:bg-[var(--color-border)] transition-colors"
                            >
                                Later
                            </button>
                        </div>
                    </div>
                    <button
                        onClick={handleDismiss}
                        className="flex-shrink-0 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                    >
                        <Icon name="X" className="w-4 h-4" />
                    </button>
                </div>
            </div>
        );
    }

    // Show error notification
    if (error) {
        return (
            <div className="fixed top-4 right-4 z-50 max-w-md bg-[var(--color-background)] border border-red-500 rounded-lg shadow-lg p-4 animate-slide-in-right-right">
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                        <Icon name="AlertCircle" className="w-5 h-5 text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
                            Update Error
                        </h3>
                        <p className="text-xs text-[var(--color-text-secondary)] mb-2">{error}</p>
                        <button
                            onClick={handleDismiss}
                            className="px-3 py-1.5 bg-[var(--color-muted)] text-[var(--color-text-secondary)] rounded text-xs font-medium hover:bg-[var(--color-border)] transition-colors"
                        >
                            Dismiss
                        </button>
                    </div>
                    <button
                        onClick={handleDismiss}
                        className="flex-shrink-0 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
                    >
                        <Icon name="X" className="w-4 h-4" />
                    </button>
                </div>
            </div>
        );
    }

    return null;
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

