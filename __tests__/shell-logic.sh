#!/usr/bin/env bash
#
# Extract pure logic from setup-chromedriver.sh and output results as KEY=VALUE pairs.
# This script is used by the equivalence test to verify TypeScript functions
# produce identical results to the shell script logic.
#
# Usage: bash __tests__/shell-logic.sh
#
# No network access, no side effects. Pure computation only.

set -eo pipefail

echo "=== VERSION_PARSING ==="
for v in "131.0.6778.264" "114.0.5735.90" "115.0.5790.102"; do
    major=$(cut -d '.' -f 1 <<<"${v}")
    version3=$(cut -d '.' -f 1-3 <<<"${v}")
    echo "INPUT=${v} MAJOR=${major} VERSION3=${version3}"
done

echo "=== LEGACY_CHECK ==="
for major in 100 114 115 131; do
    if ((major < 115)); then
        echo "MAJOR=${major} LEGACY=true"
    else
        echo "MAJOR=${major} LEGACY=false"
    fi
done

echo "=== LEGACY_ARCH_CONVERT ==="
for arch in "mac-arm64" "mac64" "linux64" "win32"; do
    converted="${arch}"
    if [[ "${arch}" == "mac-arm64" ]]; then
        converted="mac64"
    fi
    echo "INPUT=${arch} OUTPUT=${converted}"
done

echo "=== MODERN_ARCH_CONVERT ==="
for arch in "mac64" "mac-arm64" "linux64" "win32"; do
    converted="${arch}"
    if [[ "${arch}" == "mac64" ]]; then
        converted="mac-x64"
    fi
    echo "INPUT=${arch} OUTPUT=${converted}"
done

echo "=== LEGACY_LATEST_RELEASE_URL ==="
for major in 114 100; do
    echo "MAJOR=${major} URL=https://chromedriver.storage.googleapis.com/LATEST_RELEASE_${major}"
done

echo "=== LEGACY_DOWNLOAD_URL ==="
for pair in "114.0.5735.90,linux64" "114.0.5735.90,mac64" "114.0.5735.90,win32"; do
    IFS=',' read -r version arch <<<"${pair}"
    echo "VERSION=${version} ARCH=${arch} URL=https://chromedriver.storage.googleapis.com/${version}/chromedriver_${arch}.zip"
done

echo "=== DEFAULT_CHROME_PATH ==="
# These are hardcoded in the shell script
echo "PLATFORM=linux PATH=google-chrome-stable"
echo "PLATFORM=darwin PATH=/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"

echo "=== DEFAULT_INSTALL_PATH ==="
echo "PLATFORM=linux PATH=/usr/local/bin/chromedriver"
echo "PLATFORM=darwin PATH=/usr/local/bin/chromedriver"

echo "=== JQ_EXTRACT ==="
# Test jq extraction logic with inline JSON
# This mirrors: .versions[] | select(.version == "VERSION") | .downloads.chromedriver[] | select(.platform == "PLATFORM") | .url
TEST_JSON='{
  "versions": [
    {
      "version": "131.0.6778.204",
      "downloads": {
        "chromedriver": [
          {"platform": "linux64", "url": "https://example.com/chromedriver-linux64.zip"},
          {"platform": "mac-x64", "url": "https://example.com/chromedriver-mac-x64.zip"}
        ]
      }
    },
    {
      "version": "131.0.6778.264",
      "downloads": {
        "chromedriver": [
          {"platform": "linux64", "url": "https://example.com/chromedriver-linux64-264.zip"}
        ]
      }
    }
  ]
}'

for pair in "131.0.6778.204,linux64" "131.0.6778.204,mac-x64" "999.0.0.0,linux64"; do
    IFS=',' read -r version platform <<<"${pair}"
    JQ=".versions[] | select(.version == \"${version}\") | .downloads.chromedriver[] | select(.platform == \"${platform}\") | .url"
    url=$(jq -r "${JQ}" <<<"${TEST_JSON}")
    if [[ -z "${url}" || "${url}" == "null" ]]; then
        echo "VERSION=${version} PLATFORM=${platform} URL=null"
    else
        echo "VERSION=${version} PLATFORM=${platform} URL=${url}"
    fi
done

echo "=== JQ_FALLBACK ==="
# Test fallback logic: [ .versions[] | select(.version | startswith("PREFIX.")) ] | last | .version
for prefix in "131.0.6778" "999.0.0"; do
    JQ2="[ .versions[] | select(.version | startswith(\"${prefix}.\")) ] | last | .version"
    fallback=$(jq -r "${JQ2}" <<<"${TEST_JSON}")
    if [[ -z "${fallback}" || "${fallback}" == "null" ]]; then
        echo "PREFIX=${prefix} FALLBACK=null"
    else
        echo "PREFIX=${prefix} FALLBACK=${fallback}"
    fi
done

echo "=== DONE ==="
