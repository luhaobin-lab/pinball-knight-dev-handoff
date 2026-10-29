# src/procgen/icons — item icons

- **Owner**: the items lane (with `src/ui`); built by the `placeholder-kit` task.
- **Purpose**: the HUD icon of every item row (合成数据表_修炼物品: 数据表_修炼物品_通用 and the four hero tables,
  200 rows) in the Ink & Bone language of `src/ui/icons` (the same 32-unit pen, raster and palette), drawn at the
  card's size on whole pixels, never scaled.
- **Public API** (`index.ts`):
  - `itemIcon(row, w = 32, h = w)` → a cached `Surface` (`src/ui/core/surface.ts`): blit it into the HUD.
  - `itemIconSpec(row)` → `{ glyph, type, size, enchant, variant, mark, tier, colour, name }`: the glyph picked from
    the item's 描述 name (then its row name) by `RULES` in `items.ts`; the accent type from its 可交互.修炼牌.* tags
    (武器 > 护甲 > 工具 > 饰品 > 治疗 / 药丸 / 食物 > 附魔 > loot); the card size (小型 1, 中型 2, 大型 3 rows); the
    glyph's variant (by what the name says, `BY_NAME`, else the item's place among the items sharing the glyph);
    a rune stone's mark and tier pips; a pill's named colour.
  - `ICON_ACCENT`: the type hues. It is the HUD's `ITEM_ACCENT` with armour (a cool slate) and loot (a warm ochre)
    moved off the bone inks; the HUD palette should adopt it (requested of the ui lane).
  - `ICON_GLYPHS`, `RUNE_MARKS` (`glyphs.ts`): 73 drawings `(pen, variant)`, every one used, in the style of the
    HUD's sixteen (`src/ui/icons/items.ts`); boots and herb redrawn (a 3/4 boot with heel and cuff, a curled frond).
- **Rules** (one grid, one weight): see the style guide in `src/procgen/placeholder/README.md`; enforced by
  `tests/placeholder-kit/icons.test.ts` (palette, weight 0.17–0.34 within 2×, centring, no two items alike).
- **Sheet**: `?scene=placeholder-kit&page=icons` (`&names=0..1` with names, `&iconsize=46` at the 中型 card size).
