/** Source 腾跃 L3716/4453/3212: cursor-point selection, real capsule-space validation, then unique leap effect. */
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make效果配置 } from '../../../../../core/bp/structs.ts';
import { applyEffect } from '../../效果/蓝图_效果_可控弹射.ts';
export class 蓝图_能力_腾跃 extends 蓝图_能力 {
  static override readonly path='CatapultHero/BP/Skill/Ability/玩家/蓝图_能力_腾跃';
  指示类型=3;
  override 被选中():void{const h=this.world.mode.玩家角色;if(!h)return;h.当前能力=this;h.有选中主动技能=true;if(this.技能动画[0])this.playAnim(h,this.技能动画[0]);}
  override 检查子条件():void{const o=this.拥有者,ctl=this.world.mode.玩家控制器;if(!o||!ctl)return;
    if(!this.world.mode.玩家角色?.有选中主动技能){this.子条件通过=true;return;}
    o.目标位置={...ctl.目标位置缓存};this.子条件通过=函数库_技能.角色检查目标位置空间(this,o,1,o.目标位置,0,0).有足够空间;}
  override 执行技能(_read:boolean):void{const o=this.拥有者;if(!o||!this.world.isValid(o)||o.死掉了)return;
    const cfg=make效果配置({效果类:'CatapultHero/BP/Skill/效果/玩家/蓝图_效果_腾跃',持续时间:-1,触发间隔:1,持续回合:-1,叠加层数:1,唯一:true,检查效果名:false,叠加上限:1});
    const name=函数库_技能.获取效果名(this,this,cfg.效果类).效果名字;const{effect,refreshed}=applyEffect(this,{cfg,owner:o,释放者:o,来自技能:this,效果名:name,classOf:o});if(effect&&!refreshed)effect.激活效果('');}
}
