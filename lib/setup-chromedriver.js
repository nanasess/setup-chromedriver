"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const exec = __importStar(require("@actions/exec"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
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
                // Check if running on ARM64 macOS (Apple Silicon)
                if (os.arch() === "arm64") {
                    arch = "mac-arm64";
                }
                else {
                    arch = "mac64";
                }
                break;
            default:
            case "linux":
                arch = "linux64";
        }
        if (arch == "win32") {
            await exec.exec("powershell -File " + path.join(__dirname, "../lib", "setup-chromedriver.ps1 "), [
                version,
                chromeapp
            ]);
        }
        else {
            await exec.exec(path.join(__dirname, "../lib", "setup-chromedriver.sh"), [
                version,
                arch,
                chromeapp,
            ]);
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
