/** UI_制造页 source logic as simulation data. UI_制造页 L58/L641/L6676; source slots use existing 未拾取牌. */
import type { 修炼系统 } from '../../sim/cult.ts';
import { BP_Actor_Card } from '../../sim/card.ts';
import type { World } from '../../sim/world.ts';
import { tutorialTip } from '../../sim/tutorial.ts';
import type { CraftView } from '../../api/view.ts';
import { Array_AddUnique, Array_RemoveItem } from '../../sim/engine.ts';
import { 复制词条映射 } from '../../math/stats.ts';
import { materialFns } from './materials.ts';
import { craftSave, recipeGroups, recipePrice, recipeRows, recipeUnlocked } from './recipes.ts';
import { 数据表_材料 } from '../../../content/demo/tables.ts';
import { demoClasses } from '../../../content/demo/classes.ts';

interface CraftState {
  fromItem: string | null; category: number; selected: string | null; extraQuality: number;
  outputIds: number[];
}
type Host = 修炼系统 & { ug_craftPage?: CraftState };
export const readCraft = (w: World): CraftState | null => w.cult.制造页关闭了 ? null : (w.cult as Host).ug_craftPage ?? null;
const live = (w: World, list: readonly (BP_Actor_Card | null)[]): BP_Actor_Card[] => list.filter((c): c is BP_Actor_Card => !!c && w.isValid(c));
const inventory = (w: World) => live(w, [...w.cult.已装备牌, ...w.cult.背包里牌]);
const inputs = (w: World, s: CraftState) => live(w, w.cult.未拾取牌).filter(c => !s.outputIds.includes(c.id));
const outputs = (w: World, s: CraftState) => live(w, w.cult.未拾取牌).filter(c => s.outputIds.includes(c.id));
/** SCS slot locations relative to the cultivation actor; source slot placement adds size offset on world X. */
function slotPosition(w:World,key:string,size:number){const p=(demoClasses['CatapultHero/BP/环境/修炼/修炼系统'].components as Record<string,{RelativeLocation?:{X:number;Y:number;Z:number}}>)[key]?.RelativeLocation??{X:0,Y:0,Z:0},root=w.cult.K2_GetActorLocation();return{x:root.x+p.X+([104,52,0][size-1]??0),y:root.y+p.Y,z:root.z+p.Z};}
export function recipeSupported(w: World, name: string): boolean {
  const r = recipeRows[name]; return !!r && [...r.固定技能,...r.随机普通技能,...r.随机精英技能].every(h => !h.DataTable || w.isRowPorted(h.DataTable, h.RowName));
}
export function canOpenCraft(w: World): boolean { return w.mode.当前环节 !== '进入营地' && w.mode.当前环节 !== '死亡结算' && !w.modal.current && !!w.mode.玩家角色 && !w.mode.玩家角色.死掉了 && !w.mode.场上有敌人 && !w.mode.玩家角色.OwnedGameplayTags.has('状态.缴械'); }
function recover(w: World, list: readonly BP_Actor_Card[]): boolean { let failed = 0; for (const c of list) if (!w.cult.获取牌(c).成功) failed++; return failed === 0; }

