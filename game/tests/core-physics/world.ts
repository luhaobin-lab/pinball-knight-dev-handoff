/**
 * Test world for core-physics: core-sim's createWorld with a walled room and local doubles for the modules the card
 * calls through the facade (kernel 开启碰撞 / 关闭碰撞 / 是敌人 / 销毁目标和子物体, turn 加入行动结束 / 结束行动 /
 * 加入回合开始 / 退出回合开始, the effect lifecycle of the ability module). Replace with tests/fixtures once wa/ability lands.
 */
import { registry } from '../../src/content/bp/index.ts';
import type { 蓝图_效果 } from '../../src/core/ability/effect.ts';
import type { Systems } from '../../src/core/bp/systems.ts';
import type { BP_ManeActor } from '../../src/core/sim/actor.ts';
import { BP_Actor_Other } from '../../src/core/sim/other.ts';
import type { BpObject } from '../../src/core/sim/object.ts';
import { createWorld, type SimWorld } from '../../src/core/sim/runtime.ts';
import { sciOf } from '../../src/core/math/sci.ts';
import type { Vec3 } from '../../src/core/sim/types.ts';

export interface Calls { log: string[] }

const openCollision = (self: BP_ManeActor): void => {
  self.可物理模拟 = !(self.OwnedGameplayTags.has('可交互.修炼牌') || self.OwnedGameplayTags.has('可交互.角色.AI.不可动'));
  (self as BP_ManeActor & { ug_碰撞开启?: boolean }).ug_碰撞开启 = true;
};
const closeCollision = (self: BP_ManeActor): void => {
  self.可物理模拟 = false;
  (self as BP_ManeActor & { ug_碰撞开启?: boolean }).ug_碰撞开启 = false;
};

/** Doubles of the systems this card calls (calls are logged as "<fn>:<id>"). */
export function doubles(calls: Calls, extra: Partial<Systems> = {}): Partial<Systems> {
  const log = (s: string): void => { calls.log.push(s); };
  const base: Partial<Systems> = {
    kernel: {
      BP_ManeActor: {
        开启碰撞: self => { log(`开启碰撞:${self.id}`); openCollision(self); },
        关闭碰撞: self => { log(`关闭碰撞:${self.id}`); closeCollision(self); },
      },
      函数库_工具: {
        是敌人: (_ctx, 我, 对方) => ({ 是敌人: !!我 && !!对方 && 我.角色类型 !== 对方.角色类型 }),
        销毁目标和子物体: (ctx, 目标) => { log(`销毁:${目标?.id}`); if (目标) ctx.world.destroy(目标); },
      },
    },
    turn: {
      BP_ManeActor: {
        加入行动结束: (self, x) => { log(`加入行动结束:${self.id}:${x?.id}`); if (x && !self.行动结束实例.includes(x)) self.行动结束实例.push(x); },
        结束行动: (self, x) => { log(`结束行动:${self.id}:${x?.id}`); const i = self.行动结束实例.indexOf(x); if (i >= 0) self.行动结束实例.splice(i, 1); },
      },
      蓝图_动作游戏模式: {
        加入回合开始: (self, x) => { log(`加入回合开始:${x?.id}`); if (x && !self.回合开始实例.includes(x)) self.回合开始实例.push(x); },
        退出回合开始: (self, x) => { log(`退出回合开始:${x?.id}`); const i = self.回合开始实例.indexOf(x); if (i >= 0) self.回合开始实例.splice(i, 1); },
      },
    },
    launch: { BP_ManeActor: { 更新运动数据: self => log(`更新运动数据:${self.id}`) } },
    ability: {
      蓝图_效果: {
        // ABILIT-042 (turn path) / ABILIT-047, reduced to what the terrain classes need.
        激活效果: (self, d) => { self.游戏模式 = self.world.mode; self.激活后触发(d); },
        销毁效果: self => {
          if (self.已销毁) return;
          self.已销毁 = true;
          self.销毁前触发();
          for (const o of [self.拥有者, self.释放者]) {
            if (!o) continue;
            const i = o.拥有的效果.indexOf(self);
            if (i >= 0) o.拥有的效果.splice(i, 1);
          }
          self.销毁后触发();
          self.world.destroy(self);
        },
        持续中触发: () => {},
        激活后触发: () => {},
        销毁前触发: () => {},
        销毁后触发: () => {},
        ReceiveTick: () => {},
        ReceiveBeginPlay: self => { self.游戏模式 = self.world.mode; },
      },
      函数库_工具: {
        获取释放的角色: (_ctx, 拥有者) => ({ 释放的角色: 拥有者 }),
        附加效果前处理: () => ({ 不需附加新效果: false, 效果实例: null }),
      },
      函数库_技能: { 获取效果名: (_ctx, _s, cls) => ({ 效果名字: String(cls) }) },
    },
  };
  return { ...base, ...extra };
}

/** Floor grid of w × d tiles (64 uu each); walls outside. */
export function room(w = 10, d = 10): { width: number; depth: number; cells: Uint8Array } {
  return { width: w, depth: d, cells: new Uint8Array(w * d).fill(1) };
}

export function world(calls: Calls = { log: [] }, extra: Partial<Systems> = {}, grid = room()): SimWorld {
  const w = createWorld({ content: registry, seed: 3, systems: doubles(calls, extra), geometry: () => ({ grid }) });
  w.mode.当前环节 = '进行战斗';
  return w;
}

export interface BodyOpts { at: Vec3; 质量?: number; 宽度?: number; 速度?: number; tags?: string[]; 角色类型?: BP_ManeActor['角色类型'] }

/** An enemy body: 质量 in 词条, 初始冲量 = 质量 / 50 (MA L4828), 最大物理速度 = 速度, collision opened. */
export function body(w: SimWorld, o: BodyOpts): BP_Actor_Other {
  return w.spawn(BP_Actor_Other, a => {
    a.宽度 = o.宽度 ?? 28;
    a.高度 = a.宽度;
    a.location = { ...o.at };
    a.角色类型 = o.角色类型 ?? '深渊';
    a.游戏模式 = w.mode;
    const m = o.质量 ?? 50;
    a.词条.set('质量', { 计算类型: '加算', 来源映射: new Map([['', sciOf(m, 0)]]) });
    a.初始冲量 = m / 50;
    a.最大物理速度 = o.速度 ?? 2500;
    for (const t of o.tags ?? ['可交互.角色.AI.仇恨']) a.OwnedGameplayTags.add(t);
    a.开启碰撞();
    a.更新角色质量(false);
  });
}

export const idOf = (x: BpObject | null | undefined): number | undefined => x?.id;
export type Effect = 蓝图_效果;
