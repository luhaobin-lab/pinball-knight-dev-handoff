/** 反弹创建地形 L3355: same source attach macro as death terrain, but triggers only on bounce. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { attachSourceEffect,terrainGroupConfig } from '../../../../../core/ability/apply.ts';
import { 函数库_工具 } from '../../../../../core/bp/index.ts';
import type { AssetPath,Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_反弹创建地形 extends 蓝图_效果 {
 static override readonly path:AssetPath='CatapultHero/BP/Skill/效果/敌人/蓝图_效果_反弹创建地形';
 override 持续中触发(tag:Tag):void{const a=this.拥有者,s=this.来自技能;if(tag!=='效果.时机.反弹时'||!a||!s)return;
  const points=函数库_工具.范围选取点(this,a.K2_GetActorLocation(),96,128,0,1,false,16).选到的点;s.地形选取={...s.地形选取,起点:points.map(p=>({X:p.x,Y:p.y,Z:p.z}))};
  attachSourceEffect(this,a,s,terrainGroupConfig(),true)?.激活效果('');
 }
}
