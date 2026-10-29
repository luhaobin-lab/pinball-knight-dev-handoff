import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { baseView } from '../../src/core/api/game';
import type { GameView } from '../../src/game/api';
import type { PixelRenderer } from '../../src/render/api';
import { Cues, type CueTarget } from '../../src/game/cues';
import handlers from '../../src/game/cues/launch-feel';

vi.mock('../../src/procgen/architecture/room', () => ({
  buildRoom: () => ({ group: new THREE.Group(), lights: [], update() {}, setFires() {}, dispose() {} }),
}));
vi.mock('../../src/procgen/creatures/shapes', async importOriginal => ({
  ...await importOriginal<typeof import('../../src/procgen/creatures/shapes')>(),
  // Canvas-only glow texture allocation is irrelevant to the real meshes' reaction clocks under test.
  glowCard: () => new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial()),
}));
import { roomScreen } from '../../src/game/screens/room';

const renderer = (): PixelRenderer => ({
  scene: new THREE.Scene(), camera: new THREE.OrthographicCamera(-20, 20, 10, -10, .1, 100),
  internal: { width: 960, height: 540 },
  lighting: { background: new THREE.Color(), ambientSky: new THREE.Color(), ambientGround: new THREE.Color(), keyColor: new THREE.Color(), keyDirection: new THREE.Vector3() },
  addPointLight: vi.fn(() => ({ intensity: 1 })), removeLight: vi.fn(),
} as unknown as PixelRenderer);

const view = (): GameView => ({ ...baseView('room'),
  hero: { id: 7, row: '幽冥骑士', position: { x: 64, y: 128, z: 56 }, hp: 150, maxHp: 150, armor: 0, stamina: 100, maxStamina: 100, dot: 0, statuses: [], skills: [], stats: {} },
  field: [{ id: 8, row: '眼球虫', table: '', kind: 'enemy', position: { x: 128, y: 128, z: 0 }, radius: 56, height: 64, hidden: false, hp: 10, maxHp: 10, armor: 0, intent: null, statuses: [], elite: false, boss: false }],
  room: { layout: 'first', variant: 0, cols: 5, rows: 7, tile: 64, cells: [[0, 0]], solids: [], decorations: [], spawns: [], task: null, playerSpawn: { x: 0, y: 0, z: 0 }, background: null },
});

describe('existing OPUS presentation receives real game signals', () => {
  it('launch before sync shows actual sphere at original curl time, then pops without blocking', () => {
    const r = renderer(), v = view(), screen = roomScreen({ renderer: r, seed: 1 }, v);
    const h = screen.stage!.heroView()!, ball = h.group.getObjectByName('ball')!.parent!;
    expect(ball.visible).toBe(false);
    screen.event({ t: 0, kind: 'launch.start', hero: 7 });
    screen.update(v, .1);
    expect(ball.visible).toBe(true);
    h.place(5, 5); screen.update({ ...v, hero: { ...v.hero!, position: { x: 256, y: 256, z: 56 } } }, 1 / 60);
    expect(ball.quaternion.equals(new THREE.Quaternion())).toBe(false);
    screen.event({ t: .2, kind: 'launch.end', hero: 7 }); screen.update(v, 0); screen.update(v, .3);
    expect(ball.visible).toBe(false);
    screen.exit();
  });

  it('corpse notification preserves a removed field actor and fires the authored .5-second splat once', () => {
    const r = renderer(), v = view(), screen = roomScreen({ renderer: r, seed: 1 }, v), splat = vi.fn();
    const stage = screen.stage!, enemy = stage.actor(8)!;
    stage.setPresentationHooks(splat);
    screen.event({ t: 0, kind: 'ui', op: 'update', widget: 'actor.corpse', data: { id: 8 } });
    screen.update({ ...v, field: [] }, 0);
    expect(stage.actor(8)).toBe(enemy); expect(enemy.dead).toBe(true); expect(enemy.group.parent).toBe(r.scene);
    screen.update({ ...v, field: [] }, .49); expect(splat).not.toHaveBeenCalled();
    screen.update({ ...v, field: [] }, .01); expect(splat).toHaveBeenCalledOnce();
    screen.update({ ...v, field: [] }, 1); expect(splat).toHaveBeenCalledOnce();
    screen.exit();
  });

  it('maps source planar XY recoil through room axes rather than dropping Y as height', () => {
    const screen = roomScreen({ renderer: renderer(), seed: 1 }, view()), stage = screen.stage!, enemy = stage.actor(8)!;
    const hit = vi.spyOn(enemy, 'hit');
    stage.event({ t: 0, kind: 'actor.squash', id: 8, speed: 2000, normal: { x: 0, y: 1, z: 0 } });
    const mapped = stage.direction(0, 1);
    expect(Math.hypot(mapped.x, mapped.z)).toBeCloseTo(1);
    expect(hit).toHaveBeenCalledWith(mapped.x, mapped.z, 2000);
    screen.exit();
  });

  it('routes exact source impact/splat assets and existing MetaSound names, keeping trajectory single-owned', () => {
    const cues = new Cues(handlers), target: CueTarget = { shake: vi.fn(), sound: vi.fn(), spark: vi.fn(),
      spores: vi.fn(), deathSplat: vi.fn(), place: () => ({ x: 2, z: 3 }), normal: () => ({ x: .6, z: .8 }) };
    const play = (asset: string) => cues.play({ t: 0, kind: 'vfx', asset: `CatapultHero/粒子/${asset}`, at: { x: 0, y: 0, z: 0 }, attach: null }, target);
    play('粒子_Blood_01'); play('粒子_Hit_01'); play('粒子_Blood_02'); play('粒子_轨迹');
    expect(target.spores).toHaveBeenCalledWith({ x: 2, z: 3 }, { x: .6, z: .8 });
    expect(target.spark).toHaveBeenCalledOnce(); expect(target.deathSplat).toHaveBeenCalledOnce();
    for (const [asset, cue] of [['普通撞', 'bump'], ['砍中肉', 'hit'], ['充能完毕', 'charge']] as const) {
      cues.play({ t: 0, kind: 'sound', asset: `CatapultHero/声音/音效_基础_${asset}`, at: null, volume: 1, pitch: 1 }, target);
      expect(target.sound).toHaveBeenLastCalledWith(cue, { x: 2, z: 3 });
    }
    expect(cues.unknown.size).toBe(0);
  });
});
