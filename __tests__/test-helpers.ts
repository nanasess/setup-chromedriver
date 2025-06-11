import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock Chrome for Testing API response
export const mockChromeForTestingAPI = {
  versions: [
    {
      version: '114.0.5735.90',
      downloads: {
        chromedriver: [
          {
            platform: 'linux64',
            url: 'https://chromedriver.storage.googleapis.com/114.0.5735.90/chromedriver-linux64.zip'
          },
          {
            platform: 'mac-x64',
            url: 'https://chromedriver.storage.googleapis.com/114.0.5735.90/chromedriver-mac-x64.zip'
          },
          {
            platform: 'win32',
            url: 'https://chromedriver.storage.googleapis.com/114.0.5735.90/chromedriver-win32.zip'
          }
        ]
      }
    },
    {
      version: '115.0.5790.170',
      downloads: {
        chromedriver: [
          {
            platform: 'linux64',
            url: 'https://edgedl.me.gvt1.com/edgedl/chrome/chrome-for-testing/115.0.5790.170/linux64/chromedriver-linux64.zip'
          },
          {
            platform: 'mac-x64',
            url: 'https://edgedl.me.gvt1.com/edgedl/chrome/chrome-for-testing/115.0.5790.170/mac-x64/chromedriver-mac-x64.zip'
          },
          {
            platform: 'win32',
            url: 'https://edgedl.me.gvt1.com/edgedl/chrome/chrome-for-testing/115.0.5790.170/win32/chromedriver-win32.zip'
          }
        ]
      }
    },
    {
      version: '116.0.5845.96',
      downloads: {
        chromedriver: [
          {
            platform: 'linux64',
            url: 'https://edgedl.me.gvt1.com/edgedl/chrome/chrome-for-testing/116.0.5845.96/linux64/chromedriver-linux64.zip'
          },
          {
            platform: 'mac-x64',
            url: 'https://edgedl.me.gvt1.com/edgedl/chrome/chrome-for-testing/116.0.5845.96/mac-x64/chromedriver-mac-x64.zip'
          },
          {
            platform: 'win32',
            url: 'https://edgedl.me.gvt1.com/edgedl/chrome/chrome-for-testing/116.0.5845.96/win32/chromedriver-win32.zip'
          }
        ]
      }
    }
  ]
};

// Mock Chrome version outputs
export const mockChromeVersionOutputs = {
  linux: 'Google Chrome 115.0.5790.170',
  mac: 'Google Chrome 115.0.5790.170',
  windows: '115.0.5790.170' // Windows file version format
};

// Mock HTTP responses
export class MockHTTPClient {
  static responses: Map<string, any> = new Map();

  static setResponse(url: string, response: any): void {
    this.responses.set(url, response);
  }

  static getResponse(url: string): any {
    return this.responses.get(url);
  }

  static mockChromeForTestingAPI(): void {
    const apiURL = 'https://googlechromelabs.github.io/chrome-for-testing/known-good-versions-with-downloads.json';
    this.setResponse(apiURL, mockChromeForTestingAPI);
  }

  static mockLegacyAPI(version: string, chromeDriverVersion: string): void {
    const legacyURL = `http://chromedriver.storage.googleapis.com/LATEST_RELEASE_${version}`;
    this.setResponse(legacyURL, chromeDriverVersion);
  }

  static clear(): void {
    this.responses.clear();
  }
}

// Mock file system operations
export class MockFileSystem {
  static files: Map<string, Buffer | string> = new Map();
  static directories: Set<string> = new Set();

  static createFile(filePath: string, content: Buffer | string): void {
    this.files.set(filePath, content);
    
    // Ensure parent directories exist
    const parentDir = path.dirname(filePath);
    this.directories.add(parentDir);
  }

  static createDirectory(dirPath: string): void {
    this.directories.add(dirPath);
  }

  static fileExists(filePath: string): boolean {
    return this.files.has(filePath);
  }

  static directoryExists(dirPath: string): boolean {
    return this.directories.has(dirPath);
  }

  static readFile(filePath: string): Buffer | string | undefined {
    return this.files.get(filePath);
  }

  static clear(): void {
    this.files.clear();
    this.directories.clear();
  }

  static setupMockChrome(platform: string): void {
    const chromePaths = {
      linux: '/usr/bin/google-chrome-stable',
      darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      win32: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
    };

    const chromePath = chromePaths[platform as keyof typeof chromePaths];
    if (chromePath) {
      this.createFile(chromePath, 'mock-chrome-executable');
    }
  }
}

// Mock command execution
export class MockExec {
  static commands: Map<string, { exitCode: number; stdout: string; stderr: string }> = new Map();

  static setCommandResult(command: string, result: { exitCode: number; stdout: string; stderr: string }): void {
    this.commands.set(command, result);
  }

  static getCommandResult(command: string): { exitCode: number; stdout: string; stderr: string } | undefined {
    return this.commands.get(command);
  }

  static mockChromeVersionCommand(platform: string, version: string): void {
    const commands = {
      linux: 'google-chrome-stable --version',
      darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome --version',
      win32: 'Get-Item "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" | Select-Object -ExpandProperty VersionInfo'
    };

    const command = commands[platform as keyof typeof commands];
    if (command) {
      this.setCommandResult(command, {
        exitCode: 0,
        stdout: platform === 'win32' ? version : `Google Chrome ${version}`,
        stderr: ''
      });
    }
  }

  static clear(): void {
    this.commands.clear();
  }
}

// Test utilities
export class TestUtils {
  static createTempDir(): string {
    const tempDir = path.join(os.tmpdir(), `chromedriver-test-${Date.now()}`);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    return tempDir;
  }

  static cleanupTempDir(tempDir: string): void {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  static createMockZipFile(filePath: string): void {
    // Create a mock zip file (just an empty file for testing)
    fs.writeFileSync(filePath, Buffer.from('mock-zip-content'));
  }

  static async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Integration test scenarios
export const integrationTestScenarios = [
  {
    name: 'Linux Chrome 114 Legacy API',
    platform: 'linux',
    chromeVersion: '114.0.5735.90',
    expectedAPI: 'legacy',
    expectedArchitecture: 'linux64',
    expectedInstallPath: '/usr/local/bin/chromedriver'
  },
  {
    name: 'Linux Chrome 115 Modern API',
    platform: 'linux',
    chromeVersion: '115.0.5790.170',
    expectedAPI: 'modern',
    expectedArchitecture: 'linux64',
    expectedInstallPath: '/usr/local/bin/chromedriver'
  },
  {
    name: 'macOS Chrome 115 Modern API',
    platform: 'darwin',
    chromeVersion: '115.0.5790.170',
    expectedAPI: 'modern',
    expectedArchitecture: 'mac-x64',
    expectedInstallPath: '/usr/local/bin/chromedriver'
  },
  {
    name: 'Windows Chrome 115 Modern API',
    platform: 'win32',
    chromeVersion: '115.0.5790.170',
    expectedAPI: 'modern',
    expectedArchitecture: 'win32',
    expectedInstallPath: 'C:\\SeleniumWebDrivers\\ChromeDriver'
  }
];

// Test data validation
export class TestDataValidator {
  static validateChromeVersion(version: string): boolean {
    const versionRegex = /^\d+\.\d+\.\d+\.\d+$/;
    return versionRegex.test(version);
  }

  static validateURL(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  static validatePlatform(platform: string): boolean {
    return ['linux', 'darwin', 'win32'].includes(platform);
  }

  static validateArchitecture(arch: string): boolean {
    return ['linux64', 'mac-x64', 'win32'].includes(arch);
  }
};