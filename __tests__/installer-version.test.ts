import { jest } from "@jest/globals";
import type { ExecOptions } from "@actions/exec";
import type { ChromeKnownGoodVersions } from "../src/chromedriver-helper.js";

jest.unstable_mockModule("@actions/exec", () => ({
  exec: jest.fn(),
}));
jest.unstable_mockModule("../src/installer/http.js", () => ({
  fetchJson: jest.fn(),
  fetchText: jest.fn(),
}));

const exec = await import("@actions/exec");
const { detectFullChromeVersion, resolveLegacyVersion, resolveModernDownload } =
  await import("../src/installer/version.js");
const { fetchJson, fetchText } = await import("../src/installer/http.js");

const mockedExec = jest.mocked(exec.exec);
const mockedFetchJson = jest.mocked(fetchJson);
const mockedFetchText = jest.mocked(fetchText);

// ---------------------------------------------------------------------------
// Mock Chrome-for-Testing JSON fixture
// ---------------------------------------------------------------------------

const MOCK_JSON: ChromeKnownGoodVersions = {
  versions: [
    {
      version: "131.0.6778.204",
      downloads: {
        chromedriver: [
          {
            platform: "linux64",
            url: "https://storage.googleapis.com/chrome-for-testing-public/131.0.6778.204/linux64/chromedriver-linux64.zip",
          },
          {
            platform: "win32",
            url: "https://storage.googleapis.com/chrome-for-testing-public/131.0.6778.204/win32/chromedriver-win32.zip",
          },
        ],
      },
    },
    {
      version: "131.0.6778.264",
      downloads: {
        chromedriver: [
          {
            platform: "linux64",
            url: "https://storage.googleapis.com/chrome-for-testing-public/131.0.6778.264/linux64/chromedriver-linux64.zip",
          },
        ],
      },
    },
  ],
};

const JSON_URL =
  "https://googlechromelabs.github.io/chrome-for-testing/known-good-versions-with-downloads.json";

/**
 * Helper that makes the mocked `exec.exec` emit the given string on stdout,
 * mirroring how @actions/exec forwards data to the `listeners.stdout` callback.
 */
