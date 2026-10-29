/**
 * 蓝图_效果_终级抉择 — the first full Corruption (SCM-034, SCM-053): sets `腐化满过？`, plays the 2.0 s scan, then 0.6 s
 * later offers the reward 终结抉择 (数据表_技能_奖励, weight 100) and destroys itself. Spawned by 增加腐化.
 * Demo: CatapultHero/BP/Skill/效果/玩家/蓝图_效果_终级抉择 (pseudo L15…L2379, latent L93; timeline 时间轴 2.0 s).
 * Parent: 蓝图_效果. CDO tags (manifest): 新一天时, 创建时, 可交互.角色.玩家. Batch: core-stamina.
 */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { structOf } from '../../../../../core/bp/structs.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';

export class 蓝图_效果_终级抉择 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/玩家/蓝图_效果_终级抉择';
  是天赋 = true; // 是天赋？
  跳过动画 = false; // 跳过动画？

  /** L15: only 新一层时 destroys it (and the class does not listen to it); no parent call. */
  override 持续中触发(触发时机: Tag): void {
    if (触发时机 === '效果.时机.新一层时') this.销毁效果();
  }

  /** L940: the scan particle, the screen block, "绝望之语。", the sounds; `腐化满过？ = true`; the timeline. */
  override 激活后触发(_Debug: string): void {
    const mode = this.world.mode;
    const hero = mode.玩家角色;
    this.world.cult.切换屏蔽(true, false, 2);
    if (hero) this.fx.headUp(hero, { ns: '', key: '3727CE1240DED2DFA1784B879DB4AA13' }); // #642 绝望之语。
    this.fx.sound('CatapultHero/声音/原素材/Slow_Scratch_RISER');
    if (hero) hero.腐化满过 = true;
    if (hero) this.fx.vfx('CatapultHero/粒子/粒子_增加腐化', hero, { attach: true });
    this.fx.sound('CatapultHero/声音/原素材/Uneasy_Hit');
    this.fx.vfx('CatapultHero/粒子/粒子_终结抉择', this, { attach: true });
    // L907; the update track only drives the scan's 衰减范围 (presentation).
    this.timeline('时间轴', 'ReverseFromEnd', { finished: () => this.delay('L2114', 0.6, () => this.奖励()) });
  }

  /** Latent L93: unblock, create and run the 终结抉择 reward (its options are wave B sys-shop-events), then L82. */
  private 奖励(): void {
    const mode = this.world.mode;
    this.world.cult.切换屏蔽(false, false, 2);
    const 任务条 = {
      ...structOf('结构_任务条'),
      任务名: { zh: '', en: '' }, 任务描述: { zh: '', en: '' },
      图标: 'CatapultHero/精灵片/_环境/营地/营地格_Sprite_12', 传送门粒子: null, 权重: 100,
      解锁范围: { Min: 1, Max: 999 }, 最大关卡数: 10, 最大层数: 12,
      地图格队列: { DataTable: 'CatapultHero/数据表/地图/数据表_标签队列', RowName: '初始列_0' },
      任务类型: '房间' as const, 任务等级: 1, 奖励等级: 1,
      奖励类型: [{ 权重: 100, 数据表行: { DataTable: 'CatapultHero/数据表/技能/数据表_技能_奖励', RowName: '终结抉择' } }],
      标签: [],
    };
    mode.创建奖励(任务条).实例?.执行技能(false);
    this.销毁效果(); // L82
  }
}
