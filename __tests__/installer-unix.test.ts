/**
 * Unit tests for src/installer/unix.ts.
 *
 * All external I/O is mocked: @actions/exec, @actions/io, @actions/core,
 * ./download and ./version. No network, no filesystem access, no real
 * subprocess execution occurs.
 *
 * The assertions verify parity with lib/setup-chromedriver.sh:
 *   - apt `apps=()` construction (sudo / curl / chromeapp / jq / unzip absence)
 *   - dpkg-not-installed -> apt-key + google.list tee + APP rewrite
 *   - legacy (<115) vs modern (>=115) zip path resolution
 *   - sudo present vs absent in the `mv` command
 */

import { jest } from "@jest/globals";
import * as path from "path";
import type { ExecOptions } from "@actions/exec";
import { getInstallPath } from "../src/chromedriver-helper.js";

jest.unstable_mockModule("@actions/exec", () => ({
  exec: jest.fn(),
}));
jest.unstable_mockModule("@actions/io", () => ({
  which: jest.fn(),
  cp: jest.fn(),
  mkdirP: jest.fn(),
  mv: jest.fn(),
}));
jest.unstable_mockModule("@actions/core", () => ({
  addPath: jest.fn(),
  getInput: jest.fn(),
  info: jest.fn(),
  setFailed: jest.fn(),
}));
jest.unstable_mockModule("../src/installer/download.js", () => ({
  downloadAndExtractZip: jest.fn(),
}));
jest.unstable_mockModule("../src/installer/version.js", () => ({
  detectFullChromeVersion: jest.fn(),
  resolveLegacyVersion: jest.fn(),
  resolveModernDownload: jest.fn(),
}));

const exec = await import("@actions/exec");
const io = await import("@actions/io");
const { installOnUnix } = await import("../src/installer/unix.js");
const downloadMod = await import("../src/installer/download.js");
const versionMod = await import("../src/installer/version.js");

const execMock = jest.mocked(exec.exec);
const whichMock = jest.mocked(io.which);
const downloadAndExtractZip = jest.mocked(downloadMod.downloadAndExtractZip);
const detectFullChromeVersion = jest.mocked(versionMod.detectFullChromeVersion);
const resolveLegacyVersion = jest.mocked(versionMod.resolveLegacyVersion);
const resolveModernDownload = jest.mocked(versionMod.resolveModernDownload);

// The install path is derived from process.platform at runtime. Compute the
// expected value the same way the implementation does so the test is valid
// regardless of the OS the test suite runs on.
const INSTALL_PATH = getInstallPath(process.platform);

/**
 * Configure io.which mock so that the listed commands are "found" (return an
 * absolute-ish path) and everything else is "not found" (return "").
 *
 * Mirrors `command -v` / `type -a` semantics used in the shell script.
 */
function setPresentCommands(present: string[]): void {
  whichMock.mockImplementation(async (tool: string, _check?: boolean) => {
    return present.includes(tool) ? `/usr/bin/${tool}` : "";
  });
}

/**
 * Extract every `exec.exec` call as a flat [command, args] tuple list for
 * easier assertions.
 */
function execCalls(): Array<{
  command: string;
  args: string[];
  options?: ExecOptions;
}> {
  return execMock.mock.calls.map((call) => ({
    command: call[0],
    args: (call[1] as string[]) ?? [],
    options: call[2] as ExecOptions | undefined,
  }));
}

/**
 * Find the `mv` invocation (with or without a leading sudo path) and return
 * its source / dest arguments.
 */
function findMove(): { sudo: string | null; source: string; dest: string } {
  const calls = execCalls();
  for (const { command, args } of calls) {
    if (command === "mv") {
      return { sudo: null, source: args[0], dest: args[1] };
    }
    // sudo path form: exec(sudo, ["mv", source, dest])
    if (args[0] === "mv") {
      return { sudo: command, source: args[1], dest: args[2] };
    }
  }
  throw new Error("no mv call found");
}

beforeEach(() => {
  jest.clearAllMocks();
  execMock.mockResolvedValue(0);
  downloadAndExtractZip.mockResolvedValue("/tmp/extracted");
  resolveModernDownload.mockResolvedValue({
    version: "131.0.6778.204",
    url: "https://example.com/chromedriver-linux64.zip",
  });
  resolveLegacyVersion.mockResolvedValue("114.0.5735.90");
  detectFullChromeVersion.mockResolvedValue("131.0.6778.204");
});

