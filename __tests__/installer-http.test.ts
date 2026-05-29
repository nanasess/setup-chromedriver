/**
 * Unit tests for src/installer/http.ts.
 *
 * These verify that fetchText / fetchJson reproduce the curl-like semantics of
 * the original shell scripts:
 *
 *   curl --silent --location --fail --retry 10 ...
 *
 * - 2xx responses return the body (parsed as JSON for fetchJson).
 * - Non-retryable non-2xx responses throw immediately (--fail).
 * - Transient failures (5xx / network errors) are retried (--retry 10).
 *
 * typed-rest-client is mocked so no real network I/O occurs.
 */

// Shared mock for the HttpClient instance method `get`. The module under test
// constructs a single client at load time, so the constructor mock must return
// an object backed by this shared mock.
const mockGet = jest.fn();

jest.mock("typed-rest-client/HttpClient", () => ({
  HttpClient: jest.fn().mockImplementation(() => ({
    get: mockGet,
  })),
}));

import { fetchText, fetchJson } from "../src/installer/http";

/**
 * Build a fake typed-rest-client response with the given status code and body.
 * readBody is a fresh mock per response so we can assert it is drained.
 */
function makeResponse(statusCode: number, body: string) {
  return {
    message: { statusCode },
    readBody: jest.fn().mockResolvedValue(body),
  };
}

describe("installer/http", () => {
  beforeEach(() => {
    // mockReset (not just clear) drops any persistent mockResolvedValue /
    // mockRejectedValue implementation set by a previous test, so default
    // return values never leak across tests.
    mockGet.mockReset();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /**
   * Run a promise that may schedule retry backoff via setTimeout. With fake
   * timers, `advanceTimersByTimeAsync` advances pending timers *and* flushes the
   * microtasks queued between them, so each retry's awaited get/readBody runs
   * before the next backoff is scheduled. We advance well past the maximum total
   * backoff (sum of 500*(1..10) ms) to drain every retry, leaving no timer that
   * could leak into the next test.
   */
  async function runWithTimers<T>(promise: Promise<T>): Promise<T> {
    let settled = false;
    // Observe settling without consuming the promise the caller asserts on.
    const guarded = promise.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );

    // Total worst-case backoff is 500 * (1+2+...+10) = 27500 ms.
    while (!settled) {
      await jest.advanceTimersByTimeAsync(1000);
    }
    await guarded;
    return promise;
  }

  describe("fetchText", () => {
    it("returns the response body verbatim on a 2xx response", async () => {
      mockGet.mockResolvedValueOnce(makeResponse(200, "114.0.5735.90\n"));

      const result = await runWithTimers(
        fetchText("https://example.com/LATEST_RELEASE_114"),
      );

      expect(result).toBe("114.0.5735.90\n");
      expect(mockGet).toHaveBeenCalledTimes(1);
      expect(mockGet).toHaveBeenCalledWith(
        "https://example.com/LATEST_RELEASE_114",
      );
    });

    it("throws immediately on a non-retryable non-2xx response (404)", async () => {
      const response = makeResponse(404, "not found");
      mockGet.mockResolvedValueOnce(response);

      await expect(
        runWithTimers(fetchText("https://example.com/missing")),
      ).rejects.toThrow("failed with status code 404");

      // --fail: no retries for a 404.
      expect(mockGet).toHaveBeenCalledTimes(1);
      // Body is drained even on failure so the socket can be released.
      expect(response.readBody).toHaveBeenCalled();
    });

    it("retries transient 5xx responses and succeeds when one eventually returns 2xx", async () => {
      mockGet
        .mockResolvedValueOnce(makeResponse(503, "unavailable"))
        .mockResolvedValueOnce(makeResponse(500, "error"))
        .mockResolvedValueOnce(makeResponse(200, "ok"));

      const result = await runWithTimers(
        fetchText("https://example.com/flaky"),
      );

      expect(result).toBe("ok");
      expect(mockGet).toHaveBeenCalledTimes(3);
    });

    it("retries network errors and succeeds when a later attempt returns 2xx", async () => {
      mockGet
        .mockRejectedValueOnce(new Error("ECONNRESET"))
        .mockResolvedValueOnce(makeResponse(200, "recovered"));

      const result = await runWithTimers(
        fetchText("https://example.com/network-flaky"),
      );

      expect(result).toBe("recovered");
      expect(mockGet).toHaveBeenCalledTimes(2);
    });

    it("retries up to 10 times after the initial attempt then throws (11 total)", async () => {
      // Always return a retryable status.
      mockGet.mockResolvedValue(makeResponse(503, "unavailable"));

      await expect(
        runWithTimers(fetchText("https://example.com/always-503")),
      ).rejects.toThrow("failed with status code 503");

      // 1 initial attempt + 10 retries.
      expect(mockGet).toHaveBeenCalledTimes(11);
    });

    it("gives up after exhausting retries on persistent network errors", async () => {
      mockGet.mockRejectedValue(new Error("ETIMEDOUT"));

      await expect(
        runWithTimers(fetchText("https://example.com/dead")),
      ).rejects.toThrow("ETIMEDOUT");

      expect(mockGet).toHaveBeenCalledTimes(11);
    });

    it("does not retry a 429 beyond the configured limit but does treat it as retryable", async () => {
      mockGet
        .mockResolvedValueOnce(makeResponse(429, "too many"))
        .mockResolvedValueOnce(makeResponse(200, "ok"));

      const result = await runWithTimers(
        fetchText("https://example.com/throttled"),
      );

      expect(result).toBe("ok");
      expect(mockGet).toHaveBeenCalledTimes(2);
    });
  });

  describe("fetchJson", () => {
    it("parses a 2xx JSON body into an object", async () => {
      const payload = { versions: [{ version: "115.0.5790.170" }] };
      mockGet.mockResolvedValueOnce(makeResponse(200, JSON.stringify(payload)));

      const result = await runWithTimers(
        fetchJson<typeof payload>("https://example.com/known-good.json"),
      );

      expect(result).toEqual(payload);
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it("throws on a non-2xx response without attempting to parse JSON", async () => {
      mockGet.mockResolvedValueOnce(makeResponse(404, "not found"));

      await expect(
        runWithTimers(fetchJson("https://example.com/missing.json")),
      ).rejects.toThrow("failed with status code 404");
    });

    it("throws when the 2xx body is not valid JSON", async () => {
      mockGet.mockResolvedValueOnce(makeResponse(200, "not json"));

      await expect(
        runWithTimers(fetchJson("https://example.com/bad.json")),
      ).rejects.toThrow();
    });

    it("retries transient failures before parsing the eventual JSON body", async () => {
      const payload = { ok: true };
      mockGet
        .mockResolvedValueOnce(makeResponse(500, "error"))
        .mockResolvedValueOnce(makeResponse(200, JSON.stringify(payload)));

      const result = await runWithTimers(
        fetchJson<typeof payload>("https://example.com/flaky.json"),
      );

      expect(result).toEqual(payload);
      expect(mockGet).toHaveBeenCalledTimes(2);
    });
  });
});
