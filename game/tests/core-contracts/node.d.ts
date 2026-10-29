// The node calls the generator test makes (the project ships no @types/node); merges with tests/ui-feel/node.d.ts.
declare module 'node:fs' {
  export function copyFileSync(from: string, to: string): void;
  export function mkdirSync(path: string, options?: { recursive?: boolean }): string | undefined;
  export function mkdtempSync(prefix: string): string;
  export function rmSync(path: string, options?: { recursive?: boolean; force?: boolean }): void;
  export function writeFileSync(path: string, data: string): void;
}
declare module 'node:os' {
  export function tmpdir(): string;
}
