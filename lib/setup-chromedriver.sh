#!/usr/bin/env bash

set -eo pipefail

CURL="curl --silent --location --fail --retry 10"
JSON_URL=https://googlechromelabs.github.io/chrome-for-testing/known-good-versions-with-downloads.json

VERSION="${1:-}"
ARCH="${2:-linux64}"

sudo=$(command -v sudo)

if [[ "${ARCH}" =~ ^linux64 ]]; then
    CHROMEAPP=google-chrome
    APP="${CHROMEAPP}"
    if command -v dpkg &>/dev/null; then
        if ! dpkg -s "${APP}" >/dev/null; then
            ${sudo} apt-key adv --keyserver keyserver.ubuntu.com --recv-keys A040830F7FAC5991
            echo "deb [arch=amd64] https://dl.google.com/linux/chrome/deb/ stable main" | ${sudo} tee /etc/apt/sources.list.d/google.list >/dev/null
            APP=google-chrome-stable
        fi
        apps=()
        test -z "${sudo}" && apps+=(sudo)
        type -a curl > /dev/null 2>&1 || apps+=(curl)
        type -a "${CHROMEAPP}" > /dev/null 2>&1 || apps+=("${APP}")
        type -a jq > /dev/null 2>&1 || apps+=(jq)
        type -a unzip > /dev/null 2>&1 || apps+=(unzip)
        if (("${#apps[@]}")); then
            echo "Installing ${apps[*]}..."
            export DEBIAN_FRONTEND=noninteractive
            ${sudo} apt-get update
            ${sudo} apt-get install -y --no-install-recommends "${apps[@]}"
        fi
    fi
fi

if [[ "${ARCH}" =~ ^mac64 ]]; then
    CHROMEAPP="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
fi

if [[ -n "${VERSION}" ]]; then
    CHROME_VERSION=$(cut -d '.' -f 1 <<<"${VERSION}")
else
    CHROME_VERSION=$("${CHROMEAPP}" --version | cut -d ' ' -f 3 | cut -d '.' -f 1)
fi
echo "CHROME_VERSION=${CHROME_VERSION}"

if ((CHROME_VERSION < 115)); then
    if [[ -z "${VERSION}" ]]; then
        URL="https://chromedriver.storage.googleapis.com/LATEST_RELEASE_${CHROME_VERSION}"
        echo "Downloading ${URL}..."
        VERSION=$(${CURL} "${URL}")
        echo "VERSION=${VERSION}"
    fi
    echo "Installing ChromeDriver ${VERSION} for ${ARCH}"
    URL="https://chromedriver.storage.googleapis.com/${VERSION}/chromedriver_${ARCH}.zip"
    echo "Downloading ${URL}..."
    ${CURL} -o chromedriver.zip "${URL}"
    unzip -o -q chromedriver.zip
    ${sudo} mv chromedriver /usr/local/bin/chromedriver
    rm -f chromedriver.zip
    exit
fi

if [[ -z "${VERSION}" ]]; then
    VERSION=$("${CHROMEAPP}" --version | cut -d ' ' -f 3)
    echo "VERSION=${VERSION}"
fi
if [[ "${ARCH}" =~ ^mac64 ]]; then
    ARCH="mac-x64"
fi

echo "Downloading ${JSON_URL}..."
JSON=$(${CURL} "${JSON_URL}")
JQ=".versions[] | select(.version == \"${VERSION}\") | .downloads.chromedriver[] | select(.platform == \"${ARCH}\") | .url"
URL=$(jq -r "${JQ}" <<<"${JSON}")
if [[ -z "${URL}" ]]; then
    echo "Falling back to latest version of ChromeDriver for ${ARCH}"
    VERSION3=$(cut -d '.' -f 1-3 <<<"${VERSION}")
    echo "VERSION3=${VERSION3}"
    JQ2="[ .versions[] | select(.version | startswith(\"${VERSION3}.\")) ] | last | .version"
    VERSION=$(jq -r "${JQ2}" <<<"${JSON}")
    echo "VERSION=${VERSION}"
    JQ3=".versions[] | select(.version == \"${VERSION}\") | .downloads.chromedriver[] | select(.platform == \"${ARCH}\") | .url"
    URL=$(jq -r "${JQ3}" <<<"${JSON}")
fi
echo "Installing ChromeDriver ${VERSION} for ${ARCH}"
echo "Downloading ${URL}..."
${CURL} -o chromedriver.zip "${URL}"
unzip -o -q chromedriver.zip
echo Installing chromedriver to /usr/local/bin
${sudo} mv "chromedriver-${ARCH}/chromedriver" /usr/local/bin/chromedriver
rm -fr chromedriver.zip chromedriver-*
if command -v "${CHROMEAPP}" >/dev/null; then
    echo Chrome version:
    "${CHROMEAPP}" --version
fi
echo Chromedriver version:
/usr/local/bin/chromedriver --version
