/**
 * API integration tests for Chrome for Testing endpoints.
 * These tests hit real network endpoints and should be run in CI.
 *
 * Run with: yarn test __tests__/chromedriver-api.test.ts
 */

import {
  buildLegacyLatestReleaseUrl,
  extractDriverUrlFromJson,
  ChromeKnownGoodVersions,
  ChromeVersion,
} from "../src/chromedriver-helper";

const JSON_URL =
  "https://googlechromelabs.github.io/chrome-for-testing/known-good-versions-with-downloads.json";

// Increase timeout for network requests
jest.setTimeout(30000);

describe("Chrome for Testing JSON API", () => {
  let json: ChromeKnownGoodVersions;

  beforeAll(async () => {
    const response = await fetch(JSON_URL);
    expect(response.ok).toBe(true);
    json = (await response.json()) as ChromeKnownGoodVersions;
  });

  it("returns a response with versions array", () => {
    expect(json).toHaveProperty("versions");
    expect(Array.isArray(json.versions)).toBe(true);
    expect(json.versions.length).toBeGreaterThan(0);
  });

  it("each version entry has expected structure", () => {
    const entry = json.versions[0];
    expect(entry).toHaveProperty("version");
    expect(typeof entry.version).toBe("string");
    expect(entry).toHaveProperty("downloads");
  });

  it("can extract a chromedriver URL from a recent version", () => {
    // Find a version that has chromedriver downloads
    const withDriver = json.versions.find(
      (v: ChromeVersion) => v.downloads.chromedriver && v.downloads.chromedriver.length > 0
    );
    expect(withDriver).toBeDefined();

    const url = extractDriverUrlFromJson(
      json,
      withDriver!.version,
      withDriver!.downloads.chromedriver![0].platform
    );
    expect(url).not.toBeNull();
    expect(url).toMatch(/^https:\/\//);
  });
});

describe("Legacy API", () => {
  it("LATEST_RELEASE_114 returns a valid version string", async () => {
    const url = buildLegacyLatestReleaseUrl(114);
    const response = await fetch(url);
    expect(response.ok).toBe(true);
    const text = await response.text();
    expect(text).toMatch(/^114\.\d+\.\d+\.\d+/);
  });
});
