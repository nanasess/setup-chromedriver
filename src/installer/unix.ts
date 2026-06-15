/**
 * Linux / macOS installer for setup-chromedriver.
 *
 * This module implements the install flow originally provided by the
 * (now-removed) setup-chromedriver.sh reference script:
 *
 *   - apt dependency installation on linux64 (apt-key / google.list / apt-get)
 *     via `@actions/exec`.
 *   - Chrome major-version detection and the legacy (<115) vs modern (>=115)
 *     download / install split.
 *   - Installation to `/usr/local/bin/chromedriver` via `mv` (with `sudo` when
 *     available). We deliberately do NOT add `core.addPath` here, preserving
 *     the implicit PATH resolution via the well-known install directory.
 *
 * The pure parsing / URL / JSON logic lives in `../chromedriver-helper` and is
 * reused here rather than reimplemented. HTTP, download/extract and version
 * resolution live in the sibling installer modules.
 */

import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as io from "@actions/io";
import * as path from "path";

import {
  convertArchForLegacyAPI,
  convertArchForModernAPI,
  buildLegacyDownloadUrl,
  getDefaultChromePath,
  getInstallPath,
  parseMajorVersion,
  isLegacyVersion,
} from "../chromedriver-helper.js";
import { downloadAndExtractZip } from "./download.js";
import {
  detectFullChromeVersion,
  resolveLegacyVersion,
  resolveModernDownload,
} from "./version.js";

interface InstallOnUnixOptions {
  version: string;
  arch: string;
  chromeapp: string;
}

/**
 * Resolve the `sudo` executable path, mirroring `sudo=$(command -v sudo)`.
 *
 * Returns the absolute path to `sudo` or an empty string when not present.
 */
async function resolveSudo(): Promise<string> {
  // `which("sudo", false)` returns "" when not found instead of throwing,
  // matching `command -v sudo` producing an empty string.
  return io.which("sudo", false);
}

/**
 * Run `mv <source> <dest>`, prefixing with `sudo` when available.
 *
 * Mirrors `${sudo} mv ... /usr/local/bin/chromedriver`. We use `@actions/exec`
 * rather than `@actions/io.mv` because `io.mv` cannot run under `sudo`.
 */
async function sudoMove(
  sudo: string,
  source: string,
  dest: string,
): Promise<void> {
  if (sudo) {
    await exec.exec(sudo, ["mv", source, dest]);
  } else {
    await exec.exec("mv", [source, dest]);
  }
}

/**
 * Check whether a command exists on PATH, mirroring `type -a <cmd>` /
 * `command -v <cmd>`. Returns true when found.
 */
async function commandExists(command: string): Promise<boolean> {
  const found = await io.which(command, false);
  return found !== "";
}

/**
 * Install the apt dependencies required for the linux64 arch: the Chrome
 * package itself (via the Google apt repository) plus `unzip` and, when
 * missing, `sudo`.
 *
 * Resolves to `void`. The `chromeapp` default (`google-chrome-stable`) is
 * applied by the caller (`installOnUnix`) so that it propagates to version
 * detection as well; this helper only consumes the resolved value.
 */
