import { Builder, until } from "selenium-webdriver";
// ESM (the project is "type":"module") requires an explicit extension for this
// CJS subpath; without it Node throws ERR_MODULE_NOT_FOUND. This file is run
// directly via `node __tests__/chromedriver.ts` (Node 24 native type-stripping),
// so it must stay strip-safe: value imports only, no `import type` needed here.
import * as chrome from "selenium-webdriver/chrome.js";

(async () => {
  const timeout = 30000;

  // Chrome options for better compatibility, especially on macOS
  const options = new chrome.Options();
  options.addArguments(
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--disable-web-security",
    "--disable-features=VizDisplayCompositor",
    // NOTE: do NOT pin --remote-debugging-port. Recent ChromeDriver negotiates
    // the DevTools port itself; a fixed port intermittently triggers
    // "chrome not reachable" on the Windows CI runners (port reuse / races).
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
  );

  // Add headless mode for CI environments
  if (process.env.CI) {
    options.addArguments("--headless=new");
  }

  // Set a custom user data directory to avoid permission issues
  const userDataDir =
    process.platform === "darwin"
      ? "/tmp/chrome-user-data-" + Date.now()
      : undefined;
  if (userDataDir) {
    options.addArguments(`--user-data-dir=${userDataDir}`);
  }

  // Session creation ("chrome not reachable" / "session not created") is the
  // dominant flaky failure on the Windows CI runners. Retry a few times before
  // giving up so a single transient hiccup does not fail the whole job.
  const buildWithRetry = async (attempts = 3, delayMs = 2000) => {
    for (let attempt = 1; ; attempt++) {
      try {
        return await new Builder()
          .forBrowser("chrome")
          .setChromeOptions(options)
          .build();
      } catch (err) {
        if (attempt >= attempts) throw err;
        console.log(
          `session creation failed (attempt ${attempt}/${attempts}), retrying in ${delayMs}ms: ${err}`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  };

  const driver = await buildWithRetry();
  try {
    await driver.get("https://google.com");
    await driver.wait(until.titleContains("Google"), timeout);
    console.log(await driver.getTitle());
  } finally {
    driver.quit();
  }
})();
