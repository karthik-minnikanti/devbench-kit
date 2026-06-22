/**
 * Ad-hoc sign the packaged .app before DMG/ZIP creation.
 *
 * Unsigned macOS builds (especially arm64) often show Gatekeeper's misleading
 * "damaged and can't be opened" error instead of "unidentified developer".
 * Ad-hoc signing (`codesign --sign -`) restores the bypassable right-click → Open flow.
 *
 * node-pty ships a native `spawn-helper` binary. `--deep` signing alone can leave
 * it without execute permission or a valid signature, which surfaces as
 * "posix_spawnp failed" in DevShell on other Macs.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function collectNativeBinaries(dir, results = []) {
  if (!fs.existsSync(dir)) {
    return results;
  }

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectNativeBinaries(fullPath, results);
      continue;
    }

    const isNodePtyBinary =
      entry.name === 'spawn-helper' ||
      (entry.name.endsWith('.node') && fullPath.includes(`${path.sep}node-pty${path.sep}`));

    if (isNodePtyBinary) {
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

  if (!fs.existsSync(appPath)) {
    throw new Error(`Expected app bundle not found for ad-hoc signing: ${appPath}`);
  }

  console.log(`[ad-hoc-sign] Signing ${appPath}`);

  const resourcesPath = path.join(appPath, 'Contents', 'Resources');
  const nativeBinaries = collectNativeBinaries(resourcesPath);

  for (const binaryPath of nativeBinaries) {
    console.log(`[ad-hoc-sign] Native binary: ${binaryPath}`);
    signBinary(binaryPath);
  }

  execFileSync(
    'codesign',
    ['--force', '--sign', '-', '--timestamp=none', appPath],
    { stdio: 'inherit' },
  );

  execFileSync('codesign', ['--verify', '--deep', '--strict', appPath], {
    stdio: 'inherit',
  });

  console.log('[ad-hoc-sign] Done');
};
