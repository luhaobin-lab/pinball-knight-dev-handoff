import { describe, expect, it } from 'vitest';

/**
 * tools/lib/*.ts run under Node's type stripping (imported by tools/golden.mjs and tools/review.mjs,
 * never bundled), so they may use only erasable TypeScript, no packages, and relative imports with an
 * explicit .ts extension.
 */
const sources = import.meta.glob<string>('../../tools/lib/*.ts', { query: '?raw', import: 'default', eager: true });

const NOT_ERASABLE: [RegExp, string][] = [
  [/^\s*(?:export\s+)?(?:const\s+)?enum\s/m, 'enum'],
  [/^\s*(?:export\s+)?(?:declare\s+)?namespace\s/m, 'namespace'],
  [/constructor\s*\([^)]*\b(?:public|private|protected|readonly)\s/, 'parameter property'],
  [/\bimport\s+\w+\s*=\s*require\(/, 'import = require'],
];

describe('tools/lib runs in Node directly', () => {
  it('finds the modules', () => {
    expect(Object.keys(sources).length).toBeGreaterThanOrEqual(6);
  });

  for (const [file, code] of Object.entries(sources)) {
    it(`${file.replace('../../', '')} uses erasable syntax and .ts imports`, () => {
      for (const [pattern, what] of NOT_ERASABLE) expect(pattern.test(code), `${what} in ${file}`).toBe(false);
      for (const [, specifier] of code.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) {
        expect(specifier.startsWith('./'), `"${specifier}" in ${file} is not a sibling module`).toBe(true);
        expect(specifier.endsWith('.ts'), `"${specifier}" in ${file} needs the .ts extension`).toBe(true);
      }
    });
  }
});