async function installLinuxDependencies(
  sudo: string,
  chromeapp: string,
): Promise<void> {
  // `if [[ -z "${CHROMEAPP}" ]]; then CHROMEAPP=google-chrome-stable; fi`
  const chromeApp = chromeapp || "google-chrome-stable";
  // `APP="${CHROMEAPP}"`
  let app = chromeApp;

  // `if command -v dpkg &>/dev/null; then`
  if (!(await commandExists("dpkg"))) {
    return;
  }

  // `if ! dpkg -s "${APP}" >/dev/null; then`
  // dpkg -s exits non-zero when the package is not installed.
  const dpkgStatus = await exec.exec("dpkg", ["-s", app], {
    ignoreReturnCode: true,
    silent: true,
  });
  if (dpkgStatus !== 0) {
    // `${sudo} apt-key adv --keyserver keyserver.ubuntu.com --recv-keys 4EB27DB2A3B88B8B`
    await runWithSudo(sudo, "apt-key", [
      "adv",
      "--keyserver",
      "keyserver.ubuntu.com",
      "--recv-keys",
      "4EB27DB2A3B88B8B",
    ]);
    // `echo "deb [arch=amd64] ..." | ${sudo} tee /etc/apt/sources.list.d/google.list >/dev/null`
    // Reproduce the piped `tee` without invoking a shell: feed the repo line to
    // tee's stdin via @actions/exec's `input` option, and run tee under sudo
    // when available. Avoiding `sh -c` removes any shell string interpolation.
    const teeArgs = ["/etc/apt/sources.list.d/google.list"];
    await runWithSudo(sudo, "tee", teeArgs, {
      input: Buffer.from(
        "deb [arch=amd64] https://dl.google.com/linux/chrome/deb/ stable main\n",
      ),
      // Mirror the original `>/dev/null` (suppress tee echoing stdin to stdout).
      silent: true,
    });
    // `APP=google-chrome-stable`
    app = "google-chrome-stable";
  }

  // Build the list of apt packages to install when missing.
  //
  // The original shell script also installed `curl` and `jq` for its
  // `curl | jq` Chrome-for-Testing JSON pipeline. The TypeScript runtime
  // fetches and parses that JSON natively (typed-rest-client in http.ts), so
  // neither binary is needed and we no longer install them. `unzip` is still
  // required because @actions/tool-cache shells out to it when extracting the
  // downloaded archive.
  const apps: string[] = [];
  // Install sudo when it is not already present (needed by the runWithSudo
  // calls above, which fall back to running unprivileged when sudo is absent).
  if (!sudo) {
    apps.push("sudo");
  }
  // Install the Chrome package when the browser binary is not on PATH.
  if (!(await commandExists(chromeApp))) {
    apps.push(app);
  }
  // Install unzip when missing (used by tool-cache's archive extraction).
  if (!(await commandExists("unzip"))) {
    apps.push("unzip");
  }

  // `if (("${#apps[@]}")); then`
  if (apps.length > 0) {
    core.info(`Installing ${apps.join(" ")}...`);
    // `export DEBIAN_FRONTEND=noninteractive`
    const env = { ...process.env, DEBIAN_FRONTEND: "noninteractive" };
    // `${sudo} apt-get update`
    await runWithSudo(sudo, "apt-get", ["update"], { env });
    // `${sudo} apt-get install -y --no-install-recommends "${apps[@]}"`
    await runWithSudo(
      sudo,
      "apt-get",
      ["install", "-y", "--no-install-recommends", ...apps],
      { env },
    );
  }
}

/**
 * Run a command, prefixing with `sudo` when available, mirroring `${sudo} cmd`.
 */
async function runWithSudo(
  sudo: string,
  command: string,
  args: string[],
  options?: exec.ExecOptions,
): Promise<void> {
  if (sudo) {
    await exec.exec(sudo, [command, ...args], options);
  } else {
    await exec.exec(command, args, options);
  }
}

/**
 * Install ChromeDriver on Linux / macOS.
 */
