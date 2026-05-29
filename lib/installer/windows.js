"use strict";
/**
 * Windows ChromeDriver installer for the TypeScript rewrite of
 * setup-chromedriver.
 *
 * This reproduces the behavior of `lib/setup-chromedriver.ps1` 1:1:
 *
 *   1. Resolve the Chrome app path (default if not provided).
 *   2. Detect the full Chrome version via the PE FileVersion.
 *   3. Determine the major version (from the requested version, or the detected
 *      full version).
 *   4. Legacy (<115): resolve LATEST_RELEASE_$major, download
 *      `chromedriver_win32.zip`, extract it (binary at the zip root) and move
 *      `chromedriver.exe` to `C:\SeleniumWebDrivers\ChromeDriver`.
 *   5. Modern (>=115): resolve the Chrome-for-Testing download (with version3
 *      fallback), download and extract it (single-nested
 *      `chromedriver-win32/chromedriver.exe`) and move `chromedriver.exe` to
 *      `C:\SeleniumWebDrivers\ChromeDriver`.
 *
 * The install location (`C:\SeleniumWebDrivers\ChromeDriver`) is unchanged from
 * the original script, and no PATH manipulation (`core.addPath`) is performed,
 * matching the original behavior which relied on the directory already being on
 * the runner's PATH.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.installOnWindows = installOnWindows;
const core = __importStar(require("@actions/core"));
const io = __importStar(require("@actions/io"));
const path = __importStar(require("path"));
const chromedriver_helper_1 = require("../chromedriver-helper");
const download_1 = require("./download");
const version_1 = require("./version");
async function installOnWindows(opts) {
    // Step 1: resolve the Chrome app path.
    const chromeapp = opts.chromeapp || (0, chromedriver_helper_1.getDefaultChromePath)("win32");
    // Step 2: detect the full Chrome version (PE FileVersion via powershell).
    const fullVersion = await (0, version_1.detectFullChromeVersion)("win32", chromeapp);
    core.info(`Chrome version: ${fullVersion}`);
    // Step 3: determine the major version. If a version was requested, use its
    // major; otherwise use the detected full version's major.
    const majorVersion = (0, chromedriver_helper_1.parseMajorVersion)(opts.version || fullVersion);
    // Install destination (C:\SeleniumWebDrivers\ChromeDriver).
    const installPath = (0, chromedriver_helper_1.getInstallPath)("win32");
    await io.mkdirP(installPath);
    // Step 4: legacy (<115).
    if ((0, chromedriver_helper_1.isLegacyVersion)(majorVersion)) {
        const version = await (0, version_1.resolveLegacyVersion)(majorVersion);
        const url = (0, chromedriver_helper_1.buildLegacyDownloadUrl)(version, "win32");
        core.info(`Installing ChromeDriver ${version} for win32`);
        core.info(`Downloading ${url}...`);
        const extractedDir = await (0, download_1.downloadAndExtractZip)(url);
        // Legacy zip: chromedriver.exe is at the root of the archive.
        const binary = path.join(extractedDir, "chromedriver.exe");
        await io.mv(binary, path.join(installPath, "chromedriver.exe"), {
            force: true,
        });
        return;
    }
    // Step 5: modern (>=115).
    // If no version was requested, use the detected full version.
    const requestedVersion = opts.version || fullVersion;
    const arch = "win32";
    const { version, url } = await (0, version_1.resolveModernDownload)(requestedVersion, arch);
    core.info(`Installing ChromeDriver ${version} for ${arch}`);
    core.info(`Downloading ${url}...`);
    const extractedDir = await (0, download_1.downloadAndExtractZip)(url);
    // Modern Windows zip: single-nested chromedriver-win32/chromedriver.exe.
    // (The original ps1 produced a double-nested path as a side effect of
    // Expand-Archive -Force without -DestinationPath; tool-cache.extractZip
    // honors the real zip structure, so we do not reproduce the double nesting.)
    const binary = path.join(extractedDir, "chromedriver-win32", "chromedriver.exe");
    await io.mv(binary, path.join(installPath, "chromedriver.exe"), {
        force: true,
    });
}
