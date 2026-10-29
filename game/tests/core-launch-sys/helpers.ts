/** Fixtures of the core-launch-sys tests: combatFixture with the charge semantics wired where module turn owns them. */
import { combatFixture, withSystems, type CombatFixture, type CombatFixtureOptions, type SystemOverrides } from '../fixtures/index.ts';
import { turnChargeDouble } from './turn-double.ts';
import type { BP_ManeActor } from '../../src/core/sim/actor.ts';
import { 函数库_工具 } from '../../src/core/bp/index.ts';
import { 蓝图_效果 } from '../../src/core/ability/effect.ts';
import type { RoomPlan } from '../../src/core/api/view.ts';
import { 科学数加减, 科学数零 } from '../../src/core/math/sci.ts';

/** CHARGE-030 parent (BP_ManeActor.判断行动力, module turn): the double of what the card's override relies on. */
export function baseJudge(self: BP_ManeActor, _来源: string): void {
  self.临时效果计数.length = 0;
  self.疲劳了 = 函数库_工具.有对应标签效果(self, self.拥有的效果, '状态.僵直').存在 || self.当前行动力 < 100.0;
  const list = self.world.mode.可行动角色;
  const i = list.indexOf(self);
  if (i >= 0) list.splice(i, 1);
}

export interface Log { readonly lines: string[] }

/** turn doubles: the charge functions (turn-double.ts), the 判断行动力 parent, 进入战斗状态 (TURN-045), 结束行动. */
export function launchSystems(log: string[] = [], extra: SystemOverrides = {}): SystemOverrides {
  return {
    ...extra,
    turn: {
      BP_ManeActor: {
        添加行动力: turnChargeDouble.BP_ManeActor.添加行动力,
        判断行动力: baseJudge,
        结束行动: (self, _i, d) => { log.push(`结束行动 ${self.名字} ${d}`); self.移动中 = false; self.疲劳了 = true; },
      },
      BP_Actor_Card: turnChargeDouble.BP_Actor_Card,
      蓝图_动作游戏模式: {
        进入战斗状态: mode => { mode.当前环节 = '进行战斗'; const h = mode.玩家角色; if (h) { h.战斗状态 = true; h.疲劳 = 0.0; } },
      },
      ...(extra.turn ?? {}),
    },
    rating: {
      蓝图_动作游戏模式: {
        更新回合战斗统计: (_m, name, v) => { log.push(`更新回合战斗统计 ${name} ${v.系数}`); },
        更新轮回战斗统计: (_m, name, v) => { log.push(`更新轮回战斗统计 ${name} ${v}`); },
      },
      BP_ManeActor: {
        更新角色战斗统计: (self, name, v) => {
          log.push(`更新角色战斗统计 ${self.名字} ${name} ${v.系数}`);
          const old = self.战斗数据统计.get(name);
          self.战斗数据统计.set(name, 科学数加减(old ?? 科学数零, v, false));
        },
      },
      ...(extra.rating ?? {}),
    },
  };
}

export function fixture(o: CombatFixtureOptions & { log?: string[]; extra?: SystemOverrides } = {}): CombatFixture {
  const w = combatFixture({ ...o, systems: withSystems(launchSystems(o.log ?? [], o.extra ?? {})) });
  w.world.mode.当前环节 = '进行战斗';
  w.world.mode.当前层回合 = 1;
  return w;
}

/** A test effect that logs the timings it receives (tags added by the caller). */
export class SpyEffect extends 蓝图_效果 {
  static override readonly path = 'Test/core-launch-sys/SpyEffect';
  label = '';
  log: string[] = [];
  onFire: ((e: SpyEffect, tag: string) => void) | null = null;
  override 激活后触发(_d: string): void {}
  override 持续中触发(tag: string): void {
    this.log.push(`${this.label} ${tag} ${this.触发次数}`);
    this.onFire?.(this, tag);
  }
}

/** Spawn a SpyEffect into `owner`'s 拥有的效果 with the given timing tags. */
export function spy(owner: BP_ManeActor, label: string, tags: readonly string[], log: string[]): SpyEffect {
  const e = owner.world.spawn(SpyEffect, x => { x.拥有者 = owner; x.label = label; x.log = log; });
  for (const t of tags) e.OwnedGameplayTags.add(t);
  owner.拥有的效果.push(e);
  return e;
}

/** A 5 × 7 room of 64 uu floor cells (core-map's RoomPlan shape), for the launch geometry. */
export function roomPlan(cols = 9, rows = 9): RoomPlan {
  const cells: [number, number][] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push([c, r]);
  return { layout: 'test', variant: 0, cols, rows, tile: 64, cells, solids: [], decorations: [], spawns: [], task: null, playerSpawn: { x: 0, y: 0, z: 0 }, background: null };
}
