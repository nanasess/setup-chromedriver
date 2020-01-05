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
    await exec.exec(path.join(__dirname, "setup-chromedriver.sh"), [
      version,
      arch
    ]);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