function execWithStdout(output: string): typeof mockedExec {
  return mockedExec.mockImplementation(
    async (_cmd: string, _args?: string[], options?: ExecOptions) => {
      options?.listeners?.stdout?.(Buffer.from(output));
      return 0;
    },
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// detectFullChromeVersion
// ---------------------------------------------------------------------------

describe("detectFullChromeVersion", () => {
  it("parses the third token of `<chromeapp> --version` on linux", async () => {
    execWithStdout("Google Chrome 131.0.6778.204 \n");

    const version = await detectFullChromeVersion(
      "linux",
      "google-chrome-stable",
    );

    expect(version).toBe("131.0.6778.204");
    expect(mockedExec).toHaveBeenCalledTimes(1);
    const [cmd, args] = mockedExec.mock.calls[0];
    // The command line is quoted to survive @actions/exec space-splitting.
    expect(cmd).toBe('"google-chrome-stable"');
    expect(args).toEqual(["--version"]);
  });

  it("parses the third token of `<chromeapp> --version` on darwin", async () => {
    execWithStdout("Google Chrome 120.0.6099.109\n");

    const version = await detectFullChromeVersion(
      "darwin",
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    );

    expect(version).toBe("120.0.6099.109");
    const [cmd, args] = mockedExec.mock.calls[0];
    // Quoted so the space in the .app path is not split by @actions/exec.
    expect(cmd).toBe(
      '"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"',
    );
    expect(args).toEqual(["--version"]);
  });

  it("reads the FileVersion via powershell on win32", async () => {
    execWithStdout("120.0.6099.109\r\n");

    const chromeapp =
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
    const version = await detectFullChromeVersion("win32", chromeapp);

    expect(version).toBe("120.0.6099.109");
    expect(mockedExec).toHaveBeenCalledTimes(1);
    const [cmd, args, options] = mockedExec.mock.calls[0];
    expect(cmd).toBe("powershell");
    // The path is read from $env:CHROME_PATH, not interpolated into the
    // -command string (command-injection guard).
    expect(args).toEqual([
      "-command",
      "(Get-Item $env:CHROME_PATH).VersionInfo.FileVersion",
    ]);
    expect(options?.env?.CHROME_PATH).toBe(chromeapp);
    // The raw path must never appear in the command arguments.
    expect((args as string[]).join(" ")).not.toContain(chromeapp);
  });

  it("does not allow command injection via a malicious chromeapp path on win32", async () => {
    execWithStdout("120.0.6099.109\r\n");

    // A path crafted to break out of a quoted PowerShell literal.
    const malicious = "x'; Start-Process calc; '";
    await detectFullChromeVersion("win32", malicious);

    const [, args, options] = mockedExec.mock.calls[0];
    // The payload is confined to the env var; the command string is static.
    expect(args).toEqual([
      "-command",
      "(Get-Item $env:CHROME_PATH).VersionInfo.FileVersion",
    ]);
    expect(options?.env?.CHROME_PATH).toBe(malicious);
    expect((args as string[]).join(" ")).not.toContain("Start-Process");
  });

  it("accumulates stdout emitted across multiple chunks", async () => {
    mockedExec.mockImplementation(
      async (_cmd: string, _args?: string[], options?: ExecOptions) => {
        options?.listeners?.stdout?.(Buffer.from("Google Chrome "));
        options?.listeners?.stdout?.(Buffer.from("131.0.6778.204\n"));
        return 0;
      },
    );

    const version = await detectFullChromeVersion(
      "linux",
      "google-chrome-stable",
    );

    expect(version).toBe("131.0.6778.204");
  });
});

// ---------------------------------------------------------------------------
// resolveModernDownload
// ---------------------------------------------------------------------------

describe("resolveModernDownload", () => {
  it("resolves an exact version match without falling back", async () => {
    mockedFetchJson.mockResolvedValue(MOCK_JSON);

    const result = await resolveModernDownload("131.0.6778.204", "linux64");

    expect(result).toEqual({
      version: "131.0.6778.204",
      url: "https://storage.googleapis.com/chrome-for-testing-public/131.0.6778.204/linux64/chromedriver-linux64.zip",
    });
    expect(mockedFetchJson).toHaveBeenCalledWith(JSON_URL);
  });

  it("resolves win32 arch on an exact match", async () => {
    mockedFetchJson.mockResolvedValue(MOCK_JSON);

    const result = await resolveModernDownload("131.0.6778.204", "win32");

    expect(result.url).toBe(
      "https://storage.googleapis.com/chrome-for-testing-public/131.0.6778.204/win32/chromedriver-win32.zip",
    );
  });

  it("falls back to the last version3-matching version when no exact match", async () => {
    mockedFetchJson.mockResolvedValue(MOCK_JSON);

    // 131.0.6778.999 has no exact entry; version3 "131.0.6778" matches both
    // entries -> findFallbackVersion returns the last (".264").
    const result = await resolveModernDownload("131.0.6778.999", "linux64");

    expect(result).toEqual({
      version: "131.0.6778.264",
      url: "https://storage.googleapis.com/chrome-for-testing-public/131.0.6778.264/linux64/chromedriver-linux64.zip",
    });
  });

  it("falls back for a major-only version without throwing (cut -f1-3 parity)", async () => {
    mockedFetchJson.mockResolvedValue(MOCK_JSON);

    // Parity guard: a major-only `chromedriver-version` like "131" has no exact
    // match. The shell computes VERSION3 via `cut -d '.' -f 1-3` => "131" and
    // matches `startswith("131.")`, so it must fall back to the latest 131.*
    // release rather than throwing (parseVersion3 would throw on "131").
    const result = await resolveModernDownload("131", "linux64");

    expect(result).toEqual({
      version: "131.0.6778.264",
      url: "https://storage.googleapis.com/chrome-for-testing-public/131.0.6778.264/linux64/chromedriver-linux64.zip",
    });
  });

  it("throws when neither an exact match nor a fallback can be resolved", async () => {
    mockedFetchJson.mockResolvedValue(MOCK_JSON);

    await expect(resolveModernDownload("999.0.0.0", "linux64")).rejects.toThrow(
      /Could not resolve a ChromeDriver download URL/,
    );
  });

  it("throws when the fallback version lacks the requested arch", async () => {
    mockedFetchJson.mockResolvedValue(MOCK_JSON);

    // version3 "131.0.6778" matches, fallback resolves to ".264", but that
    // entry has no mac-arm64 download -> still unresolved.
    await expect(
      resolveModernDownload("131.0.6778.999", "mac-arm64"),
    ).rejects.toThrow(/Could not resolve a ChromeDriver download URL/);
  });
});

// ---------------------------------------------------------------------------
// resolveLegacyVersion
// ---------------------------------------------------------------------------

describe("resolveLegacyVersion", () => {
  it("fetches LATEST_RELEASE_<major> and returns the trimmed body", async () => {
    mockedFetchText.mockResolvedValue("114.0.5735.90\n");

    const version = await resolveLegacyVersion(114);

    expect(version).toBe("114.0.5735.90");
    expect(mockedFetchText).toHaveBeenCalledWith(
      "https://chromedriver.storage.googleapis.com/LATEST_RELEASE_114",
    );
  });

  it("trims surrounding whitespace from the response", async () => {
    mockedFetchText.mockResolvedValue("  100.0.4896.60  ");

    const version = await resolveLegacyVersion(100);

    expect(version).toBe("100.0.4896.60");
  });
});