export async function installOnUnix(opts: InstallOnUnixOptions): Promise<void> {
  const platform = process.platform;
  let { version, arch, chromeapp } = opts;

  // `sudo=$(command -v sudo)`
  const sudo = await resolveSudo();

  // `if [[ "${ARCH}" =~ ^linux64 ]]; then` ... apt dependency installation.
  if (arch.startsWith("linux64")) {
    // `if [[ -z "${CHROMEAPP}" ]]; then CHROMEAPP=google-chrome-stable; fi`
    // The shell assigns this default to CHROMEAPP at the top of the linux64
    // block, and it persists for the rest of the script (version detection and
    // the final `command -v` check). Apply it in this scope so it propagates,
    // not just inside the dependency-install helper.
    if (!chromeapp) {
      chromeapp = "google-chrome-stable";
    }
    await installLinuxDependencies(sudo, chromeapp);
  }

  // `if [[ "${ARCH}" =~ ^mac && -z "${CHROMEAPP}" ]]; then CHROMEAPP=...; fi`
  if (arch.startsWith("mac") && !chromeapp) {
    chromeapp = getDefaultChromePath("darwin");
  }

  // CHROME_VERSION (major): from VERSION when provided, else from the app.
  // When detected from the app, cache the full version string so the modern
  // (>=115) path below can reuse it instead of probing `--version` again.
  let majorVersion: number;
  let detectedFullVersion: string | undefined;
  if (version) {
    majorVersion = parseMajorVersion(version);
  } else {
    detectedFullVersion = await detectFullChromeVersion(platform, chromeapp);
    majorVersion = parseMajorVersion(detectedFullVersion);
  }
  core.info(`CHROME_VERSION=${majorVersion}`);

  const installPath = getInstallPath(platform);

  // -------------------------------------------------------------------------
  // Legacy (<115)
  // -------------------------------------------------------------------------
  if (isLegacyVersion(majorVersion)) {
    // `if [[ -z "${VERSION}" ]]; then VERSION=$(curl .../LATEST_RELEASE_$major); fi`
    if (!version) {
      version = await resolveLegacyVersion(majorVersion);
      core.info(`VERSION=${version}`);
    }
    // `if [[ "${ARCH}" == "mac-arm64" ]]; then ARCH="mac64"; fi`
    const legacyArch = convertArchForLegacyAPI(arch);
    core.info(`Installing ChromeDriver ${version} for ${legacyArch}`);
    const url = buildLegacyDownloadUrl(version, legacyArch);
    core.info(`Downloading ${url}...`);
    // Download + unzip. Legacy zip has the `chromedriver` binary at the root.
    const extractedDir = await downloadAndExtractZip(url);
    const source = path.join(extractedDir, "chromedriver");
    // `${sudo} mv chromedriver /usr/local/bin/chromedriver`
    await sudoMove(sudo, source, installPath);
    // `exit` -- legacy path terminates without printing versions.
    return;
  }

  // -------------------------------------------------------------------------
  // Modern (>=115)
  // -------------------------------------------------------------------------
  // When no version was requested, reuse the full version detected above for
  // the major-version check rather than probing `<chromeapp> --version` again.
  if (!version) {
    version =
      detectedFullVersion ??
      (await detectFullChromeVersion(platform, chromeapp));
    core.info(`VERSION=${version}`);
  }
  // `if [[ "${ARCH}" == "mac64" ]]; then ARCH="mac-x64"; fi`
  const modernArch = convertArchForModernAPI(arch);

  // Fetch JSON, extract URL, with version3 fallback (handled in version.ts).
  const resolved = await resolveModernDownload(version, modernArch);
  version = resolved.version;
  const url = resolved.url;

  core.info(`Installing ChromeDriver ${version} for ${modernArch}`);
  core.info(`Downloading ${url}...`);
  // Download + unzip. Modern Unix zip nests the binary under
  // `chromedriver-${arch}/chromedriver`.
  const extractedDir = await downloadAndExtractZip(url);
  core.info("Installing chromedriver to /usr/local/bin");
  const source = path.join(
    extractedDir,
    `chromedriver-${modernArch}`,
    "chromedriver",
  );
  // `${sudo} mv "chromedriver-${ARCH}/chromedriver" /usr/local/bin/chromedriver`
  await sudoMove(sudo, source, installPath);

  // `if command -v "${CHROMEAPP}" >/dev/null; then echo Chrome version:; "${CHROMEAPP}" --version; fi`
  if (await commandExists(chromeapp)) {
    core.info("Chrome version:");
    // Quote the path: @actions/exec splits the command line on spaces (see
    // version.ts), so a chromeapp path containing spaces must be quoted.
    await exec.exec(`"${chromeapp}"`, ["--version"]);
  }
  // `echo Chromedriver version:; /usr/local/bin/chromedriver --version`
  core.info("Chromedriver version:");
  await exec.exec(installPath, ["--version"]);
}
