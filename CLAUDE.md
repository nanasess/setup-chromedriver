# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is the setup-chromedriver GitHub Action repository that sets up ChromeDriver for use in GitHub Actions workflows. It supports Ubuntu, macOS, and Windows platforms.

## Commands

### Build and Development
- `yarn install --frozen-lockfile` - Install dependencies
- `yarn build` - Build TypeScript files (compiles src/ to lib/)
- `yarn package` - Package the action using ncc (creates dist/index.js)
- `yarn format` - Format code with Prettier
- `yarn format-check` - Check code formatting
- `yarn test` - Run Jest tests

### Running a Single Test
```bash
yarn test path/to/test.ts
# or
jest path/to/test.ts
```

## Architecture

The action follows this execution flow:

1. **Entry Point**: `dist/index.js` (packaged version of the compiled TypeScript)
2. **Main Logic**: `src/setup-chromedriver.ts` - Determines the platform and executes the appropriate setup script
3. **Platform-Specific Scripts**:
   - Linux/macOS: `lib/setup-chromedriver.sh`
   - Windows: `lib/setup-chromedriver.ps1`

### Key Components

- **src/setup-chromedriver.ts**: Main TypeScript file that:
  - Reads input parameters (`chromedriver-version` and `chromeapp`)
  - Detects the platform (win32, darwin, linux)
  - Executes the appropriate shell script with parameters

- **lib/setup-chromedriver.sh**: Bash script for Linux/macOS that handles downloading and installing ChromeDriver
- **lib/setup-chromedriver.ps1**: PowerShell script for Windows ChromeDriver setup

### Build Process

1. TypeScript compilation: `src/*.ts` → `lib/*.js`
2. Packaging: `lib/setup-chromedriver.js` → `dist/index.js` (includes all dependencies)

The action uses GitHub Actions toolkit libraries (@actions/core, @actions/exec, etc.) for integration with the GitHub Actions environment.