/** Source L4584/L2836/L96: source point selection/shuffle before cap20; actual detached ball atz32; nonfatigued bounce activates live children. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 蓝图_效果_电击球 } from './蓝图_效果_电击球.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make效果配置 } from '../../../../../core/bp/structs.ts';
import { Array_Shuffle } from '../../../../../core/rng/ue.ts';
import { applyEffect } from '../蓝图_效果_可控弹射.ts';
import type { AssetPath,Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_雷云精灵 extends 蓝图_效果 {
 static override readonly path:AssetPath='CatapultHero/BP/Skill/效果/物品/蓝图_效果_雷云精灵';
 override 持续中触发(t:Tag):void{const s=this.来自技能,o=this.拥有者;if(!s||!o)return;
  if(t==='效果.时机.反弹时'){if(o.疲劳了)return;for(let i=0;i<s.创建的效果.length;i++)s.创建的效果[i]?.持续中触发('效果.时机.主动激活');return;}
  if(t==='效果.时机.结束层时'){for(let i=0;i<s.创建的效果.length;i++)s.创建的效果[i]?.销毁效果();return;} // Source live list: each child's teardown removes itself.
  if(t!=='效果.时机.自身完成充能')return;
  for(let i=0;i<=this.触发次数-1;i++){
   const points=函数库_技能.获取目标范围空地(this,60,60,6,o,false,false,0).查询到的位置;Array_Shuffle(this.world.rng.combat,points);
   if(s.创建的效果.length>=20||!this.world.isValid(o)||o.死掉了)continue;
   const cls=蓝图_效果_电击球.path,cfg=make效果配置({效果类:cls,持续时间:-1,触发间隔:1,持续回合:3,叠加层数:1,唯一:false,检查效果名:false,叠加上限:999});
   const r=applyEffect(this,{cfg,owner:o,释放者:o,来自技能:s,效果名:函数库_技能.获取效果名(this,s,cls).效果名字,classOf:o});if(r.refreshed||!r.effect)continue;
   r.effect.K2_DetachFromActor();const p=points[0]??{x:0,y:0,z:0};r.effect.K2_SetActorLocation({x:p.x,y:p.y,z:32});if(!s.创建的效果.includes(r.effect))s.创建的效果.push(r.effect);r.effect.激活效果('');
  }
 }
}
