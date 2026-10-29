/**
 * Area helpers: 函数库_技能.对周围敌人造成伤害 (函数库_技能.txt 45–118, DAMAGE-104) and the empty virtual
 * 蓝图_能力.通过地形造成伤害 (蓝图_能力.txt; terrain abilities override it).
 */
import type { 蓝图_能力 } from '../../ability/ability.ts';
import { make伤害 } from '../../bp/structs.ts';
import type { 科学数 } from '../../math/sci.ts';
import { Array_Shuffle } from '../../rng/ue.ts';
import { BP_ManeActor } from '../../sim/actor.ts';
import type { BpObject } from '../../sim/object.ts';
import type { Vec3 } from '../../sim/types.ts';
import type { 枚举_伤害来源, 枚举_伤害类型 } from '../../../content/demo/types.ts';
import { T } from './common.ts';

/** ETraceTypeQuery 3, the channel every damage sweep uses. SPEC-GAP: the channel name is core-sim's trace convention. */
export const DAMAGE_CHANNEL = '3';
const DOT_TYPES: readonly 枚举_伤害类型[] = ['中毒', '燃烧', '流血'];

export function 对周围敌人造成伤害(
  ctx: BpObject, 释放者: BP_ManeActor | null, 来自技能: 蓝图_能力 | null, 伤害来源: 枚举_伤害来源, 伤害类型: 枚举_伤害类型,
  伤害范围: number, 伤害数值: 科学数, 触发次数: number, _DrawDebugType: number,
): void {
  if (!释放者) return;
  const w = ctx.world;
  释放者.更新运动数据();
  const p = 释放者.当前位置;
  const hits = w.trace.sphere(p, { x: p.x, y: p.y, z: p.z + 100 }, 伤害范围, DAMAGE_CHANNEL, [释放者]);
  Array_Shuffle(w.rng.combat, hits); // CORE-M-129 row 148
  for (let i = 0; i < hits.length; i++) {
    const a = hits[i].actor;
    if (!(a instanceof BP_ManeActor) || !a.HasMatchingGameplayTag(T.仇恨)) continue; // no dead check (DAMAGE-104)
    a.更新运动数据();
    const owner = 来自技能?.拥有者 ?? null; // the attacker is the skill's owner, the sphere is centred on 释放者
    const n = 释放者.当前位置;
    const base = {
      伤害来源, 伤害类型, 不变速: false, 是暴击: false, 是弱点: false, 伤害数值, 所需回合: 3,
      击中点位置: a.当前位置, 击中点法线: { x: n.x - a.当前位置.x, y: n.y - a.当前位置.y, z: n.z - a.当前位置.z },
      断开骨骼名: 'None', 来自技能, 来自角色: owner, 来自发射物: null, 目标角色: a,
    };
    if (DOT_TYPES.includes(伤害类型)) owner?.造成持续伤害(make伤害({ ...base, 触发次数 }), true, false);
    else owner?.造成即时伤害(make伤害({ ...base, 触发次数: 1 }), true, false); // QUIRK: 触发次数 forced to 1
  }
}

/** 蓝图_能力.通过地形造成伤害: an empty virtual in the base class. */
export function 通过地形造成伤害(_self: 蓝图_能力, _伤害目标: BP_ManeActor | null, _来自位置: Vec3): void {}
