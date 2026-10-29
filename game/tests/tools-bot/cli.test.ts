import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { globRegExp } from '../../tools/bot/glob.mjs';
import { FAKE_SEEDS } from '../../tools/bot/fake-game.mjs';

const ROOT = process.cwd();
const node = (args: string[]) =>
  spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', ...args], { cwd: ROOT, encoding: 'utf8', timeout: 120_000 });
const json = (stdout: string) => JSON.parse(stdout.trim().split('\n').at(-1)!);

describe('npm run bot', () => {
  it('plays 1000 fake runs on 18 workers in under 30 s and names the bad seeds', () => {
    const out = mkdtempSync(join(tmpdir(), 'tools-bot-'));
    try {
      const t0 = performance.now();
      const r = node(['tools/bot.mjs', '--game', 'fake', '--runs', '1000', '--workers', '18', '--out', out]);
      const seconds = (performance.now() - t0) / 1000;
      expect(r.status, r.stderr).toBe(1);
      const summary = json(r.stdout);
      expect(summary.runs).toBe(1000);
      expect(summary.seconds).toBeLessThan(30);
      expect(seconds).toBeLessThan(30);
      expect(summary.crashes).toBe(1);
      expect(summary.softlocks).toBe(1);
      const report = JSON.parse(readFileSync(join(out, 'report.json'), 'utf8'));
      const bySeed = Object.fromEntries(report.errors.map((e: { seed: number; kind: string }) => [e.seed, e]));
      expect(bySeed[FAKE_SEEDS.crashSeed].kind).toBe('crash');
      expect(bySeed[FAKE_SEEDS.crashSeed].commandLog.length).toBeGreaterThan(0);
      expect(bySeed[FAKE_SEEDS.softlockSeed].kind).toBe('softlock');
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  }, 60_000);

  it('--determinism finds the nondeterministic seed', () => {
    const out = mkdtempSync(join(tmpdir(), 'tools-bot-'));
    try {
      const r = node(['tools/bot.mjs', '--game', 'fake', '--determinism', '30', '--workers', '6', '--out', out]);
      const summary = json(r.stdout);
      expect(summary.determinism).toEqual({ seeds: 30, equal: 29, completed: 30, incomplete: 0 });
      expect(summary.errors).toEqual([expect.objectContaining({ seed: FAKE_SEEDS.flakySeed, kind: 'determinism' })]);
      expect(r.status).toBe(1);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  }, 60_000);

  it('a determinism-only failure exits 1 even when ordinary run error counters are zero', () => {
    const out = mkdtempSync(join(tmpdir(), 'tools-bot-det-exit-'));
    try {
      const r = node(['tools/bot.mjs', '--game', 'fake', '--determinism', '1', '--seed', String(FAKE_SEEDS.flakySeed), '--workers', '1', '--out', out]);
      expect(json(r.stdout)).toMatchObject({ runs: 0, crashes: 0, softlocks: 0, timeouts: 0, determinism: { seeds: 1, equal: 0 } });
      expect(r.status, r.stdout + r.stderr).toBe(1);
    } finally { rmSync(out, { recursive: true, force: true }); }
  }, 60_000);

  it('exits 0 on clean seeds and 2 on bad usage', () => {
    const out = mkdtempSync(join(tmpdir(), 'tools-bot-'));
    try {
      expect(node(['tools/bot.mjs', '--game', 'fake', '--runs', '50', '--seed', '1000', '--workers', '4', '--out', out]).status).toBe(0);
      expect(node(['tools/bot.mjs', '--policy', 'nope']).status).toBe(2);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  }, 60_000);

  const real = existsSync(join(ROOT, 'src/core/api/game.ts')) && existsSync(join(ROOT, 'src/content/bp/index.ts'));
  it.skipIf(!real)('the real createGame runs to the title and stops cleanly', () => {
    const r = node(['tools/bot.mjs', '--smoke']);
    expect(r.status, r.stdout + r.stderr).toBe(0);
    expect(json(r.stdout)).toMatchObject({ ok: true, screen: 'title' });
  }, 60_000);
});

describe('tools/train.mjs', () => {
  it('--dry-run prints the planned steps of each stage and phase', () => {
    const plan = (...args: string[]) => {
      const r = node(['tools/train.mjs', '--dry-run', ...args]);
      expect(r.status, r.stderr).toBe(0);
      return JSON.parse(r.stdout) as { steps: { name: string; block: boolean }[] };
    };
    expect(plan('--stage', 'merge', '--phase', 't1').steps.map(s => s.name)).toEqual(['check', 'data-check', 'bot-fake', 'bot-smoke']);
    const t2 = plan('--stage', 'merge', '--phase', 't2', '--card', 'core-map', '--paths', 'src/core/sys/map/**');
    expect(t2.steps.map(s => s.name)).toEqual(['check', 'data-check', 'ownership', 'bot-runs', 'bot-determinism']);
    expect(t2.steps.filter(s => s.name.startsWith('bot-')).every(s => !s.block)).toBe(true);
    const t3 = plan('--stage', 'train', '--phase', 't3', '--skip', 'golden');
    expect(t3.steps.map(s => s.name)).toEqual(expect.arrayContaining(['bot-1000', 'build', 'shots-title', 'shots-runEnd', 'perf']));
    expect(t3.steps.find(s => s.name === 'bot-runs')?.block).toBe(true);
    expect(t3.steps.some(s => s.name === 'golden')).toBe(false);
  });

  it('matches card path globs', () => {
    const owned = (glob: string, path: string) => globRegExp(glob).test(path);
    expect(owned('tools/bot/**', 'tools/bot/fake-game.mjs')).toBe(true);
    expect(owned('src/core/sys/{map,room}/**', 'src/core/sys/room/plan.ts')).toBe(true);
    expect(owned('src/core/sys/{map,room}/**', 'src/core/sys/turn/index.ts')).toBe(false);
    expect(owned('tools/bot*', 'tools/bot.mjs')).toBe(true);
    expect(owned('tools/bot*', 'tools/bot/pool.mjs')).toBe(false);
    expect(owned('src/ui/pages/{map,loot}/**', 'src/ui/pages/loot/page.ts')).toBe(true);
  });
});
