import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import inventory from '../../src/content/bp/batches/core-inventory.ts';

function ported(root: string): Set<string> {
  const r = spawnSync(process.execPath, ['--input-type=module', '-e',
    "import { portedClasses } from './tools/bp/coverage.mjs'; process.stdout.write(JSON.stringify([...portedClasses(process.argv[1])]));", root],
  { cwd: process.cwd(), encoding: 'utf8', timeout: 10_000 });
  expect(r.status, r.stderr).toBe(0);
  return new Set(JSON.parse(r.stdout) as string[]);
}

describe('ported class coverage', () => {
  it('recognizes typed and untyped paths but still requires a batch import for content classes', () => {
    const root = mkdtempSync(join(tmpdir(), 'coffin-coverage-'));
    try {
      mkdirSync(join(root, 'src/content/bp/batches'), { recursive: true });
      mkdirSync(join(root, 'src/core'), { recursive: true });
      writeFileSync(join(root, 'src/content/bp/typed.ts'), "export class Typed { static override readonly path: AssetPath = 'Demo/typed'; }");
      writeFileSync(join(root, 'src/content/bp/untyped.ts'), 'export class Untyped { static readonly path = "Demo/untyped"; }');
      writeFileSync(join(root, 'src/content/bp/unregistered.ts'), "export class Missing { static override readonly path: AssetPath = 'Demo/not-registered'; }");
      writeFileSync(join(root, 'src/core/base.ts'), "export class Base { static readonly path: AssetPath = 'Demo/base'; }");
      writeFileSync(join(root, 'src/content/bp/batches/fixture.ts'), "import { Typed } from '../typed.ts';\nimport { Untyped } from '../untyped.ts';\nexport default [Typed, Untyped];\n");
      expect([...ported(root)].sort()).toEqual(['Demo/base', 'Demo/typed', 'Demo/untyped']);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  it('counts every real core-inventory class that the runtime batch registers', () => {
    expect(inventory).toHaveLength(6);
    const measured = ported(process.cwd());
    expect(inventory.filter(cls => !measured.has(cls.path)).map(cls => cls.path)).toEqual([]);
  });
});
