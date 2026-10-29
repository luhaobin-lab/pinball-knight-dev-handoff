import { describe, expect, it, vi } from 'vitest';
import { combatFixture } from '../fixtures/index.ts';
import type { RoomPlan } from '../../src/core/api/view.ts';
import { 蓝图_可拾取物_尖刺 } from '../../src/content/bp/Skill/效果/可拾取物/蓝图_可拾取物_尖刺.ts';
import { moveEffectOverlaps } from '../../src/core/sys/physics/boss-overlap.ts';
import { 科学数变普通 } from '../../src/core/math/sci.ts';
import { 蓝图_效果_电击球 } from '../../src/content/bp/Skill/效果/物品/蓝图_效果_电击球.ts';
import { simulateEffectSphere, impulseEffectSphere, effectSphereState } from '../../src/core/sys/physics/effect-body.ts';

/** Deliberate simple geometry boundary. Actual spawned Box and actor collision/lifecycle run unchanged. */
function boundary(solids: RoomPlan['solids'] = []) {
  const f = combatFixture();
  const cells: [number, number][] = []; for (let x = -8; x < 8; x++) for (let y = -8; y < 8; y++) cells.push([x, y]);
  const room: RoomPlan = { layout: 'BoxBoundaryFixture', variant: 0, cols: 16, rows: 16, cells, tile: 64,
    origin: { x: 0, y: 0 }, solids, decorations: [], spawns: [], task: null, playerSpawn: { x: -400, y: -400, z: 56 }, background: null };
  vi.spyOn(f.world.sys.room, 'view').mockReturnValue({ room });
  f.hero.K2_SetActorLocation({ x: -400, y: -400, z: 56 });
  return f;
}
describe('source spike Box body boundaries', () => {
  it('mass.5 converts impulse100 to velocity200, locks Z, and only weak timers remain after rest', () => {
    const f = boundary(), s = f.world.spawn(蓝图_可拾取物_尖刺, undefined, { x: 0, y: 0, z: 0 });
    s.加冲量({ x: 100, y: 0, z: 999 });
    expect((s as typeof s & { ug_pickupBox: { vx: number } }).ug_pickupBox.vx).toBe(200);
    f.world.clock.advance(1 / 120); expect(s.K2_GetActorLocation().x).toBeGreaterThan(1.6); expect(s.K2_GetActorLocation().z).toBe(0);
    f.world.clock.advance(1); const p = s.K2_GetActorLocation(); f.world.clock.advance(1); expect(s.K2_GetActorLocation()).toEqual(p);
    expect(f.world.scheduler.runUntil(() => false, 1)).toBe('idle');
  });
  it('actual moving square hits a wall at centreX=42 and bounces instead of crossing', () => {
    const f = boundary([{ kind: 'box', at: { x: 60, y: 0, z: 0 }, half: { x: 10, y: 100 }, tags: [] }]);
    const s = f.world.spawn(蓝图_可拾取物_尖刺, undefined, { x: 30, y: 0, z: 0 }); s.加冲量({ x: 100, y: 0, z: 0 });
    const seen: number[] = []; for (let i = 0; i < 40; i++) { f.world.clock.advance(1 / 120); seen.push(s.K2_GetActorLocation().x); }
    expect(Math.max(...seen)).toBeLessThanOrEqual(42); expect(Math.max(...seen)).toBeGreaterThan(40);
    expect(seen.at(-1)).toBeLessThan(30);
  });
  it('a circular pillar sees the square corner, not a radius8 substitute', () => {
    // Circle centre(30,30),r10; along diagonal square corner touches at centre22-10/sqrt2=14.9289.
    const f = boundary([{ kind: 'circle', at: { x: 30, y: 30, z: 0 }, radius: 10, tags: [] }]);
    const s = f.world.spawn(蓝图_可拾取物_尖刺, undefined, { x: 10, y: 10, z: 0 }); s.加冲量({ x: 80, y: 80, z: 0 });
    const seen: number[] = []; for (let i = 0; i < 24; i++) { f.world.clock.advance(1 / 120); seen.push(s.K2_GetActorLocation().x); }
    expect(Math.max(...seen)).toBeLessThanOrEqual(22 - 10 / Math.SQRT2 + 1e-8);
    expect(Math.max(...seen)).toBeGreaterThan(14); expect(seen.at(-1)).toBeLessThan(10);
  });
  it('query exposes square corners and Pawn touch, while Visibility ignores the component', () => {
    const f = boundary(), s = f.world.spawn(蓝图_可拾取物_尖刺, undefined, { x: 0, y: 0, z: 0 });
    expect(f.world.trace.sphere({ x: 7, y: 7, z: 0 }, { x: 7, y: 7, z: 0 }, .1, 'Pawn').find(h => h.actor === s)?.blockingHit).toBe(false);
    expect(f.world.trace.line({ x: -20, y: 7, z: 0 }, { x: 20, y: 7, z: 0 }, '可伤害')?.actor).toBe(s);
    expect(f.world.trace.line({ x: -20, y: 7, z: 0 }, { x: 20, y: 7, z: 0 }, 'Visibility')).toBe(null);
  });
  it('arming in an existing overlap does not create another BeginOverlap; exit/reentry consumes once', () => {
    const f = boundary(), p = { x: 0, y: 0, z: 56 }; f.hero.K2_SetActorLocation(p);
    const s = f.world.spawn(蓝图_可拾取物_尖刺, undefined, { x: 0, y: 0, z: 0 });
    f.world.clock.advance(.31); const mana = 科学数变普通(f.hero.当前魔力);
    moveEffectOverlaps(f.world, f.hero, p, p); expect(s.valid).toBe(true);
    const away = { x: 200, y: 0, z: 56 }; f.hero.K2_SetActorLocation(away); moveEffectOverlaps(f.world, f.hero, p, away);
    f.hero.K2_SetActorLocation(p); moveEffectOverlaps(f.world, f.hero, away, p); expect(s.valid).toBe(false);
    expect(科学数变普通(f.hero.当前魔力)).toBeCloseTo(mana - 1);
    moveEffectOverlaps(f.world, f.hero, away, p); expect(科学数变普通(f.hero.当前魔力)).toBeCloseTo(mana - 1);
  });
  it('electric sphere respects its source Vehicle overlap instead of treating the spike as a static blocker', () => {
    const f = boundary(), s = f.world.spawn(蓝图_可拾取物_尖刺, undefined, { x: 0, y: 0, z: 0 });
    const ball = f.world.spawn(蓝图_效果_电击球, undefined, { x: -50, y: 0, z: 0 });
    simulateEffectSphere(ball, true); impulseEffectSphere(ball, { x: 12000, y: 0, z: 0 });
    f.world.clock.advance(.5); expect(ball.K2_GetActorLocation().x).toBeGreaterThan(0); expect(effectSphereState(ball)?.vx).toBeGreaterThan(0);
    expect(s.K2_GetActorLocation()).toEqual({ x: 0, y: 0, z: 0 });
  });
});
