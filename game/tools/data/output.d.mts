// Types for output.mjs (used by tests/content-import).

export const DEMO_DIR: string;
export function compareGenerated(files: Map<string, string>, dir?: string): { changed: string[]; stale: string[] };
export function writeGenerated(files: Map<string, string>, diff: { changed: string[]; stale: string[] }, dir?: string): void;
