<div align="center">

# 🚀 setup-chromedriver

**A GitHub Action to set up ChromeDriver for automated testing**

[![Test on Linux & macOS](https://github.com/nanasess/setup-chromedriver/actions/workflows/test.yml/badge.svg)](https://github.com/nanasess/setup-chromedriver/actions/workflows/test.yml)
[![Test on Windows](https://github.com/nanasess/setup-chromedriver/actions/workflows/windows.yml/badge.svg)](https://github.com/nanasess/setup-chromedriver/actions/workflows/windows.yml)
[![GitHub release](https://img.shields.io/github/v/release/nanasess/setup-chromedriver?color=blue)](https://github.com/marketplace/actions/setup-chromedriver)
[![License](https://img.shields.io/github/license/nanasess/setup-chromedriver?color=green)](./LICENSE)
[![GitHub Sponsors](https://img.shields.io/github/sponsors/nanasess?color=pink)](https://github.com/sponsors/nanasess)

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-usage">Usage</a> •
  <a href="#-platform-support">Platform Support</a> •
  <a href="#-configuration">Configuration</a> •
  <a href="#-examples">Examples</a> •
  <a href="#-contributing">Contributing</a>
</p>

</div>

---

## ✨ Features

- 🔧 **Automatic Version Matching** - Automatically installs ChromeDriver that matches your Chrome browser version
- 🖥️ **Cross-Platform** - Works on Ubuntu, macOS, and Windows
- ⚡ **Fast Setup** - Quick installation with minimal configuration
- 🎯 **Version Control** - Option to specify exact ChromeDriver version
- 🛠️ **Custom Chrome Binary** - Support for custom Chrome binary names

## 🚀 Quick Start

Add this step to your workflow to automatically set up ChromeDriver:

```yaml
- uses: nanasess/setup-chromedriver@v3
```

That's it! ChromeDriver will be installed and added to your PATH.

> [!NOTE]
> **Versioning** — `@v3` is the current major, a native TypeScript
> reimplementation of the action. The public contract (inputs, install
> locations, PATH behavior) is unchanged from `@v2`, so upgrading is a drop-in
> replacement. `@v2` remains available as the previous, shell-based
> implementation for existing workflows that prefer to stay pinned.

> [!TIP]
> **Supply-chain hardening** — mutable tags like v3 can be repointed at any
> time, so for security-sensitive workflows pin the action to a full-length
> commit SHA instead. Keep the tag in a trailing comment for readability, and
> let Dependabot/Renovate bump the SHA for you:
>
> ```yaml
> # Pinned to a full commit SHA (recommended)
> - uses: nanasess/setup-chromedriver@<full-commit-sha> # v3.0.0
> ```

## 📖 Usage

### Basic Usage

The simplest way to use this action is without any parameters. It will automatically detect your Chrome version and install the matching ChromeDriver:

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: nanasess/setup-chromedriver@v3
  - run: chromedriver --version
```

### Specify ChromeDriver Version

If you need a specific version of ChromeDriver:

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: nanasess/setup-chromedriver@v3
    with:
      chromedriver-version: '131.0.6778.87'
  - run: chromedriver --version
```

### Custom Chrome Binary

If your Chrome binary has a custom name:

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: nanasess/setup-chromedriver@v3
    with:
      chromeapp: chrome-beta
```

### Usage in a Container

When a job runs inside a `container:` image (e.g. `ruby`, `elixir`, `node:slim`,
`debian:slim`), the action **cannot install Google Chrome or the system
prerequisites for you** — minimal images ship without `sudo`, `git`, `gnupg`,
`unzip`, etc., and recent Debian releases (12 "bookworm" and later) no longer
provide `apt-key`. You must prepare the container yourself before calling the
action (see issues [#32](https://github.com/nanasess/setup-chromedriver/issues/32)
and [#243](https://github.com/nanasess/setup-chromedriver/issues/243)).

Three things are required:

1. **Install the prerequisites _before_ `actions/checkout`** (checkout itself
   needs `git`, which slim images do not ship):
   `git sudo gnupg ca-certificates curl unzip jq wget`
2. **Install Google Chrome yourself** using the modern `signed-by` keyring
   scheme (the action's built-in Chrome install relies on the removed
   `apt-key`).
3. **Pass `chromeapp: google-chrome-stable`** — the action checks
   `dpkg -s <chromeapp>`, so it must match the installed _package_ name
   (`google-chrome-stable`), not the `google-chrome` binary alias. Otherwise the
   check fails and the action falls back to the broken `apt-key` install path.

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    container:
      image: ruby:3.2.2
    steps:
      # 1. Prerequisites (must run before checkout, since checkout needs git)
      - name: Install container prerequisites
        run: |
          apt-get update
          apt-get install -y --no-install-recommends \
            git sudo gnupg ca-certificates curl unzip jq wget

      # 2. Install Google Chrome via the signed-by keyring scheme
      - name: Install Google Chrome
        run: |
          wget -q -O- https://dl.google.com/linux/linux_signing_key.pub \
            | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg
          echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" \
            > /etc/apt/sources.list.d/google-chrome.list
          apt-get update
          apt-get install -y google-chrome-stable

      - uses: actions/checkout@v4

      # 3. Pass the installed package name as chromeapp
      - uses: nanasess/setup-chromedriver@v3
        with:
          chromeapp: google-chrome-stable

      - run: chromedriver --version
```

## 🖥️ Platform Support

| Platform    | Versions                                          |
|-------------|---------------------------------------------------|
| **Ubuntu**  | `ubuntu-latest`, `ubuntu-24.04`, `ubuntu-22.04`   |
| **macOS**   | `macos-latest`, `macos-15`, `macos-14`            |
| **Windows** | `windows-latest`, `windows-2025 , windows-2022`   |

## ⚙️ Configuration

### Input Parameters

| Parameter | Description | Required | Default |
|-----------|-------------|----------|---------|
| `chromedriver-version` | The ChromeDriver version to install | No | Auto-detected |
| `chromeapp` | Custom Chrome binary name (Linux/macOS only) | No | System default |

## 📚 Examples

### Running Tests on Ubuntu/macOS with Xvfb

```yaml
name: UI Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: nanasess/setup-chromedriver@v3

      - name: Start ChromeDriver
        run: |
          export DISPLAY=:99
          chromedriver --url-base=/wd/hub &
          sudo Xvfb -ac :99 -screen 0 1280x1024x24 > /dev/null 2>&1 &

      - name: Run tests
        run: npm test
```

### Running Tests on Windows

```yaml
name: Windows UI Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4

      - uses: nanasess/setup-chromedriver@v3

      - name: Start ChromeDriver
        run: chromedriver --url-base=/wd/hub &

      - name: Run tests
        run: npm test
```

### Matrix Testing Across Platforms

```yaml
name: Cross-Platform Tests
on: [push, pull_request]

jobs:
  test:
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4

      - uses: nanasess/setup-chromedriver@v3

      - name: Run tests
        run: npm test
```

### Testing with Specific Chrome Version

```yaml
name: Chrome Version Test
on: [push]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Chrome
        uses: browser-actions/setup-chrome@v1
        with:
          chrome-version: '131'

      - uses: nanasess/setup-chromedriver@v3
        with:
          chromedriver-version: '131.0.6778.87'

      - name: Run tests
        run: npm test
```

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. 🍴 Fork the repository
2. 🔧 Create your feature branch (`git checkout -b feature/amazing-feature`)
3. 💻 Make your changes
4. ✅ Run tests with `pnpm test`
5. 📝 Commit your changes (`git commit -m 'Add amazing feature'`)
6. 📤 Push to the branch (`git push origin feature/amazing-feature`)
7. 🔄 Open a Pull Request

### Development Setup

```bash
# Enable pnpm via Corepack (uses the version pinned in package.json)
corepack enable

# Install dependencies
pnpm install --frozen-lockfile

# Build the action
pnpm build
pnpm package

# Run tests
pnpm test

# Format code
pnpm format
```

For more details on the architecture and development process, see [CLAUDE.md](./CLAUDE.md).

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

- Thanks to all [contributors](https://github.com/nanasess/setup-chromedriver/graphs/contributors) who have helped improve this action
- Special thanks to the ChromeDriver team for their excellent work

## 💖 Support

If you find this action helpful, please consider:

- ⭐ Starring the repository
- 💬 Sharing it with others who might benefit
- 💰 [Sponsoring the maintainer](https://github.com/sponsors/nanasess)

---

<div align="center">

Made with ❤️ by [@nanasess](https://github.com/nanasess)

</div>
