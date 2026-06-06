/**
 * Ad-hoc sign the packaged .app before DMG/ZIP creation.
 *
 * Unsigned macOS builds (especially arm64) often show Gatekeeper's misleading
 * "damaged and can't be opened" error instead of "unidentified developer".
 * Ad-hoc signing (`codesign --sign -`) restores the bypassable right-click → Open flow.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

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
