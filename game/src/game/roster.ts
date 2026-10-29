import { baseAttribute, 数据表_敌人_普通, type DemoRowNames } from '../content/demo/index.ts';
import type { MobKind } from '../procgen/creatures/mobs';

/**
 * SPEC-GAP: which Demo enemy each of our small fry reskins is decided at G3 (ART_BIBLE "World"). Until then each
 * stands in for the common Demo enemy closest to its model's size (MOB_RADIUS: wickling 40 uu, skull 46,
 * acolyte 46, jelly 56) and takes that row's body: 宽度 is the capsule radius the launch collides with, 高度 its
 * half-height and the 目标角色.高度 of its damage popups.
 */
export const STAND_IN = {
  wickling: '眼球',
  skull: '水母脑',
  acolyte: '结晶',
  jelly: '大肠',
} as const satisfies Record<MobKind, DemoRowNames['数据表_敌人_普通']>;

export interface DemoBody {
  /** 属性.宽度 in uu. */
  readonly width: number;
  /** 属性.高度 in uu. */
  readonly height: number;
}

export function demoBody(kind: MobKind): DemoBody {
  const a = 数据表_敌人_普通.rows[STAND_IN[kind]].属性;
  return { width: a.宽度, height: a.高度 };
}

/** 科学词条.经验 of the stand-in row: what a kill grants before BP_Actor_Other's U(0.8, 1.2) roll. */
export function demoExp(kind: MobKind): number {
  return baseAttribute(数据表_敌人_普通.rows[STAND_IN[kind]].科学词条, '经验')?.值 ?? 0;
}
