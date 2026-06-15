import * as core from "@actions/core";
import * as os from "os";
import { installOnUnix } from "./installer/unix.js";
import { installOnWindows } from "./installer/windows.js";

async function run() {
  try {
    console.log(`##setup chromedriver`);
    core.warning(
      "nanasess/setup-chromedriver@master is deprecated and no longer maintained. " +
        "Please switch to a release tag: uses: nanasess/setup-chromedriver@v3 " +
        "(or pin a full commit SHA). The master branch will not receive future updates.",
    );
    const version = core.getInput("chromedriver-version", { required: false });
    const chromeapp = core.getInput("chromeapp", { required: false });
    const plat = process.platform;
    let arch: string;
    switch (plat) {
      case "win32":
        arch = plat;
        break;
      case "darwin":
        // Check if running on ARM64 macOS (Apple Silicon)
        if (os.arch() === "arm64") {
          arch = "mac-arm64";
        } else {
          arch = "mac64";
        }
        break;
      default:
      case "linux":
        arch = "linux64";
    }
    if (arch == "win32") {
      await installOnWindows({ version, chromeapp });
    } else {
      await installOnUnix({ version, arch, chromeapp });
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
