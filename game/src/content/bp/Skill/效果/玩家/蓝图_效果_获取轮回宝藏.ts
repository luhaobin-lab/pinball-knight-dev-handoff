/** Source L2007->L1261->L10: current build executes reward immediately, then delayed destruction1s; unused timeline is not invented. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import type { AssetPath } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_获取轮回宝藏 extends 蓝图_效果 {
  static override readonly path:AssetPath='CatapultHero/BP/Skill/效果/玩家/蓝图_效果_获取轮回宝藏';
  跳过动画=false;
  override 激活后触发(_d:string):void{this.销毁延迟=1;const ctl=this.world.mode.玩家控制器;if(ctl)ctl.玩家可与环境交互=false;this.fx.sound('CatapultHero/声音/Tribal_Win_2');this.grant(true);}
  private grant(hint:boolean):void{const m=this.world.mode;if(m.玩家控制器)m.玩家控制器.玩家可与环境交互=true;const r=m.当前轮回奖励;if(this.world.isValid(r)){if(hint)this.fx.ui({op:'open',widget:'UI_奖励提示',data:{额外文本:'达成目标！',类型:1}});r.被选中();r.执行技能(false);}this.销毁效果();}
  跳过动画事件():void{this.grant(false);}
}
