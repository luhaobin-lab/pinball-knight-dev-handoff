/** Source 自然之力 L6152: confirmed indicator config, new terrain manager then child effect; all three sequence branches run. */
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import type { 结构_地形选取配置 } from '../../../../demo/types.ts';
import { 函数库_工具,函数库_技能 } from '../../../../../core/bp/index.ts';
import { structOf } from '../../../../../core/bp/structs.ts';
import { applyEffect } from '../../效果/蓝图_效果_可控弹射.ts';
export class 蓝图_能力_投掷_地形区域 extends 蓝图_能力 {
  static override readonly path='CatapultHero/BP/Skill/Ability/玩家/蓝图_能力_投掷_地形区域';
  指示类型=4;
  override 被选中():void{const h=this.world.mode.玩家角色,o=this.拥有者;if(!h||!o)return;h.当前能力=this;函数库_工具.选择角色作为目标(this,o);h.有选中主动技能=true;
    函数库_技能.选择声音播放(this,this.音效,3,o);if(this.技能动画[0])this.playAnim(o,this.技能动画[0]);
    h.切换指示箭头(true,'地形区域（实时）',60,[],[],this.地形选取,null);}
  override 检查子条件():void{this.子条件通过=!this.本技能激活中;}
  override 执行技能(_read:boolean):void{
    const h=this.world.mode.玩家角色,ctl=this.world.mode.玩家控制器;if(!h||!ctl)return;
    const indicator=h.技能指示 as (typeof h.技能指示 & {地形选取配置:结构_地形选取配置});
    if(!indicator?.valid)throw Error('自然之力 requires source type4 terrain indicator');
    this.地形选取=indicator.地形选取配置;
    const source=this.效果配置[0];
    if(source&&this.world.isValid(h)&&!h.死掉了){
      const cfg={...source,持续时间:-1,触发间隔:0,持续回合:-1,叠加层数:1,唯一:false,检查效果名:false,叠加上限:1};
      const name=函数库_技能.获取效果名(this,this,cfg.效果类).效果名字;
      const{effect}=applyEffect(this,{cfg,owner:h,释放者:this.拥有者,来自技能:this,效果名:name,classOf:this.拥有者!});
      if(effect){effect.激活效果('');effect.持续中触发('效果.时机.主动激活');
        h.切换指示箭头(true,'地形区域（实时）',60,[],[],structOf('结构_地形选取配置'),null);}
    }
    const cfg=this.子效果配置[0];if(cfg&&this.world.isValid(h)&&!h.死掉了){const name=函数库_技能.获取效果名(this,this,cfg.效果类).效果名字;
      const{effect,refreshed}=applyEffect(this,{cfg,owner:h,释放者:this.拥有者,来自技能:this,效果名:name,classOf:this.拥有者!});if(effect&&!refreshed)effect.激活效果('');}
    this.释放结束(false);
  }
}
