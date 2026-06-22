/**
 * Ad-hoc sign the packaged .app before DMG/ZIP creation.
 *
 * Unsigned macOS builds (especially arm64) often show Gatekeeper's misleading
 * "damaged and can't be opened" error instead of "unidentified developer".
 * Ad-hoc signing (`codesign --sign -`) restores the bypassable right-click → Open flow.
 *
 * node-pty ships a native `spawn-helper` binary. We chmod + sign those first, then
 * deep-sign the full .app so Electron Helper bundles are signed too.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function normalizeArch(arch) {
  if (!arch) {
    return process.arch === 'arm64' ? 'arm64' : 'x64';
  }
  if (arch === 'arm64' || arch === 'aarch64') {
    return 'arm64';
  }
  return 'x64';
}

function shouldSignNodePtyBinary(fullPath, targetArch) {
  if (!fullPath.includes(`${path.sep}node-pty${path.sep}`)) {
    return false;
  }

  const baseName = path.basename(fullPath);
  if (baseName !== 'spawn-helper' && !baseName.endsWith('.node')) {
    return false;
  }

  // Always sign electron-rebuild outputs for this package.
  if (fullPath.includes(`${path.sep}build${path.sep}Release${path.sep}`)) {
    return true;
  }

  // Never sign Windows prebuilds bundled inside the mac app.
  if (fullPath.includes(`${path.sep}prebuilds${path.sep}win32${path.sep}`)) {
    return false;
  }

  const darwinPrebuild = fullPath.match(/prebuilds\/darwin-(x64|arm64)\//);
  if (darwinPrebuild && darwinPrebuild[1] !== targetArch) {
    return false;
  }

  const darwinBin = fullPath.match(/bin\/darwin-(x64|arm64)-/);
  if (darwinBin && darwinBin[1] !== targetArch) {
    return false;
  }

  return true;
}

function collectNativeBinaries(dir, targetArch, results = []) {
  if (!fs.existsSync(dir)) {
    return results;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectNativeBinaries(fullPath, targetArch, results);
      continue;
    }

    if (shouldSignNodePtyBinary(fullPath, targetArch)) {
      results.push(fullPath);
    }
  }

  return results;
}

function signBinary(binaryPath) {
  fs.chmodSync(binaryPath, 0o755);
  execFileSync(
    'codesign',
    ['--force', '--sign', '-', '--timestamp=none', binaryPath],
    { stdio: 'inherit' },
  );
}

module.exports = async function adHocSignMac(context) {
  if (context.electronPlatformName !== 'darwin') {
    return;
  }

  const appName = `${context.packager.appInfo.productFilename}.app`;
  const appPath = path.join(context.appOutDir, appName);
  const targetArch = normalizeArch(context.arch);

  if (!fs.existsSync(appPath)) {
    throw new Error(`Expected app bundle not found for ad-hoc signing: ${appPath}`);
  }

  console.log(`[ad-hoc-sign] Signing ${appPath} (arch=${targetArch})`);

  const resourcesPath = path.join(appPath, 'Contents', 'Resources');
  const nativeBinaries = collectNativeBinaries(resourcesPath, targetArch);

  for (const binaryPath of nativeBinaries) {
    console.log(`[ad-hoc-sign] Native binary: ${binaryPath}`);
    signBinary(binaryPath);
  }

  // Deep sign covers DevBench Helper*.app and Frameworks; required after per-binary signing.
  execFileSync(
    'codesign',
    ['--force', '--deep', '--sign', '-', '--timestamp=none', appPath],
    { stdio: 'inherit' },
  );

  execFileSync('codesign', ['--verify', '--deep', '--strict', appPath], {
    stdio: 'inherit',
  });

  console.log('[ad-hoc-sign] Done');
};
