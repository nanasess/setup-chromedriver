"use strict";
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
exports.downloadAndExtractZip = downloadAndExtractZip;
const tc = __importStar(require("@actions/tool-cache"));
/**
 * Downloads a ChromeDriver zip from the given URL and extracts it.
 *
 * Mirrors the shell scripts' `curl ... -o chromedriver.zip` + `unzip` /
 * `Expand-Archive` step.
 *
 * Note: @actions/tool-cache's downloadTool already retries transient failures
 * internally (3 attempts, exponential backoff). We wrap it in an additional
 * retry loop so the overall behavior approximates the shell scripts' curl
 * `--retry 10`. downloadTool throttles via HttpClient and does not expose a
 * retry-count argument, so the retry is implemented here.
 *
 * The caller (unix.ts / windows.ts) is responsible for resolving the final
 * binary path inside the returned directory, since the zip layout differs
 * between legacy (binary at the root), modern Unix (`chromedriver-${arch}/`)
 * and modern Windows (single-nested `chromedriver-win32/`).
 *
 * @param url The URL of the ChromeDriver zip archive.
 * @returns The absolute path of the directory the archive was extracted into.
 */
async function downloadAndExtractZip(url) {
    const maxRetries = 10;
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const zipPath = await tc.downloadTool(url);
            const extractedDir = await tc.extractZip(zipPath);
            return extractedDir;
        }
        catch (error) {
            lastError = error;
        }
    }
    throw lastError;
}
