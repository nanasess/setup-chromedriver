"use strict";
/**
 * HTTP helpers used by the TypeScript rewrite of setup-chromedriver.
 *
 * These reproduce the behavior of the `curl` invocations in the original
 * shell scripts:
 *
 *   curl --silent --location --fail --retry 10 ...
 *
 * - `--location`  -> follow redirects
 * - `--fail`      -> treat 4xx/5xx responses as errors (throw)
 * - `--retry 10`  -> retry transient failures (network errors / 5xx) up to
 *                    10 times with a backoff between attempts
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
exports.fetchText = fetchText;
exports.fetchJson = fetchJson;
const httpm = __importStar(require("typed-rest-client/HttpClient"));
const USER_AGENT = "setup-chromedriver";
// curl --retry 10 retries up to 10 times *after* the initial attempt.
const MAX_RETRIES = 10;
// Base backoff between retries (ms). Grows with the attempt count.
const RETRY_BASE_MS = 500;
const client = new httpm.HttpClient(USER_AGENT, [], {
    // --location: follow redirects.
    allowRedirects: true,
    allowRedirectDowngrade: true,
});
function isRetryableStatusCode(statusCode) {
    // curl --retry retries on transient errors: 408, 429, and 5xx.
    return (statusCode === 408 ||
        statusCode === 429 ||
        (statusCode >= 500 && statusCode <= 599));
}
async function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
/**
 * Perform a GET request with curl-like semantics and return the response body.
 *
 * Throws on non-2xx responses (after exhausting retries for transient ones)
 * and on network errors.
 */
async function getWithRetry(url) {
    let lastError = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        let statusError = null;
        try {
            const response = await client.get(url);
            const statusCode = response.message.statusCode ?? 0;
            if (statusCode >= 200 && statusCode < 300) {
                return await response.readBody();
            }
            // Drain the body so the socket can be reused / released.
            await response.readBody();
            const error = new Error(`Request to ${url} failed with status code ${statusCode}`);
            if (isRetryableStatusCode(statusCode) && attempt < MAX_RETRIES) {
                // Retryable status: record it and fall through to the backoff below.
                lastError = error;
            }
            else {
                // --fail: non-2xx, non-retryable (or retries exhausted). Mark it for a
                // throw *outside* the try so the catch below does not reclassify it as
                // a retryable network error.
                statusError = error;
            }
        }
        catch (error) {
            // Network-level errors are retryable (curl --retry behavior).
            lastError = error instanceof Error ? error : new Error(String(error));
            if (attempt >= MAX_RETRIES) {
                throw lastError;
            }
        }
        // A non-retryable status code throws immediately (curl --fail).
        if (statusError) {
            throw statusError;
        }
        await sleep(RETRY_BASE_MS * (attempt + 1));
    }
    // Should be unreachable, but keeps the type checker satisfied.
    throw lastError ?? new Error(`Request to ${url} failed`);
}
/**
 * Fetch a URL and return the raw response body as a string.
 *
 * The body is returned verbatim (including any trailing newline). Callers that
 * need a clean value (e.g. LATEST_RELEASE_* responses) should `.trim()` it.
 */
async function fetchText(url) {
    return getWithRetry(url);
}
/**
 * Fetch a URL and parse the response body as JSON.
 */
async function fetchJson(url) {
    const body = await getWithRetry(url);
    return JSON.parse(body);
}
