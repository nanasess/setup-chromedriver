/**
 * Unit tests for src/installer/download.ts.
 *
 * @actions/tool-cache is mocked so no real network or filesystem I/O occurs.
 *
 * The project is ESM, so the mock is registered with
 * `jest.unstable_mockModule` and both the mocked module and the module under
 * test are pulled in with dynamic `import()` *after* the mock is in place.
 */

import { jest } from "@jest/globals";

jest.unstable_mockModule("@actions/tool-cache", () => ({
  downloadTool: jest.fn(),
  extractZip: jest.fn(),
}));

const tc = await import("@actions/tool-cache");
const { downloadAndExtractZip } = await import("../src/installer/download.js");

const mockedTc = jest.mocked(tc);

describe("downloadAndExtractZip", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Reset timers in case a test enabled fake timers for the retry backoff.
    jest.useRealTimers();
  });

  it("downloads the zip then extracts it and returns the extracted directory", async () => {
    const url = "https://example.com/chromedriver-linux64.zip";
    const zipPath = "/tmp/download/chromedriver.zip";
    const extractedDir = "/tmp/extracted/chromedriver-linux64";

    mockedTc.downloadTool.mockResolvedValue(zipPath);
    mockedTc.extractZip.mockResolvedValue(extractedDir);

    const result = await downloadAndExtractZip(url);

    expect(result).toBe(extractedDir);
    expect(mockedTc.downloadTool).toHaveBeenCalledTimes(1);
    expect(mockedTc.downloadTool).toHaveBeenCalledWith(url);
    expect(mockedTc.extractZip).toHaveBeenCalledTimes(1);
    expect(mockedTc.extractZip).toHaveBeenCalledWith(zipPath);
  });

  it("calls downloadTool before extractZip", async () => {
    const callOrder: string[] = [];
    mockedTc.downloadTool.mockImplementation(async () => {
      callOrder.push("downloadTool");
      return "/tmp/download/chromedriver.zip";
    });
    mockedTc.extractZip.mockImplementation(async () => {
      callOrder.push("extractZip");
      return "/tmp/extracted/chromedriver";
    });

    await downloadAndExtractZip("https://example.com/chromedriver.zip");

    expect(callOrder).toEqual(["downloadTool", "extractZip"]);
  });

  it("retries on transient failure and eventually succeeds", async () => {
    // Fake timers so the inter-attempt backoff does not add real delay.
    jest.useFakeTimers();
    const extractedDir = "/tmp/extracted/chromedriver";
    mockedTc.downloadTool
      .mockRejectedValueOnce(new Error("network error 1"))
      .mockRejectedValueOnce(new Error("network error 2"))
      .mockResolvedValue("/tmp/download/chromedriver.zip");
    mockedTc.extractZip.mockResolvedValue(extractedDir);

    const promise = downloadAndExtractZip(
      "https://example.com/chromedriver.zip",
    );
    // Drain the backoff timers scheduled between the failed attempts.
    await jest.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe(extractedDir);
    expect(mockedTc.downloadTool).toHaveBeenCalledTimes(3);
    expect(mockedTc.extractZip).toHaveBeenCalledTimes(1);
  });

  it("throws the last error after exhausting all retries (max 10)", async () => {
    jest.useFakeTimers();
    const finalError = new Error("final failure");
    mockedTc.downloadTool.mockRejectedValue(finalError);

    const promise = downloadAndExtractZip(
      "https://example.com/chromedriver.zip",
    );
    // Attach the rejection expectation before advancing timers so the
    // rejection is handled (no unhandled-rejection warning).
    const expectation = expect(promise).rejects.toThrow("final failure");
    await jest.runAllTimersAsync();
    await expectation;

    expect(mockedTc.downloadTool).toHaveBeenCalledTimes(10);
    expect(mockedTc.extractZip).not.toHaveBeenCalled();
  });
});
