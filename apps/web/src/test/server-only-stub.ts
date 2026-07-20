// Test stub for `server-only`. It has no real npm package — Next.js injects it
// at build time to poison client bundles — so vitest can't resolve the bare
// specifier and any server module that `import 'server-only'` fails to transform.
// Aliased to this empty module in vitest.config.ts so those modules are unit-
// testable. Intentionally empty.
export {}
