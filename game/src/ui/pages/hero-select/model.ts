import { rowNames, 数据表_玩家 } from '../../../content/demo';

/**
 * UI_英雄选择页 + UI_英雄头像 + UI_介绍词条 (BP/UI/*.txt). 激活英雄选择页 lists every 数据表_玩家 row without the tag 忽略
 * (测试 only in 测试模式, false in the Demo; L1475), in row order: 幽冥骑士 and 灵魂猎手. A portrait is unlocked when the
 * save's 探索等级进度['总值'].当前解锁等级 ≥ the row's 解锁.积分等级 (L1669, L2641); a locked one shows the hover tip
 * "探索等级提升至<天赋>{0}</>后解锁。" titled with 描述[0] and tagged 未解锁 (L632). 出发 is enabled unless the selected hero
 * is 默认 (更新出发按钮 L4083). Not built: the 深渊级别 row (Collapsed), the 潜能 tab (dead, PROTOTYPE_SCOPE §3), the chapter
 * buttons (章节框 Collapsed).
 */

export interface HeroPortrait {
  /** 数据表_玩家 row name (英雄名). */
  readonly hero: string;
  /** 描述[0]: the hero's name. */
  readonly name: string;
  /** 精灵片: the portrait's icon sprite path (the placeholder draws a glyph per hero). */
  readonly sprite: string | null;
  /** 解锁.积分等级. */
  readonly unlockLevel: number;
  readonly unlocked: boolean;
  readonly selected: boolean;
}

export interface HeroSelectModel {
  /** 探索等级进度['总值'].当前解锁等级. */
  readonly explorationLevel: number;
  /** 游戏模式.当前英雄角色名 (默认 before a portrait was clicked). */
  readonly selected: string;
  /**
   * 玩家角色.拥有的主动能力[0]: 额外描述[0] and 描述 of the selected hero's first active ability (UI_英雄头像 L15), read
   * from the live ability by the binder; omitted until the hero is activated.
   */
  readonly skill?: { readonly name: string; readonly description: string };
}

/** The portrait rows of 数据表_玩家 (no 忽略 tag), in table order. */
export function heroRows(): string[] {
  return rowNames(数据表_玩家).filter(r => !数据表_玩家.rows[r].标签.includes('忽略'));
}

export function heroPortraits(m: Pick<HeroSelectModel, 'explorationLevel' | 'selected'>): HeroPortrait[] {
  return heroRows().map(hero => {
    const row = 数据表_玩家.rows[hero as keyof typeof 数据表_玩家.rows];
    return {
      hero,
      name: row.描述[0]?.zh ?? hero,
      sprite: row.精灵片,
      unlockLevel: row.解锁.积分等级,
      unlocked: m.explorationLevel >= row.解锁.积分等级,
      selected: m.selected === hero,
    };
  });
}

/** 英雄介绍: 名字 = 描述[0], 简介 = Format("{0}\r\n{1}", 描述[1], 描述[2]) (L4751). Empty for 默认. */
export function heroIntro(hero: string): { name: string; text: string } {
  const row = (数据表_玩家.rows as Record<string, (typeof 数据表_玩家.rows)[keyof typeof 数据表_玩家.rows] | undefined>)[hero];
  const d = row?.描述 ?? [];
  if (d.length === 0) return { name: '', text: '' };
  return { name: d[0]?.zh ?? '', text: `${d[1]?.zh ?? ''}\n${d[2]?.zh ?? ''}` };
}

/** The lock tip of a locked portrait (L632): 简单描述(描述[0], text) with the extra line 未解锁. */
export function lockTip(p: HeroPortrait): { title: string; text: string; extra: string } {
  return { title: p.name, text: `探索等级提升至<天赋>${p.unlockLevel}</>后解锁。`, extra: '未解锁' };
}

/** 出发按钮.SetIsEnabled(当前英雄角色名 != 默认). */
export const canStart = (m: Pick<HeroSelectModel, 'selected'>): boolean => m.selected !== '默认';

/** Page title TextBlock_56. */
export const HERO_SELECT_TITLE = '冒险菜单';
export const START_LABEL = '出发';

/**
 * `pick` → `hero.pick { hero }` (only an unlocked portrait that is not already selected: 被点击 L2962); `start` →
 * `hero.start` (only when enabled); `back` (关闭按钮) → `hero.back`.
 */
export type HeroSelectIntent = { readonly kind: 'pick'; readonly hero: string } | { readonly kind: 'start' } | { readonly kind: 'back' };

/** What a click on a portrait does (L2962: ¬被选中？ ∧ 已解锁？), or null. */
export function pickIntent(p: HeroPortrait): HeroSelectIntent | null {
  return !p.selected && p.unlocked ? { kind: 'pick', hero: p.hero } : null;
}
