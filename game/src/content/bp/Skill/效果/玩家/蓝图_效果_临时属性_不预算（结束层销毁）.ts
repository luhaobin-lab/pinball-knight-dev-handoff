/** Hunter-owned shared effect, source L454: raw parameter0 accumulates under the skill ID; floor end removes it. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { 添加科学映射值, 移除科学映射值 } from '../../../../../core/math/stats.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
export class 蓝图_效果_临时属性_不预算_结束层销毁 extends 蓝图_效果 {
  static override readonly path = 'CatapultHero/BP/Skill/效果/玩家/蓝图_效果_临时属性_不预算（结束层销毁）';
  override 激活后触发(_debug: string): void {
    const a=this.来自技能,o=this.拥有者;if(!a||!o)return;
    const p=函数库_技能.获取技能参数(this,a,0,false,'');添加科学映射值(o.词条,p.词条,a.唯一ID,sciOf(p.参数值,0),true);
  }
  override 销毁前触发(): void {
    const a=this.来自技能,o=this.拥有者;if(!a||!o)return;
    const p=函数库_技能.获取技能参数(this,a,0,false,'');if(移除科学映射值(o.词条,p.词条,a.唯一ID))o.更新外观数据();
  }
  override 持续中触发(tag:string):void{if(tag==='效果.时机.结束层时')this.销毁效果();}
  ReceiveDestroyed():void{}
}
