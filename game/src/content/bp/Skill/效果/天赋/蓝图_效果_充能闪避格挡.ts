/**
 * 蓝图_效果_充能闪避格挡 — on its item's charge completion give the hero n = FTrunc(参数[0]) × 触发次数 × the item's stat
 * 参数[0].词条 stacks of Block (每格挡层 → 蓝图_效果_精神状态_格挡, capped by the hero's 格挡层上限) or Dodge (else →
 * 精神状态_闪避, capped by 闪避层上限; 99 when the hero has no such stat), refreshing an existing one through
 * 附加效果前处理 or spawning a new one on the hero.
 * Demo: CatapultHero/BP/Skill/效果/天赋/蓝图_效果_充能闪避格挡 (dump/blueprints-pseudo/…/效果/天赋/蓝图_效果_充能闪避格挡.txt).
 * Parent: 蓝图_效果. CDO tags (manifest): 效果.时机.自身完成充能. Rows: 获得格挡层 (旧盾), 获得闪避层 (旧鞋) ….
 * Batch: core-inventory.
 */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_工具, 函数库_技能 } from '../../../../../core/bp/index.ts';
import type { 效果配置 } from '../../../../../core/bp/structs.ts';
import { FTrunc } from '../../../../../core/math/kismet.ts';
import { 科学数变普通 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import type { AssetPath } from '../../../../../core/sim/types.ts';

const 格挡 = 'CatapultHero/BP/Skill/效果/玩家/精神状态/蓝图_效果_精神状态_格挡';
const 闪避 = 'CatapultHero/BP/Skill/效果/玩家/精神状态/蓝图_效果_精神状态_闪避';

export class 蓝图_效果_充能闪避格挡 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_充能闪避格挡';
  词条名 = '闪避%';
  累计次数 = 0;

  /** The 结构_效果 the blueprint builds (a pure MakeStruct, evaluated per use in the Demo; no draws involved). */
  private 层配置(): 效果配置 {
    const skill = this.来自技能!;
    const hero = this.world.mode.玩家角色!;
    const p0 = 函数库_技能.获取技能参数(this, skill, 0, false, '');
    const isBlock = p0.词条 === '每格挡层';
    const stat = 科学数变普通(获取科学映射词条(skill.拥有者!.词条, p0.词条).输出值);
    const n = FTrunc(FTrunc(p0.参数值) * this.触发次数 * stat);
    const cap = (name: string) => {
      const r = 获取科学映射词条(hero.词条, name);
      return r.found ? FTrunc(科学数变普通(r.输出值)) : 99;
    };
    return {
      效果类: isBlock ? 格挡 : 闪避, 持续时间: -1, 触发间隔: 1, 持续回合: -1, 叠加层数: n, 唯一: true, 检查效果名: false,
      叠加上限: isBlock ? cap('格挡层上限') : cap('闪避层上限'),
    };
  }

  // L11251
  override 激活后触发(_Debug: string): void {}

  // L11256
  override 销毁前触发(): void {}

  // L11261
  override 持续中触发(触发时机: string): void {
    if (触发时机 !== '效果.时机.自身完成充能') return;
    const skill = this.来自技能;
    if (!skill?.拥有者) return;
    // L11336
    const p0 = 函数库_技能.获取技能参数(this, skill, 0, false, '');
    const stat = 科学数变普通(获取科学映射词条(skill.拥有者.词条, p0.词条).输出值);
    if (!(FTrunc(FTrunc(p0.参数值) * this.触发次数 * stat) > 0)) return; // L13581: "没给拥有者填词条" (debug print)
    const hero = this.world.mode.玩家角色;
    if (!this.world.isValid(hero)) return;
    const { 效果名字 } = 函数库_技能.获取效果名(this, skill, this.层配置().效果类);
    // L10
    if (hero.死掉了) return;
    // L79
    const { 不需附加新效果, 效果实例 } = 函数库_工具.附加效果前处理(this, this.层配置(), hero, 效果名字);
    if (不需附加新效果) { 效果实例?.激活效果(''); return; } // L1748
    // L1854: deferred spawn on the hero
    const cfg = this.层配置();
    const cls = this.world.data.classes[cfg.效果类!] ? cfg.效果类! : null;
    if (!cls) return; // L11014: "效果生成失败"
    const e = this.world.spawn<蓝图_效果>(cls as AssetPath, o => {
      o.拥有者 = hero;
      o.释放者 = skill.拥有者;
      o.来自技能 = skill;
      o.持续时长 = cfg.持续时间;
      o.触发间隔 = cfg.触发间隔;
      o.持续回合 = cfg.持续回合;
      o.叠加层数 = cfg.叠加层数;
      o.临时 = false;
    });
    if (!this.world.isValid(e)) return;
    e.效果名字 = 效果名字;
    // SPEC-GAP: the class test also accepts the legacy BP_Actor_Equip, which no G2 item uses.
    if (skill.拥有者 instanceof BP_Actor_Card && !e.临时) {
      e.OwnedGameplayTags.add('效果.时机.装上');
      e.OwnedGameplayTags.add('效果.时机.卸下');
    } else if (skill.是天赋) {
      e.OwnedGameplayTags.add('能力.类型.天赋');
    }
    // L10804
    if (!hero.拥有的效果.includes(e)) hero.拥有的效果.push(e);
    e.K2_AttachToActor(hero);
    e.激活效果(''); // L1748
  }
}

