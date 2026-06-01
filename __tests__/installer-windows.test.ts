/**
 * Unit tests for the Windows ChromeDriver installer (`src/installer/windows.ts`).
 *
 * All external I/O is mocked: version detection / download resolution
 * (`./version`), zip download & extraction (`./download`) and file moves
 * (`@actions/io`). No network access or filesystem mutation occurs.
 *
 * These tests assert parity with `lib/setup-chromedriver.ps1`:
 *   - the Chrome FileVersion is detected (via version.ts),
 *   - legacy (<115) vs modern (>=115) branching,
 *   - the modern Windows zip is single-nested
 *     (`chromedriver-win32/chromedriver.exe`), and
 *   - the binary is installed to `C:\SeleniumWebDrivers\ChromeDriver`.
 */

import { jest } from "@jest/globals";
import * as path from "path";

jest.unstable_mockModule("@actions/io", () => ({
  which: jest.fn(),
  cp: jest.fn(),
  mkdirP: jest.fn(),
  mv: jest.fn(),
}));
jest.unstable_mockModule("../src/installer/download.js", () => ({
  downloadAndExtractZip: jest.fn(),
}));
jest.unstable_mockModule("../src/installer/version.js", () => ({
  detectFullChromeVersion: jest.fn(),
  resolveLegacyVersion: jest.fn(),
  resolveModernDownload: jest.fn(),
}));

const io = await import("@actions/io");
const { installOnWindows } = await import("../src/installer/windows.js");
const downloadMod = await import("../src/installer/download.js");
const versionMod = await import("../src/installer/version.js");

const mockedIo = jest.mocked(io);
const mockedDownloadAndExtractZip = jest.mocked(
  downloadMod.downloadAndExtractZip,
);
const mockedDetectFullChromeVersion = jest.mocked(
  versionMod.detectFullChromeVersion,
);
const mockedResolveLegacyVersion = jest.mocked(versionMod.resolveLegacyVersion);
const mockedResolveModernDownload = jest.mocked(
  versionMod.resolveModernDownload,
);

const INSTALL_PATH = "C:\\SeleniumWebDrivers\\ChromeDriver";
const DEFAULT_CHROME_PATH =
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

beforeEach(() => {
  jest.clearAllMocks();
  mockedIo.mkdirP.mockResolvedValue(undefined as never);
  mockedIo.cp.mockResolvedValue(undefined as never);
  mockedDownloadAndExtractZip.mockResolvedValue("C:\\extracted");
});

describe("installOnWindows (modern, >=115)", () => {
  beforeEach(() => {
    mockedDetectFullChromeVersion.mockResolvedValue("120.0.6099.109");
    mockedResolveModernDownload.mockResolvedValue({
      version: "120.0.6099.109",
      url: "https://example.com/chromedriver-win32.zip",
    });
  });

  it("detects the full Chrome version via version.ts for win32", async () => {
    await installOnWindows({ version: "", chromeapp: "" });

    expect(mockedDetectFullChromeVersion).toHaveBeenCalledWith(
      "win32",
      DEFAULT_CHROME_PATH,
    );
  });

  it("uses the provided chromeapp path when given", async () => {
    const customApp = "D:\\Chrome\\chrome.exe";
    await installOnWindows({ version: "", chromeapp: customApp });

    expect(mockedDetectFullChromeVersion).toHaveBeenCalledWith(
      "win32",
      customApp,
    );
  });

  it("creates the install directory C:\\SeleniumWebDrivers\\ChromeDriver", async () => {
    await installOnWindows({ version: "", chromeapp: "" });

    expect(mockedIo.mkdirP).toHaveBeenCalledWith(INSTALL_PATH);
  });

  it("resolves the modern download using the detected version when none requested", async () => {
    await installOnWindows({ version: "", chromeapp: "" });

    expect(mockedResolveModernDownload).toHaveBeenCalledWith(
      "120.0.6099.109",
      "win32",
    );
    expect(mockedResolveLegacyVersion).not.toHaveBeenCalled();
  });

  it("resolves the modern download using the requested version when provided", async () => {
    await installOnWindows({ version: "121.0.6167.85", chromeapp: "" });

    expect(mockedResolveModernDownload).toHaveBeenCalledWith(
      "121.0.6167.85",
      "win32",
    );
  });

  it("copies the single-nested chromedriver-win32/chromedriver.exe to the install path", async () => {
    await installOnWindows({ version: "", chromeapp: "" });

    expect(mockedDownloadAndExtractZip).toHaveBeenCalledWith(
      "https://example.com/chromedriver-win32.zip",
    );
    expect(mockedIo.cp).toHaveBeenCalledWith(
      path.join("C:\\extracted", "chromedriver-win32", "chromedriver.exe"),
      path.join(INSTALL_PATH, "chromedriver.exe"),
      { force: true },
    );
  });
});

describe("installOnWindows (legacy, <115)", () => {
  beforeEach(() => {
    mockedDetectFullChromeVersion.mockResolvedValue("114.0.5735.90");
    mockedResolveLegacyVersion.mockResolvedValue("114.0.5735.90");
  });

  it("resolves the legacy version via LATEST_RELEASE and does not touch the modern API", async () => {
    await installOnWindows({ version: "", chromeapp: "" });

    expect(mockedResolveLegacyVersion).toHaveBeenCalledWith(114);
    expect(mockedResolveModernDownload).not.toHaveBeenCalled();
  });

  it("downloads the legacy chromedriver_win32.zip from chromedriver.storage.googleapis.com", async () => {
    await installOnWindows({ version: "", chromeapp: "" });

    expect(mockedDownloadAndExtractZip).toHaveBeenCalledWith(
      "https://chromedriver.storage.googleapis.com/114.0.5735.90/chromedriver_win32.zip",
    );
  });

  it("copies chromedriver.exe from the zip root to the install path", async () => {
    await installOnWindows({ version: "", chromeapp: "" });

    expect(mockedIo.cp).toHaveBeenCalledWith(
      path.join("C:\\extracted", "chromedriver.exe"),
      path.join(INSTALL_PATH, "chromedriver.exe"),
      { force: true },
    );
  });

  it("uses the requested version's major to select the legacy branch", async () => {
    // Detected Chrome is modern, but a legacy version is explicitly requested.
    mockedDetectFullChromeVersion.mockResolvedValue("120.0.6099.109");
    await installOnWindows({ version: "100.0.4896.60", chromeapp: "" });

    expect(mockedResolveLegacyVersion).toHaveBeenCalledWith(100);
    expect(mockedResolveModernDownload).not.toHaveBeenCalled();
  });
});
