# src/ui/kit — the page kit (WAVE_A A06)

Pages are plain view model in, intents out (ARCHITECTURE §9). They draw on the software `Surface` (src/ui/core) in the
960×540 design frame and never import `src/core`; `src/game` maps `GameView` to models and intents to Commands.

## Writing a page (`src/ui/pages/<id>/{model.ts,page.ts}`)

```ts
// model.ts: plain data and the intents
export interface FooModel { title: string; options: { id: string; label: string; enabled: boolean }[] }
export type FooIntent = { kind: 'pick'; id: string } | { kind: 'close' };

// page.ts
export class FooPage implements Page {
  readonly id = 'foo';
  private readonly regions = new Regions<string>();
  constructor(private readonly font: TextFont, private model: FooModel, private readonly emit: (i: FooIntent) => void) {}
  setModel(m: FooModel): void { this.model = m; this.layout(); }
  layout(): void { this.regions.set([...]); }            // rects from WIDGETS (demo.ts) through umg.ts
  draw(s: Surface, t: number): void { panel(s, r, 'window'); label(s, this.font, …); }
  hit(x: number, y: number): boolean { … }
  pointer(e: UiPointer): boolean { const t = this.regions.route(e); if (t) this.emit({ kind: 'pick', id: t }); return … }
}
```

The stack: `stack.setBase(mapPage)`, `stack.open(lootPage, { dim: true, fade: 0.15 })`, `stack.close(lootPage)`;
per frame `stack.update(dt)` (real time) and `stack.draw(layer.surface, t)`; pointer events in layer pixels go to
`stack.pointer(e)` (true = consumed: do not pass the click to the game). The top open page takes input; a modal
swallows every click. `stack.layout(frame)` takes the design frame on the layer (`frameTop` centring).

## API

| Module | What |
|---|---|
| `page.ts` | `Page`, `UiPointer`, `UiKey`, `Regions<T>` (hover, press, click = press + release on the same target) |
| `stack.ts` | `PageStack` (base + modals, dim `DIM`, fades, input routing) |
| `umg.ts` | `canvasBox` (CanvasPanelSlot LayoutData, point and stretched anchors), `padBox`, `alignBox` (box slots), `toGrid` (units → px, edges rounded), `SCREEN` (×0.5) |
| `demo.ts` | `WIDGETS`: the Demo widget numbers of the A06 pages, checked against the dump by `tests/ui-kit/widgets.test.ts` |
| `widgets.ts` | `panel` (window / tip / plain / well), `rule`, `Button` + `drawButton` (normal / hover / pressed / disabled), `bar`, `icon` (`PixelSprite`, e.g. `itemIcon(row, w, h)` from `src/procgen/icons`, passed in by the caller), `Grid`, `list`, `diamondBadge` |
| `rich.ts` | `layoutRich` / `drawRich` / `richLabel` (the Demo's `<style>…</>` markup), `label` (one aligned line) |
| `style.ts` | `RICH_DEFAULT` (富文本_悬停显示_默认), `RICH_TALENT` (富文本_天赋选择) mapped to Ink & Bone, `TEXT`, `Quality` |
| `tooltip.ts` | `layoutTooltip(font, TooltipModel)` (UI_悬停提示 modes), `layoutKeyword` (UI_词条说明), `placeTooltip`, `TIP` |
| `menu.ts` | `Menu` (UI_物品交互菜单 / UI_物品交互按钮), `MENU`, `menuRects` |
| `card.ts` | `drawCard` (an item card face with quality frame and badges), `qualityFrame`, `currencyChip` |
| `strings.ts` | `STR` fixed labels resolved by their Demo loc keys `STR_KEYS` through `src/content/text` |

Colours are Ink & Bone only (src/ui/style/palette.ts); the Demo's hex values are kept in comments in `style.ts`.

## The A06 pages (`src/ui/pages/<id>/{model.ts,page.ts}`)

| Page | Demo widgets | Model → intents | Command (ARCHITECTURE §6.2, WAVE_A §3) |
|---|---|---|---|
| `map` (`MapPage`) | UI_关卡地图页面, UI_地图格, UI_关卡选项, UI_难度星级, UI_任务列表 / UI_任务条目 | `MapModel` (tiles 3 × N with state, links, stars, tips; or chapter options) → `enter`, `option`, `retreat` | `map.enter`, `map.option`, the retreat command |
| `loot` (`LootPage`) | UI_物品盒子, UI_奖励提示 | `LootModel` → `take`, `close`, `reroll`, `dismantle` | `loot.take`, `loot.close` |
| `tooltip` (`TooltipPage`) | UI_悬停提示 A / B, UI_词条说明, UI_技能词条, UI_装备词条, UI_属性词条 | `TooltipPageModel` (no input) | — |
| `item-menu` (`ItemMenuPage`) | UI_物品交互菜单, UI_物品交互按钮, UI_分解框 | `ItemMenuModel` → `pick`, `close` | `item.use`, `item.dismantle` … |
| `panel` (`PanelPage`) | UI_战斗结束统计页, UI_角色战斗统计 | `PanelModel` → `continue`, `retry` | `panel.continue`, `panel.retry` |

Debug: `?scene=ui-kit&page=map|map-options|loot|tooltip|item-menu|panel[&hover=x,y][&click=x,y]` (design-frame px).
The map pages have no 3D room behind them, so `npm run shots` needs `--allow-blank` for them.
