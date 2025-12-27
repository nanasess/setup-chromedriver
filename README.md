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
- uses: nanasess/setup-chromedriver@v2
```

That's it! ChromeDriver will be installed and added to your PATH.

## 📖 Usage

### Basic Usage

The simplest way to use this action is without any parameters. It will automatically detect your Chrome version and install the matching ChromeDriver:

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: nanasess/setup-chromedriver@v2
  - run: chromedriver --version
```

### Specify ChromeDriver Version

If you need a specific version of ChromeDriver:

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: nanasess/setup-chromedriver@v2
    with:
      chromedriver-version: '131.0.6778.87'
  - run: chromedriver --version
```

### Custom Chrome Binary

If your Chrome binary has a custom name:

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: nanasess/setup-chromedriver@v2
    with:
      chromeapp: chrome-beta
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

      - uses: nanasess/setup-chromedriver@v2

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

      - uses: nanasess/setup-chromedriver@v2

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

      - uses: nanasess/setup-chromedriver@v2

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

      - uses: nanasess/setup-chromedriver@v2
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
4. ✅ Run tests with `yarn test`
5. 📝 Commit your changes (`git commit -m 'Add amazing feature'`)
6. 📤 Push to the branch (`git push origin feature/amazing-feature`)
7. 🔄 Open a Pull Request

### Development Setup

```bash
# Install dependencies
yarn install --frozen-lockfile

# Build the action
yarn build
yarn package

# Run tests
yarn test

# Format code
yarn format
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
