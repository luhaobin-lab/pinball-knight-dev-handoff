// The node:fs and node:path calls these tests make (the project ships no @types/node; tests/ui-feel/node.d.ts
// declares existsSync and readFileSync).
declare module 'node:fs' {
  interface Dirent {
    readonly name: string;
    isDirectory(): boolean;
  }
  export function readdirSync(path: string, options: { withFileTypes: true }): Dirent[];
}
declare module 'node:path' {
  const path: {
    readonly sep: string;
    join(...parts: string[]): string;
    resolve(...parts: string[]): string;
    relative(from: string, to: string): string;
  };
  export default path;
}
