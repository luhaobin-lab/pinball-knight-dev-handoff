/**
 * 蓝图_效果_意图: the enemy intent (ENEMY--041…048). Created unique by BP_ManeActor.选择技能; placed above its owner; shows
 * UI_意图提示 (page by the first 类型 tag of 当前能力, number 参数[0] × stat snapshotted now); hidden and destroyed on
 * 进入战斗时 or 死亡前; ignores 新一天时.
 * Demo: CatapultHero/BP/Skill/效果/敌人/蓝图_效果_意图 (dump/blueprints-pseudo/…/效果/敌人/蓝图_效果_意图.txt), widget logic
 * from BP/UI/UI_意图提示 (激活意图提示 L10, L1472, L2941, L3487). Parent: 蓝图_效果. CDO tags (manifest): 效果.时机.新一天时,
 * 效果.时机.死亡前, 效果.时机.进入战斗时. Batch: core-ai.
 */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能, 函数库_科学数 } from '../../../../../core/bp/index.ts';
import { sciOf, 科学数乘除, 科学数变普通 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import { BP_Actor_Other } from '../../../../../core/sim/other.ts';
import type { AssetPath, Tag, Vec3 } from '../../../../../core/sim/types.ts';

/** UI_意图提示 pages (UII L10): 0 attack, 1 heal, 2 armour, 3 special. */
export type IntentPage = 0 | 1 | 2 | 3;

const snap4 = (v: number): number => Math.floor(v / 4 + 0.5) * 4;

export class 蓝图_效果_意图 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/敌人/蓝图_效果_意图';
  弱点角度 = 0;
  As_BP_Actor_Other: BP_Actor_Other | null = null;
  /** UI_意图提示 state (widget variables, not blueprint variables): the page and the text set at activation. */
  widgetPage: IntentPage = 3;
  widgetText = '';
  widgetVisible = false;

  // L25
  override 激活后触发(_Debug: string): void {
    const owner = this.拥有者;
    if (!(owner instanceof BP_Actor_Other)) return;
    this.As_BP_Actor_Other = owner;
    const p = this.K2_GetActorLocation();
    const at: Vec3 = { x: snap4(owner.高度 + 15 + p.x), y: snap4(0 + p.y), z: snap4(200 + p.z) };
    this.K2_SetActorLocation(at);
    this.激活意图提示(owner, this.K2_GetActorLocation());
    this.widgetVisible = true; // 侧栏UI.SetHiddenInGame(false)
  }

  // L706
  override 销毁前触发(): void {}

  // L711
  override 持续中触发(触发时机: Tag): void {
    if (触发时机 !== '效果.时机.进入战斗时' && 触发时机 !== '效果.时机.死亡前') return;
    this.widgetVisible = false; // L848 / L887
    this.fx.ui({ op: 'close', widget: 'UI_意图提示', data: { owner: this.拥有者?.id ?? null } });
    this.销毁效果(); // L10
  }

  /** UI_意图提示.激活意图提示 (UII L10, L1472, L2941, L3487): the page and the number text, snapshotted now (ENEMY--046). */
  private 激活意图提示(owner: BP_Actor_Other, at: Vec3): void {
    const skill = owner.当前能力;
    const first = skill ? skill.类型.toArray()[0] : undefined;
    const page: IntentPage = first === '能力.类型.攻击' ? 0 : first === '能力.类型.治疗' ? 1 : first === '能力.类型.护甲' ? 2 : 3;
    let text = ''; // page 3: the widget variable 文本 is still empty
    if (page !== 3) {
      const { 参数值, 词条 } = 函数库_技能.获取技能参数(this, skill, 0, false, '');
      const v = 科学数乘除(sciOf(参数值, 0), 获取科学映射词条(owner.词条, 词条).输出值, false);
      text = 函数库_科学数.科学数字缩写(this, v, 0).ReturnValue.zh;
      if (page === 0 && skill?.类型.has('能力.类型.连击')) {
        const combo = 科学数变普通(获取科学映射词条(owner.词条, '连击').输出值);
        if (combo > 1) text = `${text}×${combo}`;
      }
    }
    this.widgetPage = page;
    this.widgetText = text;
    this.fx.ui({ op: 'open', widget: 'UI_意图提示', data: { owner: owner.id, skill: skill?.能力名 ?? null, page, text, at } });
  }
}
