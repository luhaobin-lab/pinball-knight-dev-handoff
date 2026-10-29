import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const run = (root: string, ...args: string[]) => spawnSync(process.execPath, ['tools/train.mjs', ...args], {
  cwd: root, encoding: 'utf8', timeout: 60_000,
});
type Step = { name: string; command: string; block: boolean };
function plan(...args: string[]): Step[] {
  const r = run(ROOT, '--stage', 'train', '--phase', 't3', '--dry-run', ...args);
  expect(r.status, r.stderr).toBe(0);
  return JSON.parse(r.stdout).steps;
}
function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'coffin-train-'));
  mkdirSync(join(root, 'tools/bot'), { recursive: true });
  copyFileSync(join(ROOT, 'tools/train.mjs'), join(root, 'tools/train.mjs'));
  copyFileSync(join(ROOT, 'tools/bot/glob.mjs'), join(root, 'tools/bot/glob.mjs'));
  return root;
}

describe('merge-train regression gates', () => {
  it('uses 20 blocking determinism seeds for G2/t3 and retains the t2 warning probe', () => {
    const t3 = plan().find(s => s.name === 'bot-determinism')!;
    expect(t3.command).toContain('--determinism 20');
    expect(t3.block).toBe(true);
    const t2 = plan('--phase', 't2').find(s => s.name === 'bot-determinism')!;
    expect(t2.command).toContain('--determinism 10');
    expect(t2.block).toBe(false);
  });

  it('builds at the first selected capture, including skipped first/all screenshots', () => {
    for (const skip of ['', 'shots-title', 'shots-title,shots-map']) {
      const captures = plan('--screens', 'title,map', '--skip', skip)
        .filter(s => s.name.startsWith('shots-') || s.name === 'perf');
      expect(captures[0].command, skip).not.toContain('--nobuild');
      expect(captures.slice(1).every(s => s.command.includes('--nobuild')), skip).toBe(true);
    }
  });

  it('runs a fresh npm build, then creates one harness build reused by both captures and perf', () => {
    const root = fixture();
    try {
      writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts: {
        build: 'node capture-fixture.mjs build', shots: 'node capture-fixture.mjs shots', perf: 'node capture-fixture.mjs perf',
      } }));
      // The fixture preserves the actual two build contracts: npm build produces
      // dist only; a capture without --nobuild creates the harness cache.
      writeFileSync(join(root, 'capture-fixture.mjs'), `
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
const [kind, ...args] = process.argv.slice(2);
const events = existsSync('events.json') ? JSON.parse(readFileSync('events.json', 'utf8')) : [];
if (kind === 'build') { mkdirSync('dist'); writeFileSync('dist/index.html', 'vite build'); }
else if (!args.includes('--nobuild')) writeFileSync('capture-build.txt', String(process.pid));
const build = kind === 'build' ? null : readFileSync('capture-build.txt', 'utf8');
events.push({ kind, build, reuse: args.includes('--nobuild') });
writeFileSync('events.json', JSON.stringify(events));
`);
      const r = run(root, '--stage', 'train', '--phase', 't1', '--screens', 'title,map',
        '--skip', 'check,data-check,bot-fake,bot-smoke,golden', '--out', join(root, 'results'));
      expect(r.status, r.stdout + r.stderr).toBe(0);
      const events = JSON.parse(readFileSync(join(root, 'events.json'), 'utf8')) as { kind: string; build: string | null; reuse: boolean }[];
      expect(events.map(e => e.kind)).toEqual(['build', 'shots', 'shots', 'perf']);
      expect(events.map(e => e.reuse)).toEqual([false, false, true, true]);
      expect(events[1].build).toBeTruthy();
      expect(new Set(events.slice(1).map(e => e.build)).size).toBe(1);
    } finally { rmSync(root, { recursive: true, force: true }); }
  }, 60_000);

  it('checks Chinese paths on the requested candidate even with Git quotePath enabled', () => {
    const root = fixture();
    try {
      const git = (...args: string[]) => {
        const r = spawnSync('git', args, { cwd: root, encoding: 'utf8', timeout: 10_000 });
        expect(r.status, r.stderr).toBe(0);
        return r.stdout.trim();
      };
      git('init', '--initial-branch=main');
      git('config', 'user.name', 'Train fixture');
      git('config', 'user.email', 'train-fixture@local.invalid');
      git('config', 'core.quotePath', 'true');
      git('add', '.'); git('commit', '-qm', 'fixture baseline');
      git('checkout', '-qb', 'codex/candidate');
      mkdirSync(join(root, 'src/效果'), { recursive: true });
      writeFileSync(join(root, 'src/效果/药剂.ts'), 'export const value = 1;\n');
      git('add', '.'); git('commit', '-qm', 'Chinese candidate path');
      // HEAD is deliberately the unchanged main branch. The explicit candidate
      // must be checked, and the UTF-8 path must survive Git's normal quoting.
      git('checkout', '-q', 'main');
      const check = (paths: string) => run(root, '--stage', 'merge', '--phase', 't1', '--card', 'candidate',
        '--base', 'main', '--candidate', 'codex/candidate', '--paths', paths,
        '--skip', 'check,data-check,bot-fake,bot-smoke', '--out', join(root, 'results'));
      const owned = check('src/效果/**');
      expect(owned.status, owned.stdout + owned.stderr).toBe(0);
      expect(JSON.parse(owned.stdout).steps).toEqual([expect.objectContaining({ name: 'ownership', status: 'pass' })]);
      const outside = check('src/别的/**');
      expect(outside.status, outside.stdout + outside.stderr).toBe(1);
      expect(JSON.parse(outside.stdout).steps[0].tail).toContain('src/效果/药剂.ts');
    } finally { rmSync(root, { recursive: true, force: true }); }
  }, 60_000);
});
