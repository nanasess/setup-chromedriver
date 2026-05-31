/**
 * Chrome / ChromeDriver version resolution for the TypeScript rewrite of
 * setup-chromedriver.
 *
 * This module reproduces the version-detection and version-resolution logic of
 * the original shell / PowerShell scripts:
 *
 * - `detectFullChromeVersion` mirrors the version probing:
 *     - Unix:    `$CHROMEAPP --version | cut -d' ' -f3`
 *     - Windows: `(Get-Item '<path>').VersionInfo.FileVersion`
 * - `resolveModernDownload` mirrors the Chrome-for-Testing JSON lookup with the
 *   version3 fallback (`extractDriverUrlFromJson` -> `findFallbackVersion`).
 * - `resolveLegacyVersion` mirrors `curl .../LATEST_RELEASE_$major`.
 *
 * The pure parsing / URL / JSON logic lives in `../chromedriver-helper` and is
 * reused here rather than reimplemented.
 */

import * as exec from "@actions/exec";

import {
  ChromeKnownGoodVersions,
  buildLegacyLatestReleaseUrl,
  extractDriverUrlFromJson,
  findFallbackVersion,
} from "../chromedriver-helper";
import { fetchJson, fetchText } from "./http";

// Chrome-for-Testing known-good-versions endpoint (modern, >=115).
const JSON_URL =
  "https://googlechromelabs.github.io/chrome-for-testing/known-good-versions-with-downloads.json";

/**
 * Detect the full Chrome version string.
 *
 * - win32: run `powershell -command "(Get-Item $env:CHROME_PATH).VersionInfo.FileVersion"`
 *   with the path passed via the CHROME_PATH env var (avoids command injection),
 *   and return the trimmed stdout (the PE FileVersion, e.g. "120.0.6099.109").
 * - linux/darwin: run `<chromeapp> --version` and return the third
 *   whitespace-separated token (equivalent to `cut -d' ' -f3`).
 */
export async function detectFullChromeVersion(
  platform: NodeJS.Platform,
  chromeapp: string,
): Promise<string> {
  let stdout = "";
  const listeners = {
    stdout: (data: Buffer) => {
      stdout += data.toString();
    },
  };

  try {
    if (platform === "win32") {
      // Pass the path via an environment variable rather than interpolating it
      // into the -command string. String interpolation would allow a chromeapp
      // value containing a single quote to break out of the quoted literal and
      // inject arbitrary PowerShell (command injection). The original ps1 used a
      // bound variable (`Get-Item $chromeapp`) and was not vulnerable; reading
      // from $env:CHROME_PATH restores that safety.
      await exec.exec(
        "powershell",
        ["-command", "(Get-Item $env:CHROME_PATH).VersionInfo.FileVersion"],
        { listeners, env: { ...process.env, CHROME_PATH: chromeapp } },
      );
      return stdout.trim();
    }

    // Quote the path: @actions/exec splits the command line on spaces, so an
    // unquoted chromeapp with spaces (e.g. macOS "/Applications/Google
    // Chrome.app/...") would be truncated at the first space. The shell scripts
    // quoted it as `"${CHROMEAPP}"`; we reproduce that here.
    await exec.exec(`"${chromeapp}"`, ["--version"], { listeners });
    // `cut -d' ' -f3`: split on spaces, take the third token.
    return stdout.trim().split(" ")[2];
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Failed to detect the Chrome version using "${chromeapp}": ${message}`,
    );
  }
}

export interface ResolvedDownload {
  version: string;
  url: string;
}

/**
 * Resolve the modern (Chrome-for-Testing) ChromeDriver download for a given
 * version and platform arch.
 *
 * Mirrors the shell logic:
 *   1. Fetch the known-good-versions JSON.
 *   2. Try an exact version match (`extractDriverUrlFromJson`).
 *   3. If no URL is found, fall back to the latest version sharing the same
 *      version3 prefix (`findFallbackVersion`) and look up its URL.
 *
 * Throws if no download URL can be resolved.
 */
export async function resolveModernDownload(
  version: string,
  arch: string,
): Promise<ResolvedDownload> {
  const json = await fetchJson<ChromeKnownGoodVersions>(JSON_URL);

  let resolvedVersion = version;
  let url = extractDriverUrlFromJson(json, resolvedVersion, arch);

  if (!url) {
    // Shell fallback: `VERSION3=$(cut -d '.' -f 1-3 <<<"${VERSION}")`.
    // We mirror `cut` semantics (take the first up to three dot-separated
    // fields) rather than the stricter `parseVersion3` helper, which throws on
    // inputs with fewer than three parts. This preserves parity for partial
    // inputs such as a major-only `chromedriver-version` (e.g. "120"), where
    // the shell still falls back to the latest matching release instead of
    // failing.
    const version3 = version.split(".").slice(0, 3).join(".");
    const fallbackVersion = findFallbackVersion(json, version3);
    if (fallbackVersion) {
      resolvedVersion = fallbackVersion;
      url = extractDriverUrlFromJson(json, resolvedVersion, arch);
    }
  }

  if (!url) {
    throw new Error(
      `Could not resolve a ChromeDriver download URL for version ${version} (${arch})`,
    );
  }

  return { version: resolvedVersion, url };
}

/**
 * Resolve the latest legacy (<115) ChromeDriver release for a major version.
 *
 * Mirrors `curl .../LATEST_RELEASE_$major` and returns the trimmed version.
 */
export async function resolveLegacyVersion(
  majorVersion: number,
): Promise<string> {
  const body = await fetchText(buildLegacyLatestReleaseUrl(majorVersion));
  return body.trim();
}