// ---------------------------------------------------------------------------
// apt apps[] construction (linux64)
// ---------------------------------------------------------------------------

describe("installOnUnix - linux apt dependency installation", () => {
  test("when all tools present and package installed, no apt-get is run", async () => {
    // sudo, dpkg, curl, jq, unzip, and chromeapp all present.
    setPresentCommands([
      "sudo",
      "dpkg",
      "curl",
      "jq",
      "unzip",
      "google-chrome-stable",
    ]);
    // dpkg -s succeeds (exit 0 => installed).
    execMock.mockResolvedValue(0);

    await installOnUnix({ version: "131", arch: "linux64", chromeapp: "" });

    const calls = execCalls();
    // No apt-get update/install, no apt-key, no tee.
    expect(
      calls.some((c) => c.command === "apt-get" || c.args.includes("apt-get")),
    ).toBe(false);
    expect(
      calls.some((c) => c.command === "apt-key" || c.args.includes("apt-key")),
    ).toBe(false);
  });

  test("missing dpkg short-circuits the whole apt block", async () => {
    setPresentCommands([]); // dpkg absent => block returns immediately.

    await installOnUnix({ version: "131", arch: "linux64", chromeapp: "" });

    const calls = execCalls();
    // dpkg -s must not be probed, no apt-key, no apt-get.
    expect(calls.some((c) => c.command === "dpkg")).toBe(false);
    expect(
      calls.some((c) => c.command === "apt-key" || c.args.includes("apt-key")),
    ).toBe(false);
    expect(
      calls.some((c) => c.command === "apt-get" || c.args.includes("apt-get")),
    ).toBe(false);
  });

  test("package not installed triggers apt-key + google.list tee + APP rewrite", async () => {
    // dpkg present, but package not installed (dpkg -s returns non-zero).
    // chromeapp default 'google-chrome-stable' is NOT present so it gets added.
    setPresentCommands(["sudo", "dpkg", "curl", "jq", "unzip"]);
    execMock.mockImplementation(async (command: string, args?: string[]) => {
      if (command === "dpkg" && args && args[0] === "-s") {
        return 1; // not installed
      }
      return 0;
    });

    await installOnUnix({ version: "131", arch: "linux64", chromeapp: "" });

    const calls = execCalls();

    // apt-key adv ... 4EB27DB2A3B88B8B (under sudo).
    const aptKey = calls.find(
      (c) => c.args.includes("apt-key") || c.command === "apt-key",
    );
    expect(aptKey).toBeDefined();
    expect(aptKey!.args).toContain("--recv-keys");
    expect(aptKey!.args).toContain("4EB27DB2A3B88B8B");
    expect(aptKey!.args).toContain("keyserver.ubuntu.com");

    // tee google.list: no shell — the repo line is piped to tee's stdin via
    // the `input` option, and tee runs under sudo (command path or args).
    const tee = calls.find(
      (c) => c.command === "tee" || c.args.includes("tee"),
    );
    expect(tee).toBeDefined();
    expect(tee!.args).toContain("/etc/apt/sources.list.d/google.list");
    const teeInput = (tee!.options?.input as Buffer | undefined)?.toString();
    expect(teeInput).toContain(
      "deb [arch=amd64] https://dl.google.com/linux/chrome/deb/ stable main",
    );

    // apt-get update then install -y --no-install-recommends.
    const aptGetUpdate = calls.find(
      (c) =>
        (c.command === "apt-get" || c.args.includes("apt-get")) &&
        c.args.includes("update"),
    );
    expect(aptGetUpdate).toBeDefined();

    const aptGetInstall = calls.find(
      (c) =>
        (c.command === "apt-get" || c.args.includes("apt-get")) &&
        c.args.includes("install"),
    );
    expect(aptGetInstall).toBeDefined();
    expect(aptGetInstall!.args).toContain("-y");
    expect(aptGetInstall!.args).toContain("--no-install-recommends");
    // APP was rewritten to google-chrome-stable and added to apps[].
    expect(aptGetInstall!.args).toContain("google-chrome-stable");
  });

  test("apps[] includes sudo/curl/jq/unzip when absent, package installed", async () => {
    // Only dpkg and chromeapp present; sudo/curl/jq/unzip all absent.
    setPresentCommands(["dpkg", "google-chrome-stable"]);
    execMock.mockImplementation(async (command: string, args?: string[]) => {
      if (command === "dpkg" && args && args[0] === "-s") {
        return 0; // installed => no apt-key / tee, APP stays
      }
      return 0;
    });

    await installOnUnix({ version: "131", arch: "linux64", chromeapp: "" });

    const calls = execCalls();
    // No apt-key since the package is installed.
    expect(
      calls.some((c) => c.command === "apt-key" || c.args.includes("apt-key")),
    ).toBe(false);

    const aptGetInstall = calls.find((c) => c.args.includes("install"));
    expect(aptGetInstall).toBeDefined();
    // sudo is absent => command is run directly ("apt-get"), and "sudo" is in apps[].
    expect(aptGetInstall!.command).toBe("apt-get");
    expect(aptGetInstall!.args).toEqual(
      expect.arrayContaining([
        "install",
        "-y",
        "--no-install-recommends",
        "sudo",
        "curl",
        "jq",
        "unzip",
      ]),
    );
    // chromeapp is present so it must NOT be added.
    expect(aptGetInstall!.args).not.toContain("google-chrome-stable");
  });

  test("apps[] adds chromeapp(APP) when the chrome command is absent", async () => {
    // dpkg, sudo, curl, jq, unzip present but chrome command absent.
    setPresentCommands(["dpkg", "sudo", "curl", "jq", "unzip"]);
    execMock.mockImplementation(async (command: string, args?: string[]) => {
      if (command === "dpkg" && args && args[0] === "-s") {
        return 0; // installed => APP stays as the given chromeapp
      }
      return 0;
    });

    await installOnUnix({
      version: "131",
      arch: "linux64",
      chromeapp: "google-chrome-beta",
    });

    const calls = execCalls();
    const aptGetInstall = calls.find((c) => c.args.includes("install"));
    expect(aptGetInstall).toBeDefined();
    // chrome command absent => APP (the provided chromeapp) is added.
    expect(aptGetInstall!.args).toContain("google-chrome-beta");
    // sudo present => only the chromeapp is in apps[], run under sudo.
    expect(aptGetInstall!.command).toBe("/usr/bin/sudo");
  });
});

