# setup-chromedriver

<p align="left">
  <a href="https://github.com/nanasess/setup-chromedriver"><img alt="GitHub Actions status" src="https://github.com/nanasess/setup-chromedriver/workflows/Test%20chromedriver/badge.svg"></a>
  <a href="https://github.com/nanasess/setup-chromedriver/blob/master/LICENSE"><img alt="LICENSE" src="https://img.shields.io/badge/license-MIT-428f7e.svg"></a>
</p>

This action sets up a [ChromeDriver](https://chromedriver.chromium.org/) for use in actions

## OS/Platform support

- ubuntu-latest, ubuntu-20.04, ubuntu-18.04, or ubuntu-16.04
- macos-latest, macos-10.15
- windows-latest, windows-2019

# Usage

See [action.yml](action.yml)

## for ubuntu-latest, macos-latest

``` yaml
steps:
- uses: actions/checkout@v2
- uses: nanasess/setup-chromedriver@master
  with:
    # Optional: do not specify to match Chrome's version
    chromedriver-version: '88.0.4324.96'
- run: |
    export DISPLAY=:99
    chromedriver --url-base=/wd/hub &
    sudo Xvfb -ac :99 -screen 0 1280x1024x24 > /dev/null 2>&1 & # optional
 ```

## for windows-latest

``` yaml
steps:
- uses: actions/checkout@v2
- uses: nanasess/setup-chromedriver@master
  with:
    # Optional: do not specify to match Chrome's version
    chromedriver-version: '88.0.4324.96'
- run: chromedriver --url-base=/wd/hub &
 ```
