import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { baseView } from '../../src/core/api/game.ts';
import type { GameView } from '../../src/game/api';
import type { PixelRenderer } from '../../src/render/api';

const fixtures = vi.hoisted(() => ({ created: [] as unknown[] }));
vi.mock('../../src/procgen/architecture/room', () => ({
  buildRoom: () => ({ group: new THREE.Group(), lights: [], update() {}, setFires() {}, dispose: vi.fn() }),
}));
vi.mock('../../src/game/views/actors', () => {
  const create = (id: number, kind: string) => {
    const group = new THREE.Group();
    const actor = { id, kind, group, radius: 1, top: 2, dead: false, x: 0, z: 0,
      place(x: number, z: number) { this.x = x; this.z = z; }, update() {}, lookAt() {}, flash() {}, die() { this.dead = true; },
      launch: vi.fn(), hit() {}, dispose: vi.fn(() => group.removeFromParent()),
    };
    fixtures.created.push(actor);
    return actor;
  };
  return { createHeroView: (id: number) => create(id, 'hero'), createActorView: (a: { id: number }) => create(a.id, 'mob') };
});

import { roomScreen } from '../../src/game/screens/room';

const renderer = (): PixelRenderer => ({
  scene: new THREE.Scene(), camera: new THREE.OrthographicCamera(-20, 20, 10, -10, 0.1, 100),
  internal: { width: 960, height: 540 },
  lighting: { background: new THREE.Color(), ambientSky: new THREE.Color(), ambientGround: new THREE.Color(), keyColor: new THREE.Color(), keyDirection: new THREE.Vector3() },
  addPointLight: vi.fn(), removeLight: vi.fn(),
} as unknown as PixelRenderer);

const roomView = (): GameView => ({
  ...baseView('room'),
  hero: { id: 7, row: '幽冥骑士', position: { x: 64, y: 128, z: 56 }, hp: 150, maxHp: 150, armor: 0, stamina: 100, maxStamina: 100, dot: 0, statuses: [], skills: [], stats: {} },
  field: [],
  room: { layout: 'first', variant: 0, cols: 5, rows: 7, tile: 64, cells: [[0, 0]], solids: [], decorations: [], spawns: [], task: null, playerSpawn: { x: 0, y: 0, z: 0 }, background: null },
});

describe('browser room stage lifecycle', () => {
  it('shows and retires live rock solids without replacing the stage or hero', () => {
    const r = renderer(), base = roomView();
    const screen = roomScreen({ renderer: r, seed: 1 }, base), stage = screen.stage!, hero = stage.heroView();
    const prior = fixtures.created.length;
    const view = { ...base, room: { ...base.room!, solids: [{ kind: 'box' as const, at: { x: 128, y: 192, z: 0 }, half: { x: 32, y: 32 }, tags: ['环境.房间.墙壁'] }] } };
    screen.update(view, 1 / 60);
    const rock = fixtures.created[prior] as { group: THREE.Group; x: number; z: number; dispose: ReturnType<typeof vi.fn> };
    expect(rock.group.parent).toBe(r.scene);
    expect([rock.x, rock.z]).toEqual([4, 4]); // UE(Y,-X):1+192/64,1+5-128/64
    expect(screen.stage).toBe(stage);
    expect(stage.heroView()).toBe(hero);
    screen.update(base, 1 / 60);
    expect(rock.dispose).toHaveBeenCalledOnce();
    expect(screen.stage).toBe(stage);
    screen.exit();
  });
  it('creates and retires the independent pickup slice without rebuilding the room or hero', () => {
    const base = roomView();
    const view = { ...base, pickups: [{ id: 88, row: '加速点', position: { x: 128, y: 192, z: 0 } }] };
    const screen = roomScreen({ renderer: renderer(), seed: 1 }, view);
    const stage = screen.stage!, pickup = stage.actor(88)!;
    expect([pickup.x, pickup.z]).toEqual([4, 4]); // sameactualroomframeasstaticcolliders
    const hero = stage.heroView();
    screen.update({ ...view, pickups: [] }, 1 / 60);
    expect(screen.stage).toBe(stage);
    expect(stage.heroView()).toBe(hero);
    expect(stage.actor(88)).toBeUndefined();
    expect(pickup.dispose).toHaveBeenCalledOnce();
    screen.exit();
  });
  it('renders the independent hero slice and keeps its identity across fresh equal room snapshots', () => {
    const r = renderer(), view = roomView();
    const screen = roomScreen({ renderer: r, seed: 1 }, view);
    const stage = screen.stage!;
    const hero = stage.heroView()!;
    expect(hero.kind).toBe('hero');
    expect(hero.group.parent).toBe(r.scene);
    expect([hero.x, hero.z]).toEqual([3, 5]); // UE(Y,-X):1+128/64,1+5-64/64
    for (let i = 0; i < 3; i++) screen.update({ ...view, room: { ...view.room!, cells: [[0, 0]] } }, 1 / 60);
    expect(screen.stage).toBe(stage);
    expect(screen.stage!.heroView()).toBe(hero);
    expect(hero.dispose).not.toHaveBeenCalled();
    screen.event({ kind: 'launch.start', t: 0, hero: 7 } as never);
    screen.update(view, 1 / 60);
    expect(hero.launch).toHaveBeenCalledWith('start');
    screen.exit();
    expect(hero.group.parent).toBeNull();
    expect(hero.dispose).toHaveBeenCalledOnce();
  });

  it('replaces a changed room and retires a removed/dead hero without retaining a corpse', () => {
    const view = roomView(), screen = roomScreen({ renderer: renderer(), seed: 1 }, view);
    const firstStage = screen.stage!, firstHero = firstStage.heroView()!;
    const changed = { ...view, room: { ...view.room!, variant: 1 } };
    screen.update(changed, 1 / 60);
    expect(screen.stage).not.toBe(firstStage);
    expect(firstHero.dispose).toHaveBeenCalledOnce();
    const nextHero = screen.stage!.heroView()!;
    nextHero.dead = true;
    screen.update({ ...changed, hero: null }, 1 / 60);
    expect(screen.stage!.heroView()).toBeUndefined();
    expect(nextHero.dispose).toHaveBeenCalledOnce();
    screen.exit();
  });
});
