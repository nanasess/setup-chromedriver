# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is the setup-chromedriver GitHub Action repository that sets up ChromeDriver for use in GitHub Actions workflows. It supports Ubuntu, macOS, and Windows platforms.

## Commands

This project uses **pnpm** (pinned via the `packageManager` field in
`package.json`). Enable it with `corepack enable`. pnpm is chosen for
supply-chain hardening: install-time build scripts are blocked by default
(`allowBuilds` in `pnpm-workspace.yaml`) and freshly published versions are
held back by a cooldown (`minimumReleaseAge`).

### Build and Development
- `pnpm install --frozen-lockfile` - Install dependencies
- `pnpm build` - Build TypeScript files (compiles src/ to lib/)
- `pnpm package` - Package the action using ncc (creates dist/index.js)
- `pnpm format` - Format code with Prettier
- `pnpm format-check` - Check code formatting
- `pnpm test` - Run Jest tests

### Running a Single Test
```bash
pnpm test path/to/test.ts
# or
pnpm jest path/to/test.ts
```

## Architecture

The installation logic is implemented natively in TypeScript (no shell-out to
`setup-chromedriver.sh` / `.ps1`). The action follows this execution flow:

1. **Entry Point**: `dist/index.js` (the `ncc` bundle of the compiled TypeScript)
2. **Main Logic**: `src/setup-chromedriver.ts` - reads inputs, detects the
   platform/arch, then calls the appropriate native installer
   (`installOnUnix` / `installOnWindows`)
3. **Installer modules** (`src/installer/`):
   - `http.ts` - `fetchText` / `fetchJson` via typed-rest-client (curl-like retry/fail/redirect)
   - `download.ts` - `downloadAndExtractZip` via `@actions/tool-cache`
   - `version.ts` - Chrome version detection + Chrome-for-Testing JSON resolution with fallback
   - `unix.ts` - Linux/macOS install (apt dependency setup via `@actions/exec`, legacy/modern split)
   - `windows.ts` - Windows install (FileVersion detection, legacy/modern split)

### Key Components

- **src/setup-chromedriver.ts**: Entry point that:
  - Reads input parameters (`chromedriver-version` and `chromeapp`)
  - Detects the platform (win32, darwin, linux) and maps the arch
  - Calls `installOnUnix` (Linux/macOS) or `installOnWindows` (Windows)
- **src/chromedriver-helper.ts**: Pure helper functions (version parsing,
  API/URL selection, JSON extraction, fallback, default paths) reused by the
  installer modules. Covered by unit + shell-equivalence tests.
- **src/installer/\*.ts**: The native installation layer described above.
- **lib/setup-chromedriver.sh** / **lib/setup-chromedriver.ps1**: The legacy
  shell/PowerShell implementations. These are **no longer on the execution
  path** but are retained for one release cycle as an emergency rollback option.

Behavioral parity with the original shell scripts is a hard requirement: install
locations (`/usr/local/bin/chromedriver`, `C:\SeleniumWebDrivers\ChromeDriver`)
are unchanged, and no `core.addPath` is added (the implicit PATH resolution via
the well-known install directory is preserved).

### Build Process

1. TypeScript compilation: `src/*.ts` → `lib/*.js` (`pnpm build`, tsc)
2. Packaging: `lib/setup-chromedriver.js` → `dist/index.js` (`pnpm package`, ncc; includes all dependencies)

`lib/` and `dist/` are committed artifacts and must be kept in sync with `src/`:
after changing any `src/**/*.ts`, re-run `pnpm build` and `pnpm package` and
commit the regenerated `lib/` and `dist/index.js`.

The action uses GitHub Actions toolkit libraries (@actions/core, @actions/exec, @actions/io, @actions/tool-cache, etc.) for integration with the GitHub Actions environment.