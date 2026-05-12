// Test stub for `server-only`.
// In production, `server-only` throws if imported in a client bundle.
// In the `node:test` runner there is no webpack bundler, so we replace
// the module with this no-op via the tsconfig.test.json `paths` override.
export {};
