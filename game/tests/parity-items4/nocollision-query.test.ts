import { expect, it } from 'vitest';
import { fixture } from '../parity-items/fixture.ts';

it('source 关闭碰撞 removes an actor from world queries until 开启碰撞', () => {
  const f = fixture(), enemy = f.enemies[0], at = enemy.K2_GetActorLocation();
  const query = () => f.w.trace.sphere(at, { ...at, x: at.x + 1 }, 4, 'Pawn', [f.hero]).some(h => h.actor === enemy);
  expect(query()).toBe(true); enemy.关闭碰撞(); expect(query()).toBe(false); enemy.开启碰撞(); expect(query()).toBe(true);
});
