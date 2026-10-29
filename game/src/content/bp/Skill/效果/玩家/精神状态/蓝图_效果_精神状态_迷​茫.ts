/**
 * 蓝图_效果_精神状态_迷​茫 — Confusion: refreshes every map tile on activation and destruction; the fog itself is in the
 * consumers that test for this class (UI_地图格, the game mode). Ported for data parity; never granted (SCM-080, SCM-096).
 * Demo: CatapultHero/BP/Skill/效果/玩家/精神状态/蓝图_效果_精神状态_迷​茫 (U+200B in the name; pseudo L15…L571).
 * Parent: 蓝图_效果_精神状态. CDO tags (manifest): 新一天时, 效果.类型.减益.精神. Batch: core-stamina.
 */
import type { AssetPath, Tag } from '../../../../../../core/sim/types.ts';
import { 蓝图_效果_精神状态 } from './蓝图_效果_精神状态.ts';

export class 蓝图_效果_精神状态_迷_茫 extends 蓝图_效果_精神状态 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/玩家/精神状态/蓝图_效果_精神状态_迷​茫';

  /** L512 → L484. */
  override 激活后触发(Debug: string): void {
    super.激活后触发(Debug);
    this.更新地图格();
  }

  /** L536. */
  override 持续中触发(触发时机: Tag): void {
    super.持续中触发(触发时机);
  }

  /** L556 → L484. */
  override 销毁前触发(): void {
    super.销毁前触发();
    this.更新地图格();
  }

  /** L15–L456: `修炼系统.地图页3DUI.地图格数组[i].更新地图格数据()` for every tile (widget refresh). */
  private 更新地图格(): void {
    this.fx.ui({ op: 'update', widget: 'UI_地图格.更新地图格数据' });
  }
}
