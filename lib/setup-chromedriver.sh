#!/bin/bash

set -eo pipefail

VERSION=$1
ARCH=$2

if [ "$ARCH" == "linux64" ]; then
    CHROMEAPP=google-chrome
    if ! type -a sudo > /dev/null 2>&1; then
        apt-get update
        apt-get install -y sudo
    fi
    if ! type -a curl > /dev/null 2>&1; then
        sudo apt-get update
        sudo apt-get install -y curl
    fi
    if ! type -a google-chrome > /dev/null 2>&1; then
        # for debian
        # curl -O https://dl.google.com/linux/direct/google-chrome-stable_current_amd64f.deb
        # sudo apt install -y ./google-chrome-stable_current_amd64.deb
        # CHROMEAPP=google-chrome-stable
        sudo apt-get update
        sudo apt-get install -y google-chrome
    fi
    if ! type -a jq > /dev/null 2>&1; then
        sudo apt-get update
        sudo apt-get install -y jq
    fi
    if ! type -a bc > /dev/null 2>&1; then
        sudo apt-get update
        sudo apt-get install -y bc
    fi
elif [ "$ARCH" == "mac64" ]; then
    CHROMEAPP="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
fi

if [ "$VERSION" == "" ]; then
    CHROME_VERSION=$("$CHROMEAPP" --version | cut -f 3 -d ' ' | cut -d '.' -f 1)
else
    CHROME_VERSION=$(echo "$VERSION" | cut -d '.' -f 1)
fi

UNDER115=$(echo "$CHROME_VERSION < 115" | bc)
if [ "$UNDER115" -eq 1 ]; then
    if [ "$VERSION" == "" ]; then
        VERSION=$(curl --location --fail --retry 10 http://chromedriver.storage.googleapis.com/LATEST_RELEASE_${CHROME_VERSION})
    fi
    echo "Installing ChromeDriver $VERSION for $ARCH"

    curl --location --fail --retry 10 -O https://chromedriver.storage.googleapis.com/${VERSION}/chromedriver_${ARCH}.zip
    unzip -o -q chromedriver_${ARCH}.zip
    rm chromedriver_${ARCH}.zip
else
    if [ "$VERSION" == "" ]; then
        VERSION=$("$CHROMEAPP" --version | cut -f 3 -d ' ')
    fi
    if [ "$ARCH" == "mac64" ]; then
        ARCH="mac-x64"
    fi

    echo "Installing ChromeDriver $VERSION for $ARCH"
    URL=$(curl  --location --fail --retry 10 https://googlechromelabs.github.io/chrome-for-testing/known-good-versions-with-downloads.json | jq -r ".versions[] | select(.version == \"${VERSION}\") | .downloads.chromedriver[] | select(.platform == \"${ARCH}\") | .url")
    echo "Downloading $URL"
    curl --location --fail --retry 10 -O "$URL"
    unzip -o -q chromedriver-${ARCH}.zip
    sudo mv chromedriver-${ARCH}/chromedriver /usr/local/bin/chromedriver
    rm chromedriver-${ARCH}.zip
    rm -r chromedriver-${ARCH}
fi


