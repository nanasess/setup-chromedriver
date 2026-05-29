/**
 * Unit tests for src/installer/download.ts.
 *
 * @actions/tool-cache is mocked so no real network or filesystem I/O occurs.
 */

import * as tc from "@actions/tool-cache";
import { downloadAndExtractZip } from "../src/installer/download";

jest.mock("@actions/tool-cache");

const mockedTc = tc as jest.Mocked<typeof tc>;

describe("downloadAndExtractZip", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    const extractedDir = "/tmp/extracted/chromedriver";
    mockedTc.downloadTool
      .mockRejectedValueOnce(new Error("network error 1"))
      .mockRejectedValueOnce(new Error("network error 2"))
      .mockResolvedValue("/tmp/download/chromedriver.zip");
    mockedTc.extractZip.mockResolvedValue(extractedDir);

    const result = await downloadAndExtractZip(
      "https://example.com/chromedriver.zip",
    );

    expect(result).toBe(extractedDir);
    expect(mockedTc.downloadTool).toHaveBeenCalledTimes(3);
    expect(mockedTc.extractZip).toHaveBeenCalledTimes(1);
  });

  it("throws the last error after exhausting all retries (max 10)", async () => {
    const finalError = new Error("final failure");
    mockedTc.downloadTool
      .mockRejectedValue(new Error("earlier failure"))
      .mockRejectedValue(finalError);
    // Ensure the final attempt rejects with finalError.
    mockedTc.downloadTool.mockRejectedValue(finalError);

    await expect(
      downloadAndExtractZip("https://example.com/chromedriver.zip"),
    ).rejects.toThrow("final failure");

    expect(mockedTc.downloadTool).toHaveBeenCalledTimes(10);
    expect(mockedTc.extractZip).not.toHaveBeenCalled();
  });
});
