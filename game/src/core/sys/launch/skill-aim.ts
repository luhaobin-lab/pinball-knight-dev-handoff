/** 技能指示 type1 L3267 -> 计算落点（最远距离）: pure query, same endpoint for hover and actual targeted cast. */
import type { World } from '../../sim/world.ts';
import type { SkillPreview } from '../../api/view.ts';
import { 获取科学映射词条 } from '../../math/stats.ts';
import { 科学数变普通 } from '../../math/sci.ts';
import { snapAimDirection } from '../../launch/math.ts';
import { BP_ManeActor } from '../../sim/actor.ts';
import { 函数库_工具 } from '../../bp/index.ts';
import type { Vec3 } from '../../sim/types.ts';
import type { 结构_地形选取配置 } from '../../../content/demo/types.ts';

export function previewSkill(world: World, aim: { x: number; y: number }): SkillPreview | null {
  const h = world.mode.玩家角色, a = h?.当前能力;
  if (!h || !a || !h.有选中主动技能 || !Number.isFinite(aim.x) || !Number.isFinite(aim.y)) return null;
  const p = h.K2_GetActorLocation();
  const mode = (a as typeof a & { 指示类型?: number }).指示类型 ?? 1;
  if (mode === 3 || mode === 4) {
    // 技能指示 计算落点（指定位置）: type4 first snaps absolute cursor to64, then clamps distance to弹射距离.
    const target = mode === 4 ? 函数库_工具.吸附到网格(h, { ...aim, z: 0 }, { x: 0, y: 0, z: 0 }, 64) : aim;
    const dx = target.x - p.x, dy = target.y - p.y, distance = Math.hypot(dx, dy);
    const range = 科学数变普通(获取科学映射词条(h.词条, '弹射距离').输出值), ratio = distance > 0 ? Math.min(distance, range) / distance : 0;
    const from = { x: p.x, y: p.y, z: p.z - h.高度 }, to = { x: p.x + dx * ratio, y: p.y + dy * ratio, z: from.z };
    const hit = world.trace.sphere(from, to, 1, '地形', []).find(hit => !(hit.actor instanceof BP_ManeActor));
    const end = hit?.location ?? to;
    const terrain = mode === 4 ? (world.sys.ability as { previewTerrain(w: World, cfg: 结构_地形选取配置, at: Vec3): { cells: Vec3[] } }).previewTerrain(world, a.地形选取, end).cells : undefined;
    return { origin: from, end, radius: a.能力名 === '腾跃' ? h.高度 : mode === 4 ? 60 : a.技能距离, row: a.能力名, indicatorType: mode, ...(terrain ? { terrain } : {}) };
  }
  const d = snapAimDirection({ x: aim.x - p.x, y: aim.y - p.y });
  const extra = (a as typeof a & { 指示额外长度?: number }).指示额外长度 ?? 0; // 瞄准射击 L4561 writes999; 幻影斩 leaves CDO0.
  const length = 科学数变普通(获取科学映射词条(h.词条, '弹射距离').输出值) + extra;
  const from = { x: p.x + .05 * d.x, y: p.y + .05 * d.y, z: h.高度 };
  const to = { x: from.x + d.x * length, y: from.y + d.y * length, z: h.高度 };
  const hit = world.trace.sphere(from, to, Math.fround(h.高度), 'Visibility', [h])[0];
  return { origin: p, end: hit?.location ?? to, radius: a.技能距离, row: a.能力名, indicatorType: 1 };
}
