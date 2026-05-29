"use strict";
/**
 * Pure functions extracted from setup-chromedriver.sh / setup-chromedriver.ps1
 * These encode the exact logic of the shell scripts so that:
 * 1. We can write fast, offline unit tests against them
 * 2. They become the production implementation when we rewrite in TypeScript
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseMajorVersion = parseMajorVersion;
exports.parseVersion3 = parseVersion3;
exports.isLegacyVersion = isLegacyVersion;
exports.mapArchitecture = mapArchitecture;
exports.convertArchForLegacyAPI = convertArchForLegacyAPI;
exports.convertArchForModernAPI = convertArchForModernAPI;
exports.buildLegacyLatestReleaseUrl = buildLegacyLatestReleaseUrl;
exports.buildLegacyDownloadUrl = buildLegacyDownloadUrl;
exports.extractDriverUrlFromJson = extractDriverUrlFromJson;
exports.findFallbackVersion = findFallbackVersion;
exports.getDefaultChromePath = getDefaultChromePath;
exports.getInstallPath = getInstallPath;
// ---------------------------------------------------------------------------
// Version parsing
// ---------------------------------------------------------------------------
function parseMajorVersion(version) {
    const major = parseInt(version.split(".")[0], 10);
    if (isNaN(major)) {
        throw new Error(`Invalid version string: ${version}`);
    }
    return major;
}
function parseVersion3(version) {
    const parts = version.split(".");
    if (parts.length < 3) {
        throw new Error(`Version must have at least 3 parts: ${version}`);
    }
    return parts.slice(0, 3).join(".");
}
// ---------------------------------------------------------------------------
// API selection
// ---------------------------------------------------------------------------
function isLegacyVersion(majorVersion) {
    return majorVersion < 115;
}
// ---------------------------------------------------------------------------
// Platform mapping
// ---------------------------------------------------------------------------
function mapArchitecture(platform, arch) {
    switch (platform) {
        case "win32":
            return "win32";
        case "darwin":
            return arch === "arm64" ? "mac-arm64" : "mac64";
        case "linux":
            return "linux64";
        default:
            return "linux64";
    }
}
function convertArchForLegacyAPI(arch) {
    // Legacy API doesn't have mac-arm64, use mac64 instead
    if (arch === "mac-arm64") {
        return "mac64";
    }
    return arch;
}
function convertArchForModernAPI(arch) {
    // Modern API uses mac-x64 instead of mac64
    if (arch === "mac64") {
        return "mac-x64";
    }
    return arch;
}
// ---------------------------------------------------------------------------
// URL construction (Legacy API)
// ---------------------------------------------------------------------------
function buildLegacyLatestReleaseUrl(majorVersion) {
    return `https://chromedriver.storage.googleapis.com/LATEST_RELEASE_${majorVersion}`;
}
function buildLegacyDownloadUrl(version, arch) {
    return `https://chromedriver.storage.googleapis.com/${version}/chromedriver_${arch}.zip`;
}
function extractDriverUrlFromJson(json, version, platform) {
    const entry = json.versions.find((v) => v.version === version);
    const chromedrivers = entry?.downloads?.chromedriver;
    if (!chromedrivers) {
        return null;
    }
    const download = chromedrivers.find((d) => d.platform === platform);
    return download?.url ?? null;
}
function findFallbackVersion(json, version3) {
    const prefix = version3 + ".";
    const matches = json.versions.filter((v) => v.version.startsWith(prefix));
    if (matches.length === 0) {
        return null;
    }
    // Return the last matching version (same as jq `last`)
    return matches[matches.length - 1].version;
}
// ---------------------------------------------------------------------------
// Default paths
// ---------------------------------------------------------------------------
function getDefaultChromePath(platform) {
    switch (platform) {
        case "win32":
            return "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
        case "darwin":
            return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
        default:
            return "google-chrome-stable";
    }
}
function getInstallPath(platform) {
    switch (platform) {
        case "win32":
            return "C:\\SeleniumWebDrivers\\ChromeDriver";
        default:
            return "/usr/local/bin/chromedriver";
    }
}
