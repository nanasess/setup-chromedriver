/**
 * Jest configuration (ESM).
 *
 * The project is ESM (`"type": "module"` in package.json) because
 * @actions/tool-cache >=4 and the rest of the toolkit are pure ESM. ts-jest
 * therefore runs in its ESM mode:
 *   - `useESM: true` makes ts-jest emit ES modules,
 *   - `extensionsToTreatAsEsm` marks .ts as ESM,
 *   - the moduleNameMapper strips the mandatory `.js` extension from relative
 *     specifiers so the TypeScript source (`./foo.ts`) is resolved.
 *
 * Run via `NODE_OPTIONS=--experimental-vm-modules` (set in the `test` script)
 * so Node's VM can evaluate the ES modules.
 *
 * @type {import('ts-jest').JestConfigWithTsJest}
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
    "^.+\\.ts$": ["ts-jest", { useESM: true }],
  },
  verbose: true,
};
