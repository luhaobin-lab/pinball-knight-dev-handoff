import { describe, expect, it } from 'vitest';

/**
 * src/bot is shared by Node (tools/bot.mjs, worker threads) and the browser shell, so it is pure like src/core: no
 * randomness or clocks, no DOM or timers, erasable syntax only, and it imports only its own modules and `src/core/api`
 * types (WAVE_A A08).
 */
const sources = import.meta.glob<string>('../../src/bot/**/*.ts', { query: '?raw', import: 'default', eager: true });

const FORBIDDEN: [RegExp, string][] = [
  [/\bMath\.random\s*\(/, 'Math.random (use botRng)'],
  [/\bDate\.now\s*\(|\bnew Date\s*\(/, 'wall-clock time'],
  [/\bperformance\.now\s*\(/, 'performance.now'],
  [/\b(?:window|document|navigator|localStorage|globalThis|process)\b/, 'host globals'],
  [/\b(?:requestAnimationFrame|setTimeout|setInterval)\b/, 'timers'],
  [/\bimport\s*\(/, 'dynamic import'],
  [/^\s*(?:export\s+)?(?:const\s+)?enum\s/m, 'enum'],
  [/^\s*(?:export\s+)?(?:declare\s+)?namespace\s/m, 'namespace'],
  [/constructor\s*\([^)]*\b(?:public|private|protected|readonly)\s/, 'parameter property'],
];

const stripComments = (code: string): string => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

describe('src/bot purity', () => {
  it('finds the bot sources', () => {
    expect(Object.keys(sources).some(f => f.endsWith('/bot/runner.ts'))).toBe(true);
  });

  for (const [file, raw] of Object.entries(sources)) {
    it(`${file.replace('../../', '')} is pure and imports only bot modules and core/api types`, () => {
      const code = stripComments(raw);
      for (const [pattern, what] of FORBIDDEN) expect(pattern.test(code), `${what} in ${file}`).toBe(false);
      for (const m of code.matchAll(/^\s*(import|export)\s+(type\s+)?[^'"]*?from\s+['"]([^'"]+)['"]/gm)) {
        const [, , typeOnly, specifier] = m;
        expect(specifier!.endsWith('.ts'), `import "${specifier}" in ${file} needs the .ts extension`).toBe(true);
        const local = specifier!.startsWith('./');
        const api = /^\.\.\/core\/api\/[^/]+\.ts$/.test(specifier!);
        expect(local || (api && typeOnly !== undefined), `"${specifier}" in ${file}: only ./ modules and type imports of ../core/api`).toBe(true);
      }
    });
  }
});
