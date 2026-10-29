import { describe, expect, it } from 'vitest';
import { createGame } from '../../src/core/api/game.ts';
import { registry } from '../../src/content/bp/index.ts';
import { UI_战斗结束统计页 } from '../../src/core/bp/widgets.ts';
import { sci } from '../../src/core/math/sci.ts';
import { panelModel } from '../../src/game/bind/pages/modal-panel';
import { heroState } from '../../src/game/bind/hud';
import { cardLayout, SIDE } from '../../src/ui/hud/layout';
import { BACKPACK_SHIFT } from '../../src/ui/pages/backpack/panel';
import { PanelPage, panelLayout, statChips } from '../../src/ui/pages/panel/page';
import { Surface, rect } from '../../src/ui/core/surface';
import { STUB } from '../ui-kit/stub';

function firstRoom() {
  const g = createGame({ seed: 1, content: registry, filter: 'ported', debug: { skipPrologue: true } });
  for (const cmd of [{ type: 'title.newRun' }, { type: 'hero.start' }, { type: 'map.enter', cell: 'r1c0' }] as const) {
    g.runUntilInput(); expect(g.send(cmd).ok).toBe(true);
  }
  g.runUntilInput(); return g;
}

describe('source combat result information remains visible across the view/page boundary', () => {
  it.each([true, false])('preserves separate hero/item totals and source positive scientific chips for success=%s', success => {
    const g = firstRoom(), w = g.world, h = w.mode.玩家角色!;
    const card = w.cult.创建牌到侧栏('旧盾', 1, null, [], 0, new Map()).卡牌实例!;
    h.战斗数据统计.clear(); h.战斗数据统计.set('造成伤害', sci(64000000)); h.战斗数据统计.set('完成充能', sci(2));
    h.战斗数据统计.set('治愈生命', sci(0)); h.战斗数据统计.set('生成护甲', sci(-2));
    card.战斗数据统计.set('造成伤害', sci(75)); card.战斗数据统计.set('生成护甲', sci(1000));
    UI_战斗结束统计页.激活战斗统计页面(w.mode, success, false);
    const m = g.view.modal;
    if (m?.kind !== 'panel') throw Error('expected actual panel');
    expect(m.characters?.map(c => c.id)).toEqual([h.id, card.id]);
    expect(m.characters?.map(c => c.stats)).toEqual([{ charge: '2', damage: '64M' }, { damage: '75', armor: '1k' }]);
    expect(m.lines.filter(l => l.label === '造成伤害')).toHaveLength(2); // legacy flat data still present
    const before = g.digest();
    const host = { frame: () => rect(40, 0, 960, 540), projectWorld: () => ({ x: 500, y: 200 }), sideOffset: () => BACKPACK_SHIFT };
    const model = panelModel(g.view, host), equipped = g.view.inventory.equip.find(c => c.id === card.id)!;
    expect(model.success).toBe(success); expect(model.stats).toHaveLength(2);
    expect(model.stats[0]).toMatchObject({ charge: '2', damage: '64M', guide: true, rightGuide: false, at: { x: 528, y: 200 } });
    const face = cardLayout(equipped.place!.row, 2).face;
    expect(model.stats[1]!.at).toEqual({ x: face.x + face.w / 2 + 106 * SIDE.scale + BACKPACK_SHIFT - 40, y: face.y + face.h / 2 });
    expect(statChips(model.stats[0]!).chips.map(c => c.value)).toEqual(['2', '64M']);
    expect(statChips(model.stats[1]!).chips.map(c => c.value)).toEqual(['75', '1k']);
    expect(g.digest()).toBe(before);
    const surface = new Surface(960, 540), page = new PanelPage(STUB, model, () => {});
    page.draw(surface);
    const chip = statChips(model.stats[0]!).chips[0]!.rect;
    expect(surface.data[chip.y * surface.w + chip.x]).not.toBe(0);
    expect(panelLayout(STUB, model.canRetry).next).toEqual(panelLayout(STUB, !success).next);
  });

  it('uses source right/left threshold and real item offset without inventing combined totals', () => {
    const g = firstRoom(), h = g.world.mode.玩家角色!;
    h.战斗数据统计.set('造成伤害', sci(75));
    UI_战斗结束统计页.激活战斗统计页面(g.world.mode, true, false);
    const model = panelModel(g.view, { frame: () => rect(0, 0, 960, 540), projectWorld: () => ({ x: 800, y: 100 }) });
    expect(model.stats[0]!.guide).toBe(false); expect(model.stats[0]!.rightGuide).toBe(true);
    const { guide, chips } = statChips(model.stats[0]!);
    expect(guide!.x).toBeGreaterThan(chips[0]!.rect.x);
    expect(guide!.x + guide!.w).toBeLessThanOrEqual(800 - h.宽度 / 2 + 1);
  });

  it('uses authoritative forced death even when HP stays positive, with fallback only for old fixtures', () => {
    const g = firstRoom(), h = g.world.mode.玩家角色!;
    const hp = g.view.hero!.hp;
    h.自杀 = true; h.检查死亡(true, true);
    expect(g.view.hero!.hp).toBe(hp); expect(hp).toBeGreaterThan(0);
    expect(heroState(g.view).dead).toBe(true);
    const liveZero = { ...g.view, hero: { ...g.view.hero!, hp: 0, dead: false } };
    expect(heroState(liveZero).dead).toBe(false);
    const legacy = { ...g.view, hero: { ...g.view.hero!, hp: -1, dead: undefined } };
    expect(heroState(legacy).dead).toBe(true);
  });
});
