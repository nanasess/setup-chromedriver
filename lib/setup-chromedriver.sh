#!/bin/bash

set -eo pipefail

VERSION=$1
ARCH=$2
SUDO=
if command -v sudo &> /dev/null
then
    SUDO=$(echo command -v sudo)
fi

if [ "$ARCH" == "linux64" ]; then
    if ! type -a gnupg > /dev/null 2>&1; then
        $SUDO apt-get update
        $SUDO apt-get install -y gnupg
    fi
    if ! type -a curl > /dev/null 2>&1; then
        $SUDO apt-get update
        $SUDO apt-get install -y curl
    fi
    if ! type -a google-chrome > /dev/null 2>&1; then
        curl -fsSL https://dl.google.com/linux/linux_signing_key.pub | $SUDO apt-key add -
        curl -O https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
        $SUDO apt install -y ./google-chrome-stable_current_amd64.deb
    fi
    CHROMEAPP=google-chrome
    if ! type -a unzip > /dev/null 2>&1; then
        $SUDO apt-get update
        $SUDO apt-get install -y unzip
    fi
elif [ "$ARCH" == "mac64" ]; then
    CHROMEAPP="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
fi

if [ "$VERSION" == "" ]; then
    CHROME_VERSION=$("$CHROMEAPP" --version | cut -f 3 -d ' ' | cut -d '.' -f 1)
    VERSION=$(curl --location --fail --retry 10 http://chromedriver.storage.googleapis.com/LATEST_RELEASE_${CHROME_VERSION})
fi

curl --location --fail --retry 10 -O https://chromedriver.storage.googleapis.com/${VERSION}/chromedriver_${ARCH}.zip
unzip -o -q chromedriver_${ARCH}.zip
$SUDO mv chromedriver /usr/local/bin/chromedriver
rm chromedriver_${ARCH}.zip
