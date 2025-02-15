import { Builder, Capabilities, until } from "selenium-webdriver";
(async () => {
  const timeout = 30000;
  const driver = new Builder().withCapabilities(Capabilities.chrome()).build();
  try {
    await driver.get("https://google.com");
    await driver.wait(until.titleContains("Google"), timeout);
    console.log(await driver.getTitle());
  } finally {
    driver.quit();
  }
})();
