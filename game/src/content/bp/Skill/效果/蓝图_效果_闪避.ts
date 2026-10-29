/**
 * 蓝图_效果_闪避: spawned by 闪避处理 on a dodged hit. Plays the dodge sound and, when the dodge left exactly 0 damage
 * (Perfect Dodge, 闪避减伤% = 1), logs it and shows the "完美闪避" popup; then destroys itself (COMBAT-039/040).
 * Demo: CatapultHero/BP/Skill/效果/蓝图_效果_闪避 (dump/blueprints-pseudo/…/效果/蓝图_效果_闪避.txt).
 * Parent: 蓝图_效果. CDO tags: manifest. Batch: core-status-rating.
 */
import { 蓝图_效果 } from '../../../../core/ability/effect.ts';
import { 函数库_工具, 函数库_战斗日志, 函数库_科学数 } from '../../../../core/bp/index.ts';
import { 科学数零 } from '../../../../core/math/sci.ts';
import { TagSet } from '../../../../core/sim/tags.ts';
import type { AssetPath, Tag } from '../../../../core/sim/types.ts';
import type { FText } from '../../../../content/demo/types.ts';

/** strings.json 9D93E9914C28794140822985DA8B01A4 (#14). */
const 完美闪避日志: FText = {
  zh: '<强调>{受伤者}</>完美闪避了来自<技能>“{技能名}”</>的伤害。',
  en: '<强调>{受伤者}</> perfectly dodged Damage from <技能>“{技能名}”</>.',
};
/** strings.json CD43E38B45A45995043780888FB22FD1 (#298). */
const 完美闪避: FText = { zh: '完美闪避', en: 'Perfect Dodge' };

/** KismetTextLibrary.Format with named text arguments, per culture. */
function format(t: FText, args: Readonly<Record<string, FText>>): FText {
  const sub = (s: string, lang: keyof FText): string => s.replace(/\{([^{}]+)\}/g, (m, k: string) => (k in args ? args[k][lang] : m));
  return { zh: sub(t.zh, 'zh'), en: sub(t.en, 'en') };
}

export class 蓝图_效果_闪避 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/蓝图_效果_闪避';

  // L25
  override 激活后触发(_Debug: string): void {
    const owner = this.拥有者!;
    函数库_工具.更新目标和自身运动数据(this, owner);
    owner.被击特效A = null;
    this.fx.sound('MARTIAL_ARTS_Kick_Punch_RR12_mono', owner.K2_GetActorLocation(), { volume: 1.3, pitch: 1.0 });
    // The UI_伤害提示 widget is created here either way; it only shows through 创建伤害提示 below.
    if (函数库_科学数.科学数等于(this, owner.当前受伤数据.伤害数值, 科学数零)) {
      const 受伤者 = 函数库_战斗日志.日志__获取角色名(this, owner).Output;
      const 技能名 = 函数库_战斗日志.日志__获取能力名(this, owner.当前受伤数据.来自技能).Output;
      函数库_战斗日志.日志__输出(this, format(完美闪避日志, { 受伤者, 技能名 }), owner, new TagSet(['可交互.角色.AI.仇恨', '可交互.角色.玩家']), new TagSet());
      // 创建伤害提示("完美闪避", {当前受伤数据, 是弱点 false, 触发次数 1, 断开骨骼名 '免疫'}, 拥有者, false, 像素字体)
      this.fx.popup({ popup: 'text', value: 完美闪避.zh, target: owner.id, at: null, damageType: owner.当前受伤数据.伤害类型 });
    }
    this.销毁效果(); // L10
  }

  // L2426 → L2431
  override 销毁前触发(): void {}

  // L2431
  override 持续中触发(_触发时机: Tag): void {}
}