// ---------------------------------------------------------------------------
// Legacy (<115) install path
// ---------------------------------------------------------------------------

describe("installOnUnix - legacy (<115)", () => {
  test("legacy moves chromedriver from the zip root and skips version output", async () => {
    setPresentCommands(["sudo", "dpkg", "curl", "jq", "unzip"]);
    execMock.mockResolvedValue(0);
    downloadAndExtractZip.mockResolvedValue("/tmp/legacy");

    await installOnUnix({ version: "114", arch: "linux64", chromeapp: "" });

    // Legacy zip => binary at the root.
    const move = findMove();
    expect(move.source).toBe(path.join("/tmp/legacy", "chromedriver"));
    expect(move.dest).toBe(INSTALL_PATH);

    // Legacy path returns before printing "Chromedriver version:" => no
    // `<installPath> --version` exec call.
    const calls = execCalls();
    expect(
      calls.some(
        (c) => c.command === INSTALL_PATH && c.args[0] === "--version",
      ),
    ).toBe(false);
  });

  test("legacy with no version resolves LATEST_RELEASE_<major>", async () => {
    setPresentCommands(["sudo", "dpkg", "curl", "jq", "unzip"]);
    detectFullChromeVersion.mockResolvedValue("114.0.5735.90");

    await installOnUnix({ version: "", arch: "linux64", chromeapp: "" });

    expect(resolveLegacyVersion).toHaveBeenCalledWith(114);
  });

  test("empty chromeapp on linux64 defaults to google-chrome-stable for version detection", async () => {
    // Parity guard: the shell sets CHROMEAPP=google-chrome-stable at the top of
    // the linux64 block and uses it for `"${CHROMEAPP}" --version`. The default
    // must propagate to detectFullChromeVersion, not stay an empty string.
    setPresentCommands(["sudo", "dpkg", "curl", "jq", "unzip"]);
    detectFullChromeVersion.mockResolvedValue("114.0.5735.90");

    await installOnUnix({ version: "", arch: "linux64", chromeapp: "" });

    expect(detectFullChromeVersion).toHaveBeenCalledWith(
      process.platform,
      "google-chrome-stable",
    );
  });
});

