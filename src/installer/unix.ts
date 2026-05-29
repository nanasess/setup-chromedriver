/**
 * Linux / macOS installer for the TypeScript rewrite of setup-chromedriver.
 *
 * This module reproduces the behavior of `lib/setup-chromedriver.sh` 1:1:
 *
 *   - apt dependency installation on linux64 (apt-key / google.list / apt-get),
 *     reproduced via `@actions/exec` so that runner behavior is unchanged.
 *   - Chrome major-version detection and the legacy (<115) vs modern (>=115)
 *     download / install split.
 *   - Installation to `/usr/local/bin/chromedriver` via `mv` (with `sudo` when
 *     available), preserving the implicit PATH resolution of the original
 *     script. We do NOT add `core.addPath` here, matching the shell script.
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
} from "../chromedriver-helper";
import { downloadAndExtractZip } from "./download";
import {
  detectFullChromeVersion,
  resolveLegacyVersion,
  resolveModernDownload,
} from "./version";

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
 * Reproduce the apt dependency installation block of setup-chromedriver.sh for
 * the linux64 arch.
 *
 * Returns the (possibly rewritten) chromeapp value, mirroring the shell's
 * reassignment of `APP=google-chrome-stable` when the package is missing.
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
    // Reproduce the piped `tee` (run under sudo when available) via `sh -c`.
    const teeCommand = sudo ? `${sudo} tee` : "tee";
    await exec.exec("sh", [
      "-c",
      `echo "deb [arch=amd64] https://dl.google.com/linux/chrome/deb/ stable main" | ${teeCommand} /etc/apt/sources.list.d/google.list >/dev/null`,
    ]);
    // `APP=google-chrome-stable`
    app = "google-chrome-stable";
  }

  // Build the `apps=()` array exactly as the shell script does.
  const apps: string[] = [];
  // `test -z "${sudo}" && apps+=(sudo)`
  if (!sudo) {
    apps.push("sudo");
  }
  // `type -a curl > /dev/null 2>&1 || apps+=(curl)`
  if (!(await commandExists("curl"))) {
    apps.push("curl");
  }
  // `type -a "${CHROMEAPP}" > /dev/null 2>&1 || apps+=("${APP}")`
  if (!(await commandExists(chromeApp))) {
    apps.push(app);
  }
  // `type -a jq > /dev/null 2>&1 || apps+=(jq)`
  if (!(await commandExists("jq"))) {
    apps.push("jq");
  }
  // `type -a unzip > /dev/null 2>&1 || apps+=(unzip)`
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
 * Install ChromeDriver on Linux / macOS, reproducing setup-chromedriver.sh.
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
  let majorVersion: number;
  if (version) {
    // `cut -d '.' -f 1 <<<"${VERSION}"`
    majorVersion = parseMajorVersion(version);
  } else {
    // `"${CHROMEAPP}" --version | cut -d ' ' -f 3 | cut -d '.' -f 1`
    const fullVersion = await detectFullChromeVersion(platform, chromeapp);
    majorVersion = parseMajorVersion(fullVersion);
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
  // `if [[ -z "${VERSION}" ]]; then VERSION=$("${CHROMEAPP}" --version | cut -d ' ' -f 3); fi`
  if (!version) {
    version = await detectFullChromeVersion(platform, chromeapp);
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
