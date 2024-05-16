import { Builder, Capabilities, until, By, Key, logging } from 'selenium-webdriver';
(async () => {
  const logger = logging.getLogger('selenium');
  logger.setLevel(logging.Level.DEBUG);
  const timeout = 30000;
  const driver = new Builder()
    .withCapabilities(Capabilities.chrome())
    .build();
  try {
    await driver.get('https://google.com');
    await driver.wait(until.titleContains('Google'), timeout);
    console.log(await driver.getTitle());

    const searchBox = await driver.findElement(By.name('q'));
    await searchBox.sendKeys('ChromeDriver', Key.RETURN);
    await driver.wait(until.titleContains('ChromeDriver'), timeout);
    console.log(await driver.getTitle());
  } finally {
    driver.quit();
  }
})();
