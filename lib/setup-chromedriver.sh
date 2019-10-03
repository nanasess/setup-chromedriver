#!/bin/bash

set -eo pipefail

version=$1
arch=$2

sudo apt-fast install -y xvfb screen google-chrome-stable

wget -c -nc --retry-connrefused --tries=0 https://chromedriver.storage.googleapis.com/${version}/chromedriver_${arch}.zip
unzip -o -q chromedriver_${arch}.zip
sudo mv chromedriver /usr/local/bin/chromedriver
