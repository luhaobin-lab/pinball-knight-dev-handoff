import { describe, expect, it } from 'vitest';
import { 数据表_关卡_固定地点 } from '../../src/content/demo/index.ts';
import { makeRand15 } from '../../src/core/rng/ue.ts';
import { buildRoomPlan, layerOf, roomOfTile } from '../../src/core/sys/room/plan.ts';

/** The 18 live room rows (PROTOTYPE_SCOPE §4, §5.3; WAVE_A §4). */
const LIVE = ['营地', '第一层', '宝箱房', '探索房', '传奇房', '属性房', '天赋房', '锻造房', '恢复点', '新手关01', '新手关02', '新手关04', '新手关05', '新手关07', '战斗房_简单', '战斗房_普通', '战斗房_困难', '战斗房_首领'];

describe('core-map: room plans v0', () => {
  it('every live layout gives a 5 × 7 plan with its task and deck', () => {
    expect(LIVE).toHaveLength(18);
    for (const room of LIVE) {
      const row = 数据表_关卡_固定地点.rows[room as '营地'];
      expect(row, room).toBeDefined();
      row.层类型.forEach((layer, v) => {
        const p = buildRoomPlan(room, room, v, layer, makeRand15(1));
        expect([p.cellsX, p.cellsY], room).toEqual([5, 7]);
        expect(p.floor.width * p.floor.depth).toBe(20 * 28);
        expect(p.spawnDeck.length).toBe(layer.敌人池.length);
        for (const d of p.decorations) expect(d.count >= d.range.min && d.count <= d.range.max, d.cls).toBe(true);
        if (room !== '营地') expect(p.task, room).not.toBeNull();
      });
    }
  });

  it('combat rooms: 场上最多敌人 5, kill-all task, elite caps 1/1/2; boss room on 遗迹 has 守门人 and 首领背景A', () => {
    for (const [room, cap] of [['战斗房_简单', 1], ['战斗房_普通', 1], ['战斗房_困难', 2]] as const) {
      const p = buildRoomPlan(room, room, 0, layerOf(room, 0)!, null);
      expect(p.场上最多敌人).toBe(5);
      expect(p.task).toBe('消灭所有敌人');
      expect(p.精英上限).toBe(cap);
    }
    const boss = buildRoomPlan('首领战斗', '战斗房_首领', 0, layerOf('战斗房_首领', 0)!, null);
    expect(boss.spawnDeck.flatMap(e => e.内容.map(c => c.row))).toContain('守门人');
    expect(boss.background).toMatch(/首领背景A/);
    expect(boss.junction).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('first floor: 任务宝箱, 完成交互, hand-made map 手动房间图01, junction offset (−12, 0, 0)', () => {
    const p = buildRoomPlan('第一层', roomOfTile('第一层')!, 0, layerOf('第一层', 0)!, null);
    expect(p.spawnDeck[0]?.内容[0]?.row).toBe('任务宝箱');
    expect(p.task).toBe('完成交互');
    expect(p.手动房间图).toMatch(/手动房间图01/);
    expect(p.junction).toEqual({ x: -12, y: 0, z: 0 });
    expect(p.playerSpawn).toEqual({ x: 0, y: -256, z: 0 });
  });

  it('空 tiles use the 营地 room; explore room variants [1] and [2] have weight 0', () => {
    expect(roomOfTile('空')).toBe('营地');
    expect(数据表_关卡_固定地点.rows.探索房.层类型.map(l => l.出现权重)).toEqual([50, 0, 0, 200, 100]);
  });
});
