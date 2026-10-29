import { 蓝图_装饰品 } from '../装饰品/蓝图_装饰品.ts';
import { 蓝图_永恒之盒 } from './蓝图_永恒之盒.ts';
/** ChildActor SCS at UE(296,0,1), source enable/disable and .5/1s curtain visibility. Renderer consumes the hub. */
export class 蓝图_装饰品_关卡选择 extends 蓝图_装饰品 {
 static override readonly path='CatapultHero/BP/环境/营地/蓝图_装饰品_关卡选择';
 永恒之盒:蓝图_永恒之盒|null=null;显示=false;可交互=false;遮挡=true;
 override ReceiveBeginPlay():void{this.永恒之盒=this.world.spawn(蓝图_永恒之盒,undefined,{x:296,y:0,z:1});this.永恒之盒.K2_AttachToActor(this);}
 开启关卡选择背景():void{this.显示=true;this.可交互=true;this.永恒之盒?.更新解锁状态(false);this.delay('L31',.5,()=>{this.遮挡=false});}
 关闭关卡选择页面():void{this.可交互=false;this.遮挡=true;this.delay('L293',1,()=>{this.显示=false});}
}
