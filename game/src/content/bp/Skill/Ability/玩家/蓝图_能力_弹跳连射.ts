/** Source L3766/L4477: p1-1 volleys (counter decrements before firing), two scattered transforms per arrow. */
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { 蓝图_发射物 } from '../../../../../core/ability/projectile.ts';
import type { BpObject } from '../../../../../core/sim/object.ts';
import type { Rotator } from '../../../../../core/sim/types.ts';
import { 函数库_工具,函数库_技能 } from '../../../../../core/bp/index.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import { 科学数变普通 } from '../../../../../core/math/sci.ts';
import { 蓝图_发射物_弹跳箭 } from '../../发射物/蓝图_发射物_弹跳箭.ts';
export class 蓝图_能力_弹跳连射 extends 蓝图_能力 {
  static override readonly path='CatapultHero/BP/Skill/Ability/玩家/蓝图_能力_弹跳连射';
  指示类型=3;
  计数器=0;
  发射物销毁用数组:蓝图_发射物[]=[];
  override 被选中():void{const h=this.world.mode.玩家角色;if(!h)return;h.当前能力=this;h.有选中主动技能=true;if(this.技能动画[0])this.playAnim(h,this.技能动画[0]);}
  override 执行技能(_read:boolean):void{const o=this.拥有者,ctl=this.world.mode.玩家控制器;if(!o||!ctl)return;
    o.疲劳了=false;o.目标位置={...ctl.目标位置缓存};o.创建发射物组(1,true);this.计数器=Math.trunc(函数库_技能.获取技能参数(this,this,1,false,'').参数值);
    this.setTimer('发射',.3,true,()=>this.发射(),-.3);}
  发射():void{this.计数器--;if(this.计数器<1){this.clearTimer('发射');return;}const o=this.拥有者;if(!o)return;o.更新运动数据();
    const split=()=>Math.trunc(科学数变普通(获取科学映射词条(o.词条,'投射分裂').输出值));
    for(let i=0;i<=split();i++){
      const rotation=():Rotator=>{const p=函数库_工具.扩散命中中心(this,null,o.目标位置,this.技能距离,{x:0,y:0,z:0});return{Pitch:0,Roll:0,Yaw:Math.fround(Math.atan2(p.y-o.当前位置.y,p.x-o.当前位置.x)*180/Math.PI+(i-Math.max(split()-1,0)/2)*7.5)};};
      const first=rotation();const p=this.world.spawn(蓝图_发射物_弹跳箭,p=>{p.来自角色=o;p.来自技能=this;p.速度=2500;p.持续时长=1.2;p.ActorRotation=first;},o.当前位置);
      p.ActorRotation=rotation();p.K2_SetActorLocation(o.当前位置);p.伤害数值=获取科学映射词条(o.词条,'基础伤害').输出值;p.伤害类型='物理';o.创建发射物(p,1,true);this.发射物销毁用数组.push(p);
    }this.fx.shake('CatapultHero/BP/摄像机晃动_零点二:520');
  }
  override 特殊结算(from:BpObject|null):void{if(!(from instanceof 蓝图_发射物))return;this.发射物销毁用数组=this.发射物销毁用数组.filter(p=>p!==from);if(!this.发射物销毁用数组.length&&!this.world.latent.isTimerActive(this,'发射'))this.释放结束(false);}
}
