import { describe, expect, it } from 'vitest';
import { blue, green, red } from '../../src/ui/core/color';
import { Surface } from '../../src/ui/core/surface';
import { popupBounds } from '../../src/ui/hud/layout';
import { HudModel } from '../../src/ui/hud/model';
import { drawPopups, popupState, Popups, type PopupSpec } from '../../src/ui/hud/popups';
import type { TextFont } from '../../src/ui/text/font';
import { BONE, DANGER, INK, SAPPHIRE, WEAK } from '../../src/ui/style/palette';

/** Fusion Pixel metrics without the browser: 6 px per Latin character, 12 per CJK, ink as boxes. */
const STUB: TextFont = {
  line: 16,
  measure: t => [...t].reduce((w, ch) => w + ((ch.codePointAt(0) ?? 0) > 0x2e80 ? 12 : 6), 0),
  draw(s, text, x, y, style) {
    let pen = x;
    for (const ch of text) {
      const w = (ch.codePointAt(0) ?? 0) > 0x2e80 ? 12 : 6;
      s.fill(pen + 1, y + 2, w - 2, 11, style.color, style.opacity);
      pen += w;
    }
    return pen - x;
  },
};

const B960 = popupBounds(960, 540);
const hit = (value: number, extra: Partial<PopupSpec> = {}): PopupSpec => ({ kind: 'damage', value, owner: 'jelly', skill: '可控挥击', start: { x: 500, y: 300 }, ...extra }) as PopupSpec;

/** The ink box of `color` on `s`: [x0, y0, x1, y1) or null. */
function box(s: Surface, color: number): [number, number, number, number] | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (let y = 0; y < s.h; y++)
    for (let x = 0; x < s.w; x++)
      if (s.get(x, y) === color) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x + 1);
        y1 = Math.max(y1, y + 1);
      }
  return x0 === Infinity ? null : [x0, y0, x1, y1];
}

function drawn(pops: Popups): Surface {
  const s = new Surface(960, 540);
  drawPopups(s, STUB, pops.list);
  return s;
}

