import { HeroSelectPage } from '../../../ui/pages/hero-select/page';
import type { HeroSelectModel } from '../../../ui/pages/hero-select/model';
import { 数据表_玩家 } from '../../../content/demo/index.ts';
import type { GameView } from '../../api';
import type { Rect, Surface } from '../../../ui/core/surface';
import type { Page, UiPointer } from '../../../ui/kit';
import { heroSelectLayout } from '../../../ui/pages/hero-select/layout';
import { KNIGHT_ROW } from '../../screens/hero';
import { synced, type PageBinding } from '../page-model';

/**
 * UI_英雄选择页 (ui-pages `HeroSelectPage`): portraits locked by 探索等级, 出发 disabled on 默认; `pick` → `hero.pick`,
 * `start` → `hero.start`, `back` → `hero.back`.
 * SPEC-GAP: the view gives each hero's unlocked flag, not 探索等级 itself; the page's level is the highest 解锁.积分等级
 * among the unlocked heroes, which reproduces the same locks.
 */
const unlockLevel = (row: string): number => (数据表_玩家.rows as Record<string, { 解锁: { 积分等级: number } } | undefined>)[row]?.解锁.积分等级 ?? 0;

export function heroSelectModel(v: GameView): HeroSelectModel {
  const hs = v.heroSelect;
  const levels = (hs?.heroes ?? []).filter(h => h.unlocked).map(h => unlockLevel(h.row));
  return { explorationLevel: levels.length > 0 ? Math.max(...levels) : 0, selected: hs?.picked ?? '默认' };
}

/** The splash frame's inside (its two frame lines kept) is cleared to transparent for the 3D knight behind. */
const SPLASH_INSET = 4;

/** The splash's arch frame as HeroSelectPage draws it (the middle 60 % of 角色选择立绘's rect). */
export function splashArch(): Rect {
  const r = heroSelectLayout(1).splash;
  return { x: r.x + Math.round(r.w * 0.2), y: r.y, w: Math.round(r.w * 0.6), h: r.h };
}

/** HeroSelectPage with the beetle knight's splash window opened onto the 3D layer (screens/hero.ts). */
class KnightSplash implements Page {
  readonly id = 'hero-select';
  private selected = '';
  constructor(
    readonly page: HeroSelectPage,
    private readonly frame: () => Rect,
  ) {}
  layout(): void {
    this.page.layout();
  }
  draw(s: Surface): void {
    this.page.draw(s);
    if (this.selected !== KNIGHT_ROW) return;
    const r = splashArch();
    const f = this.frame();
    const x0 = Math.max(0, f.x + r.x + SPLASH_INSET), x1 = Math.min(s.w, f.x + r.x + r.w - SPLASH_INSET);
    const y0 = Math.max(0, f.y + r.y + SPLASH_INSET), y1 = Math.min(s.h, f.y + r.y + r.h - SPLASH_INSET);
    for (let y = y0; y < y1; y++) s.data.fill(0, y * s.w + x0, y * s.w + x1);
  }
  hit(): boolean {
    return this.page.hit();
  }
  pointer(e: UiPointer): boolean {
    return this.page.pointer(e);
  }
  setModel(m: HeroSelectModel): void {
    this.selected = m.selected;
    this.page.setModel(m);
  }
}

const binding: PageBinding = {
  id: 'hero-select',
  modal: false,
  match: v => v.screen === 'heroSelect' && !v.modal,
  live: host => {
    const page = new HeroSelectPage(host.font, { explorationLevel: 0, selected: '默认' }, i => {
      if (i.kind === 'pick') host.send({ type: 'hero.pick', hero: i.hero });
      else host.send({ type: i.kind === 'start' ? 'hero.start' : 'hero.back' });
    });
    return synced(new KnightSplash(page, host.frame), heroSelectModel);
  },
};
export default binding;
