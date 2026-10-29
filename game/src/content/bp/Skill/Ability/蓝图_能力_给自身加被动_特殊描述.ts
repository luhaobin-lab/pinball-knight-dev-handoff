/** Source L2423/L2647: first passive effect plus quality-name substitution in description parameter1. */
import { 蓝图_能力 } from '../../../../core/ability/ability.ts';
import type { 蓝图_效果 } from '../../../../core/ability/effect.ts';
import { 函数库_工具, 函数库_技能 } from '../../../../core/bp/index.ts';
import type { AssetPath } from '../../../../core/sim/types.ts';
import { applyEffect } from '../效果/蓝图_效果_可控弹射.ts';
export class 蓝图_能力_给自身加被动_特殊描述 extends 蓝图_能力 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/Ability/蓝图_能力_给自身加被动_特殊描述';
  添加的实例: 蓝图_效果 | null = null;
  override 执行技能(_是读档: boolean): void {
    const owner = this.拥有者, cfg = this.效果配置[0];
    if (!owner || !this.world.isValid(owner) || owner.死掉了 || !cfg) return;
    const name = 函数库_技能.获取效果名(this, this, cfg.效果类).效果名字;
    const { effect, refreshed } = applyEffect(this, { cfg, owner, 释放者: owner, 来自技能: this, 效果名: name, classOf: owner });
    if (!effect) return;
    if (refreshed) effect.激活效果('');
    else { this.添加的实例 = effect; if (effect.HasMatchingGameplayTag('效果.时机.创建时')) effect.激活效果(this.能力名); }
    this.释放结束(false);
  }
  override 被选中(): void { 函数库_工具.选择角色作为目标(this, this.拥有者); }
  override 子初始化(): void {
    const q = ['青铜', '白银', '黄金', '钻石'][this.品质 - 1];
    const args = { '0': this.描述中参数[0], '2': this.描述中参数[2], '3': this.描述中参数[3] };
    const format = (text: string, lang: 'zh' | 'en') => text.replace(/\{([0-4])\}/g, (_, key: string) => key === '1' ? q ? `<强调>${q}</>` : '' : key === '4' ? '' : args[key as '0']?.[lang] ?? '');
    this.描述 = { zh: format(this.原始描述.zh, 'zh'), en: format(this.原始描述.en, 'en') };
  }
}
