import * as core from "@actions/core";
import * as os from "os";
import { mapArchitecture } from "./chromedriver-helper.js";
import { installOnUnix } from "./installer/unix.js";
import { installOnWindows } from "./installer/windows.js";
async function run() {
    try {
        console.log(`##setup chromedriver`);
        // The "@master is deprecated" warning (#463) lives only on the frozen
        // `master` branch, which `@master` consumers execute. It must not be added
        // here: releases are cut from `main`, so it would warn every `@v3` user.
        const version = core.getInput("chromedriver-version", { required: false });
        const chromeapp = core.getInput("chromeapp", { required: false });
        // win32 / mac-arm64 / mac64 / linux-arm64 / linux64. Windows always maps to
        // win32 here; on Windows on Arm the x64 (win64) ChromeDriver is installed
        // and runs under emulation, since Chrome for Testing ships no win-arm64
        // build.
        const arch = mapArchitecture(process.platform, os.arch());
        if (arch == "win32") {
            await installOnWindows({ version, chromeapp });
        }
        else {
            await installOnUnix({ version, arch, chromeapp });
        }
    }
    catch (error) {
        if (error instanceof Error) {
            core.setFailed(error.message);
        }
        else {
            throw error;
        }
    }
}
run();
