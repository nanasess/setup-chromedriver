#!/bin/bash

set -eo pipefail

VERSION=$1
ARCH=$2

if [ "$ARCH" == "linux64" ]; then
    if ! type -a google-chrome > /dev/null 2>&1; then
        sudo apt-get update
        sudo apt-get install -y google-chrome
    fi
fi

if [ "$VERSION" == "" ]; then
    if [ "$ARCH" == "mac64" ]; then
        CHROME_VERSION=$(/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --version | cut -f 3 -d ' ' | cut -d '.' -f 1)
    elif [ "$ARCH" == "linux64" ]; then
        CHROME_VERSION=$(google-chrome --version | cut -f 3 -d ' ' | cut -d '.' -f 1)
    fi
  VERSION=$(curl --location --fail --retry 10 http://chromedriver.storage.googleapis.com/LATEST_RELEASE_${CHROME_VERSION})
fi

wget -c -nc --retry-connrefused --tries=0 https://chromedriver.storage.googleapis.com/${VERSION}/chromedriver_${ARCH}.zip
unzip -o -q chromedriver_${ARCH}.zip
sudo mv chromedriver /usr/local/bin/chromedriver
rm chromedriver_${ARCH}.zip
