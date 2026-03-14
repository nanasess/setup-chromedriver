/**
 * Equivalence tests: run shell-logic.sh and compare its output
 * against the TypeScript helper functions to verify 1:1 correspondence.
 *
 * Requires: bash, jq (available on GitHub Actions runners)
 */

import { execSync } from "child_process";
import * as path from "path";
import {
  parseMajorVersion,
  parseVersion3,
  isLegacyVersion,
  convertArchForLegacyAPI,
  convertArchForModernAPI,
  buildLegacyLatestReleaseUrl,
  buildLegacyDownloadUrl,
  getDefaultChromePath,
  getInstallPath,
  extractDriverUrlFromJson,
  findFallbackVersion,
} from "../src/chromedriver-helper";

// ---------------------------------------------------------------------------
// Run shell script and parse output
// ---------------------------------------------------------------------------

function runShellLogic(): string {
  const scriptPath = path.join(__dirname, "shell-logic.sh");
  return execSync(`bash "${scriptPath}"`, { encoding: "utf-8" });
}

function parseSection(output: string, sectionName: string): string[] {
  const lines = output.split("\n");
  const start = lines.indexOf(`=== ${sectionName} ===`);
  if (start === -1) throw new Error(`Section not found: ${sectionName}`);
  const result: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].startsWith("===") || lines[i] === "") break;
    result.push(lines[i]);
  }
  return result;
}

function parseKeyValue(line: string): Record<string, string> {
  const result: Record<string, string> = {};
  // Match KEY=VALUE pairs (VALUE may contain spaces, paths, URLs)
  const regex = /(\w+)=((?:(?!\s\w+=).)*)/g;
  let match;
  while ((match = regex.exec(line)) !== null) {
    result[match[1]] = match[2].trim();
  }
  return result;
}

// ---------------------------------------------------------------------------
// Shared JSON fixture (same as in shell-logic.sh)
// ---------------------------------------------------------------------------

const TEST_JSON = {
  versions: [
    {
      version: "131.0.6778.204",
      downloads: {
        chromedriver: [
          {
            platform: "linux64",
            url: "https://example.com/chromedriver-linux64.zip",
          },
          {
            platform: "mac-x64",
            url: "https://example.com/chromedriver-mac-x64.zip",
          },
        ],
      },
    },
    {
      version: "131.0.6778.264",
      downloads: {
        chromedriver: [
          {
            platform: "linux64",
            url: "https://example.com/chromedriver-linux64-264.zip",
          },
        ],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

let shellOutput: string;

beforeAll(() => {
  shellOutput = runShellLogic();
});

describe("Shell ↔ TypeScript equivalence", () => {
  describe("VERSION_PARSING", () => {
    it("parseMajorVersion and parseVersion3 match shell cut commands", () => {
      const lines = parseSection(shellOutput, "VERSION_PARSING");
      for (const line of lines) {
        const kv = parseKeyValue(line);
        const input = kv["INPUT"];
        const expectedMajor = parseInt(kv["MAJOR"], 10);
        const expectedVersion3 = kv["VERSION3"];

        expect(parseMajorVersion(input)).toBe(expectedMajor);
        expect(parseVersion3(input)).toBe(expectedVersion3);
      }
    });
  });

  describe("LEGACY_CHECK", () => {
    it("isLegacyVersion matches shell comparison", () => {
      const lines = parseSection(shellOutput, "LEGACY_CHECK");
      for (const line of lines) {
        const kv = parseKeyValue(line);
        const major = parseInt(kv["MAJOR"], 10);
        const expected = kv["LEGACY"] === "true";

        expect(isLegacyVersion(major)).toBe(expected);
      }
    });
  });

  describe("LEGACY_ARCH_CONVERT", () => {
    it("convertArchForLegacyAPI matches shell conversion", () => {
      const lines = parseSection(shellOutput, "LEGACY_ARCH_CONVERT");
      for (const line of lines) {
        const kv = parseKeyValue(line);
        expect(convertArchForLegacyAPI(kv["INPUT"])).toBe(kv["OUTPUT"]);
      }
    });
  });

  describe("MODERN_ARCH_CONVERT", () => {
    it("convertArchForModernAPI matches shell conversion", () => {
      const lines = parseSection(shellOutput, "MODERN_ARCH_CONVERT");
      for (const line of lines) {
        const kv = parseKeyValue(line);
        expect(convertArchForModernAPI(kv["INPUT"])).toBe(kv["OUTPUT"]);
      }
    });
  });

  describe("LEGACY_LATEST_RELEASE_URL", () => {
    it("buildLegacyLatestReleaseUrl matches shell URL construction", () => {
      const lines = parseSection(shellOutput, "LEGACY_LATEST_RELEASE_URL");
      for (const line of lines) {
        const kv = parseKeyValue(line);
        const major = parseInt(kv["MAJOR"], 10);
        expect(buildLegacyLatestReleaseUrl(major)).toBe(kv["URL"]);
      }
    });
  });

  describe("LEGACY_DOWNLOAD_URL", () => {
    it("buildLegacyDownloadUrl matches shell URL construction", () => {
      const lines = parseSection(shellOutput, "LEGACY_DOWNLOAD_URL");
      for (const line of lines) {
        const kv = parseKeyValue(line);
        expect(buildLegacyDownloadUrl(kv["VERSION"], kv["ARCH"])).toBe(
          kv["URL"]
        );
      }
    });
  });

  describe("DEFAULT_CHROME_PATH", () => {
    it("getDefaultChromePath matches shell defaults", () => {
      const lines = parseSection(shellOutput, "DEFAULT_CHROME_PATH");
      for (const line of lines) {
        const kv = parseKeyValue(line);
        expect(
          getDefaultChromePath(kv["PLATFORM"] as NodeJS.Platform)
        ).toBe(kv["PATH"]);
      }
    });
  });

  describe("DEFAULT_INSTALL_PATH", () => {
    it("getInstallPath matches shell defaults", () => {
      const lines = parseSection(shellOutput, "DEFAULT_INSTALL_PATH");
      for (const line of lines) {
        const kv = parseKeyValue(line);
        expect(getInstallPath(kv["PLATFORM"] as NodeJS.Platform)).toBe(
          kv["PATH"]
        );
      }
    });
  });

  describe("JQ_EXTRACT", () => {
    it("extractDriverUrlFromJson matches jq extraction", () => {
      const lines = parseSection(shellOutput, "JQ_EXTRACT");
      for (const line of lines) {
        const kv = parseKeyValue(line);
        const result = extractDriverUrlFromJson(
          TEST_JSON,
          kv["VERSION"],
          kv["PLATFORM"]
        );
        const expected = kv["URL"] === "null" ? null : kv["URL"];
        expect(result).toBe(expected);
      }
    });
  });

  describe("JQ_FALLBACK", () => {
    it("findFallbackVersion matches jq fallback logic", () => {
      const lines = parseSection(shellOutput, "JQ_FALLBACK");
      for (const line of lines) {
        const kv = parseKeyValue(line);
        const result = findFallbackVersion(TEST_JSON, kv["PREFIX"]);
        const expected = kv["FALLBACK"] === "null" ? null : kv["FALLBACK"];
        expect(result).toBe(expected);
      }
    });
  });
});
