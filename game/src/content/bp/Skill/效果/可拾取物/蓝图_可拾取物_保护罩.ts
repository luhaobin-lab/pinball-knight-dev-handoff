import { 蓝图_可拾取物 } from './蓝图_可拾取物.ts';
import { 函数库_工具 } from '../../../../../core/bp/index.ts';
import { 科学数比较 } from '../../../../../core/math/sci.ts';
import type { BpObject } from '../../../../../core/sim/object.ts';
import type { World } from '../../../../../core/sim/world.ts';
import type { AssetPath,Tag } from '../../../../../core/sim/types.ts';
/** Source L2116/3356: pickup opens a stationary160uu ward; positive incoming damage inside adds immunity. */
export class 蓝图_可拾取物_保护罩 extends 蓝图_可拾取物 {
  static override readonly path:AssetPath='CatapultHero/BP/Skill/效果/可拾取物/蓝图_可拾取物_保护罩';
  保护罩尺寸=160;ug_visual:{state:'ready'|'spawning'|'active'|'closing';since:number;scale:number}={state:'ready',since:0,scale:0};
  override 激活后触发(debug:string):void {
    super.激活后触发(debug);this.拾取时音效='CatapultHero/声音/原素材/MAGIC_SPELL_Shield_mono';
    this.ug_visual={state:'ready',since:this.world.clock.now,scale:0};
    (this.world.sys.physics as {initialiseEnvironmentOverlaps?(w:World,o:BpObject):void}).initialiseEnvironmentOverlaps?.(this.world,this);
  }
  override 拾取时触发():void {
    this.fx.sound('CatapultHero/声音/原素材/MAGIC_SPELL_Shield_mono',this.拥有者?.K2_GetActorLocation());
    this.游戏模式?.加入回合开始(this);this.ug_visual={state:'spawning',since:this.world.clock.now,scale:0};
    this.timeline('免疫生成','PlayFromStart',{update:(_t,tr)=>{this.ug_visual.scale=tr.变大??0;},finished:()=>{this.ug_visual.state='active';this.ug_visual.scale=1;}});
  }
  override 持续中触发(tag:Tag):void {
    if(tag==='效果.时机.结束层时'||tag==='效果.时机.新一天时'&&this.已拾取){this.销毁效果();return;}
    const hero=this.游戏模式?.玩家角色;
    if(tag!=='效果.时机.受到伤害前'||!hero||!this.已拾取||!科学数比较(this.伤害数据.伤害数值,'>',{系数:0,指数:0}))return;
    const p=hero.K2_GetActorLocation(),q=this.K2_GetActorLocation();
    if(Math.hypot(p.x-q.x,p.y-q.y)<=this.保护罩尺寸)hero.OwnedGameplayTags.add('状态.免疫');
  }
  override 销毁前触发():void {
    if(!this.已拾取){this.游戏模式?.退出回合开始(this);return;}
    const hero=this.游戏模式?.玩家角色;
    if(hero&&!函数库_工具.存在同类效果(this,hero.拥有的效果,'CatapultHero/BP/Skill/效果/蓝图_效果_免疫状态').存在相同被动)hero.OwnedGameplayTags.remove('状态.免疫');
    this.ug_visual={state:'closing',since:this.world.clock.now,scale:1};
    this.timeline('免疫移除','PlayFromStart',{update:(_t,tr)=>{this.ug_visual.scale=tr.变小??0;},finished:()=>{this.游戏模式?.退出回合开始(this);}});
  }
}
