import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/core/rng';
import { Surface } from '../../src/ui/core/surface';
import { popupBounds } from '../../src/ui/hud/layout';
import { HudModel } from '../../src/ui/hud/model';
import { drawPopups, popupState, Popups, type Popup, type PopupSpec, type PopupView } from '../../src/ui/hud/popups';
import type { TextFont } from '../../src/ui/text/font';
import { DANGER, SAPPHIRE } from '../../src/ui/style/palette';

/**
 * Expected values are hand-computed from the Demo dump by tests/ui-hud/demo_vectors.py (UE FRichCurve on
 * 曲线表's 伤害提示曲线 / 恢复提示曲线 keys, GetRotated2D and the FClamp of UI_伤害提示 L4027 /
 * UI_治疗提示 L3687, in 1920×1080 units × 0.5), not by the code under test.
 */
const B960 = popupBounds(960, 540);

function at(spec: PopupSpec, age: number, bounds = B960): PopupView {
  const p = new Popups().spawn(spec);
  p.age = age;
  p.origin ??= p.locate();
  const v = popupState(p, bounds);
  if (!v) throw new Error('popup not shown');
  return v;
}

describe('popup widgets (UI_伤害提示 / UI_治疗提示 / UI_充能提示)', () => {
  it('retire 2 s after they appear (Delay 2.0), a charge when its animation ends', () => {
    const p = new Popups();
    p.spawn({ kind: 'damage', value: 12, start: { x: 0, y: 0 } });
    p.spawn({ kind: 'heal', hero: true, value: 5, start: { x: 0, y: 0 } });
    p.spawn({ kind: 'charge', value: 15, start: { x: 0, y: 0 } });
    p.spawn({ kind: 'damage', value: 7, stack: 2, start: { x: 0, y: 0 } }); // appears at 0.3 s
    p.update(0.99);
    expect(p.list.map(x => x.value)).toEqual([12, 5, 15, 7]);
    p.update(0.1); // 1.09 s: 向上弹出's playback range (64583 ticks, 1.076 s) is over
    expect(p.list.map(x => x.value)).toEqual([12, 5, 7]);
    p.update(0.92); // 2.01 s: 弹出V2 and the heal's Delay(2.0) are over, the late number plays until 2.3 s
    expect(p.list.map(x => x.value)).toEqual([7]);
    p.update(0.3);
    expect(p.active).toBe(false);
  });

  it('pop from 弹出V2 scale 1.797 (fractional, drawn nearest-neighbour) and sit at 1 from 0.5 s', () => {
    expect(at({ kind: 'damage', value: 1234, start: { x: 100, y: 200 } }, 0)).toMatchObject({ opacity: 0, text: '1.23k', x: 100 });
    expect(at({ kind: 'damage', value: 1234, start: { x: 100, y: 200 } }, 0).scale).toBeCloseTo(1.797023, 5);
    const mid = at({ kind: 'damage', value: 1234, start: { x: 100, y: 200 } }, 0.5);
    expect(mid.scale).toBe(1);
    expect(mid.opacity).toBe(1);
    // 弹出V2 lifts −34.19 widget px by 0.5 s (× 0.5 on our grid)
    expect(mid.y).toBeCloseTo(200 - 34.189735 * 0.5, 4);
  });
});

