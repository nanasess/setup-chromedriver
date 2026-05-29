"use strict";
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
exports.detectFullChromeVersion = detectFullChromeVersion;
exports.resolveModernDownload = resolveModernDownload;
exports.resolveLegacyVersion = resolveLegacyVersion;
const exec = __importStar(require("@actions/exec"));
const chromedriver_helper_1 = require("../chromedriver-helper");
const http_1 = require("./http");
// Chrome-for-Testing known-good-versions endpoint (modern, >=115).
const JSON_URL = "https://googlechromelabs.github.io/chrome-for-testing/known-good-versions-with-downloads.json";
/**
 * Detect the full Chrome version string.
 *
 * - win32: run `powershell -command "(Get-Item '<chromeapp>').VersionInfo.FileVersion"`
 *   and return the trimmed stdout (the PE FileVersion, e.g. "120.0.6099.109").
 * - linux/darwin: run `<chromeapp> --version` and return the third
 *   whitespace-separated token (equivalent to `cut -d' ' -f3`).
 */
async function detectFullChromeVersion(platform, chromeapp) {
    let stdout = "";
    const listeners = {
        stdout: (data) => {
            stdout += data.toString();
        },
    };
    if (platform === "win32") {
        await exec.exec("powershell", ["-command", `(Get-Item '${chromeapp}').VersionInfo.FileVersion`], { listeners });
        return stdout.trim();
    }
    await exec.exec(chromeapp, ["--version"], { listeners });
    // `cut -d' ' -f3`: split on spaces, take the third token.
    return stdout.trim().split(" ")[2];
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
async function resolveModernDownload(version, arch) {
    const json = await (0, http_1.fetchJson)(JSON_URL);
    let resolvedVersion = version;
    let url = (0, chromedriver_helper_1.extractDriverUrlFromJson)(json, resolvedVersion, arch);
    if (!url) {
        // Shell fallback: `VERSION3=$(cut -d '.' -f 1-3 <<<"${VERSION}")`.
        // We mirror `cut` semantics (take the first up to three dot-separated
        // fields) rather than the stricter `parseVersion3` helper, which throws on
        // inputs with fewer than three parts. This preserves parity for partial
        // inputs such as a major-only `chromedriver-version` (e.g. "120"), where
        // the shell still falls back to the latest matching release instead of
        // failing.
        const version3 = version.split(".").slice(0, 3).join(".");
        const fallbackVersion = (0, chromedriver_helper_1.findFallbackVersion)(json, version3);
        if (fallbackVersion) {
            resolvedVersion = fallbackVersion;
            url = (0, chromedriver_helper_1.extractDriverUrlFromJson)(json, resolvedVersion, arch);
        }
    }
    if (!url) {
        throw new Error(`Could not resolve a ChromeDriver download URL for version ${version} (${arch})`);
    }
    return { version: resolvedVersion, url };
}
/**
 * Resolve the latest legacy (<115) ChromeDriver release for a major version.
 *
 * Mirrors `curl .../LATEST_RELEASE_$major` and returns the trimmed version.
 */
async function resolveLegacyVersion(majorVersion) {
    const body = await (0, http_1.fetchText)((0, chromedriver_helper_1.buildLegacyLatestReleaseUrl)(majorVersion));
    return body.trim();
}
