/**
 * Windows ChromeDriver installer for setup-chromedriver.
 *
 * This implements the install flow originally provided by the (now-removed)
 * setup-chromedriver.ps1 reference script:
 *
 *   1. Resolve the Chrome app path (default if not provided).
 *   2. Detect the full Chrome version via the PE FileVersion.
 *   3. Determine the major version (from the requested version, or the detected
 *      full version).
 *   4. Legacy (<115): resolve LATEST_RELEASE_$major, download
 *      `chromedriver_win32.zip`, extract it (binary at the zip root) and move
 *      `chromedriver.exe` to `C:\SeleniumWebDrivers\ChromeDriver`.
 *   5. Modern (>=115): resolve the Chrome-for-Testing download (with version3
 *      fallback) for the native `win64` build, download and extract it
 *      (single-nested `chromedriver-win64/chromedriver.exe`) and move
 *      `chromedriver.exe` to `C:\SeleniumWebDrivers\ChromeDriver`.
 *
 * The install location (`C:\SeleniumWebDrivers\ChromeDriver`) is unchanged from
 * the original script, and no PATH manipulation (`core.addPath`) is performed,
 * matching the original behavior which relied on the directory already being on
 * the runner's PATH.
 */

import * as core from "@actions/core";
import * as io from "@actions/io";
import * as path from "path";

import {
  buildLegacyDownloadUrl,
  getDefaultChromePath,
  getInstallPath,
  isLegacyVersion,
  parseMajorVersion,
} from "../chromedriver-helper.js";
import { downloadAndExtractZip } from "./download.js";
import {
  detectFullChromeVersion,
  resolveLegacyVersion,
  resolveModernDownload,
} from "./version.js";

export async function installOnWindows(opts: {
  version: string;
  chromeapp: string;
}): Promise<void> {
  // Step 1: resolve the Chrome app path.
  const chromeapp = opts.chromeapp || getDefaultChromePath("win32");

  // Step 2: detect the full Chrome version (PE FileVersion via powershell).
  const fullVersion = await detectFullChromeVersion("win32", chromeapp);
  core.info(`Chrome version: ${fullVersion}`);

  // Step 3: determine the major version. If a version was requested, use its
  // major; otherwise use the detected full version's major.
  const majorVersion = parseMajorVersion(opts.version || fullVersion);

  // Install destination (C:\SeleniumWebDrivers\ChromeDriver).
  const installPath = getInstallPath("win32");
  await io.mkdirP(installPath);

  // Step 4: legacy (<115).
  if (isLegacyVersion(majorVersion)) {
    const version = await resolveLegacyVersion(majorVersion);
    const url = buildLegacyDownloadUrl(version, "win32");
    core.info(`Installing ChromeDriver ${version} for win32`);
    core.info(`Downloading ${url}...`);
    const extractedDir = await downloadAndExtractZip(url);
    // Legacy zip: chromedriver.exe is at the root of the archive.
    const binary = path.join(extractedDir, "chromedriver.exe");
    // Use cp, not mv: tool-cache extracts to the temp drive (D:) while the
    // install path is on C:, and io.mv uses fs.rename which fails with EXDEV
    // across drives. The original ps1 used Move-Item, which copies across
    // volumes. A copy achieves the same install (the temp source is ephemeral).
    await io.cp(binary, path.join(installPath, "chromedriver.exe"), {
      force: true,
    });
    return;
  }

  // Step 5: modern (>=115).
  // If no version was requested, use the detected full version.
  const requestedVersion = opts.version || fullVersion;
  // Chrome for Testing publishes a native x64 `win64` build for every modern
  // version, so we prefer it over the 32-bit `win32` build that the original
  // ps1 hard-coded. (Legacy <115 ChromeDriver only shipped win32, which is why
  // the legacy branch above keeps win32.)
  const arch = "win64";
  const { version, url } = await resolveModernDownload(requestedVersion, arch);
  core.info(`Installing ChromeDriver ${version} for ${arch}`);
  core.info(`Downloading ${url}...`);
  const extractedDir = await downloadAndExtractZip(url);
  // Modern Windows zip: single-nested chromedriver-win64/chromedriver.exe.
  // tool-cache.extractZip honors the real zip structure.
  const binary = path.join(
    extractedDir,
    "chromedriver-win64",
    "chromedriver.exe",
  );
  // Use cp, not mv: see the legacy branch above — io.mv (fs.rename) fails with
  // EXDEV when the temp drive (D:) and the install path (C:) differ.
  await io.cp(binary, path.join(installPath, "chromedriver.exe"), {
    force: true,
  });
}
