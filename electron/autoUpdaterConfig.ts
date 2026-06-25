import { app } from 'electron';
import { execSync } from 'child_process';

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

export function isMacDeveloperIdSigned(): boolean {
    if (process.platform !== 'darwin') {
        return true;
    }
    try {
        const output = execSync(`codesign -dv --verbose=4 "${process.execPath}" 2>&1`, {
            encoding: 'utf8',
        });
        if (output.includes('Signature=adhoc')) {
            return false;
        }
        return output.includes('Authority=Developer ID Application');
    } catch {
        return false;
    }
}

/** Production builds can check GitHub for updates on every platform. */
export function isAutoUpdateEnabled(): boolean {
    return !isDev;
}

export function getAutoUpdateStatus() {
    const enabled = isAutoUpdateEnabled();
    const developerIdSigned = isMacDeveloperIdSigned();

    return {
        enabled,
        checksEnabled: enabled,
        autoInstallSupported: process.platform !== 'darwin' || developerIdSigned,
        signing:
            process.platform === 'darwin'
                ? developerIdSigned
                    ? 'developer-id'
                    : 'adhoc'
                : 'n/a',
        hint:
            enabled && process.platform === 'darwin' && !developerIdSigned
                ? 'This build is ad-hoc signed. Updates can still be downloaded and installed in-app; Gatekeeper may prompt on first launch after update.'
                : undefined,
    };
}

export function isBenignUpdateError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return (
        message.includes('latest-mac.yml') ||
        message.includes('latest.yml') ||
        message.includes('latest-linux.yml') ||
        message.includes('Cannot find latest') ||
        message.includes('404') ||
        message.includes('HttpError')
    );
}
