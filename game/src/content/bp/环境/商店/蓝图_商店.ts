import { BpObject } from '../../../../core/sim/object.ts';
import { BP_Actor_Other } from '../../../../core/sim/other.ts';
import type { BP_ManeActor } from '../../../../core/sim/actor.ts';
import type { 蓝图_能力 } from '../../../../core/ability/ability.ts';
import { currentMapTile } from '../../../../core/sim/map-tile.ts';
import { 数据表_玩家 } from '../../../demo/tables.ts';
import { Divide_IntInt } from '../../../../core/math/kismet.ts';
import { 蓝图_货架 } from './蓝图_货架.ts';
/** Source shop L15/1073: every reward parameter is a shelf, with source offsets and one purchase allowance. */
export class 蓝图_商店 extends BpObject {
  static override readonly path='CatapultHero/BP/环境/商店/蓝图_商店';
  商品映射=new Map<BP_ManeActor,蓝图_货架>();货架池:蓝图_货架[]=[];类型='None';商品数量=3;可购买数量=1;
  奖励技能:蓝图_能力|null=null;商人:BP_Actor_Other|null=null;
  激活商店():void {
    const w=this.world,p=this.K2_GetActorLocation();this.奖励技能=currentMapTile(w)?.奖励技能实例??null;
    this.可购买数量=1;this.商品数量=this.奖励技能?.参数.length??0;
    const row=数据表_玩家.rows.商人;
    this.商人=w.spawn(BP_Actor_Other,a=>{a.角色配置=row;a.名字='商人';},{x:p.x+64,y:p.y+40,z:p.z+64});
    this.商人.激活角色(false);this.商人.更新角色数据();this.商人.OwnedGameplayTags.add('可交互.角色.AI.商人');this.商人.K2_AttachToActor(this);
    for(let i=0;i<this.商品数量;i++){
      const at={x:p.x,y:p.y+i*Divide_IntInt(-720,this.商品数量)+(4-this.商品数量)*-69-276,z:p.z};
      const shelf=w.spawn(蓝图_货架,s=>{s.所在商店=this;},at);shelf.序号=i;shelf.激活商品();shelf.K2_AttachToActor(this);
    }
  }
}
