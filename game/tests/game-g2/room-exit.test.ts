import { describe, expect, it } from 'vitest';
import { registry } from '../../src/content/bp/index.ts';
import { createGame } from '../../src/core/api/game.ts';
import { 函数库_技能 } from '../../src/core/bp/index.ts';
import { GridSnap_Float } from '../../src/core/math/kismet.ts';
import { Array_Shuffle, makeRand15, rand15, RandomFloatInRange } from '../../src/core/rng/ue.ts';
import { BP_ManeActor } from '../../src/core/sim/actor.ts';
import { BP_Actor_Player } from '../../src/core/sim/player.ts';
import { 蓝图_通用路口 } from '../../src/core/sim/junction.ts';
import { 蓝图_房间 } from '../../src/core/sim/room.ts';
import { createWorld } from '../../src/core/sim/runtime.ts';
import { currentRoomPlan } from '../../src/core/sys/room/index.ts';
import { layerOf } from '../../src/core/sys/room/plan.ts';

function fixture(seed = 3, layout = '战斗房_普通', tile = '普通战斗') {
  const w = createWorld({ seed, content: registry });
  const m = w.mode;
  m.当前层配置 = layerOf(layout, 0)!;
  m.当前层地图格配置表 = { DataTable: null, RowName: tile };
  const room = w.spawn(蓝图_房间); m.当前房间实例 = room;
  room.激活房间(5, 7);
  const hero = w.spawn(BP_Actor_Player, a => { a.宽度 = 56; a.高度 = 56; }, { x: 0, y: -256, z: 56 });
  m.玩家角色 = hero;
  m.路口创建点 = { x: -1, y: -1, z: -1 };
  return { w, m, room, hero, plan: currentRoomPlan(w)! };
}

