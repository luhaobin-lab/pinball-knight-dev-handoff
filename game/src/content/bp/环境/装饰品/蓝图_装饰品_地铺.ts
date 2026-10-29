import { 蓝图_装饰品 } from './蓝图_装饰品.ts';
import { 函数库_工具 } from '../../../../core/bp/index.ts';
import { UI_主界面 } from '../../../../core/bp/widgets.ts';
import { make治疗 } from '../../../../core/bp/structs.ts';
import { sciOf } from '../../../../core/math/sci.ts';
import type { World } from '../../../../core/sim/world.ts';
import type { BpObject } from '../../../../core/sim/object.ts';
/** Source.75s loading -> close -> .5s -> heal/stamina/debuff removal and task completion. */
export class 蓝图_装饰品_地铺 extends 蓝图_装饰品 {
  static override readonly path='CatapultHero/BP/环境/装饰品/蓝图_装饰品_地铺';
  已消耗=false;
  玩家交互():void {
    if(this.已消耗)return;this.已消耗=true;const w=this.world,m=w.mode;
    w.cult.切换屏蔽(true,false,2);UI_主界面.打开加载页(this,true,{zh:'我彻夜难眠····',en:'I could not sleep all night...'});
    this.delay('L1157',.75,()=>{(w.sys.run as typeof w.sys.run&{closeLoading(w:World):void}).closeLoading(w);
      this.delay('L15',.5,()=>{w.cult.切换屏蔽(false,false,2);const h=m.玩家角色;if(!h)return;
        h.移除减益效果();h.获得治疗(make治疗({治疗百分比:sciOf(1),特效位置:h.当前位置,释放者:h}),true,false);
        函数库_工具.修改体力点(this,sciOf(0),sciOf(1),h,h,true,{x:0,y:0,z:0});h.精神系统(50,50,'恢复点',true);
        if(m.当前任务实例)(m.当前任务实例 as BpObject&{未完成:boolean}).未完成=false;m.新回合前();});});
  }
  悬停高亮(on:boolean):void {this.fx.ui({op:'update',widget:'actor.highlight',data:{id:this.id,on}});}
  悬停提示():void {this.fx.ui({op:'open',widget:'UI_悬停提示_A',data:{title:'地铺',text:'恢复生命和体力，移除负面精神状态。',width:275}});}
}
