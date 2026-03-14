import {
  parseMajorVersion,
  parseVersion3,
  isLegacyVersion,
  mapArchitecture,
  convertArchForLegacyAPI,
  convertArchForModernAPI,
  buildLegacyLatestReleaseUrl,
  buildLegacyDownloadUrl,
  extractDriverUrlFromJson,
  findFallbackVersion,
  getDefaultChromePath,
  getInstallPath,
} from "../src/chromedriver-helper";

// ---------------------------------------------------------------------------
// Mock API response fixture
// ---------------------------------------------------------------------------

const MOCK_API_RESPONSE = {
  versions: [
    {
      version: "114.0.5735.90",
      downloads: {
        chromedriver: [
          {
            platform: "linux64",
            url: "https://chromedriver.storage.googleapis.com/114.0.5735.90/chromedriver_linux64.zip",
          },
        ],
      },
    },
    {
      version: "131.0.6778.204",
      downloads: {
        chromedriver: [
          {
            platform: "linux64",
            url: "https://storage.googleapis.com/chrome-for-testing-public/131.0.6778.204/linux64/chromedriver-linux64.zip",
          },
          {
            platform: "mac-x64",
            url: "https://storage.googleapis.com/chrome-for-testing-public/131.0.6778.204/mac-x64/chromedriver-mac-x64.zip",
          },
          {
            platform: "mac-arm64",
            url: "https://storage.googleapis.com/chrome-for-testing-public/131.0.6778.204/mac-arm64/chromedriver-mac-arm64.zip",
          },
          {
            platform: "win32",
            url: "https://storage.googleapis.com/chrome-for-testing-public/131.0.6778.204/win32/chromedriver-win32.zip",
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
            url: "https://storage.googleapis.com/chrome-for-testing-public/131.0.6778.264/linux64/chromedriver-linux64.zip",
          },
          {
            platform: "mac-x64",
            url: "https://storage.googleapis.com/chrome-for-testing-public/131.0.6778.264/mac-x64/chromedriver-mac-x64.zip",
          },
          {
            platform: "mac-arm64",
            url: "https://storage.googleapis.com/chrome-for-testing-public/131.0.6778.264/mac-arm64/chromedriver-mac-arm64.zip",
          },
          {
            platform: "win32",
            url: "https://storage.googleapis.com/chrome-for-testing-public/131.0.6778.264/win32/chromedriver-win32.zip",
          },
        ],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("parseMajorVersion", () => {
  it("parses major version from full version string", () => {
    expect(parseMajorVersion("131.0.6778.264")).toBe(131);
  });

  it("parses legacy version", () => {
    expect(parseMajorVersion("114.0.5735.90")).toBe(114);
  });

  it("throws on invalid version string", () => {
    expect(() => parseMajorVersion("")).toThrow("Invalid version string");
    expect(() => parseMajorVersion("abc")).toThrow("Invalid version string");
  });
});

describe("parseVersion3", () => {
  it("extracts first 3 parts of version", () => {
    expect(parseVersion3("115.0.5790.102")).toBe("115.0.5790");
    expect(parseVersion3("131.0.6778.264")).toBe("131.0.6778");
  });

  it("throws when version has fewer than 3 parts", () => {
    expect(() => parseVersion3("115.0")).toThrow(
      "Version must have at least 3 parts"
    );
  });
});

describe("isLegacyVersion", () => {
  it("returns true for versions < 115", () => {
    expect(isLegacyVersion(114)).toBe(true);
    expect(isLegacyVersion(100)).toBe(true);
  });

  it("returns false for versions >= 115", () => {
    expect(isLegacyVersion(115)).toBe(false);
    expect(isLegacyVersion(131)).toBe(false);
  });
});

describe("mapArchitecture", () => {
  it("maps linux x64", () => {
    expect(mapArchitecture("linux" as NodeJS.Platform, "x64")).toBe("linux64");
  });

  it("maps darwin x64", () => {
    expect(mapArchitecture("darwin", "x64")).toBe("mac64");
  });

  it("maps darwin arm64", () => {
    expect(mapArchitecture("darwin", "arm64")).toBe("mac-arm64");
  });

  it("maps win32", () => {
    expect(mapArchitecture("win32", "x64")).toBe("win32");
  });
});

describe("convertArchForLegacyAPI", () => {
  it("converts mac-arm64 to mac64", () => {
    expect(convertArchForLegacyAPI("mac-arm64")).toBe("mac64");
  });

  it("keeps linux64 unchanged", () => {
    expect(convertArchForLegacyAPI("linux64")).toBe("linux64");
  });

  it("keeps mac64 unchanged", () => {
    expect(convertArchForLegacyAPI("mac64")).toBe("mac64");
  });

  it("keeps win32 unchanged", () => {
    expect(convertArchForLegacyAPI("win32")).toBe("win32");
  });
});

describe("convertArchForModernAPI", () => {
  it("converts mac64 to mac-x64", () => {
    expect(convertArchForModernAPI("mac64")).toBe("mac-x64");
  });

  it("keeps mac-arm64 unchanged", () => {
    expect(convertArchForModernAPI("mac-arm64")).toBe("mac-arm64");
  });

  it("keeps linux64 unchanged", () => {
    expect(convertArchForModernAPI("linux64")).toBe("linux64");
  });

  it("keeps win32 unchanged", () => {
    expect(convertArchForModernAPI("win32")).toBe("win32");
  });
});

describe("buildLegacyLatestReleaseUrl", () => {
  it("builds correct URL for version 114", () => {
    expect(buildLegacyLatestReleaseUrl(114)).toBe(
      "https://chromedriver.storage.googleapis.com/LATEST_RELEASE_114"
    );
  });
});

describe("buildLegacyDownloadUrl", () => {
  it("builds correct download URL", () => {
    expect(buildLegacyDownloadUrl("114.0.5735.90", "linux64")).toBe(
      "https://chromedriver.storage.googleapis.com/114.0.5735.90/chromedriver_linux64.zip"
    );
  });

  it("builds correct URL for mac64", () => {
    expect(buildLegacyDownloadUrl("114.0.5735.90", "mac64")).toBe(
      "https://chromedriver.storage.googleapis.com/114.0.5735.90/chromedriver_mac64.zip"
    );
  });
});

describe("extractDriverUrlFromJson", () => {
  it("extracts URL for exact version and platform match", () => {
    const url = extractDriverUrlFromJson(
      MOCK_API_RESPONSE,
      "131.0.6778.204",
      "linux64"
    );
    expect(url).toBe(
      "https://storage.googleapis.com/chrome-for-testing-public/131.0.6778.204/linux64/chromedriver-linux64.zip"
    );
  });

  it("extracts URL for mac-arm64", () => {
    const url = extractDriverUrlFromJson(
      MOCK_API_RESPONSE,
      "131.0.6778.204",
      "mac-arm64"
    );
    expect(url).toBe(
      "https://storage.googleapis.com/chrome-for-testing-public/131.0.6778.204/mac-arm64/chromedriver-mac-arm64.zip"
    );
  });

  it("returns null for non-existent version", () => {
    const url = extractDriverUrlFromJson(
      MOCK_API_RESPONSE,
      "999.0.0.0",
      "linux64"
    );
    expect(url).toBeNull();
  });

  it("returns null for platform mismatch", () => {
    const url = extractDriverUrlFromJson(
      MOCK_API_RESPONSE,
      "114.0.5735.90",
      "win32"
    );
    expect(url).toBeNull();
  });

  it("returns null when chromedriver downloads are missing", () => {
    const json = {
      versions: [
        {
          version: "100.0.0.0",
          downloads: {},
        },
      ],
    };
    const url = extractDriverUrlFromJson(json, "100.0.0.0", "linux64");
    expect(url).toBeNull();
  });
});

describe("findFallbackVersion", () => {
  it("finds the last matching patch version", () => {
    const version = findFallbackVersion(MOCK_API_RESPONSE, "131.0.6778");
    expect(version).toBe("131.0.6778.264");
  });

  it("returns null for non-existent version prefix", () => {
    const version = findFallbackVersion(MOCK_API_RESPONSE, "999.0.0");
    expect(version).toBeNull();
  });

  it("returns the only match when there is one", () => {
    const version = findFallbackVersion(MOCK_API_RESPONSE, "114.0.5735");
    expect(version).toBe("114.0.5735.90");
  });
});

describe("getDefaultChromePath", () => {
  it("returns google-chrome-stable for linux", () => {
    expect(getDefaultChromePath("linux" as NodeJS.Platform)).toBe(
      "google-chrome-stable"
    );
  });

  it("returns macOS app path for darwin", () => {
    expect(getDefaultChromePath("darwin")).toBe(
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    );
  });

  it("returns Windows exe path for win32", () => {
    expect(getDefaultChromePath("win32")).toBe(
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
    );
  });
});

describe("getInstallPath", () => {
  it("returns /usr/local/bin/chromedriver for linux", () => {
    expect(getInstallPath("linux" as NodeJS.Platform)).toBe(
      "/usr/local/bin/chromedriver"
    );
  });

  it("returns /usr/local/bin/chromedriver for darwin", () => {
    expect(getInstallPath("darwin")).toBe("/usr/local/bin/chromedriver");
  });

  it("returns Windows SeleniumWebDrivers path for win32", () => {
    expect(getInstallPath("win32")).toBe(
      "C:\\SeleniumWebDrivers\\ChromeDriver"
    );
  });
});
