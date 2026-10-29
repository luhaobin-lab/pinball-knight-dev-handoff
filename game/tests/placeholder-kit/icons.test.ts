import { describe, expect, it } from 'vitest';
import { 合成数据表_修炼物品 } from '../../src/content/demo/index.ts';
import { ICON_ACCENT, itemIcon, itemIconSpec, ITEM_ROWS } from '../../src/procgen/icons';
import { ICON_GLYPHS } from '../../src/procgen/icons/glyphs';
import { BONE, DANGER, INK, SAPPHIRE, shade } from '../../src/ui/style/palette';
import { alpha, toHex } from '../../src/ui/core/color';

/**
 * An icon's opaque pixels: its weight (the share of the square its inks cover, the 1-px ink outline aside, which
 * sits on the panel's own darkness), bounding box, centroid and colours.
 */
function measure(rowName: string, size = 32): { weight: number; w: number; h: number; cx: number; cy: number; colors: Set<number>; key: string } {
  const s = itemIcon(rowName, size);
  let n = 0;
  let inks = 0;
  let sx = 0;
  let sy = 0;
  let x0 = size;
  let y0 = size;
  let x1 = -1;
  let y1 = -1;
  const colors = new Set<number>();
  const key: number[] = [];
  for (let y = 0; y < s.h; y++) {
    for (let x = 0; x < s.w; x++) {
      const c = s.get(x, y);
      key.push(c);
      if (!alpha(c)) continue;
      colors.add(c);
      n++;
      if (c !== INK.deep) inks++;
      sx += x;
      sy += y;
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
    }
  }
  return { weight: inks / (size * size), w: x1 - x0 + 1, h: y1 - y0 + 1, cx: sx / n, cy: sy / n, colors, key: key.join(',') };
}

describe('item icons', () => {
  it('draws every item row (合成数据表_修炼物品) with a named glyph', () => {
    expect(ITEM_ROWS.length).toBe(Object.keys(合成数据表_修炼物品.rows).length);
    expect(ITEM_ROWS.length).toBe(200);
    for (const row of ITEM_ROWS) {
      const spec = itemIconSpec(row);
      expect(ICON_GLYPHS[spec.glyph], row).toBeDefined();
      expect(itemIcon(row, 32).w).toBe(32);
    }
  });

  it('picks a glyph from what the item is called and a hue from its type tag', () => {
    const glyph = (row: string): string => itemIconSpec(row).glyph;
    expect(glyph('旧剑')).toBe('sword');
    expect(glyph('巨神兵大剑')).toBe('greatsword');
    expect(glyph('袖剑')).toBe('dagger');
    expect(glyph('寂静法杖')).toBe('crown'); // shown as 寂静头冠
    expect(glyph('巨人盾斧')).toBe('axe');
    expect(glyph('护盾孢子')).toBe('mushroom');
    expect(glyph('药丸蜗牛')).toBe('snail');
    expect(glyph('鲜血教母')).toBe('idol');
    expect(glyph('传奇附魔A')).toBe('rune');
    expect(itemIconSpec('伤害附魔A').enchant).toBe('伤害');
    expect(itemIconSpec('旧剑').type).toBe('weapon');
    expect(itemIconSpec('旧盾').type).toBe('armor');
    expect(itemIconSpec('生命药剂').type).toBe('consumable');
    expect(itemIconSpec('旧剑').size).toBe(2);
  });

  it('marks every enchantment by what it does and its tier', () => {
    expect(itemIconSpec('伤害附魔A')).toMatchObject({ mark: 'damage', tier: 1 });
    expect(itemIconSpec('伤害附魔B')).toMatchObject({ mark: 'damage', tier: 2 });
    expect(itemIconSpec('传奇附魔A').mark).toBe('leech');
    expect(itemIconSpec('英雄附魔C').mark).toBe('agility');
    expect(itemIconSpec('空附魔石').mark).toBeNull();
  });

  it('stays in the Ink & Bone palette: bone, ink and one accent per type (or a pill’s named colour), never gold', () => {
    const base = [BONE.base, BONE.dim, INK.base, INK.deep];
    for (const row of ITEM_ROWS) {
      const spec = itemIconSpec(row);
      const accent = spec.colour ?? ICON_ACCENT[spec.type];
      const allowed = new Set([...base, accent, shade(accent)]);
      for (const c of measure(row).colors) expect(allowed.has(c), `${row} ${toHex(c)}`).toBe(true);
    }
    // the reserved hues never colour an item: red for danger, sapphire for the hero's resources
    for (const c of Object.values(ICON_ACCENT)) expect([DANGER.base, SAPPHIRE.base, SAPPHIRE.light]).not.toContain(c);
  });

  it('paints the pills named after a colour in it, and the reserved red and blue with a pattern', () => {
    const pill = (row: string) => itemIconSpec(row);
    expect(pill('黄色药丸').colour).not.toBeNull();
    expect(pill('绿色药丸').colour).not.toBeNull();
    expect(pill('紫色药丸').colour).not.toBeNull();
    expect(pill('红色药丸')).toMatchObject({ colour: null, variant: 1 });
    expect(pill('蓝色药丸')).toMatchObject({ colour: null, variant: 2 });
  });

  it('keeps one grid and one optical weight: every icon weighs 0.17–0.34 (within 2×) and centres in the square', () => {
    const weights = ITEM_ROWS.map(row => measure(row).weight);
    for (const [i, row] of ITEM_ROWS.entries()) {
      const m = measure(row);
      expect(weights[i], `${row} weight`).toBeGreaterThanOrEqual(0.17);
      expect(weights[i], `${row} weight`).toBeLessThanOrEqual(0.34);
      expect(Math.max(m.w, m.h), `${row} extent`).toBeGreaterThanOrEqual(21);
      expect(Math.abs(m.cx - 15.5), `${row} centre x`).toBeLessThan(4);
      expect(Math.abs(m.cy - 15.5), `${row} centre y`).toBeLessThan(4);
    }
    expect(Math.max(...weights) / Math.min(...weights)).toBeLessThanOrEqual(2);
  });

  it('draws no two items alike: identical icons only for rows that are the same item (one name)', () => {
    const seen = new Map<string, string>();
    for (const row of ITEM_ROWS) {
      const { key } = measure(row);
      const other = seen.get(key);
      if (other) expect(itemIconSpec(other).name, `${row} looks like ${other}`).toBe(itemIconSpec(row).name);
      else seen.set(key, row);
    }
    expect(seen.size).toBeGreaterThanOrEqual(197);
  });

  it('renders at the HUD card sizes on whole pixels and caches', () => {
    for (const size of [27, 32, 46]) expect(itemIcon('旧剑', size).w).toBe(size);
    expect(itemIcon('旧剑', 32)).toBe(itemIcon('旧剑', 32));
  });
});
