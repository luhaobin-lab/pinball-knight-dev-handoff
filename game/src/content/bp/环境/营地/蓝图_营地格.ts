import { BpObject } from '../../../../core/sim/object.ts';
import type { World } from '../../../../core/sim/world.ts';
import type { Vec3 } from '../../../../core/sim/types.ts';
/** Only the Demo's built-cell use path; the unused construction grid is explicitly outside PROTOTYPE_SCOPE10.7. */
export class 蓝图_营地格 extends BpObject {
 static override readonly path='CatapultHero/BP/环境/营地/蓝图_营地格';
 已建造=false;表名='None';整数坐标:Vec3={x:0,y:0,z:0};真实坐标:Vec3={x:0,y:0,z:0};
 激活营地格():void{this.K2_SetActorLocation({x:this.真实坐标.x,y:this.真实坐标.y,z:10-this.整数坐标.x});}
 玩家交互():void{
  if(!this.已建造||this.表名==='空地')return;
  this.fx.ui({op:'open',widget:'UI_加载页'});
  this.delay('L2810',.5,()=>{if(this.world.mode.是DEMO)this.delay('L15',.2,()=>{(this.world.sys.run as {DEMO出发(w:World):void}).DEMO出发(this.world);});});
 }
}
