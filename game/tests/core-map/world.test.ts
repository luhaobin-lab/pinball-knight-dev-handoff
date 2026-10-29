import { describe, expect, it, vi } from 'vitest';
import { 数据表_任务条_默认 } from '../../src/content/demo/index.ts';
import { createRegistry, registry } from '../../src/content/bp/index.ts';
import environment from '../../src/content/bp/batches/env-hazards.ts';
import { routeCommand } from '../../src/core/api/compose.ts';
import { 蓝图_通用路口 } from '../../src/core/sim/junction.ts';
import { 蓝图_房间 } from '../../src/core/sim/room.ts';
import { createWorld } from '../../src/core/sim/runtime.ts';
import type { TimelineCallbacks } from '../../src/core/sim/world.ts';
import { mapPage, 地图页重置 } from '../../src/core/sys/map/index.ts';
import { currentRoomPlan } from '../../src/core/sys/room/index.ts';
import { stubWorld } from '../fixtures/stub-world.ts';

/** Map/room facade unit: complete world services, with explicitly absent turn/reward implementations. */
function world(seed: number) {
  return stubWorld({
    seed,
    registry: createRegistry([蓝图_房间, 蓝图_通用路口, ...environment]),
    sys: {
      turn: {}, rewards: { 修炼系统: { 筛选物品生成: () => ({ 筛选后物品: [] }) } },
    },
  });
}

describe('core-map: module on the generated facade', () => {
  it('builds the map, accepts map.enter, explores through the junction and runs 创建地块', () => {
    const w = world(11);
    const m = w.mode;
    m.当前关卡名 = '遗迹';
    m.当前关卡任务条 = 数据表_任务条_默认.rows.遗迹;
    地图页重置(w);
    const page = mapPage(w);
    expect(page.地图格数组).toHaveLength(12);
    expect(m.当前关卡最高层数).toBe(12);
    expect(m.地图格历史).toHaveLength(12);
    // The map only accepts input in phase 选择地图 (修炼系统.切换地图页 sets it when the map opens).
    expect(w.sys.map.legal?.(w)).toEqual([]);
    m.当前环节 = '选择地图';
    const legal = w.sys.map.legal?.(w) ?? [];
    expect(legal[0]).toEqual({ type: 'map.enter', params: { cell: ['r1c0', 'r1c1', 'r1c2'] } });
    expect(routeCommand(w, { type: 'map.enter', cell: 'r2c0' }).ok).toBe(false);
    expect(routeCommand(w, { type: 'map.enter', cell: 'r1c1' }).ok).toBe(true);
    expect(w.unportedCalls).toContain('蓝图_动作游戏模式.新一层');
    expect(page.当前所在格?.地图格名).toBe('第一层');
    expect(m.当前层地图格配置表.RowName).toBe('第一层');

    // 新一层 (turn) stand-in, then the room and the junction.
    m.当前总层数 = 1;
    m.当前关卡层数 = 1;
    expect(m.创建地块().成功).toBe(false);  // 创建任务 is turn's (unported here)
    const plan = currentRoomPlan(w);
    expect(plan?.room).toBe('第一层');
    expect(plan?.spawnDeck[0]?.内容[0]?.row).toBe('任务宝箱');
    const view = w.sys.room.view?.(w).room;
    expect(view?.cols).toBe(20); // source房间尺寸X5 *地形格细分4; renderer maps UEY horizontally
    expect(view?.task).toBe('完成交互');
    m.路口创建点 = { x: -12, y: 0, z: 0 };
    m.创建路口(true);
    const jn = m.环境交互物[0] as 蓝图_通用路口;
    expect(jn).toBeInstanceOf(蓝图_通用路口);
    // 直接交互: the junction interacts when its timeline finishes: map opens (phase 9) and row 4 is built.
    w.fireLatent(w.latentCalls.findIndex(c => c.o === jn && c.op === 'delay' && c.args[0] === '激活路口'));
    const timeline = w.latentCalls.find(c => c.o === jn && c.op === 'timeline')!;
    (timeline.args[2] as TimelineCallbacks).finished!();
    w.fireLatent(w.latentCalls.findIndex(c => c.o === jn && c.op === 'delay' && c.args[0] === '交互路口'));
    expect(w.sys.map.view?.(w).map?.cells.filter(c => c.enterable)).toEqual([]);
    w.fireLatent(w.latentCalls.findIndex(c => c.o === m && c.op === 'delay' && c.args[0] === 'UI_关卡地图页面 L11060'));
    expect(m.当前环节).toBe('选择地图');
    expect(page.地图格层数).toBe(4);
    const mv = w.sys.map.view?.(w).map;
    expect(mv?.current).toBe('r1c1');
    const enterable = mv?.cells.filter(c => c.enterable) ?? [];
    expect(enterable.length).toBeGreaterThan(0);
    for (const c of enterable) expect(c.row).toBe(2);
    expect(w.sys.map.legal?.(w)[0]?.params?.cell).toEqual(enterable.map(c => c.id));
  });
});

