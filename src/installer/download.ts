import * as tc from "@actions/tool-cache";

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
export async function downloadAndExtractZip(url: string): Promise<string> {
  const maxRetries = 10;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const zipPath = await tc.downloadTool(url);
      const extractedDir = await tc.extractZip(zipPath);
      return extractedDir;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}
