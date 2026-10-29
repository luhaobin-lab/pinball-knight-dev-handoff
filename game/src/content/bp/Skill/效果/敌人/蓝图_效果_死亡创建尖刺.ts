/** 死亡创建尖刺 L1691/L782: source defaultmax2 with repeated count draws; own effect Sphere has no physics velocity. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import type { AssetPath,Tag } from '../../../../../core/sim/types.ts';
import { scatterSpikes } from '../可拾取物/蓝图_可拾取物_尖刺.ts';
export class 蓝图_效果_死亡创建尖刺 extends 蓝图_效果 {
 static override readonly path:AssetPath='CatapultHero/BP/Skill/效果/敌人/蓝图_效果_死亡创建尖刺';
 创建尖刺数=2;
 override 持续中触发(tag:Tag):void{if(tag==='效果.时机.死亡前'&&this.拥有者)scatterSpikes(this,this.创建尖刺数,this.拥有者.当前位置,{x:0,y:0,z:0});}
}
