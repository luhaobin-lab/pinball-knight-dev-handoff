import { describe, expect, it } from 'vitest';

/**
 * Hard rule 3 (studio/AGENT_GUIDE.md): src/core and src/content are pure and deterministic, and
 * stay runnable by Node directly (tools/bot.mjs), so: no randomness or clocks, no DOM, no three.js,
 * no packages, and relative imports carry an explicit .ts extension.
 */
const sources = import.meta.glob<string>(['../../src/core/**/*.ts', '../../src/content/**/*.ts'], { query: '?raw', import: 'default', eager: true });

const FORBIDDEN: [RegExp, string][] = [
  [/\bMath\.random\s*\(/, 'Math.random (use createRng from src/core/rng.ts)'],
  [/\bDate\.now\s*\(|\bnew Date\s*\(/, 'wall-clock time'],
  [/\bperformance\.now\s*\(/, 'performance.now'],
  [/\b(?:window|document|navigator|localStorage|globalThis)\b/, 'browser globals'],
  [/\b(?:requestAnimationFrame|setTimeout|setInterval)\b/, 'timers'],
  [/\bimport\s*\(/, 'dynamic import'],
];

const stripComments = (code: string): string => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('src/core purity', () => {
  it('finds the core sources', () => {
    expect(Object.keys(sources).some(file => file.endsWith('/core/rng.ts'))).toBe(true);
  });

  for (const [file, raw] of Object.entries(sources)) {
    it(`${file.replace('../../', '')} uses no forbidden APIs or imports`, () => {
      const code = stripComments(raw);
      for (const [pattern, what] of FORBIDDEN) expect(pattern.test(code), `${what} in ${file}`).toBe(false);
      for (const [, specifier] of code.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) {
        expect(specifier.startsWith('.'), `package import "${specifier}" in ${file}`).toBe(true);
        expect(specifier.endsWith('.ts'), `import "${specifier}" in ${file} needs the .ts extension`).toBe(true);
      }
    });
  }
});
