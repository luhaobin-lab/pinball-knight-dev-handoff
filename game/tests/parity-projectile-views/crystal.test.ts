import { it, expect } from 'vitest';
import { ProjectileStage } from '../../src/game/room/projectiles';
import { roomFrame } from '../../src/game/room/build';
it('crystal source projectile has a distinct shard at actual positions and retires only from source stop/view', () => {
  const s = new ProjectileStage(roomFrame({ cols: 5, rows: 7, tile: 64 } as never));
  const p = { id: 1, cls: 'CatapultHero/BP/Skill/发射物/蓝图_发射物_晶刺', position: { x: 64, y: 128, z: 5 },
    velocity: { x: 2000, y: 0, z: 0 }, radius: 24, active: true, stopped: false, startedAt: 0 };
  s.sync([p], .1); expect(s.group.userData).toMatchObject({ projectiles: 1, visibleSprites: 1, unmapped: [] });
  s.sync([{ ...p, position: { x: 96, y: 128, z: 5 }, active: false, stopped: true, stoppedAt: .2 }], .3);
  expect(s.group.userData.visibleSprites).toBe(1);
  s.sync([{ ...p, active: false, stopped: true, stoppedAt: .2 }], .7);
  expect(s.group.userData.visibleSprites).toBe(0); expect(s.group.userData.projectiles).toBe(1);
  s.sync([], 3); expect(s.group.userData.projectiles).toBe(0); s.dispose();
});
