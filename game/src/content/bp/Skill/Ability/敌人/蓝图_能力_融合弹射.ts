/** 融合弹射 L2420/L2496/L2097: return target is the actual summoner, passed as the effect's 释放者. */
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { attachSourceEffect } from '../../../../../core/ability/apply.ts';
import { make效果配置, structOf } from '../../../../../core/bp/structs.ts';
import type { BP_ManeActor } from '../../../../../core/sim/actor.ts';
import type { AssetPath } from '../../../../../core/sim/types.ts';

export class 蓝图_能力_融合弹射 extends 蓝图_能力 {
  static override readonly path:AssetPath='CatapultHero/BP/Skill/Ability/敌人/蓝图_能力_融合弹射';
  召唤者:BP_ManeActor|null=null;
  override 被选中():void { if(this.拥有者)this.拥有者.目标位置={...(this.召唤者?.当前位置??{x:0,y:0,z:0})}; }
  override 检查子条件():void { this.子条件通过=!this.召唤者?.死掉了; } // Source AccessedNone bool default false → Not true.
  override 执行技能(_load:boolean):void {
    const owner=this.拥有者;if(!owner)return;
    owner.切换指示箭头(false,'固定方向',60,[],[],structOf('结构_地形选取配置'),null);
    const e=attachSourceEffect(this,owner,this,this.效果配置[0]??make效果配置());
    if(!e)return;e.释放者=this.召唤者;e.激活效果('');
  }
}
