import { BpObject } from '../../../../core/sim/object.ts';
import { BP_Actor_Other } from '../../../../core/sim/other.ts';
import { 函数库_技能 } from '../../../../core/bp/index.ts';
import { 添加科学映射值 } from '../../../../core/math/stats.ts';
import { sciOf } from '../../../../core/math/sci.ts';
import { 数据表_道具_通用 } from '../../../demo/tables.ts';
import type { 结构_角色 } from '../../../demo/types.ts';
import type { 蓝图_商店 } from './蓝图_商店.ts';
export class 蓝图_货架 extends BpObject {
  static override readonly path='CatapultHero/BP/环境/商店/蓝图_货架';
  所在商店:蓝图_商店|null=null;序号=0;商品:BP_Actor_Other|null=null;价格显示=true;价格=0;
  激活商品():void {
    const shop=this.所在商店;if(!shop)return;const p=函数库_技能.获取技能参数(this,shop.奖励技能,this.序号,false,'');
    const row=(数据表_道具_通用.rows as Readonly<Record<string,结构_角色>>)[p.词条];if(!row)return;const at=this.K2_GetActorLocation();
    const a=this.world.spawn(BP_Actor_Other,a=>{a.角色配置=row;a.名字=p.词条;a.等级=this.序号+1;},{x:at.x+56,y:at.y,z:at.z+row.属性.高度});
    a.激活角色(false);a.更新角色数据();if(!this.world.mode.环境交互物.includes(a))this.world.mode.环境交互物.push(a);
    this.价格=函数库_技能.获取技能参数(this,shop.奖励技能,this.序号,false,'').参数值;添加科学映射值(a.词条,'价格','',sciOf(this.价格),false);
    a.K2_AttachToActor(shop);shop.商品映射.set(a,this);this.商品=a;
  }
  购买后效果():void {
    const shop=this.所在商店,m=this.world.mode;if(!shop)return;this.价格显示=false;m.玩家角色?.精神系统(10,0,'购买道具',true);
    this.fx.sound('CatapultHero/声音/打开商店3');shop.可购买数量--;
    if(shop.可购买数量===0&&this.world.modal.current?.kind!=='multiChoice'&&this.world.cult.盒子关闭了){if(m.当前任务实例)(m.当前任务实例 as BpObject&{未完成:boolean}).未完成=false;m.新回合前();}
  }
}