describe('提示简化处理: one number per (owner, skill) per launch (UI_伤害提示.添加数值)', () => {
  it('adds every later hit to the first number (6, +8, +7 → 21) and restarts 数值更新 each time', () => {
    const pops = new Popups();
    const first = pops.spawn(hit(6));
    pops.update(0.3);
    expect(pops.spawn(hit(8))).toBe(first);
    expect(first.bump).toBe(0);
    pops.update(0.3);
    pops.spawn(hit(7));
    expect(pops.list).toHaveLength(1);
    expect(popupState(first, B960)!.text).toBe('21');
    // 弹出V2 runs on from the first hit (scale 1 at 0.6 s), 数值更新 from 1.5 down to 1 in 0.1 s
    expect(popupState(first, B960)!.scale).toBeCloseTo(1.5, 6);
    pops.update(0.05);
    expect(popupState(first, B960)!.scale).toBeCloseTo(1.25, 3);
    pops.update(0.05);
    expect(popupState(first, B960)!.scale).toBeCloseTo(1, 6);
  });

  it('multiplies the bump into the pop: a merge 0.3 s in is 弹出V2 1.29 × 数值更新 1.5', () => {
    const pops = new Popups();
    const p = pops.spawn(hit(6));
    pops.update(0.3);
    pops.spawn(hit(8));
    expect(popupState(p, B960)!.scale).toBeCloseTo(1.290266 * 1.5, 4);
  });

  it('keeps one number per skill and per owner, numbered by the owner’s live popups (序号)', () => {
    const pops = new Popups();
    const a = pops.spawn(hit(6));
    const b = pops.spawn(hit(4, { skill: '回旋斩·余波' }));
    const c = pops.spawn(hit(9, { owner: 'skull' }));
    expect(pops.list).toHaveLength(3);
    expect([a.stack, b.stack, c.stack]).toEqual([0, 1, 0]);
    // 序号 1 waits Fraction(0.15) s and fans 48 units further
    expect(b.delay).toBeCloseTo(0.15, 9);
    expect(b.fan.y - a.fan.y).toBe(-48);
  });

  it('keeps the first hit’s face: a crit merged into a normal number stays a normal number', () => {
    const pops = new Popups();
    const p = pops.spawn(hit(6));
    pops.spawn(hit(24, { kind: 'crit' }));
    expect(p.kind).toBe('damage');
    expect(popupState(p, B960)!.text).toBe('30');
  });

  it('starts new numbers after beginLaunch (清理提示映射); the old one still counts for 序号', () => {
    const m = new HudModel();
    m.popup(hit(6));
    m.update(0.5);
    m.beginLaunch();
    m.popup(hit(8));
    expect(m.popups.list.map(p => [p.value, p.stack])).toEqual([
      [6, 0],
      [8, 1],
    ]);
  });

  it('loses a merge into a number that already left (the Demo keeps the map entry until it is cleared)', () => {
    const pops = new Popups();
    pops.spawn(hit(6));
    pops.update(2.01);
    expect(pops.active).toBe(false);
    pops.spawn(hit(8));
    expect(pops.active).toBe(false);
  });

  it('merges heals per healer (回合治愈来源映射 / 回合强固来源映射), never charges, EXP or ownerless popups', () => {
    const pops = new Popups();
    pops.spawn({ kind: 'heal', hero: true, value: 5, owner: 'potion', start: { x: 0, y: 0 } });
    pops.spawn({ kind: 'heal', hero: true, value: 4, owner: 'potion', start: { x: 0, y: 0 } });
    pops.spawn({ kind: 'heal', hero: true, value: 3, owner: 'potion', suffix: '强固', start: { x: 0, y: 0 } });
    pops.spawn({ kind: 'charge', value: 15, owner: 'sword', start: { x: 0, y: 0 } });
    pops.spawn({ kind: 'charge', value: 15, owner: 'sword', start: { x: 0, y: 0 } });
    pops.spawn({ kind: 'exp', value: 12, owner: 'hero', start: { x: 0, y: 0 } });
    pops.spawn({ kind: 'exp', value: 12, owner: 'hero', start: { x: 0, y: 0 } });
    pops.spawn({ kind: 'damage', value: 1, start: { x: 0, y: 0 } });
    pops.spawn({ kind: 'damage', value: 1, start: { x: 0, y: 0 } });
    expect(pops.list.map(p => p.value)).toEqual([9, 3, 15, 15, 12, 12, 1, 1]);
  });
});

describe('UI_拾取提示 for a kill’s EXP ("+{0}经验", 向下弹出)', () => {
  it('drifts 20–100 units down within ±45°, unclamped, at once, gone when 向下弹出 ends', () => {
    const pops = new Popups();
    for (let i = 0; i < 40; i++) {
      const p = pops.spawn({ kind: 'exp', value: 12.7, start: { x: 950, y: 500 } });
      expect(p.delay).toBe(0);
      expect(p.fan.y).toBeGreaterThanOrEqual(20);
      expect(p.fan.y).toBeLessThanOrEqual(100);
      expect(Math.abs(p.fan.angle)).toBeLessThanOrEqual(45);
    }
    const p = pops.list[0];
    p.age = 1;
    const v = popupState(p, B960)!;
    expect(v.text).toBe('+12经验');
    // the start sits outside the damage clamp and stays there (the drift moves at most 100 × sin 45° × 0.5 px)
    expect(v.x).toBeGreaterThan(B960.x1);
    pops.update(1.51);
    expect(pops.active).toBe(false);
  });

  it('is sapphire with the ink ring and shadow, the whole text in the pixel font', () => {
    const pops = new Popups();
    pops.spawn({ kind: 'exp', value: 12, start: { x: 500, y: 300 } });
    pops.update(0.6);
    const s = drawn(pops);
    const ink = box(s, SAPPHIRE.light);
    expect(ink).not.toBeNull();
    // "+12经验" in the stub: 3 Latin (6 px) + 2 CJK (12 px) characters, at 向下弹出's scale
    const v = popupState(pops.list[0], B960)!;
    expect(ink![2] - ink![0]).toBeCloseTo((3 * 6 + 2 * 12 - 2) * v.scale, -1);
    expect(box(s, INK.deep)).not.toBeNull();
  });
});

