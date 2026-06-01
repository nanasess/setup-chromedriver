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

import * as httpm from "typed-rest-client/HttpClient.js";

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

function isRetryableStatusCode(statusCode: number): boolean {
  // curl --retry retries on transient errors: 408, 429, and 5xx.
  return (
    statusCode === 408 ||
    statusCode === 429 ||
    (statusCode >= 500 && statusCode <= 599)
  );
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Perform a GET request with curl-like semantics and return the response body.
 *
 * Throws on non-2xx responses (after exhausting retries for transient ones)
 * and on network errors.
 */
async function getWithRetry(url: string): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let statusError: Error | null = null;

    try {
      const response = await client.get(url);
      const statusCode = response.message.statusCode ?? 0;

      if (statusCode >= 200 && statusCode < 300) {
        return await response.readBody();
      }

      // Drain the body so the socket can be reused / released.
      await response.readBody();

      const error = new Error(
        `Request to ${url} failed with status code ${statusCode}`,
      );

      if (isRetryableStatusCode(statusCode) && attempt < MAX_RETRIES) {
        // Retryable status: record it and fall through to the backoff below.
        lastError = error;
      } else {
        // --fail: non-2xx, non-retryable (or retries exhausted). Mark it for a
        // throw *outside* the try so the catch below does not reclassify it as
        // a retryable network error.
        statusError = error;
      }
    } catch (error: unknown) {
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
export async function fetchText(url: string): Promise<string> {
  return getWithRetry(url);
}

/**
 * Fetch a URL and parse the response body as JSON.
 */
export async function fetchJson<T>(url: string): Promise<T> {
  const body = await getWithRetry(url);
  return JSON.parse(body) as T;
}
