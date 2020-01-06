#!/bin/bash

set -eo pipefail

VERSION=$1
ARCH=$2

if [ "$VERSION" == "" ]; then
  CHROME_VERSION=$(google-chrome --version | cut -f 3 -d ' ' | cut -d '.' -f 1)
  VERSION=$(curl --location --fail --retry 10 http://chromedriver.storage.googleapis.com/LATEST_RELEASE_${CHROME_VERSION})
fi

wget -c -nc --retry-connrefused --tries=0 https://chromedriver.storage.googleapis.com/${VERSION}/chromedriver_${ARCH}.zip
unzip -o -q chromedriver_${ARCH}.zip
sudo mv chromedriver /usr/local/bin/chromedriver
rm chromedriver_${ARCH}.zip
