import { describe, expect, it } from 'vitest';
import { createGame } from '../../src/core/api/game';
import { registry } from '../../src/content/bp';
import { scriptedPolicy } from '../../src/bot/policies';
import { botRng } from '../../src/bot/rng';
import type { BotGame } from '../../src/bot/api';
import type { Command } from '../../src/core/api/commands';
import { LaunchTrajectoryLibrary } from '../../src/core/sys/launch/native';

function realRoom() {
  const g = createGame({ seed: 1, content: registry, filter: 'ported', debug: { skipPrologue: true } });
  for (const cmd of [{ type: 'title.newRun' }, { type: 'hero.start' }, { type: 'map.enter', cell: 'r1c0' }] as const) {
    g.runUntilInput(); expect(g.send(cmd).ok).toBe(true);
  }
  g.runUntilInput(); return g;
}

describe('ordinary core -> restored feel lifecycle', () => {
  it('emits successful start, actual finished contacts and exactly one rest; pure hovers emit none', () => {
    const g = realRoom(), h = g.view.hero!;
    const aims = Array.from({ length: 360 }, (_, d) => ({ x: h.position.x + Math.cos(d * Math.PI / 180) * 4096, y: h.position.y + Math.sin(d * Math.PI / 180) * 4096 }));
    const aim = aims.find(a => g.preview(a)?.legs.some(l => l.marker === 'wall'))!;
    expect(aim).toBeDefined();
    g.drainEvents(); const rng = g.world.rng.save(), before = g.digest();
    const preview = g.preview(aim)!;
    for (let i = 0; i < 10; i++) g.preview(aim);
    expect(g.digest()).toBe(before); expect(g.world.rng.save()).toEqual(rng); expect(g.drainEvents()).toEqual([]);
    expect(g.send({ type: 'aim.release', aim }).ok).toBe(true);
    const start = g.drainEvents().filter(e => e.kind === 'launch.start');
    expect(start).toHaveLength(1); expect(start[0]).toMatchObject({ hero: h.id, at: h.position, direction: { ...preview.legs[0]!.direction, z: 0 } });
    g.runUntilInput(); const events = g.drainEvents();
    const contacts = events.filter(e => e.kind === 'launch.contact');
    expect(contacts.length).toBeGreaterThan(0);
    expect(contacts.map(e => e.index)).toEqual(contacts.map((_, i) => i));
    expect(contacts.every(e => e.at && e.normal && e.speed! > 0)).toBe(true);
    expect(events.filter(e => e.kind === 'launch.end')).toHaveLength(1);
    LaunchTrajectoryLibrary.CancelLegacyLaunchLeg(g.world.mode.玩家角色!, g.world.mode);
    expect(g.drainEvents().some(e => e.kind === 'launch.end')).toBe(false);
  });

  it('source hit processing emits the actor assets at hit+30 with normalized XY, and has no gameplay/RNG side effects', () => {
    const g = realRoom(), hero = g.world.mode.玩家角色!;
    g.drainEvents(); const rng = g.world.rng.save(), health = { ...hero.当前生命 };
    hero.受击特效处理({ x: 100, y: 200, z: 56 }, { x: 3, y: 4, z: 8 }, '物理');
    expect(g.drainEvents()).toMatchObject([
      { kind: 'vfx', asset: hero.被击特效A, at: { x: 100, y: 200, z: 86 }, normal: { x: .6, y: .8, z: 0 }, attach: hero.id },
      { kind: 'vfx', asset: hero.被击特效B, at: { x: 100, y: 200, z: 86 }, attach: null },
    ]);
    expect(g.world.rng.save()).toEqual(rng); expect(hero.当前生命).toEqual(health);
  });

  it('a natural run delivers real enemy contact, exact hurt assets and corpse notification without synthetic damage', () => {
    const g = createGame({ seed: 6, content: registry, filter: 'ported', debug: { skipPrologue: true } });
    const policy = scriptedPolicy(), rng = botRng(6, 0), found = new Set<string>();
    for (let step = 0; step < 100; step++) {
      g.runUntilInput();
      for (const e of g.drainEvents()) {
        if (e.kind === 'launch.contact' && e.contact === 'enemy') found.add('contact');
        if (e.kind === 'vfx' && e.asset?.endsWith('/粒子_Hit_01')) found.add('spark');
        if (e.kind === 'vfx' && e.asset?.endsWith('/粒子_Blood_01')) found.add('spores');
        if (e.kind === 'ui' && e.widget === 'actor.corpse') found.add('corpse');
      }
      if (found.size === 4) break;
      const cmd = policy.choose({ game: g as unknown as BotGame, legal: g.legal(), rng, step });
      if (!cmd) break;
      expect(g.send(cmd as Command).ok).toBe(true);
    }
    expect([...found].sort()).toEqual(['contact', 'corpse', 'spark', 'spores']);
  }, 30_000);
});
