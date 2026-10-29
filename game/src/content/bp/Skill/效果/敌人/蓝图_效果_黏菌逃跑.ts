/** 黏菌逃跑 L107/L6003/L4914: source gated .075 tick, eight fixed rays, turn7 escape (not a kill). */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_工具,函数库_技能 } from '../../../../../core/bp/index.ts';
import { SetActorHiddenInGame } from '../../../../../core/sim/engine.ts';
import type { AssetPath,Tag,Vec3 } from '../../../../../core/sim/types.ts';
import type { BP_ManeActor } from '../../../../../core/sim/actor.ts';
export class 蓝图_效果_黏菌逃跑 extends 蓝图_效果 {
  static override readonly path:AssetPath='CatapultHero/BP/Skill/效果/敌人/蓝图_效果_黏菌逃跑';
  范围内玩家角色数=0;死掉的角色:(BP_ManeActor|null)[]=[];逃跑方向:Vec3={x:0,y:0,z:0};临时逃跑判断=0;未触发=true;检测间隔=.075;
  ug_gate=false;
  ug_waitingDetection=false;
  override 激活后触发(_debug:string):void {函数库_工具.选择角色作为目标(this,this.拥有者);}
  override 销毁前触发():void {this.fx.ui({op:'close',widget:'黏菌闪烁',data:{id:this.id}});}
  ReceiveDestroyed():void {this.销毁前触发();}
  检测开始():void {
    this.ug_gate=true;
    if(this.ug_waitingDetection)return;
    this.ug_waitingDetection=true;
    // A finite pending source gate must reach its next .075s ReceiveTick even after the physics body settles.
    // This process owns no timing/side effects; the original tick below remains the sole decision point.
    this.world.clock.addProcess({step:()=>{},active:()=>{
      if(this.valid&&this.ug_gate&&this.拥有者?.valid)return true;
      this.ug_waitingDetection=false;return false;
    }});
  }
  检测结束():void {
    const owner=this.拥有者;if(!owner)return;owner.结束行动(null,'');owner.更新运动数据();owner.更新朝向();this.游戏模式?.退出回合开始(owner);
    this.fx.ui({op:'close',widget:'轨迹',data:{effect:this.id}});
  }
  发动逃跑():void {
    const owner=this.拥有者;if(!owner)return;this.游戏模式?.加入回合开始(owner);owner.疲劳+=1;this.临时逃跑判断=0;
    const from={...owner.当前位置,z:owner.当前位置.z+10};
    for(const [x,y]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){
      const n=Math.hypot(x!,y!),d={x:x!/n,y:y!/n,z:0};
      const hit=this.world.trace.line(from,{x:from.x+d.x*5000,y:from.y+d.y*5000,z:from.z},'Visibility',[owner]);
      // Source uses HitResult.Location even on miss; the engine default vector is zero (draft U-18 retained).
      const p=hit?.location??{x:0,y:0,z:0},distance=Math.hypot(p.x-owner.当前位置.x,p.y-owner.当前位置.y,p.z-owner.当前位置.z);
      if(distance>this.临时逃跑判断){this.临时逃跑判断=distance;this.逃跑方向=d;}
    }
    const k=1000*(this.来自技能?.冲击力??0),d=this.逃跑方向;
    函数库_技能.根据体重添加冲击(this,owner,{x:d.x*k,y:d.y*k,z:0});owner.更新朝向();owner.移动中=true;this.检测开始();
    this.fx.vfx('CatapultHero/粒子/粒子_轨迹',owner,{attach:true});
  }
  override 持续中触发(tag:Tag):void {
    const owner=this.拥有者,mode=this.游戏模式;if(!owner||!mode)return;
    if(tag==='效果.时机.受到伤害前'){
      函数库_工具.更新目标和自身运动数据(this,owner);owner.闪避层计数+=函数库_工具.传统概率判断(this,.75).触发?1:0;
      if(!owner.移动中)this.发动逃跑();
    }else if(tag==='效果.时机.进入战斗时'){
      if(owner.死掉了)this.检测结束();else{this.检测开始();owner.疲劳=0;owner.疲劳了=false;}
    }else if(tag==='效果.时机.新一天时'&&mode.当前层回合>6&&this.未触发){
      owner.疲劳了=false;this.未触发=false;mode.加入回合开始(owner);
      this.playAnim(owner,'CatapultHero/精灵片/AnimSequences/Actor_M06_Skill',{completed:()=>{
        mode.从场上移出_碰撞(owner);mode.添加到墓地(owner);owner.关闭碰撞();SetActorHiddenInGame(owner,true);owner.结束行动(null,'');
        const mission=mode.当前任务实例 as (typeof mode.当前任务实例&{失败了:boolean})|null;if(mission)mission.失败了=true;
        mode.退出回合开始(owner);this.fx.ui({op:'update',widget:'抬头提醒',data:{text:'盗宝黏菌逃跑了。'}});
      }});this.fx.ui({op:'close',widget:'黏菌闪烁',data:{id:this.id}});
    }
  }
  override ReceiveTick(dt:number):void {
    super.ReceiveTick(dt);this.检测间隔-=Math.fround(dt);if(this.检测间隔>0)return;this.检测间隔=.075;
    const owner=this.拥有者;if(!this.ug_gate||!owner)return;const target=owner.当前目标;
    const stop=!this.world.isValid(target)||target.疲劳了||target.死掉了||owner.疲劳>=owner.最大疲劳||owner.死掉了||this.游戏模式?.当前环节!=='进行战斗';
    if(stop){if(owner.当前物理速度<3){this.检测结束();this.ug_gate=false;}return;}
    函数库_工具.更新目标和自身运动数据(this,owner);if(owner.与目标距离<300&&owner.当前物理速度<3)this.发动逃跑();
  }
}
