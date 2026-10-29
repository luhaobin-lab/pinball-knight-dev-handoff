/** Source L2109/L712/L2057: condition always passes even with no matching DoT; snapshot targets, remove, refresh and finish after.5s. */
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { 蓝图_效果_持续伤害 } from '../../效果/蓝图_效果_持续伤害.ts';
import { 函数库_工具,函数库_技能 } from '../../../../../core/bp/index.ts';
import type { AssetPath,枚举_伤害类型 } from '../../../../demo/types.ts';
export class 蓝图_能力_移除持续伤害 extends 蓝图_能力 {
 static override readonly path:AssetPath='CatapultHero/BP/Skill/Ability/道具/蓝图_能力_移除持续伤害';治疗百分比=.1;移除类型:枚举_伤害类型='物理';NewVar_0:蓝图_效果_持续伤害[]=[];
 override 子初始化():void{this.移除类型=this.world.mode.持续伤害类型[['流血','剧毒','燃烧'].indexOf(函数库_技能.获取技能参数(this,this,0,false,'').词条)]??'物理';}
 override 被选中():void{函数库_工具.选择角色作为目标(this,this.拥有者);}
 override 检查子条件():void{this.NewVar_0=[];const list=[...(this.world.mode.玩家角色?.持续伤害实例映射.values()??[])];for(const e of list){if(!(e instanceof 蓝图_效果_持续伤害))continue;const all=函数库_技能.获取技能参数(this,this,0,false,'').词条==='所有';if((all||e.类型===this.移除类型)&&!this.NewVar_0.includes(e))this.NewVar_0.push(e);}this.子条件通过=true;}
 override 执行技能(_load:boolean):void{for(let i=0;i<this.NewVar_0.length;i++)this.NewVar_0[i].销毁效果();this.world.mode.玩家角色?.更新剩余持续伤害();this.delay('L15',.5,()=>this.释放结束(false));}
}
