#!/bin/bash

set -eo pipefail

VERSION=$1
ARCH=$2

if [ "$ARCH" == "linux64" ]; then
    CHROMEAPP=google-chrome
    if ! type -a google-chrome > /dev/null 2>&1; then
        sudo apt-get update
        sudo apt-get install -y google-chrome
    fi
elif [ "$ARCH" == "mac64" ]; then
    CHROMEAPP="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
fi

if [ "$VERSION" == "" ]; then
    VERSION=$("$CHROMEAPP" --version | cut -f 3 -d ' ')
fi

npx @puppeteer/browsers install "chromedriver@$VERSION"
sudo mv chromedriver/*/*/chromedriver /usr/local/bin/chromedriver
rm -rf chromedriver/