// ---------------------------------------------------------------------------
// Modern (>=115) install path
// ---------------------------------------------------------------------------

describe("installOnUnix - modern (>=115)", () => {
  test("modern moves chromedriver from the chromedriver-<arch>/ subdir", async () => {
    setPresentCommands([
      "sudo",
      "dpkg",
      "curl",
      "jq",
      "unzip",
      "google-chrome-stable",
    ]);
    execMock.mockResolvedValue(0);
    downloadAndExtractZip.mockResolvedValue("/tmp/modern");
    resolveModernDownload.mockResolvedValue({
      version: "131.0.6778.204",
      url: "https://example.com/chromedriver-linux64.zip",
    });

    await installOnUnix({ version: "131", arch: "linux64", chromeapp: "" });

    const move = findMove();
    // Modern Unix zip nests under chromedriver-<arch>/.
    expect(move.source).toBe(
      path.join("/tmp/modern", "chromedriver-linux64", "chromedriver"),
    );
    expect(move.dest).toBe(INSTALL_PATH);
  });

  test("modern converts mac64 arch to mac-x64 for resolution and zip subdir", async () => {
    setPresentCommands([]); // not linux64 => no apt block
    execMock.mockResolvedValue(0);
    downloadAndExtractZip.mockResolvedValue("/tmp/mac");
    resolveModernDownload.mockResolvedValue({
      version: "131.0.6778.204",
      url: "https://example.com/chromedriver-mac-x64.zip",
    });

    await installOnUnix({ version: "131", arch: "mac64", chromeapp: "" });

    // resolveModernDownload must be called with the converted modern arch.
    expect(resolveModernDownload).toHaveBeenCalledWith("131", "mac-x64");
    const move = findMove();
    expect(move.source).toBe(
      path.join("/tmp/mac", "chromedriver-mac-x64", "chromedriver"),
    );
  });

  test("modern prints chromedriver version (and chrome version when present)", async () => {
    setPresentCommands(["google-chrome-stable"]);
    execMock.mockResolvedValue(0);
    downloadAndExtractZip.mockResolvedValue("/tmp/modern");

    await installOnUnix({
      version: "131",
      arch: "mac64",
      chromeapp: "google-chrome-stable",
    });

    const calls = execCalls();
    // chromeapp present => `"<chromeapp>" --version` is invoked (quoted to
    // survive @actions/exec space-splitting).
    expect(
      calls.some(
        (c) =>
          c.command === '"google-chrome-stable"' && c.args[0] === "--version",
      ),
    ).toBe(true);
    // `<installPath> --version` is invoked.
    expect(
      calls.some(
        (c) => c.command === INSTALL_PATH && c.args[0] === "--version",
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// sudo present vs absent in the mv command
// ---------------------------------------------------------------------------

describe("installOnUnix - sudo handling in mv", () => {
  test("mv runs under sudo when sudo is present", async () => {
    setPresentCommands([
      "sudo",
      "dpkg",
      "curl",
      "jq",
      "unzip",
      "google-chrome-stable",
    ]);
    execMock.mockResolvedValue(0);
    downloadAndExtractZip.mockResolvedValue("/tmp/modern");

    await installOnUnix({ version: "131", arch: "linux64", chromeapp: "" });

    const move = findMove();
    expect(move.sudo).toBe("/usr/bin/sudo");
  });

  test("mv runs without sudo when sudo is absent", async () => {
    // sudo absent. Keep linux64 so apt block runs, but with sudo missing the
    // apps[] gets 'sudo' added; that does not affect the final mv assertion.
    setPresentCommands(["dpkg", "curl", "jq", "unzip", "google-chrome-stable"]);
    execMock.mockResolvedValue(0);
    downloadAndExtractZip.mockResolvedValue("/tmp/modern");

    await installOnUnix({ version: "131", arch: "linux64", chromeapp: "" });

    const move = findMove();
    expect(move.sudo).toBeNull();
    expect(move.source).toBe(
      path.join("/tmp/modern", "chromedriver-linux64", "chromedriver"),
    );
    expect(move.dest).toBe(INSTALL_PATH);
  });
});
