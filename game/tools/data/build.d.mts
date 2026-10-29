// Types for build.mjs (used by tests/content-import).

/** The generated files (path relative to src/content/demo -> content) and the manifest written as manifest.json. */
export function buildDemoContent(dumpDir: string): { files: Map<string, string>; manifest: { totals: Record<string, number> } };
