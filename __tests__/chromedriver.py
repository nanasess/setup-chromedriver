import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

options = Options()
options.add_argument('--headless')
options.add_argument('--no-sandbox')
options.add_argument('--disable-gpu')
options.add_argument('--disable-extensions')
driver = webdriver.Chrome(options=options)  # Optional argument, if not specified will search path.
driver.get('http://www.google.com/');
print(driver.title)
time.sleep(5) # Let the user actually see something!
search_box = driver.find_element_by_name('q')
search_box.send_keys('ChromeDriver')
search_box.submit()
time.sleep(5) # Let the user actually see something!
print(driver.title)
driver.quit()
