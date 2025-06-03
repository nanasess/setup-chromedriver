import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as tc from "@actions/tool-cache";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";

async function run() {
  try {
    console.log(`##setup chromedriver`);
    const version = core.getInput("chromedriver-version", { required: false });
    const chromeapp = core.getInput("chromeapp", { required: false });
    const plat = process.platform;
    let arch = "linux";
    switch (plat) {
      case "win32":
        arch = plat;
        break;
      case "darwin":
        arch = "mac64";
        break;
      default:
      case "linux":
        arch = "linux64";
    }

    const jsonUrl = "https://googlechromelabs.github.io/chrome-for-testing/known-good-versions-with-downloads.json";

    if (arch === "win32") {
      const chromeFullVersion = (await exec.getExecOutput(`powershell -Command "(Get-Item '${chromeapp}').VersionInfo.FileVersion"`)).stdout.trim();
      const chromeMajorVersion = chromeFullVersion.split(".")[0];

      if (parseInt(chromeMajorVersion) < 115) {
        const response = (await exec.getExecOutput(`powershell -Command "(Invoke-WebRequest 'http://chromedriver.storage.googleapis.com/LATEST_RELEASE_${chromeMajorVersion}').Content"`)).stdout.trim();
        const version = response;
        const url = `https://chromedriver.storage.googleapis.com/${version}/chromedriver_win32.zip`;
        const downloadPath = await tc.downloadTool(url);
        const extractPath = await tc.extractZip(downloadPath, "C:\\SeleniumWebDrivers\\ChromeDriver");
        fs.unlinkSync(downloadPath);
      } else {
        const response = (await exec.getExecOutput(`powershell -Command "(Invoke-WebRequest '${jsonUrl}').Content | ConvertFrom-Json"`)).stdout.trim();
        const json = JSON.parse(response);
        const url = json.versions.find((v: any) => v.version === version).downloads.chromedriver.find((d: any) => d.platform === arch).url;
        const downloadPath = await tc.downloadTool(url);
        const extractPath = await tc.extractZip(downloadPath, "C:\\SeleniumWebDrivers\\ChromeDriver");
        fs.unlinkSync(downloadPath);
      }
    } else {
      const chromeVersion = (await exec.getExecOutput(`${chromeapp} --version`)).stdout.trim();
      const chromeMajorVersion = chromeVersion.split(" ")[2].split(".")[0];

      if (parseInt(chromeMajorVersion) < 115) {
        const response = (await exec.getExecOutput(`curl --silent --location --fail --retry 10 "http://chromedriver.storage.googleapis.com/LATEST_RELEASE_${chromeMajorVersion}"`)).stdout.trim();
        const version = response;
        const url = `https://chromedriver.storage.googleapis.com/${version}/chromedriver_${arch}.zip`;
        const downloadPath = await tc.downloadTool(url);
        const extractPath = await tc.extractZip(downloadPath, "/usr/local/bin");
        fs.unlinkSync(downloadPath);
      } else {
        const response = (await exec.getExecOutput(`curl --silent --location --fail --retry 10 "${jsonUrl}"`)).stdout.trim();
        const json = JSON.parse(response);
        const url = json.versions.find((v: any) => v.version === version).downloads.chromedriver.find((d: any) => d.platform === arch).url;
        const downloadPath = await tc.downloadTool(url);
        const extractPath = await tc.extractZip(downloadPath, "/usr/local/bin");
        fs.unlinkSync(downloadPath);
      }
    }
  } catch (error: unknown) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      throw error;
    }
  }
}

run();
