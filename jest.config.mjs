/**
 * Jest configuration (ESM).
 *
 * The project is ESM (`"type": "module"` in package.json) because
 * @actions/tool-cache >=4 and the rest of the toolkit are pure ESM.
 *
 * `.ts` files are transformed by `jest-transform.cjs`, a zero-dependency
 * transformer built on Node's native `module.stripTypeScriptTypes()`. This
 * avoids ts-jest's dependency on the TypeScript programmatic API, which
 * TypeScript 7.0 (the Go-native compiler) no longer ships. Type-checking is
 * handled separately by `pnpm build` (tsc); the test transform only strips
 * types. `strip` mode preserves line/column positions, so no sourcemap is
 * needed for accurate stack traces.
 *
 *   - `extensionsToTreatAsEsm` marks .ts as ESM (the strip output stays ESM),
 *   - the moduleNameMapper strips the mandatory `.js` extension from relative
 *     specifiers so the TypeScript source (`./foo.ts`) is resolved.
 *
 * Run with `--experimental-vm-modules` (set in the `test` script) so Node's VM
 * can evaluate the ES modules.
 *
 * @type {import('jest').Config}
 */
export default {
  clearMocks: true,
  testEnvironment: "node",
  testMatch: ["**/*.test.ts"],
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.ts$": "<rootDir>/jest-transform.cjs",
  },
  verbose: true,
};
