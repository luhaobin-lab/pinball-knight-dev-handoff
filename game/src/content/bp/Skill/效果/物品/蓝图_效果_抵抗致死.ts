/** Source L5797/L974: once per combat, restore 1+fraction HP and grant immunity BEFORE death recheck. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能, 函数库_工具 } from '../../../../../core/bp/index.ts';
import { make治疗 } from '../../../../../core/bp/structs.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
import { applyEffect, effectStruct } from '../蓝图_效果_可控弹射.ts';
import { 蓝图_效果_免疫状态 } from '../蓝图_效果_免疫状态.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_抵抗致死 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_抵抗致死';
  触发次数_0 = 0; 触发上限 = 1;
  /** Timeline.Play retains its position across combats, unlike PlayFromStart. */
  ug_抵抗时间 = 0;
  override 激活后触发(_Debug: string): void { this.触发上限 = 1; }
  override 持续中触发(时机: Tag): void {
    const owner = this.拥有者, s = this.来自技能; if (!owner || !s) return;
    if (时机 === '效果.时机.新战斗层时') { this.触发次数_0 = 0; return; }
    if (时机 === '效果.时机.新一天时') { owner.OwnedGameplayTags.remove('状态.濒死'); return; }
    if (时机 !== '效果.时机.死亡前') return;
    owner.更新运动数据();
    if (owner.HasMatchingGameplayTag('状态.濒死') || !(this.触发次数_0 < this.触发上限)) return;
    owner.OwnedGameplayTags.add('状态.濒死'); this.触发次数_0 += 1;
    if (!this.world.isValid(owner) || owner.死掉了) return;
    const cls = 蓝图_效果_免疫状态.path;
    const turns = Math.trunc(函数库_技能.获取技能参数(this, s, 1, false, '').参数值);
    const r = applyEffect(this, { cfg: effectStruct(cls, -1, 1, turns, true), owner, 释放者: owner, 来自技能: s,
      效果名: 函数库_技能.获取效果名(this, s, cls).效果名字, classOf: owner });
    if (!r.effect) return;
    r.effect.激活效果(''); owner.当前生命 = sciOf(1, 0);
    const fraction = 函数库_技能.获取技能参数(this, s, 0, false, '').参数值;
    owner.获得治疗(make治疗({ 是暴击: false, 生命护甲: false, 治疗百分比: sciOf(fraction, 0), 触发次数: 1, 来自技能: s, 释放者: s.拥有者 }), false, false);
    this.playAnim(owner, 'CatapultHero/精灵片/AnimSequences/Actor_C01_绝命');
    // Source timeline has .1 at0/.07,1 at.3, length.5. The shell samples the same manifest; no substitute death curve.
    this.world.bus.emit({ t: this.world.clock.now, kind: 'time.dilation', curve: 'deathResist', from: this.world.clock.now - this.ug_抵抗时间 });
    this.timeline('时间轴', 'Play', { update: t => { this.ug_抵抗时间 = t; }, finished: () => {
      函数库_工具.以目标为中心释放冲击(this, owner, 300, 50000, false, 0, [], false, { x: 0, y: 0, z: 0 });
      this.fx.vfx('粒子_Hit_冲击波', owner, { attach: true });
    } });
  }
  override 销毁前触发(): void {
    // Source deactivates its attached Niagara only. Presentation owns this instance's effect lifetime.
    this.fx.ui({ op: 'update', widget: 'effect.deactivate', data: { id: this.id } });
  }
}
