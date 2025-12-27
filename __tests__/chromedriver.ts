import { Builder, Capabilities, until } from "selenium-webdriver";
import * as chrome from "selenium-webdriver/chrome";

(async () => {
  const timeout = 30000;
  
  // Chrome options for better compatibility, especially on macOS
  const options = new chrome.Options();
  options.addArguments(
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-web-security',
    '--disable-features=VizDisplayCompositor',
    '--remote-debugging-port=9222',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding'
  );
  
  // Add headless mode for CI environments
  if (process.env.CI) {
    options.addArguments('--headless=new');
  }
  
  // Set a custom user data directory to avoid permission issues
  const userDataDir = process.platform === 'darwin' 
    ? '/tmp/chrome-user-data-' + Date.now()
    : undefined;
  if (userDataDir) {
    options.addArguments(`--user-data-dir=${userDataDir}`);
  }
  
  const driver = new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build();
  try {
    await driver.get("https://google.com");
    await driver.wait(until.titleContains("Google"), timeout);
    console.log(await driver.getTitle());
  } finally {
    driver.quit();
  }
})();
