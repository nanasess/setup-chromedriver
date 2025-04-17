import * as core from '@actions/core';
import axios from 'axios';
import * as tc from '@actions/tool-cache';
import * as io from '@actions/io';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as exec from '@actions/exec';

/**
 * Entry point: orchestrates retrieval of download URL and installation of ChromeDriver.
 */
async function run() {
  try {
    console.log('##setup chromedriver');
    const versionInput = core.getInput('chromedriver-version', { required: false });
    // prefer action input, fallback to CHROMEAPP environment variable for workflow overrides
    const chromeAppInput = core.getInput('chromeapp', { required: false });
    const chromeapp = chromeAppInput || process.env.CHROMEAPP;
    const url = await getDownloadUrl(versionInput, chromeapp);
    await downloadAndInstall(url);
  } catch (error: unknown) {
    if (error instanceof Error) core.setFailed(error.message);
    else throw error;
  }
}

/**
 * Determines the appropriate ChromeDriver download URL based on the installed
 * Chrome version or user-provided version. Handles both legacy (<115) and
 * modern ChromeDriver JSON API endpoints.
 */
async function getDownloadUrl(versionInput: string | undefined, chromeapp: string | undefined): Promise<string> {
  const plat = process.platform;
  let arch: string;
  switch (plat) {
    case 'win32': arch = 'win32'; break;
    case 'darwin': arch = 'mac-x64'; break;
    default: arch = 'linux64';
  }

  // determine the Chrome executable path, preferring input or env var, fallback to common defaults
  let chromeCmd = chromeapp;
  if (!chromeCmd) {
    if (plat === 'darwin') {
      chromeCmd = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    } else if (plat === 'win32') {
      // check PROGRAMFILES(x86) and PROGRAMFILES for installed Chrome
      const pf86 = process.env['PROGRAMFILES(X86)'] || process.env['ProgramFiles(x86)'];
      const pf = process.env['PROGRAMFILES'] || process.env['ProgramFiles'];
      const p86Path = pf86 ? path.join(pf86, 'Google', 'Chrome', 'Application', 'chrome.exe') : '';
      const pPath = pf ? path.join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe') : '';
      if (p86Path && fs.existsSync(p86Path)) chromeCmd = p86Path;
      else if (pPath && fs.existsSync(pPath)) chromeCmd = pPath;
      else chromeCmd = 'chrome';
    } else {
      chromeCmd = 'google-chrome-stable';
    }
  }

  // determine Chrome version via platform-specific invocation to handle spaces in path
  let result;
  if (plat === 'win32') {
    // use cmd.exe with verbatim args on Windows
    result = await exec.getExecOutput('cmd', ['/C', chromeCmd, '--version'], { windowsVerbatimArguments: true });
  } else {
    // use POSIX shell on macOS/Linux to invoke path containing spaces
    const cmdStr = `"${chromeCmd}" --version`;
    result = await exec.getExecOutput('/bin/sh', ['-c', cmdStr]);
  }
  const chromeVersion = result.stdout.trim().split(' ')[2];
  const chromeMajor = parseInt(chromeVersion.split('.')[0], 10);

  let driverVersion = versionInput;
  if (!driverVersion || chromeMajor >= 115) {
    const jsonUrl = 'https://googlechromelabs.github.io/chrome-for-testing/known-good-versions-with-downloads.json';
    const resp = await axios.get(jsonUrl);
    const versions = resp.data.versions;
    if (!driverVersion) {
      const vinfo = versions.find((v: any) => v.version === chromeVersion)
        || [...versions].reverse().find((v: any) => v.version.startsWith(`${chromeMajor}.`));
      if (!vinfo) throw new Error(`No matching ChromeDriver version for Chrome ${chromeVersion}`);
      driverVersion = vinfo.version;
      const platInfo = vinfo.downloads.chromedriver.find((d: any) => d.platform === arch);
      if (!platInfo) throw new Error(`No download for platform ${arch}`);
      return platInfo.url;
    }
    const vblock = versions.find((v: any) => v.version === driverVersion);
    if (!vblock) throw new Error(`ChromeDriver version ${driverVersion} not found`);
    const platInfo = vblock.downloads.chromedriver.find((d: any) => d.platform === arch);
    if (!platInfo) throw new Error(`No download for platform ${arch}`);
    return platInfo.url;
  }

  // for legacy <115
  const major = chromeMajor;
  if (!driverVersion) {
    const urlMaj = `https://chromedriver.storage.googleapis.com/LATEST_RELEASE_${major}`;
    driverVersion = (await axios.get(urlMaj)).data;
  }
  return `https://chromedriver.storage.googleapis.com/${driverVersion}/chromedriver_${arch}.zip`;
}

/**
 * Downloads ChromeDriver from the specified URL, extracts the archive, locates
 * the binary, and installs it to the target destination with correct permissions.
 */
async function downloadAndInstall(url: string): Promise<void> {
  const plat = process.platform;
  console.log(`Downloading ${url}`);
  const downloadPath = await tc.downloadTool(url);
  const extractDir = await tc.extractZip(downloadPath);
  let binaryName = plat === 'win32' ? 'chromedriver.exe' : 'chromedriver';
  let binaryPath = path.join(extractDir, binaryName);
  if (!fs.existsSync(binaryPath)) {
    // handle nested folder
    const dirs = fs.readdirSync(extractDir);
    for (const d of dirs) {
      const p = path.join(extractDir, d, binaryName);
      if (fs.existsSync(p)) { binaryPath = p; break; }
    }
  }
  const dest = plat === 'win32'
    ? path.join(process.env.USERPROFILE || '', '.chromedriver', path.basename(binaryName))
    : '/usr/local/bin/chromedriver';
  await io.mkdirP(path.dirname(dest));
  await io.mv(binaryPath, dest);
  if (plat !== 'win32') await fs.promises.chmod(dest, 0o755);
  console.log('Installed chromedriver to', dest);
}

run();