describe('source room slots and exits', () => {
  it('attaches 35 centred 256uu slots but exposes only source-generated explored cells and spawn ranges', () => {
    const { w, room, plan } = fixture();
    const cells = room.已探索格子;
    expect(room.所有房间格子数组).toHaveLength(35);
    expect(cells.length).toBeLessThan(35);
    expect(cells).toHaveLength(plan.shape.mask.filter(Boolean).length);
    expect(room.未探索格子.length + cells.length).toBe(35);
    for (const cell of room.所有房间格子数组) {
      const source = plan.shape.cells[cell!.序号]!;
      expect(cell!.边拼接号数组).toEqual([...source.edge]);
      expect(cell!.K2_GetActorLocation()).toEqual({ x: plan.floor.origin.x + (source.x + .5) * 256, y: plan.floor.origin.y + (source.y + .5) * 256, z: 0 });
    }
    for (const cell of cells) {
      expect(cell!.已探索).toBe(true);
      expect(cell!.attachParent).toBe(room);
      expect(cell!.来自房间).toBe(room);
      expect(w.isValid(cell!.出生点)).toBe(true);
      expect(cell!.出生点!.attachParent).toBe(cell);
      if (cell!.边拼接号 === '1111' && cell!.角拼接号 === '1111') {
        expect(cell!.名字).toBe('中');
        expect(cell!.瓷砖配置.出生点范围.Scale3D).toEqual({ X: 64, Y: 64, Z: 1 });
      }
    }
  });

  it('keeps candidate shuffle then Z/Y/X spawn draws in their original domains and snaps once to 24uu', () => {
    const { w, m, room, hero } = fixture(71);
    const candidates = room.已探索格子.filter(c => {
      const p = c!.K2_GetActorLocation(), h = hero.K2_GetActorLocation();
      const d = Math.hypot(p.x - h.x, p.y - h.y);
      return d >= 120 && d <= 640 && c!.边拼接号 === '1111' && !c!.存在装饰品的占位.includes('地面');
    });
    const meta = makeRand15(w.rng.meta.state), level = makeRand15(w.rng.level.state);
    const untouched = { combat: w.rng.combat.state, loot: w.rng.loot.state };
    Array_Shuffle(meta, candidates);
    const picked = candidates[0]!;
    const p = picked!.K2_GetActorLocation();
    const { Scale3D: s, Translation: o } = picked!.瓷砖配置.出生点范围;
    RandomFloatInRange(level, -s.Z, s.Z); // consumed even though the child template projects Z to zero
    const y = RandomFloatInRange(level, -s.Y, s.Y);
    const x = RandomFloatInRange(level, -s.X, s.X);
    const expected = { x: GridSnap_Float(p.x + x + o.X, 24), y: GridSnap_Float(p.y + y + o.Y, 24), z: 0 };
    m.创建路口(false);
    const exit = m.环境交互物[0] as 蓝图_通用路口;
    expect(exit).toBeInstanceOf(蓝图_通用路口);
    expect(exit.K2_GetActorLocation()).toEqual(expected);
    expect(m.临时计数格).toEqual(candidates);
    expect(w.rng.meta.state).toBe(meta.state);
    expect(w.rng.level.state).toBe(level.state);
    expect({ combat: w.rng.combat.state, loot: w.rng.loot.state }).toEqual(untouched);
    expect(函数库_技能.查找地形格(m, m, expected, { x: 0, y: 0, z: 0 }, true, 24).找到了).toBe(true);
    const after = w.rng.save();
    m.创建路口(false);
    expect(m.环境交互物).toHaveLength(1);
    expect(w.rng.save()).toEqual(after);
  });

  it('honours ground occupancy and deduplication, with no fallback when there is no legal candidate', () => {
    const { w, m, room } = fixture();
    const chosen = room.已探索格子.find(c => c!.边拼接号 === '1111' && c!.K2_GetActorLocation().x === 0 && c!.K2_GetActorLocation().y === 0)!;
    for (const c of room.已探索格子) c!.存在装饰品的占位.push('地面');
    chosen!.存在装饰品的占位.length = 0;
    room.已探索格子.push(chosen); // the source uses Array_AddUnique before the shuffle
    const expectedMeta = makeRand15(w.rng.meta.state); rand15(expectedMeta);
    m.创建路口(false);
    expect(m.临时计数格).toEqual([chosen]);
    expect(w.rng.meta.state).toBe(expectedMeta.state);
    expect(m.环境交互物).toHaveLength(1);

    const empty = fixture();
    for (const c of empty.room.已探索格子) c!.存在装饰品的占位.push('地面');
    const before = empty.w.rng.save();
    empty.m.创建路口(false);
    expect(empty.m.环境交互物).toEqual([]);
    expect(empty.m.已有路口).toBe(true); // source L1193, even after the failed empty candidate lookup
    expect(empty.w.rng.save()).toEqual(before);
  });

  it('generates in-floor exits for the exploration and both ordinary battle rectangle variants across seeds', () => {
    for (const [layout, tile] of [['探索房', '探索房'], ['战斗房_简单', '简单战斗'], ['战斗房_普通', '普通战斗']]) {
      for (const seed of [1, 3, 19, 71]) {
        const { w, m, room, plan } = fixture(seed, layout, tile);
        m.创建路口(false);
        const exit = m.环境交互物[0]!;
        expect(exit, `${layout}, seed ${seed}`).toBeDefined();
        const p = exit.K2_GetActorLocation();
        expect(p.x - 24).toBeGreaterThan(plan.floor.origin.x);
        expect(p.x + 24).toBeLessThan(-plan.floor.origin.x);
        expect(p.y - 24).toBeGreaterThan(plan.floor.origin.y);
        expect(p.y + 24).toBeLessThan(-plan.floor.origin.y);
        expect(room.已探索格子).toContain(m.临时计数格[0]);
        expect(函数库_技能.查找地形格(m, m, p, { x: 0, y: 0, z: 0 }, true, 24).找到了).toBe(true);
        expect(w.counters.report().unported['蓝图_房间格子.瓷砖配置:None']).toBeUndefined();
      }
    }
  });

  it('cleans attached cell/point trees on a rebuild and actual room cleanup while preserving unrelated objects', () => {
    const { w, m, room } = fixture();
    const external = w.spawn(BP_ManeActor);
    const first = room.所有房间格子数组.flatMap(c => [c!, c!.出生点!]);
    const firstDecorations = [...room.房间装饰品];
    const count = w.objects().length;
    room.激活房间(5, 7);
    expect(first.every(o => !w.isValid(o))).toBe(true);
    expect(firstDecorations.every(o => !w.isValid(o))).toBe(true);
    // Source RNG may place a different number of decorations on rebuild; old and new trees must still reconcile.
    expect(w.objects().length).toBe(count - firstDecorations.length + room.房间装饰品.length);
    expect(w.isValid(external)).toBe(true);
    const second = room.所有房间格子数组.flatMap(c => [c!, c!.出生点!]);
    const secondDecorations = [...room.房间装饰品];
    m.已创建普通房间.push(room);
    m.清理房间();
    expect(w.isValid(room)).toBe(false);
    expect(second.every(o => !w.isValid(o))).toBe(true);
    expect(secondDecorations.every(o => !w.isValid(o))).toBe(true);
    expect(w.objects().some(o => first.includes(o) || second.includes(o))).toBe(false);
    expect(w.isValid(external)).toBe(true);
    const next = w.spawn(蓝图_房间); m.当前房间实例 = next; next.激活房间(5, 7);
    expect(next.所有房间格子数组).toHaveLength(35);
    expect(next.所有房间格子数组.every(c => c!.来自房间 === next && w.isValid(c!.出生点))).toBe(true);
  });

  it('lets the composed game interact with a generated random exit and reach the next map row', () => {
    const game = createGame({ seed: 3, content: registry, filter: 'ported', debug: { skipPrologue: true } });
    game.runUntilInput(10); game.send({ type: 'title.newRun' });
    game.runUntilInput(10); game.send({ type: 'hero.start' }); game.runUntilInput(10);
    const enter = game.legal().find(c => c.type === 'map.enter')!.params!.cell![0] as string;
    game.send({ type: 'map.enter', cell: enter }); game.advance(2);
    const m = game.world.mode;
    // Invoke only the room-completion boundary directly. This verifies exit wiring;
    // it is deliberately not evidence that the current combat AI can win a floor.
    m.路口创建点 = { x: -1, y: -1, z: -1 };
    m.创建路口(false);
    const exit = m.环境交互物.find(o => o instanceof 蓝图_通用路口)!;
    expect(exit).toBeDefined();
    m.当前环节 = '交互场牌'; m.玩家控制器!.玩家可与环境交互 = true;
    expect(game.send({ type: 'interact', actor: exit.id })).toEqual({ ok: true });
    game.advance(1);
    expect(game.view.screen).toBe('map');
    const next = game.legal().find(c => c.type === 'map.enter')!.params!.cell!;
    expect(next.length).toBeGreaterThan(0);
    expect(next.every(c => String(c).startsWith('r2c'))).toBe(true);
  });
});
