import { 合成数据表_修炼物品, 数据表_制造分类 } from '../../../content/demo/tables.ts';
import type { 结构_角色 } from '../../../content/demo/types.ts';
import type { BP_ManeActor } from '../../sim/actor.ts';
import type { 修炼系统 } from '../../sim/cult.ts';
import type { World } from '../../sim/world.ts';
import { TagSet } from '../../sim/tags.ts';
import { 词条映射From, 科学映射原始值 } from '../../math/stats.ts';
import { 科学数变普通 } from '../../math/sci.ts';
import { FTrunc } from '../../math/kismet.ts';

export interface CraftSave { 已解锁配方: string[]; 轮回次数: number }
export const craftSave = (w: World): CraftSave => (w.sys.save as typeof w.sys.save & { GetCustomSave(w: World): CraftSave }).GetCustomSave(w);
export const recipeRows = 合成数据表_修炼物品.rows as Readonly<Record<string, 结构_角色>>;
export const hasRecipe = (r: 结构_角色): boolean => Object.keys(r.制造需求.需求物品).length + Object.keys(r.制造需求.需求材料).length > 0;

/** 修炼系统.解锁配方判断 L415: any first acquired recipe-bearing row is learned, including a 不需解锁 row. */
export function unlockRecipe(cult: 修炼系统, card: BP_ManeActor | null): void {
  if (!card || !hasRecipe(card.角色配置)) return; const save = craftSave(cult.world); if (save.已解锁配方.includes(card.名字)) return;
  cult.fx.ui({ op: 'open', widget: 'UI_奖励提示', data: { 额外文本: `习得配方：\r\n"${card.显示名.zh}"`, 类型: 2 } });
  save.已解锁配方.push(card.名字); // EMS custom fields are serialized by saveBlob, separate from actor snapshot.
}

/** UI_制造页 L58–L2970; pure quantity=-2 source filtering, without the historical G2 ordinary-loot admission list. */
const groupCandidates = new Map<string,{name:string;label:string;rows:string[]}[]>();
export function recipeGroups(w: World, fromItem: string | null, type = 0): { name: string; label: string; rows: string[] }[] {
  const key=JSON.stringify([fromItem,type]);let candidates=groupCandidates.get(key);
  if(!candidates){candidates=staticGroups(fromItem,type);groupCandidates.set(key,candidates);}
  // All expensive tag/recipe tests depend only on immutable source rows; floor unlock is the only run-dependent part.
  return candidates.map(g=>({...g,rows:g.rows.filter(name=>w.mode.当前总层数>=recipeRows[name].解锁.层数)})).filter(g=>g.rows.length>0);
}
function staticGroups(fromItem:string|null,type:number): {name:string;label:string;rows:string[]}[] {
  const kinds = ['', '制造.锻造', '制造.缝纫', '制造.工程', '制造.烹饪', '制造.炼金', '制造.秘术'];
  const out: { name: string; label: string; rows: string[] }[] = [];
  for (const [name, group] of Object.entries(数据表_制造分类.rows)) {
    const query = [...group.标签]; if (kinds[type]) query.push(kinds[type]);
    const exclude = query.length ? ['忽略'] : ['忽略', '可交互.修炼牌.传奇', '可交互.修炼牌.稀有'];
    const rows = Object.entries(recipeRows).filter(([, r]) => {
      const tags = new TagSet(r.标签), need = r.制造需求;
      const match = fromItem !== null ? Object.hasOwn(need.需求物品, fromItem) : Object.keys(need.需求物品).length === 0 && Object.keys(need.需求材料).length > 0;
      return match && tags.hasAll(query) && !tags.hasAny(exclude);
    }).map(([key]) => key);
    if (rows.length) out.push({ name, label: group.显示名.zh, rows });
  }
  return out;
}
export function recipeUnlocked(w: World, name: string): boolean {
  const row = recipeRows[name]; return !!row && (new TagSet(row.标签).has('可交互.修炼牌.不需解锁') || craftSave(w).已解锁配方.includes(name));
}
/** UI_物品图鉴 L9489: size*rawprice*2^(quality-1)+rawpremium, no generated actor or RNG in the preview. */
export function recipePrice(name: string, quality: number): number {
  const row = recipeRows[name]; if (!row) return 0; const stats = 词条映射From(row.科学词条), tags = new TagSet(row.标签);
  const size = tags.has('可交互.修炼牌.大型') ? 3 : tags.has('可交互.修炼牌.中型') ? 2 : 1;
  return FTrunc(size * 科学数变普通(科学映射原始值(stats, '价格', false)) * FTrunc(2 ** (quality - 1)) + 科学数变普通(科学映射原始值(stats, '溢价', false)));
}
