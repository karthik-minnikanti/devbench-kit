import { execSync } from 'child_process';

export interface ArchMismatchWarning {
    mismatch: true;
    appArch: 'arm64' | 'x64';
    machineArch: 'arm64' | 'x64';
    message: string;
    releasesUrl: string;
}

const RELEASES_URL = 'https://github.com/karthik-minnikanti/devbench-kit/releases';

function isAppleSiliconMac(): boolean {
    if (process.platform !== 'darwin') {
        return false;
    }
    try {
        return execSync('sysctl -n hw.optional.arm64', { encoding: 'utf8' }).trim() === '1';
    } catch {
        return false;
    }
}

function getAppArch(): 'arm64' | 'x64' | null {
    if (process.arch === 'arm64') {
        return 'arm64';
    }
    if (process.arch === 'x64') {
        return 'x64';
    }
    return null;
}

/** Warn when the installed build arch does not match the Mac hardware. */
export function getArchMismatchWarning(): ArchMismatchWarning | null {
    if (process.platform !== 'darwin') {
        return null;
    }

    const appArch = getAppArch();
    if (!appArch) {
        return null;
    }

    const appleSilicon = isAppleSiliconMac();

    if (appleSilicon && appArch === 'x64') {
        return {
            mismatch: true,
            appArch: 'x64',
            machineArch: 'arm64',
            message:
                'This Mac has Apple Silicon, but you installed the Intel (x64) build. ' +
                'DevShell and other native features may fail. Download the arm64 DMG from GitHub Releases.',
            releasesUrl: RELEASES_URL,
        };
    }

    if (!appleSilicon && appArch === 'arm64') {
        return {
            mismatch: true,
            appArch: 'arm64',
            machineArch: 'x64',
            message:
                'This Mac has an Intel chip, but you installed the Apple Silicon (arm64) build. ' +
                'Download the x64 DMG from GitHub Releases.',
            releasesUrl: RELEASES_URL,
        };
    }

    return null;
}
