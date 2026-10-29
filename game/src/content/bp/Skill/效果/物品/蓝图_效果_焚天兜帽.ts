/** Source L1870/L2174/L15: other-item crit or infusion starts a .3s combo timer; every hit iteration uses OutHits[0]. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_工具 } from '../../../../../core/bp/index.ts';
import { make伤害 } from '../../../../../core/bp/structs.ts';
import { 科学数变普通 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import { BP_ManeActor } from '../../../../../core/sim/actor.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_焚天兜帽 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_焚天兜帽';
  角度抖动 = 0; 连击计数_0 = 0; 连击定时器柄 = { Handle: 0 };
  override 持续中触发(时机: Tag): void {
    const s = this.来自技能, source = s?.拥有者; if (!s || !source) return;
    if (时机 === '效果.时机.有物品会心时') {
      const card = this.world.cult.当前触发会心的牌;
      if (card === source || !card?.HasMatchingGameplayTag('可交互.修炼牌')) return;
    } else if (时机 !== '效果.时机.被灌注时') return;
    this.连击计数_0 = 科学数变普通(获取科学映射词条(source.词条, '连击').输出值);
    this.setTimer('连击定时器柄', Math.fround(.3), true, () => this.连击触发(), Math.fround(-.3));
  }
  连击触发(): void {
    const s = this.来自技能, source = s?.拥有者, hero = this.world.mode.玩家角色; if (!s || !source || !hero) return;
    hero.更新运动数据();
    const result = 函数库_工具.以目标为中心追踪(this, hero, Math.fround(s.技能距离), 3, 2, [hero], false, { x: 0, y: 0, z: 0 });
    this.fx.sound('CatapultHero/声音/FireBallImpactB', result.目标所在位置, { volume: 1, pitch: 1 });
    this.fx.vfx('CatapultHero/粒子/粒子_火环', result.目标所在位置);
    for (let i = 0; i < result.OutHits.length; i++) {
      const hit = result.OutHits[0], target = hit?.actor; if (!(target instanceof BP_ManeActor)) continue;
      // Source calls the HIT actor's outgoing damage function, while the packet caster remains the source item.
      target.造成持续伤害(make伤害({ 伤害来源: '装备', 伤害类型: '燃烧', 不变速: false,
        伤害数值: 获取科学映射词条(source.词条, '基础伤害').输出值, 所需回合: 3, 触发次数: this.触发次数,
        击中点位置: hit.impactPoint, 击中点法线: hit.impactNormal, 来自技能: s, 来自角色: source, 目标角色: target }), false, false);
    }
    this.连击计数_0 -= 1; if (this.连击计数_0 <= 0) this.clearTimer('连击定时器柄');
  }
}
