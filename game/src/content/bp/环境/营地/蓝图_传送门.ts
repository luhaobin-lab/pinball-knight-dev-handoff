import { BpObject } from '../../../../core/sim/object.ts';
import type { World } from '../../../../core/sim/world.ts';
/** Source L792/1104: original manifest timelines, then the option callback at 时间轴_0.Finished. Demo options only. */
export class 蓝图_传送门 extends BpObject {
 static override readonly path='CatapultHero/BP/环境/营地/蓝图_传送门';
 未点击=true;延迟=0;关卡名='None';显示=true;尺寸=0;WPO=0;
 激活传送门(direct:boolean):void{this.delay('L792',this.延迟,()=>this.timeline('时间轴','PlayFromStart',{update:(_t,v)=>{this.尺寸=v['尺寸'];this.WPO=v.WPO;},finished:()=>{if(direct)this.交互传送门();}}));}
 交互传送门():void{
  const w=this.world;if(!this.未点击||!w.cult.仓库页关闭了||!w.cult.盒子关闭了)return;
  this.未点击=false;(w.cult.关卡选择背景 as {关闭关卡选择页面?():void}|null)?.关闭关卡选择页面?.();
  this.timeline('时间轴_0','ReverseFromEnd',{update:(_t,v)=>{this.尺寸=v['尺寸'];this.WPO=v.WPO;},finished:()=>{
   (w.sys.camp as {enterChapter(w:World,name:string):boolean}).enterChapter(w,this.关卡名);
  }});
 }
 玩家交互():void{this.交互传送门();}
}
