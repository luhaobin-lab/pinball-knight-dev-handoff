/** EMS card actors: exact SaveGame properties from BP_ManeActor/BP_Actor_Card manifests, plus saved actor transform.
 * Unowned side offers and dead cards are deliberately discarded by ActorLoaded, as in Card L12106.
 */
import{BP_Actor_Card}from'../../sim/card.ts';import type{World}from'../../sim/world.ts';import type{修炼系统}from'../../sim/cult.ts';import type{BpObject}from'../../sim/object.ts';import{TagSet}from'../../sim/tags.ts';import{函数库_工具}from'../../bp/index.ts';import{科学数乘除}from'../../math/sci.ts';import{GetCustomSave,toJson,fromJson}from'./ems.ts';
export const CARD_SAVED=[
 '死掉了','角色配置','品质','等级','成长率','生命百分比','词条','标签','唯一ID','名字','显示名','锻造词条','是精英','弹力点','种子','暴击保护计数','当前是暴击',
 '所在起始格序号','下一级计数','附魔存档','额外标签_存档','所在格子组标签','未获取','获取轮次',
]as const;
interface CardRecord{readonly fields:Record<string,unknown>;readonly position:{x:number;y:number;z:number}}
export interface InventorySnapshot{readonly version:1;readonly cards:readonly CardRecord[]}
type RuntimeWorld=World&{objects?():readonly BpObject[]};
export function cardPreSave(card:BP_Actor_Card):void{
 if(card.world.isValid(card.所在格子组))card.未获取=card.world.mode.玩家角色?.死掉了??false;
 else{card.未获取=true;if(card.所在格子组标签!=='UI.修炼物品在仓库')return;}
 card.储存附魔();
}
export function inventorySnapshot(w:World):InventorySnapshot{
 const cards=((w as RuntimeWorld).objects?.()??[]).filter((o):o is BP_Actor_Card=>o instanceof BP_Actor_Card&&o.valid);
 return{version:1,cards:cards.map(c=>{cardPreSave(c);const fields:Record<string,unknown>={};for(const key of CARD_SAVED)fields[key]=toJson(key==='标签'?c.标签.toArray():c[key]);return{fields,position:c.K2_GetActorLocation()};})};
}
export function cardLoaded(c:BP_Actor_Card):void{
 const w=c.world;if(c.未获取||c.死掉了){函数库_工具.销毁目标和子物体(c,c);return;}
 const saved=[...c.附魔存档],tags=new Map(c.额外标签_存档);c.激活角色(true);c.已揭示=true;
 if(!w.cult.未拾取牌.includes(c))w.cult.未拾取牌.push(c);
 for(const a of saved)c.添加技能({DataTable:'CatapultHero/数据表/技能/数据表_技能_附魔',RowName:a.能力名},a.等级,a.获取轮次);
 for(const tag of tags.values())c.OwnedGameplayTags.add(tag);
 c.拥有的能力=[...c.拥有的被动能力,...c.拥有的主动能力];c.更新外观数据();
}
/** EMS actor pass2: clear the old level's cards, construct from saved scalars, then call the original ActorLoaded. */
export function loadInventoryActors(w:World,snapshot:unknown):void{
 const saved=snapshot as Partial<InventorySnapshot>|undefined;if(saved?.version!==1||!Array.isArray(saved.cards))return; // oldsavev0 compatibility
 const cult=w.cult;
 for(const c of ((w as RuntimeWorld).objects?.()??[]).filter((o):o is BP_Actor_Card=>o instanceof BP_Actor_Card&&o.valid))函数库_工具.销毁目标和子物体(cult,c);
 cult.已装备牌=[];cult.背包里牌=[];cult.未拾取牌=[];w.mode.已装备=[];
 for(const group of[cult.修炼物品格_已装备,cult.修炼物品格_在背包])group?.更新格子信息(0);
 for(const rec of saved.cards){
  if(!rec||typeof rec!=='object'||!rec.fields||typeof rec.fields.名字!=='string'||!rec.fields.角色配置)throw Error('Invalid saved inventory card');
  const c=w.spawn(BP_Actor_Card,c=>{for(const key of CARD_SAVED){if(!Object.hasOwn(rec.fields,key))continue;const value=fromJson(rec.fields[key]);(c as unknown as Record<string,unknown>)[key]=key==='标签'?new TagSet(Array.isArray(value)?value:[]):value;}},rec.position);
  c.ActorLoaded();
 }
}
/** 修炼系统 L15779 -> Delay.5 -> equipment/backpack slots -> clear staging -> restore HP/MP percentages. */
export function readInventory(cult:修炼系统):void{
 const w=cult.world,saved=GetCustomSave(w).actorSnapshot?.inventory as Partial<InventorySnapshot>|undefined;
 if(saved?.version!==1)return;
 cult.delay('save inventory L15779',.5,()=>{
  for(const card of [...cult.未拾取牌]){
   if(!w.isValid(card))continue;
   const equip=card.所在格子组标签==='UI.修炼物品已装备',bag=card.所在格子组标签==='UI.修炼物品在背包';
   if(!equip&&!bag)continue;
   const group=equip?cult.修炼物品格_已装备:cult.修炼物品格_在背包;
   const cell=group?.格子实例数组[card.所在起始格序号];if(!group||!cell)throw Error(`Saved item has invalid source slot: ${card.名字}/${card.所在起始格序号}`);
   if(equip)cult.装备牌(card);else if(!cult.背包里牌.includes(card))cult.背包里牌.push(card);
   group.放入物品到指定格(card,cell,false);card.更新价格(false);
  }
  cult.未拾取牌=[];cult.检查可合成牌();const hero=w.mode.玩家角色;if(!hero)return;
  hero.生命百分比=w.mode.英雄生命百分比保存;hero.魔力百分比=w.mode.英雄魔力百分比保存;
  hero.当前生命=科学数乘除({系数:hero.生命百分比,指数:0},hero.当前最大生命,false);
  hero.当前魔力=科学数乘除({系数:hero.魔力百分比,指数:0},hero.当前最大魔力,false);
  w.mode.fx.ui({op:'update',widget:'save.inventory.ready'});
 });
}
