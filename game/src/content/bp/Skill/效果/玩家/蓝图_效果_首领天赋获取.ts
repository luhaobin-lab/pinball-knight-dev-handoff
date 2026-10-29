/**
 * 蓝图_效果_首领天赋获取: the boss talent pick after a boss kill (attached by 蓝图_奖励_复合奖励). After its 2 s show it
 * opens UI_主界面's multi-choice on the floor's tags (3 options, free, no refresh, outside the turn-start barrier);
 * closing the pick ends the floor (结束当前层). It destroys itself when the floor ends.
 * Demo: CatapultHero/BP/Skill/效果/玩家/蓝图_效果_首领天赋获取 (dump/blueprints-pseudo/CatapultHero/BP/Skill/效果/玩家/蓝图_效果_首领天赋获取.txt)
 * Parent: 蓝图_效果 (implements 接口_工具). CDO tags (manifest): 效果.时机.创建时, 效果.时机.结束层时.
 * Rows: none.
 * Batch: core-talents.
 */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { TagSet } from '../../../../../core/sim/tags.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
import { 主界面 } from './蓝图_效果_升级获取天赋.ts';

export class 蓝图_效果_首领天赋获取 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/玩家/蓝图_效果_首领天赋获取';
  是天赋: boolean = true;
  跳过动画: boolean = false; // 跳过动画？

  /** L1630 → L1370: 0.6 s, then the pick on 当前层配置.标签 (ubergraph @15). */
  时间轴__FinishedFunc(): void {
    this.delay('L1370', 0.6, () => {
      const 目标 = new TagSet(this.world.mode.当前层配置.标签);
      主界面(this).开启多选一(this, false, 目标, new TagSet(), [], true, true, false, 3, 0, 0, this, null);
    });
  }

  时间轴__UpdateFunc(): void {
    // L1425: the scan particles' falloff follows the track (presentation)
  }

  // 接口_工具 events without behaviour here (L223–L237).
  悬停高亮(_显示高亮: boolean): void {}
  玩家交互(): void {}
  悬停提示(): void {}
  新一天时(): void {}
  被复活_重置(): void {}
  盒子关闭后(): void {}
  刷新盒子(): void {}
  激活额外特效(_激活: boolean): void {}
  读档处理(_是读档: boolean): void {}
  奖励配置(_所在格层配置: unknown, _所在格种子: number): void {}
  特殊处理(): void {}
  AI行动前(): void {}
  回合开始前(): void {}
  结束层时(): void {}
  衍生物提示(_开启: boolean): void {}

  /** L238: block the UI, "憎恨的力量。", the corruption burst, then the timeline played backwards from its end (L190). */
  override 激活后触发(_Debug: string): void {
    const hero = this.world.mode.玩家角色;
    this.world.cult.切换屏蔽(true, false, 2);
    if (hero) hero.fx.headUp(hero, { ns: '蓝图_效果_首领天赋获取', key: '憎恨的力量。' });
    this.fx.sound('CatapultHero/声音/Slow_Scratch_RISER');
    if (hero) this.fx.vfx('CatapultHero/粒子/粒子_增加腐化', hero, { attach: true });
    this.fx.sound('CatapultHero/声音/Uneasy_Hit');
    this.timeline('时间轴', 'ReverseFromEnd', { finished: () => this.时间轴__FinishedFunc() });
  }

  ReceiveDestroyed(): void {
    // L1358: nothing
  }

  /** L1635: the floor's end destroys the effect. */
  override 持续中触发(触发时机: Tag): void {
    if (触发时机 === '效果.时机.结束层时') this.销毁效果(); // L1359
  }

  /** L1702 (接口_工具): the pick closed → end the floor. */
  天赋关闭后(): void {
    this.world.mode.结束当前层(true);
  }
}
