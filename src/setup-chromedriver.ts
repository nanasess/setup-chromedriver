import * as core from "@actions/core";
import * as exec from "@actions/exec";
import * as path from "path";

async function run() {
  try {
    console.log(`##setup chromedriver`);
    const version = core.getInput("chromedriver-version", { required: false });
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
    if (arch == "win32") {
      await exec.exec(
        "powershell -File " +
          path.join(__dirname, "../lib", "setup-chromedriver.ps1 " + version)
      );
    } else {
      await exec.exec(path.join(__dirname, "../lib", "setup-chromedriver.sh"), [
        version,
        arch,
      ]);
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
