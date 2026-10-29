/** 修炼系统.txt1161–1317: preserve source snapshot/live-loop ordering, unload, price refund, tagged effects and
 * usable-card death versus ordinary destruction. UI_物品交互按钮 L5183 grabs before calling this function.
 * The direct source implementation returns 精核 at current price; do not replace it with the older dust draft.
 */
import { 函数库_工具 } from '../../bp/index.ts';
import { BP_Actor_Card } from '../../sim/card.ts';
import type { 修炼系统 } from '../../sim/cult.ts';
import type { World } from '../../sim/world.ts';
import type { CommandResult, CommandSpec } from '../../api/commands.ts';

const remove=(list:(BP_Actor_Card|null)[],card:BP_Actor_Card)=>{let i;while((i=list.indexOf(card))>=0)list.splice(i,1);};
const cards=(w:World)=>[...w.cult.已装备牌,...w.cult.背包里牌].filter((c):c is BP_Actor_Card=>!!c&&w.isValid(c)&&!c.死掉了&&c.名字!=='锁定格');

export function dismantle(self:修炼系统,card:BP_Actor_Card|null,fromEnchant:boolean,force:boolean):void{
  const w=self.world,m=w.mode;if(!card||!w.isValid(card)||self.未拾取牌.includes(card)&&!force)return;
  self.当前分解的牌=card;const group=card.所在格子组,all=[...self.已装备牌,...self.背包里牌];
  remove(self.已装备牌,card);remove(self.背包里牌,card);
  // Source 从仓库中移除 is a no-op for equipment/backpack; stash persistence itself is still pending.
  if(card.所在格子组标签==='UI.修炼物品在仓库')card.从仓库中移除();
  if(fromEnchant){m.卸载目标(card);函数库_工具.销毁目标和子物体(self,card);}
  else{
    m.玩家角色?.精神系统(Math.imul(Math.imul(card.尺寸,card.品质),3),0,'分解物品',false);
    m.卸载目标(card);
    if(card.当前价格>0){m.增加金币_收入(false,false,card.当前价格,null);card.fx.headUp(card,{ns:'literal',key:`+${card.当前价格}精核`});}
    // Both effect traversals are live, while the list of all equipment+backpack cards is the source snapshot.
    for(let i=0;i<card.拥有的效果.length;i++){
      const e=card.拥有的效果[i];if(!e||!w.isValid(e)||!e.HasMatchingGameplayTag('效果.时机.分解后'))continue;
      e.触发时机='效果.时机.分解后';e.持续中触发(e.触发时机);
    }
    for(let i=0;i<all.length;i++){
      const other=all[i];if(!other)continue;
      for(let j=0;j<other.拥有的效果.length;j++){
        const e=other.拥有的效果[j];if(!e||!w.isValid(e)||!e.HasMatchingGameplayTag('效果.时机.有物品被分解'))continue;
        e.触发时机='效果.时机.有物品被分解';e.持续中触发(e.触发时机);
      }
    }
    card.fx.vfx('CatapultHero/粒子/粒子_分解',self.当前分解的牌?.K2_GetActorLocation()??card.K2_GetActorLocation());
    m.更新轮回战斗统计('分解物品',1);
    if(card.可使用)card.检查死亡(true,true);else 函数库_工具.销毁目标和子物体(self,card);
    self.fx.sound('CatapultHero/声音/魔法水晶添加');self.fx.ui({op:'update',widget:'UI_物品盒子'});
  }
  if(m.场上有敌人){group?.更新格子信息(0);return;}
  m.当前抓住卡牌=null;self.检查可合成牌();
  // Manufacture demand is a pure live projection of the remaining input cards/materials.
  m.玩家角色?.保存英雄信息();
}

export function dismantleCommand(w:World,id:number):CommandResult{
  const card=cards(w).find(c=>c.id===id);
  if(!card||w.modal.current||!w.mode.玩家角色||w.mode.玩家角色.死掉了)return{ok:false,reason:'item is not available for dismantling'};
  if(w.mode.场上有敌人){card.fx.headUp(card,{ns:'literal',key:'现在不能这么做。'});return{ok:false,reason:'cannot dismantle while enemies remain'};}
  // Source disarm gate explicitly excludes dismantle (type1); do not apply the use/rearrange restriction.
  card.被抓起(true);w.cult.分解牌(card,false,false);return{ok:true};
}
export function dismantleLegal(w:World):CommandSpec[]{
  if(w.modal.current||w.mode.场上有敌人||!w.mode.玩家角色||w.mode.玩家角色.死掉了)return[];
  const list=cards(w);return list.length?[{type:'item.dismantle',params:{item:list.map(c=>c.id)}}]:[];
}
