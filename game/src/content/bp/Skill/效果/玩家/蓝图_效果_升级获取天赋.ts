/**
 * 蓝图_效果_升级获取天赋: the level-up talent pick. Attached by 升级玩家 at turn start; after its 1.5 s show it opens
 * UI_主界面's multi-choice (3 options, 1 refresh, free; only 唯一 talents when 英雄等级 − 升级点 == 10 and none is owned)
 * and destroys itself. The pick joins the turn-start barrier (TURN-034/035).
 * Demo: CatapultHero/BP/Skill/效果/玩家/蓝图_效果_升级获取天赋 (dump/blueprints-pseudo/CatapultHero/BP/Skill/效果/玩家/蓝图_效果_升级获取天赋.txt)
 * Parent: 蓝图_效果. CDO tags (manifest): 效果.时机.新一天时, 效果.时机.创建时, 可交互.角色.玩家.
 * Rows: none.
 * Batch: core-talents.
 */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_工具 } from '../../../../../core/bp/index.ts';
import { TagSet } from '../../../../../core/sim/tags.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
import type { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import type { BpObject } from '../../../../../core/sim/object.ts';

/** UI_主界面's multi-choice as module `talents` exposes it (the core's port of the widget). */
export interface 主界面Fns {
  开启多选一(ctx: BpObject, 目标或_且: boolean, 目标标签: TagSet, 排除标签: TagSet, 指定池子: readonly string[], 不加入回合开始: boolean,
    免费: boolean, 天赋_事件: boolean, 选项数量: number, 可刷新次数: number, 额外等级: number, 来自效果: 蓝图_效果 | null, 来自能力: 蓝图_能力 | null): void;
  关闭多选一(ctx: BpObject): void;
  刷新多选一(ctx: BpObject): void;
}

/**
 * `游戏模式.主界面` for the talent content of this card (升级获取天赋, 首领天赋获取, 获取天赋, 天赋卷轴).
 * SPEC-GAP / NEEDS core-contracts: TalentsFns does not declare the UI_主界面 group yet, hence the cast.
 */
export function 主界面(ctx: BpObject): 主界面Fns {
  const ui = (ctx.world.sys.talents as { readonly UI_主界面?: 主界面Fns }).UI_主界面;
  if (!ui) throw new Error('module talents has no UI_主界面');
  return ui;
}

export class 蓝图_效果_升级获取天赋 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/玩家/蓝图_效果_升级获取天赋';
  是天赋: boolean = true;
  跳过动画: boolean = false; // 跳过动画？ (the custom event of the same name is 跳过动画事件)
  战争迷雾绘制: unknown = null;

  /** L3525: open the pick, refresh the talent page (presentation), destroy. */
  时间轴__FinishedFunc(): void {
    const owner = this.拥有者!;
    const mode = this.world.mode;
    const 有唯一 = 函数库_工具.有对应标签效果(this, owner.拥有的效果, '能力.类型.天赋.唯一').存在;
    const 第十级 = mode.英雄等级 - mode.升级点 === 10;
    // QUIRK (L3525): at the tenth level with a 唯一 talent already owned, the exclusion drops 唯一 too (only 首领 stays).
    const 只唯一 = !有唯一 && 第十级;
    const 目标: Tag[] = 只唯一 ? ['能力.类型.天赋.唯一'] : [];
    const 排除: Tag[] = 第十级 ? ['能力.类型.奖励.复合奖励.首领'] : ['能力.类型.天赋.唯一', '能力.类型.奖励.复合奖励.首领'];
    主界面(this).开启多选一(this, false, new TagSet(目标), new TagSet(排除), [], false, true, false, 3, 只唯一 ? 0 : 1, 0, null, null);
    // L1099 / L1008: 天赋页3DUI.更新天赋页 / 更新属性详情 (presentation)
    this.销毁效果();
  }

  时间轴__UpdateFunc(): void {
    // L4507 → L3205 / L2224: particle and fog-of-war radius follow the timeline track (presentation)
  }

  OnCancelled_A9FE7BA94029354E585EBF95AD7B2E81(): void {
    // L764: nothing
  }

  OnCompleted_A9FE7BA94029354E585EBF95AD7B2E81(): void {
    // L765: nothing
  }

  ReceiveDestroyed(): void {
    // L3522: nothing
  }

  override ReceiveTick(_DeltaSeconds: number): void {
    // L3523: nothing (overrides the base tick)
  }

  override 持续中触发(_触发时机: Tag): void {
    // L3524: nothing (the effect only waits for its show)
  }

  /** The custom event 跳过动画 (L4492): straight to the pick. */
  跳过动画事件(): void {
    this.时间轴__FinishedFunc();
  }

  override 销毁前触发(): void {
    // L921: particles off; without 跳过动画？ the sprite drops back (L857 / L766): presentation
  }

  /** L4502 → L2155: block the side bar, then 0.6 s of scan particles, 0.3 s more, "我变强了！" and the 1.6 s timeline. */
  override 激活后触发(_Debug: string): void {
    const owner = this.拥有者!;
    this.world.cult.切换屏蔽(true, false, 0);
    this.fx.sound('CatapultHero/声音/Item_Store_1_LOOP_END'); // L1184
    if (this.跳过动画) {
      this.跳过动画事件();
      return;
    }
    // L1283: the scan particles at the owner (presentation); 拥有者.更新运动数据 only refreshes their position.
    this.fx.vfx('CatapultHero/粒子/粒子_拾取扫描', owner);
    this.delay('L1283', 0.6, () => {
      this.fx.vfx('CatapultHero/粒子/粒子_获得奖励', owner);
      this.fx.sound('CatapultHero/声音/音效_获取天赋');
      this.delay('L525', 0.3, () => {
        owner.fx.headUp(owner, { ns: '蓝图_效果_升级获取天赋', key: '我变强了！' });
        const seq = owner.精灵动画序列[3];
        if (seq) this.playAnim(owner, seq, {});
        this.timeline('时间轴', 'PlayFromStart', { finished: () => this.时间轴__FinishedFunc() }); // L492
      });
    });
  }
}
