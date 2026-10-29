/** Source card enchant methods and UI_物品交互按钮 type4 extraction. Apply has no coin cost; extraction costs sum(levels). */
import type{Systems}from'../../bp/systems.ts';import type{World}from'../../sim/world.ts';import{BP_Actor_Card}from'../../sim/card.ts';import type{蓝图_能力}from'../../ability/ability.ts';import type{蓝图_效果}from'../../ability/effect.ts';import{函数库_工具}from'../../bp/index.ts';import{Array_Random,Array_RandomFromStream,MakeRandomStream}from'../../rng/ue.ts';import{数据表_技能_附魔,数据表_修炼物品_通用}from'../../../content/demo/tables.ts';import type{CommandSpec}from'../../api/commands.ts';import type{ModalView}from'../../api/view.ts';
const TABLE='CatapultHero/数据表/技能/数据表_技能_附魔',TAG='能力.时机.附魔',HOVER='CatapultHero/BP/Skill/效果/物品/蓝图_效果_附魔悬停物品';
type Hover=蓝图_效果&{目标牌:BP_Actor_Card|null;判断目标可附魔():{通过:boolean}};
const cards=(w:World)=>[...w.cult.已装备牌,...w.cult.背包里牌].filter((c):c is BP_Actor_Card=>!!c&&w.isValid(c)&&!c.死掉了&&c.名字!=='锁定格');
export const enchants=(c:BP_Actor_Card)=>c.拥有的被动能力.filter((a):a is 蓝图_能力=>!!a&&c.world.isValid(a)&&a.HasMatchingGameplayTag(TAG));
const run=(w:World)=>(w.sys.save as {GetCustomSave?(w:World):{轮回次数:number}}).GetCustomSave?.(w).轮回次数??0;
const canManage=(w:World)=>!w.modal.current&&!!w.mode.玩家角色&&!w.mode.玩家角色.死掉了&&!w.mode.玩家角色.HasMatchingGameplayTag('状态.缴械');
/** Read-only equivalent of 附魔悬停物品.判断目标可附魔. Do not set its 目标牌 while enumerating legal input. */
function acceptsTarget(stone:BP_Actor_Card,target:BP_Actor_Card):boolean{
 if(stone===target||target.名字==='祝福之灵'||target.名字==='空附魔石'||target.OwnedGameplayTags.hasAny(['忽略','可交互.修炼牌.附魔']))return false;
 return stone.拥有的效果.some(e=>e&&stone.world.isValid(e)&&e.def.path===HOVER&&e.来自技能&&(e.来自技能.目标标签.size===0||target.OwnedGameplayTags.hasAny(e.来自技能.目标标签.toArray())));
}
export function extractCost(c:BP_Actor_Card):number{return enchants(c).reduce((n,a)=>(n+a.等级)|0,0);}
export function storeEnchants(c:BP_Actor_Card):void{c.附魔存档=enchants(c).map(a=>({能力名:a.能力名,技能配置:a.技能配置,上一次等级:a.上一次等级,等级:a.等级,冷却秒:0,冷却回合:0,获取轮次:a.获取轮次}));}
function add(c:BP_Actor_Card,rows:string[],level:number,creation:boolean,fx:boolean,round:number):void{
 if(creation){if(c.HasMatchingGameplayTag('可交互.修炼牌.附魔'))return;
  const pool=Object.entries(数据表_技能_附魔.rows).filter(([,r])=>!r.标签.includes('忽略')&&(!(r.副条件[0]?.目标标签.length)||c.OwnedGameplayTags.hasAny(r.副条件[0].目标标签))).map(([n])=>n);
  if(pool.length)c.添加技能({DataTable:TABLE,RowName:pool[Array_Random(c.world.rng.meta,pool)]!},c.等级,round); // CORE-M-129 #2
 }else{c.被抓起(true);for(const row of rows)c.添加技能({DataTable:TABLE,RowName:row},level,round);c.被放下(true);}
 storeEnchants(c);c.拥有的能力=[...c.拥有的被动能力,...c.拥有的主动能力];c.更新外观数据();
 if(fx){c.fx.flash(c,.2);c.fx.vfx('CatapultHero/粒子/粒子_附魔',c);c.fx.sound('CatapultHero/声音/洗礼');}
}
function remove(c:BP_Actor_Card,which:蓝图_能力|null):void{
 const list=which&&c.world.isValid(which)?[which]:enchants(c),effects=c.拥有的效果.filter((e):e is 蓝图_效果=>!!e&&c.world.isValid(e)&&list.includes(e.来自技能!));
 for(const e of effects)e.销毁效果();for(const a of list){const i=c.拥有的被动能力.indexOf(a);if(i>=0)c.拥有的被动能力.splice(i,1);函数库_工具.销毁目标和子物体(c,a);}storeEnchants(c);c.拥有的能力=[...c.拥有的被动能力,...c.拥有的主动能力];
}
export function applyStone(stone:BP_Actor_Card,target:BP_Actor_Card,level:number):void{
 const w=stone.world,rows=[...stone.拥有的附魔能力.values()];w.mode.更新轮回战斗统计('进行附魔',1);
 if(target.尺寸===1){target.移除附魔(null);target.添加附魔(rows,level,false,true,stone.获取轮次);return;}
 if(target.尺寸!==2&&target.尺寸!==3)return;
 if(target.附魔存档.length<target.尺寸){target.添加附魔(rows,level,false,true,stone.获取轮次);return;}
 const current=enchants(target),view:ModalView={kind:'enchantReplace',current:current.map(a=>a.描述.zh),incoming:[...stone.拥有的附魔能力.keys()][0]?.描述.zh??'',target:target.id,rows,level};
 w.modal.open(view,answer=>{
  if(answer.type!=='modal.pick')return;const chosen=current[answer.option];if(!chosen||!w.isValid(target)||!w.isValid(chosen))return;
  // Button L98 removes chosen ability; page close L2214 adds incoming with REMOVED ability's acquisition round.
  const oldRound=chosen.获取轮次;target.移除附魔(chosen);w.modal.close();target.添加附魔(rows,level,false,true,oldRound);
 });
}
function extract(w:World,c:BP_Actor_Card):void{
 const list=enchants(c),names:string[]=[],qualities:number[]=[],rounds:number[]=[];
 for(const a of list)for(const[name,row]of Object.entries(数据表_修炼物品_通用.rows)){
  if(row.标签.includes('忽略')||row.随机普通技能[0]?.RowName!==a.能力名)continue;names.push(name);qualities.push(a.品质);if(!rounds.includes(a.获取轮次))rounds.push(a.获取轮次);break;
 }
 // Source names/qualities use Add but rounds use AddUnique; out-of-range reads become0.
 for(let i=0;i<names.length;i++)w.cult.创建牌到侧栏(names[i]!,qualities[i]!,null,[],rounds[i]??0,new Map());
 c.移除附魔(null);c.更新外观数据();w.cult.检查可合成牌();c.附魔存档=[];w.cult.修炼物品格_已装备?.更新格子信息(0);w.cult.修炼物品格_在背包?.更新格子信息(0);
}
export const enchant:Systems['enchant']&{applyStone:typeof applyStone;extractCost:typeof extractCost}={
 applyStone,extractCost,
 BP_Actor_Card:{
  自身是附魔卷轴判断(self,target){if(!self.HasMatchingGameplayTag('可交互.修炼牌.附魔'))return{失败了:true};let applied=false;
   for(let i=0;i<self.拥有的效果.length;i++){const effect=self.拥有的效果[i];if(!effect||!self.world.isValid(effect)||effect.def.path!==HOVER)continue;const h=effect as Hover;h.目标牌=target;if(target&&h.判断目标可附魔().通过){applied=true;h.持续中触发('效果.时机.主动激活');}}
   if(!applied&&target&&!self.可合成目标牌.includes(target))self.fx.headUp(self,{ns:'literal',key:'无法附魔此物品。'});return{失败了:!applied};},
  获取附魔能力(self){const list=enchants(self);return{获取到的数组:list,有遗产:list.some(a=>a.获取轮次!==run(self.world))};},
  添加附魔:add,移除附魔:remove,储存附魔:storeEnchants,
 },
 函数库_工具:{获取附魔标签(_ctx,layer,seed){const tags=layer.标签.length?layer.标签:['可交互.修炼牌.附魔.充能','可交互.修炼牌.附魔.伤害','可交互.修炼牌.附魔.治愈','可交互.修炼牌.附魔.护甲'];return{OutItem:tags[Array_RandomFromStream(MakeRandomStream(seed),tags)]??''};}},
 commands:{
  'item.enchant':(w,c)=>{const all=cards(w),stone=all.find(x=>x.id===c.stone),target=all.find(x=>x.id===c.target);if(!canManage(w)||w.cult.背包关闭了||!stone||!target||stone===target)return{ok:false,reason:'enchantment target is unavailable'};return{ok:!stone.自身是附魔卷轴判断(target).失败了};},
  'item.extract':(w,cmd)=>{const c=cards(w).find(c=>c.id===cmd.item);if(!canManage(w)||w.mode.场上有敌人||!c||!enchants(c).length||extractCost(c)>w.mode.金币)return{ok:false,reason:'extraction is unavailable or unaffordable'};w.mode.增加金币_收入(false,true,-extractCost(c),c);extract(w,c);return{ok:true};},
 },
 legal(w){const out:CommandSpec[]=[];if(!canManage(w))return out;const all=cards(w),stones=all.filter(c=>c.HasMatchingGameplayTag('可交互.修炼牌.附魔'));
  if(!w.cult.背包关闭了)for(const stone of stones){const targets=all.filter(target=>acceptsTarget(stone,target));if(targets.length)out.push({type:'item.enchant',params:{stone:[stone.id],target:targets.map(c=>c.id)}});}
  const extractable=all.filter(c=>enchants(c).length&&extractCost(c)<=w.mode.金币);if(!w.mode.场上有敌人&&extractable.length)out.push({type:'item.extract',params:{item:extractable.map(c=>c.id)}});return out;},
};
