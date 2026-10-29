/**
 * 蓝图_效果_光环修改物品词条: a talent / item aura on items' stats. Whenever items change it removes its source (the
 * ability's 唯一ID, "/附魔" for talents) of stat 参数 [0].词条 from every carried item, then, when its set condition holds
 * (and 参数 [1] 小于等于 caps the count), adds 参数 [0] to every item the ability's conditions select.
 * Demo: CatapultHero/BP/Skill/效果/天赋/蓝图_效果_光环修改物品词条 (dump/blueprints-pseudo/CatapultHero/BP/Skill/效果/天赋/蓝图_效果_光环修改物品词条.txt)
 * Parent: 蓝图_效果. CDO tags (manifest): 效果.时机.物品发生变更, 效果.时机.创建时, 效果.时机.分解后, 效果.时机.物品标签被修改.
 * Rows: 数据表_天赋_boss专属:旋风共鸣, 数据表_天赋_boss专属:邪眼, 数据表_天赋_专属:防御姿态, 数据表_天赋_专属:鹰眼, 数据表_天赋_专属:猎头, 数据表_天赋_专属:撕裂技巧, 数据表_天赋_专属:裂心一击, 数据表_天赋_专属:多重射击, 数据表_天赋_专属:心流原力, 数据表_天赋_专属:毒性加速, 数据表_天赋_专属:雷厉风行, 数据表_天赋_专属:元气锋芒, 数据表_天赋_专属:大地脉动, 数据表_天赋_新新通用:上肢力量, 数据表_天赋_新新通用:下肢力量, 数据表_天赋_新新通用:上肢耐力, 数据表_天赋_新新通用:下肢耐力, 数据表_天赋_新新通用:治愈专精, 数据表_天赋_新新通用:暗藏杀机, 数据表_天赋_新新通用:锋芒毕露, 数据表_技能_修炼物品:巨力神兵, 数据表_技能_修炼物品:双生长弓A, 数据表_技能_修炼物品:双生长弓B, 数据表_技能_修炼物品:血肉弹夹, 数据表_技能_修炼物品:无限箭袋, 数据表_技能_修炼物品:风火权杖A, 数据表_技能_修炼物品:风语草, 数据表_技能_修炼物品:火山药水A, 数据表_技能_修炼物品:螺旋腕轮, 数据表_技能_修炼物品:秘银鳞片B, 数据表_技能_修炼物品:瘟疫花B, 数据表_技能_修炼物品:防滑裹布A, 数据表_技能_修炼物品:防滑裹布B, 数据表_技能_修炼物品:圣契果, 数据表_技能_修炼物品:灌能手套, 数据表_技能_修炼物品:幸运护符, 数据表_技能_修炼物品:黏黏藤A, 数据表_技能_修炼物品:黏黏藤B, 数据表_技能_修炼物品:时空水晶, 数据表_技能_修炼物品:速效药剂C, 数据表_技能_修炼物品:结晶套装B..
 * Batch: core-talents.
 */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_工具, 函数库_技能 } from '../../../../../core/bp/index.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
import { 添加科学映射值, 移除科学映射值 } from '../../../../../core/math/stats.ts';
import { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';

export class 蓝图_效果_光环修改物品词条 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_光环修改物品词条';
  词条名: string = '元素伤害%';
  计数: number = 0;
  目标牌: (BP_Actor_Card | null)[] = [];
  来自牌: BP_Actor_Card | null = null;

  private 参数(i: number): { 参数值: number; 词条: string } {
    return 函数库_技能.获取技能参数(this, this.来自技能, i, false, '');
  }

  private 来源(): string {
    const skill = this.来自技能!;
    return skill.唯一ID + (skill.是天赋 ? '/附魔' : '');
  }

  /** L3672 → L15: strip the source from 背包里牌 then 已装备牌; then L1649: re-apply to the selected items. */
  private 重算(): void {
    const cult = this.world.cult;
    const skill = this.来自技能!;
    for (const list of [cult.背包里牌, cult.已装备牌]) {
      for (let i = 0; i < list.length; i++) {
        const card = list[i];
        if (!card) continue;
        if (移除科学映射值(card.词条, this.参数(0).词条, this.来源())) card.更新外观数据(); // L1262 (更新最大生命魔力 is off)
      }
    }
    // L1649
    if (!(skill.是天赋 || (this.来自牌 !== null && cult.已装备牌.includes(this.来自牌)))) return;
    this.目标牌 = 函数库_技能.技能条件筛选物品(this, cult, skill, -1).筛选后;
    const 满足 = 函数库_工具.套装判断(this, cult, new Map(Object.entries(skill.条件.解锁材料))).满足;
    const ok = (this.目标牌.length <= this.参数(1).参数值 && this.参数(1).词条 === '小于等于') || this.参数(1).词条 === '';
    if (!(满足 && ok)) return;
    for (let i = 0; i < this.目标牌.length; i++) { // L2573
      const card = this.目标牌[i];
      if (!card) continue;
      const p0 = this.参数(0);
      添加科学映射值(card.词条, p0.词条, this.来源(), sciOf(p0.参数值, 0), false);
      card.更新外观数据(); // L3326 (属性被修改后 is off)
      card.附加效果后(this);
    }
  }

  /** L3700: remember the source item; a talent applies at once, an item waits for the next item change. */
  override 激活后触发(_Debug: string): void {
    const owner = this.来自技能?.拥有者;
    if (owner instanceof BP_Actor_Card) this.来自牌 = owner;
    if (!this.来自技能?.是天赋) return;
    this.重算();
  }

  override 销毁前触发(): void {
    // L3857: nothing
  }

  /** L3858: every item change recomputes. */
  override 持续中触发(_触发时机: Tag): void {
    this.重算();
  }
}
