/** Source L8432/L79/L1264: charge count * trunc(p0 * current source stat * combo), bounded hero光阴 stacks. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 蓝图_效果_精神状态_光阴 } from '../玩家/精神状态/蓝图_效果_精神状态_光阴.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make效果配置 } from '../../../../../core/bp/structs.ts';
import { 科学数变普通 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import { applyEffect } from '../蓝图_效果_可控弹射.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_充能获得光阴 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_充能获得光阴';
  词条名 = '闪避%'; 累计次数 = 0;
  override 持续中触发(t: Tag): void {
    const s = this.来自技能, source = s?.拥有者, hero = this.world.mode.玩家角色;
    if (t !== '效果.时机.自身完成充能' || !s || !source || !hero || !this.world.isValid(hero) || hero.死掉了) return;
    const p = 函数库_技能.获取技能参数(this, s, 0, false, '');
    const combo = 科学数变普通(获取科学映射词条(source.词条, '连击').输出值), stat = 科学数变普通(获取科学映射词条(source.词条, p.词条).输出值);
    const cls = 蓝图_效果_精神状态_光阴.path, cfg = make效果配置({ 效果类: cls, 持续时间: -1, 触发间隔: 1, 持续回合: -1,
      叠加层数: Math.imul(this.触发次数, Math.trunc(p.参数值 * stat * combo)), 唯一: true, 检查效果名: false,
      叠加上限: Math.trunc(科学数变普通(获取科学映射词条(hero.词条, '心流层上限').输出值)) });
    const r = applyEffect(this, { cfg, owner: hero, 释放者: source, 来自技能: s, 效果名: 函数库_技能.获取效果名(this, s, cls).效果名字, classOf: source });
    r.effect?.激活效果('');
  }
}
