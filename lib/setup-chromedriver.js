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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const axios_1 = __importDefault(require("axios"));
const tc = __importStar(require("@actions/tool-cache"));
const io = __importStar(require("@actions/io"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const exec = __importStar(require("@actions/exec"));
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log('##setup chromedriver');
            const versionInput = core.getInput('chromedriver-version', { required: false });
            const chromeapp = core.getInput('chromeapp', { required: false });
            const url = yield getDownloadUrl(versionInput, chromeapp);
            yield downloadAndInstall(url);
        }
        catch (error) {
            if (error instanceof Error)
                core.setFailed(error.message);
            else
                throw error;
        }
    });
}
function getDownloadUrl(versionInput, chromeapp) {
    return __awaiter(this, void 0, void 0, function* () {
        const plat = process.platform;
        let arch;
        switch (plat) {
            case 'win32':
                arch = 'win32';
                break;
            case 'darwin':
                arch = 'mac-x64';
                break;
            default: arch = 'linux64';
        }
        // determine Chrome version
        const chromeCmd = chromeapp || (plat === 'darwin'
            ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
            : plat === 'win32'
                ? 'chrome'
                : 'google-chrome-stable');
        const result = yield exec.getExecOutput(`${chromeCmd} --version`);
        const chromeVersion = result.stdout.trim().split(' ')[2];
        const chromeMajor = parseInt(chromeVersion.split('.')[0], 10);
        let driverVersion = versionInput;
        if (!driverVersion || chromeMajor >= 115) {
            const jsonUrl = 'https://googlechromelabs.github.io/chrome-for-testing/known-good-versions-with-downloads.json';
            const resp = yield axios_1.default.get(jsonUrl);
            const versions = resp.data.versions;
            if (!driverVersion) {
                const vinfo = versions.find((v) => v.version === chromeVersion)
                    || [...versions].reverse().find((v) => v.version.startsWith(`${chromeMajor}.`));
                if (!vinfo)
                    throw new Error(`No matching ChromeDriver version for Chrome ${chromeVersion}`);
                driverVersion = vinfo.version;
                const platInfo = vinfo.downloads.chromedriver.find((d) => d.platform === arch);
                if (!platInfo)
                    throw new Error(`No download for platform ${arch}`);
                return platInfo.url;
            }
            const vblock = versions.find((v) => v.version === driverVersion);
            if (!vblock)
                throw new Error(`ChromeDriver version ${driverVersion} not found`);
            const platInfo = vblock.downloads.chromedriver.find((d) => d.platform === arch);
            if (!platInfo)
                throw new Error(`No download for platform ${arch}`);
            return platInfo.url;
        }
        // for legacy <115
        const major = chromeMajor;
        if (!driverVersion) {
            const urlMaj = `https://chromedriver.storage.googleapis.com/LATEST_RELEASE_${major}`;
            driverVersion = (yield axios_1.default.get(urlMaj)).data;
        }
        return `https://chromedriver.storage.googleapis.com/${driverVersion}/chromedriver_${arch}.zip`;
    });
}
function downloadAndInstall(url) {
    return __awaiter(this, void 0, void 0, function* () {
        const plat = process.platform;
        console.log(`Downloading ${url}`);
        const downloadPath = yield tc.downloadTool(url);
        const extractDir = yield tc.extractZip(downloadPath);
        let binaryName = plat === 'win32' ? 'chromedriver.exe' : 'chromedriver';
        let binaryPath = path.join(extractDir, binaryName);
        if (!fs.existsSync(binaryPath)) {
            // handle nested folder
            const dirs = fs.readdirSync(extractDir);
            for (const d of dirs) {
                const p = path.join(extractDir, d, binaryName);
                if (fs.existsSync(p)) {
                    binaryPath = p;
                    break;
                }
            }
        }
        const dest = plat === 'win32'
            ? path.join(process.env.USERPROFILE || '', '.chromedriver', path.basename(binaryName))
            : '/usr/local/bin/chromedriver';
        yield io.mkdirP(path.dirname(dest));
        yield io.mv(binaryPath, dest);
        if (plat !== 'win32')
            yield fs.promises.chmod(dest, 0o755);
        console.log('Installed chromedriver to', dest);
    });
}
run();