describe('core-map: on the real runtime (room completion is an explicit test double)', () => {
  it('all 12 遗迹 map floors lead to 营地, then the real run-end modal', () => {
    // This is map traversal, not a combat run. The turn boundary owns the counters (TURN-001).
    const w = createWorld({ seed: 5, content: registry, systems: { turn: { 蓝图_动作游戏模式: {
      新一层: self => { self.当前总层数++; self.当前关卡层数++; self.当前环节 = '创建房间'; },
      结束层时机: () => {},
    } } } });
    const m = w.mode;
    m.当前关卡名 = '遗迹';
    m.当前关卡任务条 = 数据表_任务条_默认.rows.遗迹;
    地图页重置(w);
    m.当前环节 = '选择地图';
    for (let floor = 1; floor <= 12; floor++) {
      const spec = w.sys.map.legal?.(w).find(s => s.type === 'map.enter');
      const cell = spec?.params?.cell?.[0] as string;
      expect(routeCommand(w, { type: 'map.enter', cell }).ok, `floor ${floor}`).toBe(true);
      expect(m.当前总层数).toBe(floor);
      expect(m.当前关卡层数).toBe(floor);
      const jn = w.spawn(蓝图_通用路口);
      jn.交互路口();
      w.clock.advance(1);
    }
    expect(m.通过关卡数).toBe(1);
    expect(w.sys.map.view?.(w).map?.options).toEqual(['营地']);
    expect(w.sys.map.legal?.(w)).toEqual([{ type: 'map.option', params: { option: ['营地'] } }]);
    expect(routeCommand(w, { type: 'map.option', option: '营地' }).ok).toBe(true);
    expect(m.当前环节).toBe('死亡结算');
    expect(w.modal.current).toBeNull();
    w.clock.advance(1);
    expect(w.modal.current).toMatchObject({ kind: 'runEnd', demoComplete: true });
    expect(w.counters.report().unported['UI_冒险结束统计页.激活冒险统计页面']).toBeUndefined();
  });

  it('map.enter hands off once to the real turn module and schedules room creation', () => {
    const w = createWorld({ seed: 5, content: registry });
    const m = w.mode;
    m.当前关卡名 = '遗迹';
    m.当前关卡任务条 = 数据表_任务条_默认.rows.遗迹;
    地图页重置(w);
    m.当前环节 = '选择地图';
    const delay = vi.spyOn(w.latent, 'delay');
    expect(routeCommand(w, { type: 'map.enter', cell: 'r1c0' })).toEqual({ ok: true });
    expect([m.当前总层数, m.当前关卡层数, m.当前环节]).toEqual([1, 1, '创建房间']);
    expect(delay).toHaveBeenCalledWith(m, expect.stringMatching(/^L14848:\d+$/), 0.55, expect.any(Function));
    expect(w.counters.report().unported['蓝图_动作游戏模式.新一层']).toBeUndefined();
    expect(routeCommand(w, { type: 'map.enter', cell: 'r1c0' }).ok).toBe(false);
    expect([m.当前总层数, m.当前关卡层数]).toEqual([1, 1]);
  });
});
