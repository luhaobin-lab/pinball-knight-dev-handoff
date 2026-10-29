import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { scopedClasses } from '../../src/content/demo/reachable.ts';
import { assignOwners, compareOwners } from '../../tools/bp/batches.mjs';
import { computeReach } from '../../tools/data/reach.mjs';

// tools/bp/batches.mjs: every scoped class has exactly one owner card, and the map equals the planner's owners.json.

const DUMP = 'D:/TAPTAPGAME_codex/reference/dump';
const OWNERS = 'D:/TAPTAPGAME_codex/studio/legacy/tmp/step0/scripts/owners.json';

describe.skipIf(!fs.existsSync(`${DUMP}/blueprints-pseudo`))('bp owners', () => {
  const reach = computeReach(DUMP);
  const owners = assignOwners(reach);

  it('recomputes reachable.ts', () => {
    expect(reach.scoped).toEqual([...scopedClasses]);
  });

  it('assigns each scoped class to exactly one card', () => {
    const short = scopedClasses.map(a => a.slice('CatapultHero/BP/Skill/'.length));
    expect(Object.keys(owners.owner).sort()).toEqual([...short].sort());
    const listed = Object.values(owners.cards).flat();
    expect(listed).toHaveLength(short.length);
    expect(new Set(listed).size).toBe(short.length);
    expect(Object.keys(owners.cards)).toHaveLength(33);
    expect(Object.values(owners.lines).reduce((a, b) => a + b, 0)).toBe(53555);
  });

  it.skipIf(!fs.existsSync(OWNERS))("matches the planner's owners.json", () => {
    const planner = JSON.parse(fs.readFileSync(OWNERS, 'utf8')) as { owner: Record<string, string> };
    expect(compareOwners(owners.owner, planner.owner)).toEqual([]);
  });
});
