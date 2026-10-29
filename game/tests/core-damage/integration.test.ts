/**
 * The pipeline on the real runtime (core-sim world, core-ability lifecycle, Demo rows through combatFixture): the hero
 * hits a 眼球 from 数据表_敌人_普通 until it dies; 受伤 lives 0.2 s and reopens the contact gate.
 */
import { describe, expect, it } from 'vitest';
import { combatFixture } from '../fixtures/index.ts';
import { n } from './harness.ts';

describe('core-damage on the real runtime', () => {
  it('hit → 受伤 0.2 s → gate reopens; the kill reaches 角色死亡 and the death log', () => {
    const f = combatFixture({ hero: '幽冥骑士', enemies: ['眼球'], seed: 1 });
    const eye = f.enemies[0];
    const hp0 = n(eye.当前生命);
    expect(hp0).toBe(30);
    f.hit({ from: f.hero, to: eye, amount: 10, type: '物理', source: '攻击' });
    expect(n(eye.当前生命)).toBe(20);
    expect(eye.受伤中).toBe(true);
    f.world.clock.advance(0.25);
    expect(eye.受伤中).toBe(false);
    expect(eye.拥有的效果.some(e => e?.valid && e.def.name === '蓝图_效果_受伤')).toBe(false);
    f.hit({ from: f.hero, to: eye, amount: 25, type: '物理', source: '攻击' });
    expect(eye.死掉了).toBe(true);
    const logs = f.world.events.drain().filter(e => e.kind === 'log').map(e => (e as { rich: string }).rich);
    expect(logs.some(l => /死掉了。（<经验>\+\d+经验<\/>）/.test(l))).toBe(true);
  });
});
