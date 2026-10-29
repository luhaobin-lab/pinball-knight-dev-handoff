/**
 * Runtime structs that hold object references (ARCHITECTURE §4.10, Appendix A.7): 伤害, 治疗, 效果配置, HitResult,
 * with `make*` filling the Demo struct defaults from `demoStructs`. Field names are D11-mangled (`是暴击？` → `是暴击`);
 * these adapters are the only bridge between data rows (original keys) and runtime structs. Data-shaped structs that
 * hold no references stay the content types (`结构_*`); `structOf` builds them from their Demo defaults.
 */
import { demoStructs } from '../../content/demo/tables.ts';
import type { AssetPath, DemoStructTypes, Transform, 枚举_伤害来源, 枚举_伤害类型, 结构_效果 } from '../../content/demo/types.ts';
import type { 蓝图_能力 } from '../ability/ability.ts';
import type { 蓝图_发射物 } from '../ability/projectile.ts';
import { fromData, type 科学数 } from '../math/sci.ts';
import type { BP_ManeActor } from '../sim/actor.ts';
import type { HitResult, Vec3 } from '../sim/types.ts';

export type { HitResult };

/** 结构_伤害. */
export interface 伤害 {
  伤害来源: 枚举_伤害来源; 伤害类型: 枚举_伤害类型; 不变速: boolean; 是暴击: boolean; 是弱点: boolean;
  伤害数值: 科学数; 所需回合: number; 触发次数: number; 击中点位置: Vec3; 击中点法线: Vec3; 断开骨骼名: string;
  来自技能: 蓝图_能力 | null; 来自角色: BP_ManeActor | null; 来自发射物: 蓝图_发射物 | null; 目标角色: BP_ManeActor | null;
}
/** 结构_治疗. */
export interface 治疗 {
  是暴击: boolean; 生命护甲: boolean; 治疗整数: 科学数; 治疗百分比: 科学数; 触发次数: number; 特效位置: Vec3;
  来自技能: 蓝图_能力 | null; 释放者: BP_ManeActor | null;
}
/** 结构_效果. */
export interface 效果配置 {
  效果类: AssetPath | null; 持续时间: number; 触发间隔: number; 持续回合: number; 叠加层数: number;
  唯一: boolean; 检查效果名: boolean; 叠加上限: number;
}

const vec = (v: { readonly X: number; readonly Y: number; readonly Z: number }): Vec3 => ({ x: v.X, y: v.Y, z: v.Z });

/** Defaults: demoStructs.结构_伤害 (来源 攻击, 类型 流血, 所需回合 3, 触发次数 1 …); references null. */
export function make伤害(p: Partial<伤害> = {}): 伤害 {
  const d = demoStructs.结构_伤害.defaults;
  return {
    伤害来源: d.伤害来源, 伤害类型: d.伤害类型, 不变速: d['不变速？'], 是暴击: d['是暴击？'], 是弱点: d['是弱点？'],
    伤害数值: fromData(d.伤害数值), 所需回合: d.所需回合, 触发次数: d.触发次数, 击中点位置: vec(d.击中点位置), 击中点法线: vec(d.击中点法线),
    断开骨骼名: d.断开骨骼名, 来自技能: null, 来自角色: null, 来自发射物: null, 目标角色: null, ...p,
  };
}

/** Defaults: demoStructs.结构_治疗; references null. */
export function make治疗(p: Partial<治疗> = {}): 治疗 {
  const d = demoStructs.结构_治疗.defaults;
  return {
    是暴击: d['是暴击？'], 生命护甲: d.生命护甲, 治疗整数: fromData(d.治疗整数), 治疗百分比: fromData(d.治疗百分比), 触发次数: d.触发次数,
    特效位置: vec(d.特效位置), 来自技能: null, 释放者: null, ...p,
  };
}

/** Defaults: demoStructs.结构_效果. */
export function make效果配置(p: Partial<效果配置> = {}): 效果配置 {
  return { ...效果配置From(demoStructs.结构_效果.defaults), ...p };
}

/** A data row's 结构_效果 → the runtime struct. */
export function 效果配置From(row: 结构_效果): 效果配置 {
  return {
    效果类: row.效果类, 持续时间: row.持续时间, 触发间隔: row.触发间隔, 持续回合: row.持续回合, 叠加层数: row.叠加层数,
    唯一: row['唯一？'], 检查效果名: row['检查效果名？'], 叠加上限: row.叠加上限,
  };
}

/** An empty FHitResult (Time 1, no blocking hit), as the Demo's struct default. */
export function makeHitResult(p: Partial<HitResult> = {}): HitResult {
  const z = (): Vec3 => ({ x: 0, y: 0, z: 0 });
  return { actor: null, impactPoint: z(), impactNormal: z(), location: z(), normal: z(), blockingHit: false, time: 1, distance: 0, ...p };
}

export function identityTransform(): Transform {
  return { Rotation: { X: 0, Y: 0, Z: 0, W: 1 }, Translation: { X: 0, Y: 0, Z: 0 }, Scale3D: { X: 1, Y: 1, Z: 1 } };
}

/**
 * A data-shaped Demo struct (`结构_*`, content/demo conventions: enums as display strings, assets as paths, texts as
 * { zh, en }): a deep copy of `value` (a blueprint CDO default) or of the struct's Demo default.
 */
export function structOf<K extends keyof DemoStructTypes>(name: K, value?: unknown): DemoStructTypes[K] {
  return deepCopy(value ?? demoStructs[name].defaults) as DemoStructTypes[K];
}

function deepCopy(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(deepCopy);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deepCopy(x)]));
  return v;
}
