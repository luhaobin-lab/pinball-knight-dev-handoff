/**
 * The Stamina/HP snapshot (SCM-010, SCM-036): `当前魔力` and `当前生命` are not saved; the game mode keeps their
 * percentages, recorded only in phases 8 创建房间 / 9 选择地图 and restored by every reload, so a room reset or a
 * mid-combat quit refunds what was spent in the room. The save card calls these from 保存英雄信息 and 读档物品.
 */
import { 科学数乘除, type 科学数 } from '../../math/sci.ts';
import type { BP_Actor_Player } from '../../sim/player.ts';

/**
 * BP_Actor_Player 保存英雄信息 L22967 (ln 1657–1667), the percentage half: only in phases 8/9. Returns whether the
 * snapshot was taken (the Demo then starts AsyncSaveActors, L7123; in any other phase it saves no actor).
 */
export function 记录英雄百分比(hero: BP_Actor_Player): boolean {
  const mode = hero.world.mode;
  if (mode.当前环节 !== '选择地图' && mode.当前环节 !== '创建房间') return false;
  mode.英雄生命百分比保存 = hero.生命百分比;
  mode.英雄魔力百分比保存 = hero.魔力百分比;
  return true;
}

/**
 * 修炼系统 L445 (ln 1780–1790), 0.5 s after 读档物品: direct writes, no 改变体力, no dispatch, no popup. A snapshot of 0.6
 * reloads as {5.999999999999999, 1} (CORE-M-010, SCM-TV-32).
 */
export function 恢复英雄百分比(hero: BP_Actor_Player): void {
  const mode = hero.world.mode;
  hero.生命百分比 = mode.英雄生命百分比保存;
  hero.魔力百分比 = mode.英雄魔力百分比保存;
  hero.当前生命 = 科学数乘除(raw(hero.生命百分比), hero.当前最大生命, false);
  hero.当前魔力 = 科学数乘除(raw(hero.魔力百分比), hero.当前最大魔力, false);
}

const raw = (系数: number): 科学数 => ({ 系数, 指数: 0 });
