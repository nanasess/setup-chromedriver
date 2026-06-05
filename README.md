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

> [!WARNING]
> **`@master` is deprecated** — the default branch is now `main`. If your
> workflow references the action by the `master` branch
> (`uses: nanasess/setup-chromedriver@master`), please migrate to `@v3` (or pin
> a full commit SHA). The `master` branch is frozen, emits a deprecation
> warning at runtime, and will not receive future updates.

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
`debian:slim`), the action sets up the Google Chrome apt repository and installs
Chrome for you. It downloads Google's signing key over HTTPS and registers it as
a `signed-by` keyring — the modern scheme that works on recent Debian releases
(12 "bookworm" and later), which removed the `apt-key` the action previously
relied on (see issues
[#32](https://github.com/nanasess/setup-chromedriver/issues/32) and
[#243](https://github.com/nanasess/setup-chromedriver/issues/243)).

You only need to install a few base packages that minimal images do not ship:

1. **Install the prerequisites _before_ `actions/checkout`** (checkout itself
   needs `git`, which slim images do not ship):
   `git sudo ca-certificates unzip`
   - `git` for `actions/checkout`, `unzip` to extract ChromeDriver,
     `ca-certificates` for the HTTPS Chrome apt repository, and `sudo` only when
     the container does not run as root.
2. **Pass `chromeapp: google-chrome-stable`** (the default on Linux) so the
   action's `dpkg -s <chromeapp>` check and version detection use the package
   name, not the `google-chrome` binary alias. The action installs
   `google-chrome-stable` itself when it is not already present.

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    container:
      image: ruby:3.2.2
    steps:
      # Prerequisites (must run before checkout, since checkout needs git)
      - name: Install container prerequisites
        run: |
          apt-get update
          apt-get install -y --no-install-recommends \
            git sudo ca-certificates unzip

      - uses: actions/checkout@v4

      # The action registers the signed-by Chrome repo and installs Chrome and
      # ChromeDriver. No manual Google Chrome setup is required.
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