describe('位移提示 of UI_伤害提示: 起始坐标 + GetRotated2D((0, 高度 − 48 × (序号 % 12)), 旋转), clamped', () => {
  // a 135-unit target (弑神幼虫), 序号 0, 旋转 90: the fan points left, so x shows the curve alone
  const first: PopupSpec = { kind: 'damage', value: 9, start: { x: 500, y: 300 }, height: 135, angle: 90 };

  it('moves even the first number 高度 units, along 伤害提示曲线 (cubic keys, overshoot past 1)', () => {
    const x = (t: number): number => at(first, t).x;
    expect(x(0.1)).toBeCloseTo(479.73061, 4);
    expect(x(0.25)).toBeCloseTo(454.51177, 4);
    expect(x(0.5)).toBeCloseTo(435.27685, 4);
    expect(x(0.8)).toBeCloseTo(432.03203, 4); // the curve is 1.0069 here
    expect(x(1)).toBeCloseTo(432.5, 6); // 500 − 135 × 0.5
    expect(x(1.9)).toBeCloseTo(432.5, 6);
    expect(at(first, 0.5).y).toBeCloseTo(282.9051, 4); // only 弹出V2's lift (−34.189735 at its 0.5-s key)
  });

  it('steps 48 units per 序号 against 高度 (the hero, 高度 56, 序号 3, 旋转 0)', () => {
    const v = at({ kind: 'hurt', value: 4, start: { x: 600, y: 300 }, height: 56, stack: 3 }, 0.45 + 1.5);
    expect(v.x).toBeCloseTo(600, 6);
    expect(v.y).toBeCloseTo(237.5367, 4); // target 300 + (56 − 144) × 0.5, then the lift (−36.926662 at 1.5 s)
  });

  it('FClamps the target (not the start) to X 485..1792, Y 128..952: 区域判断 inset 64 px', () => {
    expect(B960).toEqual({ x0: 242.5, x1: 896, y0: 64, y1: 476 });
    const left = at({ kind: 'damage', value: 3, start: { x: 250, y: 150 }, height: 56, stack: 5, angle: -90 }, 0.75 + 1);
    expect(left.x).toBeCloseTo(242.5, 6); // 250 − 184 × 0.5 = 158 → 242.5
    expect(left.y).toBeCloseTo(129.5212, 4); // the lift at 1 s is −40.957599 (tests/ui-feel/demo_vectors.py)
    const low = at({ kind: 'damage', value: 3, start: { x: 500, y: 450 }, height: 135 }, 1.5);
    expect(low.y).toBeCloseTo(457.5367, 4); // 517.5 → 476, then the lift (−36.926662 at 1.5 s)
  });

  it('keeps the clamp on the play area of a wide ×1 layer (1366×768)', () => {
    const b = popupBounds(1366, 768);
    expect(b).toEqual({ x0: 242.5, x1: 1302, y0: 178, y1: 590 });
    const v = at({ kind: 'damage', value: 3, start: { x: 1290, y: 600 }, height: 135, angle: -90 }, 1, b);
    expect(v.x).toBeCloseTo(1302, 6);
    expect(v.y).toBeCloseTo(569.5212, 4); // the target 600 → 590, then the lift (−40.957599 at 1 s)
  });
});

describe('位移提示 of UI_治疗提示: the same fan without 高度, 恢复提示曲线 at half speed', () => {
  it('matches the Demo vector (序号 3, 旋转 40)', () => {
    const v = at({ kind: 'heal', hero: true, value: 15, start: { x: 600, y: 300 }, stack: 3, angle: 40, height: 135 }, 0.45 + 1);
    expect(v.x).toBeCloseTo(635.474, 3); // 600 + 46.2807 × 恢复提示曲线(0.5) = 0.76650
    expect(v.y).toBeCloseTo(238.0206, 3); // 弹出's lift at 1 s is −39.406334 (tests/ui-feel/demo_vectors.py)
    expect(v.text).toBe('+15');
  });

  it('fans stacked heals apart instead of piling them up', () => {
    const v = (stack: number): PopupView => at({ kind: 'heal', hero: false, value: 5, start: { x: 600, y: 300 }, stack }, 0.15 * stack + 1.6);
    expect(v(1).y).toBeLessThan(v(0).y - 15);
    expect(v(2).y).toBeLessThan(v(1).y - 15);
  });
});

describe('the 序号 delay and 起始坐标', () => {
  it('appear after Fraction(序号 × 0.15) s (序号 % 12 for the fan)', () => {
    const delay = (stack: number): number => new Popups().spawn({ kind: 'damage', value: 1, stack, start: { x: 0, y: 0 } }).delay;
    expect([0, 1, 2, 6, 7, 12].map(delay).map(d => Math.round(d * 1000) / 1000)).toEqual([0, 0.15, 0.3, 0.9, 0.05, 0.8]);
    expect(new Popups().spawn({ kind: 'charge', value: 1, stack: 3, start: { x: 0, y: 0 } }).delay).toBe(0);
    const p = new Popups().spawn({ kind: 'damage', value: 1, stack: 12, height: 40, start: { x: 0, y: 0 } });
    expect(p.fan.y).toBe(40);
  });

  it('stay hidden until then and fix 起始坐标 when they appear (the Demo projects 击中点位置 after the delay)', () => {
    const pops = new Popups();
    let calls = 0;
    const p = pops.spawn({ kind: 'damage', value: 1, stack: 2, start: () => (calls++, { x: 400, y: 200 }) });
    expect(calls).toBe(0);
    pops.update(0.2);
    expect(popupState(p, B960)).toBeNull();
    pops.update(0.15);
    expect(calls).toBe(1);
    expect(popupState(p, B960)).not.toBeNull();
    pops.update(0.1);
    expect(calls).toBe(1);
    // its animation starts when it appears: 弹出V2's first key (opacity 0) at 0.3 s, full at 0.35 s
    p.age = 0.3;
    expect(popupState(p, B960)!.opacity).toBe(0);
    p.age = 0.35;
    expect(popupState(p, B960)!.opacity).toBeCloseTo(1, 9);
  });
});

