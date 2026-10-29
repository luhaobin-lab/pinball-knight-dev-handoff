import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { registry } from '../../src/content/bp/index.ts';
import { createGame } from '../../src/core/api/game.ts';
import type { BotGame } from '../../src/bot/api.ts';
import { aggregateCoverage, buildReport } from '../../src/bot/metrics.ts';
import { playRun } from '../../src/bot/runner.ts';

const EMPTY = 'CatapultHero/BP/Skill/Ability/道具/蓝图_能力_空';
const UNREACHED = 'CatapultHero/BP/Skill/Ability/道具/蓝图_能力_恢复生命和强固';

function readCoverage(file: string): { classes: { path: string; ported: boolean; hits: number; stubHits: number }[] } {
  const r = spawnSync(process.execPath, ['tools/bp/coverage.mjs', '--report', file, '--card', 'core-inventory', '--json'],
    { cwd: process.cwd(), encoding: 'utf8', timeout: 15_000 });
  expect(r.status, r.stderr).toBe(0);
  return JSON.parse(r.stdout);
}

describe('real game coverage reaches the bot report and blueprint coverage tool', () => {
  it('counts actual spawns through createGame, runner and report without crediting untouched registered classes', () => {
    const game = createGame({ seed: 77, content: registry, debug: { skipPrologue: true } });
    expect(game.coverage.classesHit).toEqual(game.world.counters.report().classes);
    expect(Object.keys(game.coverage.classesHit).length).toBeGreaterThan(0); // actual boot singletons
    expect(registry.get(EMPTY)).toBeDefined();
    expect(registry.get(UNREACHED)).toBeDefined();
    expect(game.coverage.classesHit[EMPTY]).toBeUndefined();
    expect(game.coverage.classesHit[UNREACHED]).toBeUndefined();
    game.world.spawn(EMPTY);
    game.world.spawn(EMPTY);
    expect(game.coverage.classesHit[EMPTY]).toBe(2);

    // A bounded real-core probe. This measures instrumentation, not a successful
    // full game loop: the earlier-stage core may reject the title command.
    const record = playRun(() => game as unknown as BotGame, { seed: 77, policy: 'scripted', maxCommands: 1 });
    const report = buildReport([record], { seed: 77, policy: 'scripted' });
    expect(report.coverage.classes).toContain(EMPTY);
    expect(report.coverage.classesHit).toBe(report.coverage.classes.length);
    expect(report.coverage.classCounts).toContainEqual({ path: EMPTY, count: 2 });
    expect(report.coverage.classes).not.toContain(UNREACHED);

    const dir = mkdtempSync(join(tmpdir(), 'coffin-real-coverage-'));
    try {
      const file = join(dir, 'report.json');
      writeFileSync(file, JSON.stringify(report));
      const result = readCoverage(file);
      expect(result.classes.find(c => c.path === EMPTY)).toMatchObject({ ported: true, hits: 2, stubHits: 0 });
      expect(result.classes.find(c => c.path === UNREACHED)).toMatchObject({ ported: true, hits: 0, stubHits: 0 });
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });

  it('still reads old summary lists, old hit arrays and direct API count records', () => {
    const dir = mkdtempSync(join(tmpdir(), 'coffin-legacy-coverage-'));
    try {
      const variants = [
        { data: { classesHit: 1, classes: [EMPTY] }, count: 1 },
        { data: { classesHit: [{ path: EMPTY, count: 3 }] }, count: 3 },
        { data: { classesHit: { [EMPTY]: 4 } }, count: 4 },
      ];
      for (const { data, count } of variants) {
        const file = join(dir, 'report.json');
        writeFileSync(file, JSON.stringify({ coverage: data }));
        expect(readCoverage(file).classes.find(c => c.path === EMPTY)?.hits).toBe(count);
        expect(aggregateCoverage([data]).classCounts).toContainEqual({ path: EMPTY, count });
      }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
});
