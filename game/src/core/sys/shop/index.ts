/** Source controller merchant and product interaction; source classes own shelf and task lifecycle. */
import type { Systems } from '../../bp/systems.ts';
import type { BP_ManeActor } from '../../sim/actor.ts';
import type { BpObject } from '../../sim/object.ts';
import { 函数库_工具 } from '../../bp/index.ts';
import { 科学映射原始值 } from '../../math/stats.ts';
import { 科学数变普通 } from '../../math/sci.ts';
import { FTrunc } from '../../math/kismet.ts';
interface Shop extends BpObject {可购买数量:number;商品映射:Map<BP_ManeActor,BpObject&{购买后效果():void;价格显示:boolean;价格:number}>;商人:BP_ManeActor|null}
export const shop: Systems['shop'] = {
  蓝图_主角色控制器:{
    交互到商人(c){const m=c.world.mode;if(m.当前环节==='进入商店'){if(m.当前任务实例)(m.当前任务实例 as BpObject&{未完成:boolean}).未完成=false;m.新回合前();}},
    交互到商品(c){const m=c.world.mode,s=m.商店 as Shop|null,a=c.当前交互角色;if(!s||!a||s.可购买数量===0||a.死掉了)return;
      const price=()=>FTrunc(科学数变普通(科学映射原始值(a.词条,'价格',false)));
      if(m.金币<price()){c.fx.headUp(m.玩家角色??c,{ns:'literal',key:'我买不起。'});return;}
      if(!函数库_工具.使目标执行自身技能(c,0,a,false).条件通过)return;
      m.增加金币_收入(false,false,-price(),null);c.fx.sound('CatapultHero/声音/丢硬币');
      if(!a.HasMatchingGameplayTag('可交互.角色.AI.商品.无限')){a.K2_DetachFromActor();s.商品映射.get(a)?.购买后效果();}
    }
  },
};