describe('位移提示 of UI_充能提示: a random drift, not clamped', () => {
  it('drifts up to 50 units within ±45° of up (向上弹出) or down (向下弹出)', () => {
    const pops = new Popups(createRng(7));
    for (let i = 0; i < 50; i++) {
      const up = pops.spawn({ kind: 'charge', value: 1, start: { x: 100, y: 100 } });
      expect(up.fan.y).toBeLessThanOrEqual(0);
      expect(up.fan.y).toBeGreaterThanOrEqual(-50);
      expect(Math.abs(up.fan.angle)).toBeLessThanOrEqual(45);
      const down = pops.spawn({ kind: 'charge', value: 1, start: { x: 100, y: 100 }, down: true });
      expect(down.fan.y).toBeGreaterThanOrEqual(0);
    }
    // the start sits on the side panel, outside the damage clamp, and the drift is not pulled back
    const p: Popup = pops.list[0];
    p.age = 2;
    const v = popupState(p, B960)!;
    expect(v.x).toBeCloseTo(100 - Math.sin((p.fan.angle * Math.PI) / 180) * p.fan.y * 0.5, 6);
    expect(v.x).toBeLessThan(B960.x0);
  });
});

describe("a heal is the colour of the HP it adds (BP_ManeActor.获得治疗 runs on every character)", () => {
  const words: string[] = [];
  const font: TextFont = {
    line: 16,
    measure: t => [...t].length * 12,
    draw(s, text, x, y, style) {
      words.push(text);
      s.fill(x + 1, y + 2, [...text].length * 12 - 2, 11, style.color, style.opacity);
      return [...text].length * 12;
    },
  };
  const draw = (spec: PopupSpec): Surface => {
    const pops = new Popups();
    pops.spawn(spec);
    pops.update(0.5); // 弹出 at full opacity
    const s = new Surface(960, 540);
    drawPopups(s, font, pops.list);
    return s;
  };
  const rgb = (s: Surface): Set<number> => new Set([...s.data].filter(c => c >>> 24).map(c => c & 0xffffff));
  const sapphire = [SAPPHIRE.base, SAPPHIRE.light].map(c => c & 0xffffff);

  it('an enemy heal draws no sapphire pixel, in red with the word 生命', () => {
    words.length = 0;
    const colours = rgb(draw({ kind: 'heal', hero: false, value: 9, start: { x: 500, y: 300 } }));
    for (const c of sapphire) expect(colours.has(c)).toBe(false);
    expect(colours.has(DANGER.base & 0xffffff)).toBe(true);
    expect(words).toEqual(['生命']);
  });

  it("the hero's heal is sapphire; armour gained reads 强固", () => {
    words.length = 0;
    const colours = rgb(draw({ kind: 'heal', hero: true, value: 15, suffix: '强固', start: { x: 500, y: 300 } }));
    expect(colours.has(SAPPHIRE.light & 0xffffff)).toBe(true);
    expect(colours.has(DANGER.base & 0xffffff)).toBe(false);
    expect(words).toEqual(['强固']);
  });
});

describe('popups on a card (拥有者 / 释放者 is a BP_Actor_Card)', () => {
  const model = (): HudModel => {
    const m = new HudModel();
    m.setItems([{ id: 'potion', row: 0, size: 1, icon: 'potion', type: 'consumable', heal: 15 }]);
    return m;
  };

  it('start at a random point of the card (扩散命中中心: ±48 units along a small card, ±100 across)', () => {
    const m = model();
    const xs = new Set<number>();
    for (let i = 0; i < 200; i++) m.cardPopup({ kind: 'charge', value: 5 }, 'potion', 540);
    for (const p of m.popups.list) {
      const o = p.origin!;
      expect(o.x).toBeGreaterThanOrEqual(30.75);
      expect(o.x).toBeLessThanOrEqual(105.75);
      expect(o.y).toBeGreaterThanOrEqual(111.75);
      expect(o.y).toBeLessThanOrEqual(147.75);
      xs.add(Math.round(o.x));
    }
    expect(xs.size).toBeGreaterThan(20);
  });

  it('fan a card heal straight up (UI_治疗提示 sets 旋转 0 for a card)', () => {
    const m = model();
    m.cardPopup({ kind: 'heal', hero: true, value: 15, stack: 2, angle: 30 }, 'potion', 540);
    expect(m.popups.list[0].fan).toEqual({ y: -96, angle: 0 });
    expect(() => m.cardPopup({ kind: 'charge', value: 1 }, 'missing', 540)).toThrow('no item card');
  });
});

