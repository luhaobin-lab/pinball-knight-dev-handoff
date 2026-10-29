import { MapPage } from '../../../ui/pages/map/page';
import type { MapGlyph, MapModel, MapTile } from '../../../ui/pages/map/model';
import type { GameView, MapCellView } from '../../api';
import { legalValues, type PageBinding } from '../page-model';

/**
 * UI_关卡地图页面 (ui-kit `MapPage`): `view.map` → the tile window (row 0 = the hero's floor, then the floors built
 * ahead) with links, difficulty stars and states, or the chapter options (UI_关卡选项); `enter` → `map.enter`,
 * `option` → `map.option`. 撤退 (`retreat`, 战术撤退) is out of scope (WAVE_A §4) and sends nothing.
 */
const GLYPH: Readonly<Record<string, MapGlyph>> = {
  首领战斗: 'boss',
  // 第一层's room is the 任务宝箱 room (PROTOTYPE_SCOPE §5.3)
  第一层: 'chest',
  宝箱房: 'chest',
  营地: 'camp',
  空: 'empty',
  路口: 'portal',
};

export function glyphOf(cell: Pick<MapCellView, 'tile' | 'boss'>): MapGlyph {
  if (cell.boss) return 'boss';
  return GLYPH[cell.tile] ?? (cell.tile.endsWith('战斗') ? 'enemies' : 'unknown');
}

export function mapModel(v: GameView, enterable: ReadonlySet<string>, chapterOptions: readonly string[] = []): MapModel {
  const map = v.map;
  if (!map) return { mode: 'tiles', tiles: [] };
  // UI_关卡地图页面.重置关卡页 L11610 selects WidgetSwitcher index0 without clearing 地图格数组.
  // Core legal map.option exposes that chapter mode even while the previous boss-map cells remain in the view.
  const options = chapterOptions.length > 0 ? chapterOptions : map.cells.length === 0 ? map.options : [];
  if (options.length > 0) return { mode: 'options', tiles: [], options: options.map(o => ({ id: o, name: o })) };
  const current = map.cells.find(c => c.id === map.current);
  const base = current ? current.row : Math.min(...map.cells.map(c => c.row));
  const byId = new Map(map.cells.map(c => [c.id, c]));
  const tiles: MapTile[] = map.cells.map((c): MapTile => {
    const links = map.links.filter(([a]) => a === c.id).flatMap(([, b]) => {
      const t = byId.get(b);
      return t ? [t.col] : [];
    });
    const state = c.id === map.current ? 'current' : c.explored ? 'cleared' : c.enterable && (enterable.size === 0 || enterable.has(c.id)) ? 'open' : 'closed';
    const combat = c.tile.endsWith('战斗');
    return {
      col: c.col,
      row: c.row - base,
      glyph: glyphOf(c),
      state,
      // UI_难度星级: 奖励等级 1..4 shows 0..3 stars on combat tiles
      ...(combat ? { stars: Math.max(0, Math.min(3, c.quality - 1)) } : {}),
      links,
      tip: { width: 275, title: c.tile, body: c.reward ? [c.reward] : [] },
    };
  });
  return { mode: 'tiles', tiles };
}

const binding: PageBinding = {
  id: 'map',
  modal: false,
  match: v => v.screen === 'map' && !v.modal && !v.stash && !v.camp,
  live: host => {
    let view: GameView | null = null;
    let key = '';
    const page = new MapPage(host.font, { mode: 'tiles', tiles: [] }, i => {
      const map = view?.map;
      if (!map) return;
      if (i.kind === 'option') host.send({ type: 'map.option', option: i.option });
      else if (i.kind === 'enter') {
        const current = map.cells.find(c => c.id === map.current);
        const base = current ? current.row : Math.min(...map.cells.map(c => c.row));
        const cell = map.cells.find(c => c.col === i.col && c.row - base === i.row);
        if (cell) host.send({ type: 'map.enter', cell: cell.id });
      }
    });
    return {
      page,
      update(v, legal) {
        view = v;
        const enterable = new Set(legalValues(legal, 'map.enter', 'cell').map(String));
        const options = legalValues(legal, 'map.option', 'option').map(String);
        const k = JSON.stringify([v.map, [...enterable], options]);
        if (k === key) return;
        key = k;
        page.setModel(mapModel(v, enterable, options));
      },
    };
  },
};
export default binding;
