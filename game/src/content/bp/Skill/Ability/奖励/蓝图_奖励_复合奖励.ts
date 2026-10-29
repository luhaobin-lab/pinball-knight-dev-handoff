/**
 * 蓝图_奖励_复合奖励 — the combat reward: 1 s after 执行技能 it draws ceil(参数2) = ceil(0.5 × 奖励等级) drops (权重选取 on
 * 全局种子 over 所在格层配置's 指定数据筛选 ++ 通用数据筛选 pools, ln 154–159), adds 破损的神像 on a boss floor (预览图标 one of
 * the boss sprites) until 永恒神像 is unlocked (L666), and opens a free box of those names (no refresh). Closing the box
 * on 首领战斗 gives the hero 蓝图_效果_首领天赋获取 (L7067–L4355); elsewhere it ends the floor unless the task is still open
 * or the map is shown (L7529).
 * Demo: CatapultHero/BP/Skill/Ability/奖励/蓝图_奖励_复合奖励 (dump/blueprints-pseudo/CatapultHero/BP/Skill/Ability/奖励/蓝图_奖励_复合奖励.txt)
 * Parent: 蓝图_能力. CDO tags (manifest): none.
 * Rows: 数据表_技能_奖励:复合奖励.
 * Batch: core-rewards.
 */
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { 函数库_工具, 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make效果配置, structOf } from '../../../../../core/bp/structs.ts';
import { FCeil } from '../../../../../core/math/kismet.ts';
import { 拆分权重数据表, 权重选取 } from '../../../../../core/math/prob.ts';
import type { 词条映射 } from '../../../../../core/math/stats.ts';
import { Array_AddUnique } from '../../../../../core/sim/engine.ts';
import type { AssetPath, 结构_层 } from '../../../../demo/types.ts';

const BOSS_ICONS = ['敌人地图缩略_Sprite_5', '敌人地图缩略_Sprite_7', '敌人地图缩略_Sprite_10', '敌人地图缩略_Sprite_13', '敌人地图缩略_Sprite_14'];
const 首领天赋获取 = 'CatapultHero/BP/Skill/效果/玩家/蓝图_效果_首领天赋获取';

export class 蓝图_奖励_复合奖励 extends 蓝图_能力 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/Ability/奖励/蓝图_奖励_复合奖励';
  // SPEC-GAP: the CDO value (a 消灭所有敌人 combat layer) is replaced by 奖励配置 before use; the struct default stands in.
  所在格层配置: 结构_层 = structOf('结构_层');
  所在格种子: number = 0;
  词条修正: 词条映射 = new Map();
  筛选后战利品: string[] = [];
  指定名组: string[] = [];
  生成品质: number = 1;
  空技能: 蓝图_能力 | null = null;

  // L4909: Delay 1.0 → the ubergraph head (L15).
  override 执行技能(_是读档: boolean): void {
    this.delay('L4909', 1.0, () => this.发放());
  }

  private 发放(): void {
    const w = this.world;
    const mode = w.mode;
    const pool = 函数库_工具.合并权重掉落池(this, [...this.所在格层配置.指定数据筛选], [...this.所在格层配置.通用数据筛选]).权重数据表数组;
    const { 权重数组, 数据表数组 } = 拆分权重数据表(pool);
    this.指定名组.length = 0;
    // L225: the bound is re-evaluated each iteration (pure node), 0 ..= ceil(参数2) − 1.
    for (let i = 0; i <= FCeil(函数库_技能.获取技能参数(this, this, 2, false, '').参数值) - 1; i++) {
      this.指定名组.push(数据表数组[权重选取(权重数组, w.rng.全局种子)]?.RowName ?? 'None');
    }
    // L666
    const unlocked = (w.sys.save as { GetCustomSave(world: typeof w): { 已解锁机制: readonly string[] } }).GetCustomSave(w).已解锁机制.includes('永恒神像');
    const icon = mode.当前层配置.预览图标 ?? '';
    if (BOSS_ICONS.some(s => icon.endsWith(s)) && !unlocked) Array_AddUnique(this.指定名组, '破损的神像');
    // L1140
    w.cult.切换物品盒子(false, true, this.指定名组.length, 0, this);
    w.cult.刷新生成牌(false, true, true, this.生成品质, this.指定名组.length, false, this.目标标签, this.排斥标签, false, true, this.指定名组, [], this.词条修正);
    this.释放结束(false);
  }

  // L7067
  盒子关闭后(): void {
    const w = this.world;
    const mode = w.mode;
    if (mode.当前层地图格配置表.RowName === '首领战斗') {
      const hero = mode.玩家角色;
      if (!w.isValid(hero) || hero.死掉了) return; // L1560
      const cfg = make效果配置({ 效果类: 首领天赋获取, 持续时间: -1, 触发间隔: 1, 持续回合: -2, 叠加层数: 1, 唯一: true, 检查效果名: false, 叠加上限: 1 });
      const { 效果名字 } = 函数库_技能.获取效果名(this, this.空技能, cfg.效果类);
      const pre = 函数库_工具.附加效果前处理(this, cfg, hero, 效果名字);
      if (pre.不需附加新效果) return; // L1625: an existing instance stops here
      const e = w.spawn<NonNullable<typeof pre.效果实例>>(首领天赋获取, x => {
        x.拥有者 = hero; x.释放者 = hero; x.来自技能 = this.空技能;
        x.持续时长 = cfg.持续时间; x.触发间隔 = cfg.触发间隔; x.持续回合 = cfg.持续回合; x.叠加层数 = cfg.叠加层数; x.临时 = false;
      });
      e.效果名字 = 效果名字;
      if (this.空技能 && w.isValid(this.空技能) && this.空技能.是天赋) e.OwnedGameplayTags.add('能力.类型.天赋'); // L4662 (hero is no card)
      Array_AddUnique(hero.拥有的效果, e);
      e.K2_AttachToActor(hero);
      e.激活效果('');
      return;
    }
    const task = mode.当前任务实例 as (typeof mode.当前任务实例 & { 未完成?: boolean }) | null; // L7529
    if (!w.isValid(task)) return;
    if (task.未完成 === true || mode.当前环节 === '选择地图') return;
    mode.结束当前层(true); // L7740
  }

  // L7778
  奖励配置(所在格层配置: 结构_层, 所在格种子: number): void {
    this.所在格层配置 = 所在格层配置;
    this.所在格种子 = 所在格种子;
  }

  // L7021: rebuilds 额外描述 from 额外原始描述 (text formatting, core-inventory text module).
  override 子初始化(): void {
    this.额外描述 = [];
  }
}