/** 页面切换 L112/L17374: closing an active craft page first acquires all remaining cards, and refuses when full. */
export function closeCraft(w: World): boolean {
  const s = readCraft(w); if (s && !recover(w, [...live(w, w.cult.未拾取牌)])) return false;
  w.cult.制造页关闭了 = true; w.cult.材料页关闭了 = true; w.cult.打开页面类型 = '无'; w.mode.玩家角色?.保存英雄信息(); return true;
}
export function openCraft(w: World, from: BP_Actor_Card | null = null, category = 0): boolean {
  if (!canOpenCraft(w)) return false;
  if (readCraft(w) && !closeCraft(w)) return false;
  if (w.cult.未拾取牌.length && !recover(w, [...live(w, w.cult.未拾取牌)])) return false;
  const groups = recipeGroups(w, from?.名字 ?? null, category), first = groups[0]?.rows[0] ?? null;
  (w.cult as Host).ug_craftPage = { fromItem: from?.名字 ?? null, category, selected: first, extraQuality: 0, outputIds: [] };
  w.cult.制造页关闭了 = false; w.cult.材料页关闭了 = false; w.cult.背包关闭了 = false; w.cult.打开页面类型 = '制造页';
  if (!from) tutorialTip(w,13);
  return true;
}
export function selectRecipe(w: World, name: string): boolean {
  const s = readCraft(w); if (!s || !recipeUnlocked(w,name) || !recipeGroups(w,s.fromItem,s.category).some(g => g.rows.includes(name))) return false;
  if (s.selected !== name) {
    if (!recover(w, outputs(w,s))) return false; s.outputIds = [];
    const next = recipeRows[name].制造需求, old = s.selected ? recipeRows[s.selected]?.制造需求 : undefined;
    const remaining = { ...next.需求物品 }; let compatible = true;
    for (const c of inputs(w,s)) { remaining[c.名字] = (remaining[c.名字] ?? 0) - 1; if (remaining[c.名字] < 0) compatible = false; }
    // Source checks new material requirements against old ones, not symmetric map equality.
    if (old && !Object.entries(next.需求材料).every(([k,v]) => old.需求材料[k] === v)) compatible = false;
    if (!compatible && !recover(w,[...inputs(w,s)])) return false;
  }
  s.selected = name; s.extraQuality = 0; return true;
}
export function canPut(w: World, card: BP_Actor_Card | null): boolean {
  const s = readCraft(w); if (!s?.selected || !card || !w.isValid(card)) return false;
  const need = recipeRows[s.selected].制造需求.需求物品[card.名字]; return need !== undefined && inputs(w,s).filter(c => c.名字 === card.名字).length < need;
}
export function putItem(cult: 修炼系统, card: BP_Actor_Card | null): { 放入了: boolean } {
  const w = cult.world, s = readCraft(w); if (!s || !card || !canPut(w,card)) return { 放入了: false };
  recover(w, outputs(w,s)); s.outputIds = [];
  const slots=Object.entries(recipeRows[s.selected!].制造需求.需求物品).flatMap(([name,n],index)=>Array.from({length:n},(_,k)=>({name,index:index+k})));
  const already=inputs(w,s).filter(c=>c.名字===card.名字).length,slot=slots.filter(x=>x.name===card.名字)[already]?.index??0;
  (w.sys.inventory as typeof w.sys.inventory & {detachForCraft(c:BP_Actor_Card):void}).detachForCraft(card);
  card.K2_SetActorLocation(slotPosition(w,'制造前槽'+slot,card.尺寸));
  card.fx.sound(card.音效[0] ?? null); card.当前价格 = 0; card.已揭示 = true;
  Array_AddUnique(cult.未拾取牌,card); Array_RemoveItem(cult.已装备牌,card); Array_RemoveItem(cult.背包里牌,card);
  card.所在格子组?.更新格子信息(0); card.被抓起_Q = false; return { 放入了: true };
}
function quality(w: World,s: CraftState): number { return Math.max(1,...live(w,w.cult.未拾取牌).map(c => c.品质)) + s.extraQuality; }
export function craftView(w: World): CraftView | null {
  const s = readCraft(w); if (!s) return null;
  const row = s.selected ? recipeRows[s.selected] : undefined, need = row?.制造需求, placed = inputs(w,s), made = outputs(w,s);
  const q = quality(w,s), multiplier = Math.trunc(2 ** (q - 1)), price = s.selected ? recipePrice(s.selected,q) : 0;
  const material = new Map(Object.entries(need?.需求材料 ?? {})), check = materialFns.材料需求判断!(w.cult, material, w.mode.材料包, multiplier, false);
  // Source L144 assigns loop-index + current count, not an accumulator.
  let itemCount = 0; Object.values(need?.需求物品 ?? {}).forEach((n,i) => { itemCount = i+n; });
  const adjust = !!need && !Object.keys(need.需求物品).length && Object.keys(need.需求材料).length > 0 && !made.length;
  const selectedUnlocked = !!s.selected && recipeUnlocked(w,s.selected), supported = !!s.selected && recipeSupported(w,s.selected);
  return {
    groups: recipeGroups(w,s.fromItem,s.category).map(g => ({...g,rows:g.rows.map(n => ({row:n,label:recipeRows[n].描述[0]?.zh??n,unlocked:recipeUnlocked(w,n),supported:recipeSupported(w,n)}))})),
    selected:s.selected, outputQuality:q, extraQuality:s.extraQuality, price,
    // L498 counts every unpicked card, including a still-unclaimed output. A one-item recipe can therefore be paid/recrafted.
    canCraft: !!row && selectedUnlocked && supported && live(w,w.cult.未拾取牌).length === itemCount && check.满足需求 && w.mode.金币 >= price,
    canIncrease:adjust&&s.extraQuality>=0&&s.extraQuality<3,canDecrease:adjust&&s.extraQuality>0&&s.extraQuality<=3,
    requirements:Object.entries(need?.需求物品??{}).map(([name,n])=>({row:name,need:n,placed:placed.filter(c=>c.名字===name).length,candidates:inventory(w).filter(c=>c.名字===name&&!c.死掉了).map(c=>({id:c.id,quality:c.品质}))})),
    materials:Object.entries(数据表_材料.rows).map(([name,m])=>({row:name,label:m.显示名.zh,have:w.mode.材料包.get(name)??0,need:Math.imul(material.get(name)??0,multiplier)})),
    inputs:placed.map(c=>({id:c.id,row:c.名字,quality:c.品质})),outputs:made.map(c=>({id:c.id,row:c.名字,quality:c.品质})),
  };
}
export function changeQuality(w: World, delta: number): boolean { const s = readCraft(w), v = craftView(w); if (!s || !v || !(delta===1?v.canIncrease:delta===-1&&v.canDecrease)) return false; s.extraQuality += delta; w.cult.fx.sound('CatapultHero/声音/按钮类3'); return true; }
/** Source L6676: pay, subtract material, copy first ingredient's state, destroy ingredients, bless, generate revealed free result. */
export function manufacture(w: World, name: string, count: number): boolean {
  const s = readCraft(w), v = craftView(w); if (!s || !v?.canCraft || name !== s.selected || count !== 1) return false;
  const row = recipeRows[name], ingredient = live(w,w.cult.未拾取牌)[0], stats = ingredient ? 复制词条映射(ingredient.词条) : new Map(), enchants = ingredient?.附魔存档.map(e => ({...e})) ?? [];
  const extra = s.extraQuality; w.mode.增加金币_收入(false,false,-v.price,null);
  materialFns.修改材料数量!(w.cult,w.mode.材料包,new Map(Object.entries(row.制造需求.需求材料)),Math.trunc(2**(v.outputQuality-1)),true);
  w.cult.清除未拾取牌();
  if (extra>0) for (const q of [[1],[3],[4,3]][extra-1]??[]) w.cult.创建牌到侧栏('祝福之灵',q,null,[],craftSave(w).轮回次数,stats);
  const card=w.cult.生成卡牌('CatapultHero/数据表/合成数据表_修炼物品',name,slotPosition(w,'制造后槽0',3),'None',false,v.outputQuality,0,enchants,stats,false,craftSave(w).轮回次数,-1).卡牌实例;
  if (!card) return false;
  card.K2_SetActorLocation(slotPosition(w,'制造后槽0',card.尺寸));
  card.当前价格=0;card.已揭示=true;card.更新外观数据();card.fx.sound(card.音效[1]??null);
  s.outputIds=live(w,w.cult.未拾取牌).map(c=>c.id);s.extraQuality=0;
  w.mode.玩家角色?.精神系统(Math.imul(Math.imul(card.尺寸,card.品质),8),0,'制造物品',true);return true;
}
export function takeCraftItem(w:World,id:number):boolean { const s=readCraft(w),c=s&&live(w,w.cult.未拾取牌).find(x=>x.id===id);if(!s||!c)return false;const ok=w.cult.获取牌(c).成功;if(ok)s.outputIds=s.outputIds.filter(n=>n!==id);return ok; }