describe('the Teen numerals on screen (18 pt: 13 px tall, 27 pt: 18 px, a 1-px ink ring)', () => {
  const at = (spec: PopupSpec, age: number): Surface => {
    const pops = new Popups();
    pops.spawn(spec);
    pops.update(age);
    return drawn(pops);
  };

  it('sits at 13 px (15 with the ring) from 0.5 s, 20 × 15 for "30" as in demo-rec-02 f200–f243', () => {
    const s = at(hit(30), 1);
    const [x0, y0, x1, y1] = box(s, BONE.base)!;
    expect([x1 - x0, y1 - y0]).toEqual([18, 13]);
    const [rx0, ry0, rx1, ry1] = box(s, INK.deep)!;
    expect([rx1 - rx0, ry1 - ry0]).toEqual([20, 15]);
  });

  it('pops from 弹出V2 1.797 nearest-neighbour: 1.49 at 0.05 s (opacity 1) is 19–20 px tall', () => {
    const s = at(hit(30), 0.05);
    const [, y0, , y1] = box(s, BONE.base)!;
    expect(y1 - y0).toBeGreaterThanOrEqual(19);
    expect(y1 - y0).toBeLessThanOrEqual(20);
  });

  it('uses 27 pt and 会心图标 for a crit, in the number’s colour', () => {
    const s = at(hit(24, { kind: 'crit' }), 1);
    const [x0, y0, x1, y1] = box(s, BONE.base)!;
    // the 24-px bolt is taller than the 18-px digits; bolt 11 + gap 3 + "24" 11 + 3 + 11
    expect(y1 - y0).toBe(24);
    expect(x1 - x0).toBe(11 + 3 + 11 + 3 + 11);
  });

  it('colours: bone for the enemy, danger red for the hero, the copper weak colour (not gold) for a weak point', () => {
    expect(box(at(hit(5, { kind: 'hurt' }), 1), DANGER.base)).not.toBeNull();
    const weak = at(hit(5, { kind: 'weak' }), 1);
    const [, y0, , y1] = box(weak, WEAK)!;
    expect(y1 - y0).toBe(18);
    // ART_BIBLE §7: no gold (hue 38°–62°)
    const r = red(WEAK) / 255;
    const g = green(WEAK) / 255;
    const b = blue(WEAK) / 255;
    const hue = (60 * (g - b)) / (Math.max(r, g, b) - Math.min(r, g, b));
    expect(hue).toBeLessThan(38);
  });

  it('writes each pixel once, so the fade keeps one opacity per colour', () => {
    const s = at(hit(88), 1.8);
    const alphas = new Set<number>();
    for (const c of s.data) if (c >>> 24) alphas.add(c >>> 24);
    expect(alphas.size).toBe(1);
    expect([...alphas][0]).toBeLessThan(255);
  });
});

describe('the HUD clock', () => {
  it('ages popups by the dt it is given (the game passes real time; the hit-stop never reaches the HUD)', () => {
    const run = (steps: number[]): Surface => {
      const m = new HudModel();
      m.popup(hit(6));
      for (const dt of steps) m.update(dt);
      const s = new Surface(960, 540);
      drawPopups(s, STUB, m.popups.list);
      return s;
    };
    // 0.3 s in 18 frames or in 3: the same pixels
    expect(run(Array(18).fill(1 / 60)).data).toEqual(run([0.1, 0.1, 0.1]).data);
  });
});
