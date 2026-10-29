// The Node calls the bot CLI tests make (the project ships no @types/node).
declare module 'node:child_process' {
  export function spawnSync(
    command: string,
    args: readonly string[],
    options: { cwd?: string; encoding: 'utf8'; timeout?: number },
  ): { status: number | null; stdout: string; stderr: string };
}
declare module 'node:fs' {
  export function mkdtempSync(prefix: string): string;
  export function rmSync(path: string, options?: { recursive?: boolean; force?: boolean }): void;
}
declare module 'node:os' {
  export function tmpdir(): string;
}
declare module 'node:path' {
  export function join(...parts: string[]): string;
}
declare const process: { readonly execPath: string; cwd(): string };
