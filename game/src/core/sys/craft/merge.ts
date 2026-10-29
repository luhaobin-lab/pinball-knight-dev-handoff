/** 修炼系统 检查可合成牌 / 合成牌; BP_Actor_Card 自身可合成判断. Exact enchant-value array order matters. */
import { 函数库_工具 } from '../../bp/index.ts';
import { BP_Actor_Card } from '../../sim/card.ts';
import type { 修炼系统 } from '../../sim/cult.ts';
import type { World } from '../../sim/world.ts';
import { Array_RemoveItem } from '../../sim/engine.ts';

export const mergeCards = (w: World): (BP_Actor_Card | null)[] => [...w.cult.背包里牌, ...w.cult.已装备牌, ...w.cult.未拾取牌, ...w.cult.仓库里牌];
export function mergeCompatible(a: BP_Actor_Card, b: BP_Actor_Card): boolean {
  if (!a.world.isValid(a) || !a.world.isValid(b) || a === b || a.品质 >= 4 || b.品质 >= 4 || b.死掉了 || a.名字 !== b.名字) return false;
  const aa = [...a.拥有的附魔能力.values()], bb = [...b.拥有的附魔能力.values()]; return aa.length === bb.length && aa.every((x, i) => x === bb[i]);
}
export function checkMerges(cult: 修炼系统): void {
  const all = mergeCards(cult.world);
  for (const c of all) if (c && cult.world.isValid(c)) { c.可合成目标牌 = []; c.可合成 = false; c.更新外观数据(); }
  for (const c of all) if (c && cult.world.isValid(c) && c.品质 < 4) {
    c.可合成目标牌 = [];
    for (const other of all) if (other && mergeCompatible(c, other)) { if (!c.可合成目标牌.includes(other)) c.可合成目标牌.push(other); other.可合成 = true; other.更新外观数据(); }
  }
  for (const c of all) if (c && cult.world.isValid(c)) { c.可合成 = c.可合成目标牌.length > 0; c.更新外观数据(); }
}
export function mergeResult(a: BP_Actor_Card, b: BP_Actor_Card): { quality: number; remainder: number; upgraded: boolean; before: number } {
  const sum = (a.等级 + a.下一级计数 + b.等级 + b.下一级计数) | 0, thresholds = [2, 4, 8, 16];
  let i = 0; for (; i < thresholds.length - 1; i++) if (sum < thresholds[i]) break;
  return { quality: i + 1, remainder: sum - (thresholds[i - 1] ?? 0), before: Math.max(a.品质, b.品质), upgraded: i + 1 > Math.max(a.品质, b.品质) };
}
export function merge(cult: 修炼系统, selected: BP_Actor_Card | null, target: BP_Actor_Card | null, preview: boolean): void {
  if (!selected || !target) return; if (selected.所在格子组标签 === 'UI.修炼物品在仓库') selected.从仓库中移除();
  const result = mergeResult(selected, target);
  if (preview) { cult.fx.ui({ op: 'update', widget: 'UI_合成进度', data: { item: selected.id, target: target.id, ...result } }); return; }
  target.下一级计数 = result.remainder; Array_RemoveItem(cult.背包里牌, selected); Array_RemoveItem(cult.已装备牌, selected);
  if (selected.可使用) selected.检查死亡(true, true); else 函数库_工具.销毁目标和子物体(cult, selected);
  cult.world.mode.玩家角色?.精神系统(Math.imul(Math.imul(target.尺寸, target.品质), 6), 0, '合成物品', false);
  cult.检查可合成牌(); target.品质 = result.quality; target.升级此牌(false, true);
  if (target.名字 !== '祝福之灵' && result.upgraded) cult.创建牌到侧栏('祝福之灵', result.before, null, [], target.获取轮次, new Map());
}
