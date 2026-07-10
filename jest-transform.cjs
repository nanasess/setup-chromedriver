// Jest transformer: TypeScript 型ストリップ (依存ゼロ)。
//
// TypeScript 7.0 (Go ネイティブ実装) は programmatic API を同梱しないため、
// ts.transpileModule() に依存する ts-jest は 7.0 で動作しない。本 transformer
// は Node 標準の `node:module.stripTypeScriptTypes()` (Node 22.18+/24) だけで
// .ts を JS に変換し、TypeScript のバージョンにも programmatic API にも一切
// 依存しない。型チェックは `pnpm build` (tsc) が担うため、テスト時の変換は
// 型消去のみで十分。
//
// `mode: "strip"` は型注釈を空白へ置換して行・列位置を保持するため、
// sourcemap 不要でスタックトレースがそのまま元ソースに対応する。enum /
// namespace / パラメータプロパティ等のコード生成を要する構文は strip では
// 扱えないが、本リポジトリの src・__tests__ には存在しない (移行時に確認済み)。

const { stripTypeScriptTypes } = require("node:module");

module.exports = {
  process(sourceText, sourcePath) {
    const code = stripTypeScriptTypes(sourceText, {
      mode: "strip",
      sourceUrl: sourcePath,
    });
    return { code };
  },
};
