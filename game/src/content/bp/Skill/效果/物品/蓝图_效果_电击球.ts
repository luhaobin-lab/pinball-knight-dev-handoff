/** Source L5194/L635/L5703: one spawn flipbook gate, live-origin lightning on activation, floor teardown.
 * Root Sphere radius32/mass60/damping1.5 and its explicit channel responses are projected by the physics adapter.
 * SPEC-GAP: exact Chaos damping/sleep/contact timing and the bp-items6 雷云精灵 live creator remain separate work.
 */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 蓝图_效果_闪电链 } from '../蓝图_效果_闪电链.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make伤害, make效果配置 } from '../../../../../core/bp/structs.ts';
import { sciOf, 科学数乘除, 科学数变普通 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import { applyEffect } from '../蓝图_效果_可控弹射.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_电击球 extends 蓝图_效果 {
  static override readonly path: AssetPath='CatapultHero/BP/Skill/效果/物品/蓝图_效果_电击球';
  伤害数值=0; 序号=0; Delta_Seconds=0; ug_生成门已关闭=false; ug_物理模拟请求=false;
  ug_fieldVisual:{kind:'orb';phase:'spawn'|'idle'|'closing'|'hidden';startedAt:number;phaseAt:number}|null=null;
  override ReceiveBeginPlay(): void {
    const physics=this.world.sys.physics as typeof this.world.sys.physics & { registerEffectSphere(actor: 蓝图_效果, cfg: {
      radius:number;mass:number;linearDamping:number;objectType:string;defaultResponse:'block';responses:Record<string,'overlap'|'ignore'>;
    }):void };
    // Radius from same-binary USphereComponent ctor, field0x550=0x42000000; other values from raw Sphere override.
    // Child ResponseArray replaces the base array. Custom game-channel defaults are DefaultEngine.ini179–185.
    physics.registerEffectSphere(this,{radius:32,mass:60,linearDamping:1.5,objectType:'WorldStatic',defaultResponse:'block',responses:{
      Pawn:'overlap',Vehicle:'overlap',Visibility:'overlap',mouse:'ignore',可伤害:'ignore',地形:'ignore',发射物:'overlap',道具:'ignore',物品:'ignore',迷雾:'ignore',
    }});
  }
  override 激活后触发(_Debug:string):void{
    this.销毁延迟=2;this.fx.ui({op:'update',widget:'effect.hidden',data:{id:this.id,hidden:false}});
    if(this.ug_生成门已关闭)return;this.ug_生成门已关闭=true;
    this.ug_fieldVisual={kind:'orb',phase:'spawn',startedAt:this.world.clock.now,phaseAt:this.world.clock.now};
    const prefix='CatapultHero/精灵片/FX/电击球/FX_电击球_SQ_';
    this.fx.flipbook(this,prefix+'Swpn',{loop:false});
    // Raw flipbooks each have4frames/10fps. Source waits spawn, then one idle cycle before SetSimulatePhysics.
    this.delay('L349',.4,()=>{if(this.ug_fieldVisual){this.ug_fieldVisual.phase='idle';this.ug_fieldVisual.phaseAt=this.world.clock.now;}this.fx.flipbook(this,prefix+'Idle',{loop:true});this.delay('L64',.4,()=>{
      this.ug_物理模拟请求=true;
      (this.world.sys.physics as typeof this.world.sys.physics & { simulateEffectSphere(actor:蓝图_效果,on:boolean):void }).simulateEffectSphere(this,true);
    });});
  }
  override 销毁前触发():void{
    if(this.ug_fieldVisual){this.ug_fieldVisual.phase='closing';this.ug_fieldVisual.phaseAt=this.world.clock.now;}
    const list=this.来自技能?.创建的效果;if(list){for(let i=list.length-1;i>=0;i--)if(list[i]===this)list.splice(i,1);}
    this.fx.ui({op:'update',widget:'effect.emission',data:{id:this.id,rate:0}});
    this.fx.flipbook(this,'CatapultHero/精灵片/FX/电击球/FX_电击球_SQ_Die',{loop:false});
    this.delay('L645',.4,()=>{if(this.ug_fieldVisual){this.ug_fieldVisual.phase='hidden';this.ug_fieldVisual.phaseAt=this.world.clock.now;}this.fx.ui({op:'update',widget:'effect.hidden',data:{id:this.id,hidden:true}});});
  }
  override 持续中触发(时机:Tag):void{if(时机==='效果.时机.主动激活')this.生效伤害();else if(时机==='效果.时机.结束层时')this.销毁效果();}
  生效伤害():void{
    const owner=this.拥有者,s=this.来自技能,source=s?.拥有者;if(!owner||!this.world.isValid(owner)||!s||!source)return;
    const cfg=make效果配置({效果类:蓝图_效果_闪电链.path,持续时间:1,触发间隔:1,持续回合:-1,叠加层数:1,唯一:false,检查效果名:false,叠加上限:99});
    const r=applyEffect(this,{cfg,owner,释放者:owner,来自技能:s,效果名:函数库_技能.获取效果名(this,s,cfg.效果类).效果名字,classOf:owner});
    if(r.refreshed||!(r.effect instanceof 蓝图_效果_闪电链))return;
    const p=函数库_技能.获取技能参数(this,s,0,false,'');
    r.effect.伤害数据=make伤害({伤害来源:'装备',伤害类型:'电击',伤害数值:科学数乘除(获取科学映射词条(source.词条,p.词条).输出值,sciOf(p.参数值,0),false),所需回合:3,
      触发次数:Math.trunc(科学数变普通(获取科学映射词条(source.词条,'连击').输出值)),来自技能:s,来自角色:source});
    r.effect.非角色释放者=this;r.effect.激活效果('');
  }
}
