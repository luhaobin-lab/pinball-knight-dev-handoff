/** Source child leap L15/L741: parent's curve/collision lifecycle, one dodge stack and bottom qualifying-card50L infusion. */
import { 蓝图_效果_跳向目标位置 } from '../蓝图_效果_跳向目标位置.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make效果配置 } from '../../../../../core/bp/structs.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import { 科学数变普通 } from '../../../../../core/math/sci.ts';
import { applyEffect } from '../蓝图_效果_可控弹射.ts';
export class 蓝图_效果_腾跃 extends 蓝图_效果_跳向目标位置 {
  static override readonly path='CatapultHero/BP/Skill/效果/玩家/蓝图_效果_腾跃';
  override 激活后触发(_debug:string):void{this.高度=200;this.移动速度=1000;this.高度曲线='腾跃';super.激活后触发('');}
  override 开始跳跃():void{}
  override 结束跳跃():void{const a=this.来自技能,o=a?.拥有者;if(!a||!o)return;
    this.fx.shake('CatapultHero/BP/摄像机晃动_零点六:600');this.fx.vfx('CatapultHero/粒子/粒子_Hit_冲击波',o.目标位置,{scale:5});this.fx.vfx('CatapultHero/粒子/粒子_Hit_Dust_03',o.目标位置);
    if(this.world.isValid(o)&&!o.死掉了){const cap=获取科学映射词条(o.词条,'闪避层上限');
      const cfg=make效果配置({效果类:'CatapultHero/BP/Skill/效果/玩家/精神状态/蓝图_效果_精神状态_闪避',持续时间:-1,触发间隔:1,持续回合:-1,叠加层数:1,唯一:true,检查效果名:false,叠加上限:o.词条.has('闪避层上限')?Math.trunc(科学数变普通(cap.输出值)):99});
      const name=函数库_技能.获取效果名(this,a,cfg.效果类).效果名字;const{effect}=applyEffect(this,{cfg,owner:o,释放者:o,来自技能:a,效果名:name,classOf:o});effect?.激活效果('');}
    const cards=函数库_技能.技能条件筛选物品(this,this.world.cult,a,-1).筛选后;for(const c of cards)c?.添加行动力(true,Math.trunc(函数库_技能.获取技能参数(this,a,1,false,'').参数值),1,true,false);
    a.释放结束(false);
  }
}
