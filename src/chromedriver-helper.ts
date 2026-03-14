/**
 * Pure functions extracted from setup-chromedriver.sh / setup-chromedriver.ps1
 * These encode the exact logic of the shell scripts so that:
 * 1. We can write fast, offline unit tests against them
 * 2. They become the production implementation when we rewrite in TypeScript
 */

// ---------------------------------------------------------------------------
// Version parsing
// ---------------------------------------------------------------------------

export function parseMajorVersion(version: string): number {
  const major = parseInt(version.split(".")[0], 10);
  if (isNaN(major)) {
    throw new Error(`Invalid version string: ${version}`);
  }
  return major;
}

export function parseVersion3(version: string): string {
  const parts = version.split(".");
  if (parts.length < 3) {
    throw new Error(`Version must have at least 3 parts: ${version}`);
  }
  return parts.slice(0, 3).join(".");
}

// ---------------------------------------------------------------------------
// API selection
// ---------------------------------------------------------------------------

export function isLegacyVersion(majorVersion: number): boolean {
  return majorVersion < 115;
}

// ---------------------------------------------------------------------------
// Platform mapping
// ---------------------------------------------------------------------------

export function mapArchitecture(
  platform: NodeJS.Platform,
  arch: string
): string {
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

export function convertArchForLegacyAPI(arch: string): string {
  // Legacy API doesn't have mac-arm64, use mac64 instead
  if (arch === "mac-arm64") {
    return "mac64";
  }
  return arch;
}

export function convertArchForModernAPI(arch: string): string {
  // Modern API uses mac-x64 instead of mac64
  if (arch === "mac64") {
    return "mac-x64";
  }
  return arch;
}

// ---------------------------------------------------------------------------
// URL construction (Legacy API)
// ---------------------------------------------------------------------------

export function buildLegacyLatestReleaseUrl(majorVersion: number): string {
  return `https://chromedriver.storage.googleapis.com/LATEST_RELEASE_${majorVersion}`;
}

export function buildLegacyDownloadUrl(version: string, arch: string): string {
  return `https://chromedriver.storage.googleapis.com/${version}/chromedriver_${arch}.zip`;
}

// ---------------------------------------------------------------------------
// JSON response parsing (Modern API)
// ---------------------------------------------------------------------------

interface ChromeDriverDownload {
  platform: string;
  url: string;
}

interface ChromeVersion {
  version: string;
  downloads: {
    chromedriver?: ChromeDriverDownload[];
  };
}

interface ChromeKnownGoodVersions {
  versions: ChromeVersion[];
}

export function extractDriverUrlFromJson(
  json: ChromeKnownGoodVersions,
  version: string,
  platform: string
): string | null {
  const entry = json.versions.find((v) => v.version === version);
  if (!entry || !entry.downloads.chromedriver) {
    return null;
  }
  const download = entry.downloads.chromedriver.find(
    (d) => d.platform === platform
  );
  return download?.url ?? null;
}

export function findFallbackVersion(
  json: ChromeKnownGoodVersions,
  version3: string
): string | null {
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

export function getDefaultChromePath(platform: NodeJS.Platform): string {
  switch (platform) {
    case "win32":
      return "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
    case "darwin":
      return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
    default:
      return "google-chrome-stable";
  }
}

export function getInstallPath(platform: NodeJS.Platform): string {
  switch (platform) {
    case "win32":
      return "C:\\SeleniumWebDrivers\\ChromeDriver";
    default:
      return "/usr/local/bin/chromedriver";
  }
}
