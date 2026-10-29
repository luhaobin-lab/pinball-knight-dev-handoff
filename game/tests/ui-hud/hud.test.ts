import { describe, expect, it } from 'vitest';
import { blue, green, red, toHex } from '../../src/ui/core/color';
import { HitMap } from '../../src/ui/core/hit';
import { Surface } from '../../src/ui/core/surface';
import { HudModel } from '../../src/ui/hud/model';
import { frameTop, PANEL, playArea } from '../../src/ui/hud/layout';
import type { CombatHudState } from '../../src/ui/hud/state';
import type { TextFont } from '../../src/ui/text/font';
import { ALLOWED, BONE, DANGER, SAPPHIRE } from '../../src/ui/style/palette';
import { ICON_KINDS, itemIcon } from '../../src/ui/icons/items';

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

/** The Demo's ss2.jpg state (the debug scene's default). */
const SS2: Partial<CombatHudState> = {
  hero: { hp: 100, hpMax: 100, armor: 0, dotPending: 0, stamina: 98, staminaMax: 100, level: 1, exp: 30, expMax: 100, corruption: 0, corruptionMax: 100, dead: false },
  items: [
    { id: 'potion-a', row: 0, size: 1, icon: 'potion', type: 'consumable', heal: 15, durability: 3 },
    { id: 'potion-b', row: 1, size: 1, icon: 'potion', type: 'consumable', durability: 3 },
    { id: 'blade', row: 2, size: 1, icon: 'dagger', type: 'weapon', heal: 5, damage: 3, combo: 2, charge: 0.45 },
  ],
  unlockedRows: 4,
  quest: { title: '往日回忆', line: '通过第<数值>3/36</>层' },
  statuses: [{ kind: 'bleed', turns: 3 }, { kind: 'flow', turns: 2 }],
  turnStats: { rank: 'SSS', progress: 0.5, lines: [{ value: '5', label: '反弹' }] },
};

function render(patch: Partial<CombatHudState> = {}): { m: HudModel; s: Surface } {
  const m = new HudModel();
  m.apply({ ...SS2, ...patch });
  m.update(0);
  const s = new Surface(960, 540);
  m.draw(s, STUB);
  return { m, s };
}

/** Gold: a saturated, bright yellow-orange (hue 38°–62°). */
function isGold(c: number): boolean {
  const r = red(c) / 255;
  const g = green(c) / 255;
  const b = blue(c) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max - min < 0.2 || max < 0.45) return false;
  const h = max === r ? (60 * (g - b)) / (max - min) : max === g ? 60 * (2 + (b - r) / (max - min)) : 60 * (4 + (r - g) / (max - min));
  const hue = (h + 360) % 360;
  return hue >= 38 && hue <= 62 && (max - min) / max > 0.35;
}

describe('Ink & Bone palette (ART_BIBLE §7)', () => {
  it('draws only palette colours at rest', () => {
    const { s } = render({ hero: { ...SS2.hero!, hp: 30, dotPending: 6, armor: 10, corruption: 80 } });
    const allowed = new Set(ALLOWED);
    const stray = new Set<string>();
    for (const c of s.data) if (c >>> 24 && !allowed.has(c)) stray.add(toHex(c));
    expect([...stray]).toEqual([]);
  });

  it('has no gold anywhere, item icons included', () => {
    const { s } = render();
    expect(s.data.some(c => c >>> 24 && isGold(c))).toBe(false);
    for (const kind of ICON_KINDS) for (const type of ['weapon', 'armor', 'accessory', 'tool', 'consumable', 'loot'] as const) {
      expect(itemIcon(kind, type, 32, 32).data.some(c => c >>> 24 && isGold(c))).toBe(false);
    }
  });

  it('fills HP and stamina in sapphire; red only for danger (corruption, damage over time, low HP)', () => {
    const { s } = render({ hero: { ...SS2.hero!, hp: 80, dotPending: 10, corruption: 50 } });
    const hp = PANEL.hpFrame;
    expect(s.get(hp.x + 5, hp.y + 4)).toBe(SAPPHIRE.base);
    // 0.7 of the bar is safe, 0.7–0.8 is the HP the damage over time will take (right of the text)
    expect(s.get(hp.x + Math.round(hp.w * 0.75), hp.y + 4)).toBe(DANGER.base);
    expect(s.get(hp.x + hp.w - 3, hp.y + 4)).not.toBe(SAPPHIRE.base);
    expect(s.get(PANEL.staminaFrame.x + 5, PANEL.staminaFrame.y + 4)).toBe(SAPPHIRE.light);
    expect(s.get(PANEL.corruption.x + 3, PANEL.corruption.y + 3)).toBe(DANGER.base);
    // full health: no red in the bars
    const calm = render().s;
    for (let x = hp.x; x < hp.x + hp.w; x++) expect(calm.get(x, hp.y + 4)).not.toBe(DANGER.base);
  });

});

describe('the low-health frame (区域判断 Tick → Overlay_1)', () => {
  /** In a fight at 35 % HP: the hero aims (当前环节 2), enemies are on the field, the hero lives. */
  const LOW: Partial<CombatHudState> = { hero: { ...SS2.hero!, hp: 35 }, aiming: true, enemiesOnField: true };
  const x = playArea(960, 540).x;
  /** The left bar's pixel: its colour without alpha, and its alpha. */
  const bar = (s: Surface): { rgb: number; a: number } => ({ rgb: s.get(x, 300) & 0xffffff, a: s.get(x, 300) >>> 24 });

  it('shows only while 低生命值？ && !死掉了？ && 当前环节 == 2 && 场上有敌人？', () => {
    expect(render(LOW).m.lowHealthOpacity).toBeGreaterThan(0);
    expect(bar(render(LOW).s).rgb).toBe(DANGER.deep & 0xffffff);
    const hidden: Partial<CombatHudState>[] = [
      { hero: { ...SS2.hero!, hp: 36 } }, // above 35 %
      { hero: { ...SS2.hero!, hp: 35, dead: true } },
      { aiming: false }, // e.g. 进行战斗 (the launch resolving) or a shop
      { enemiesOnField: false }, // the room is cleared
    ];
    for (const patch of hidden) {
      const { m, s } = render({ ...LOW, ...patch });
      expect(m.lowHealthOpacity).toBe(0);
      expect(s.get(x, 300)).toBe(0);
    }
  });

  it('pulses its opacity as MapRangeClamped(sin(5 t), −1, 1, 0.2, 1.0) on model time', () => {
    const m = new HudModel();
    m.apply({ ...SS2, ...LOW });
    const at = (t: number): { rgb: number; a: number } => {
      m.update(t - m.time);
      const s = new Surface(960, 540);
      m.draw(s, STUB);
      return bar(s);
    };
    expect(at(0)).toEqual({ rgb: DANGER.deep & 0xffffff, a: Math.round(0.6 * 255) });
    expect(at(Math.PI / 10)).toEqual({ rgb: DANGER.deep & 0xffffff, a: 255 }); // sin(π/2) = 1
    expect(at((3 * Math.PI) / 10)).toEqual({ rgb: DANGER.deep & 0xffffff, a: Math.round(0.2 * 255) }); // sin(3π/2) = −1
    expect(m.lowHealthOpacity).toBe(0.2);
  });

  it('keeps the layer dirty while it pulses and goes quiet once the room is cleared', () => {
    const m = new HudModel();
    m.apply({ ...SS2, ...LOW });
    const s = new Surface(960, 540);
    const redraws = (frames: number): number => {
      let n = 0;
      for (let i = 0; i < frames; i++) {
        m.update(1 / 60);
        if (!m.dirty) continue;
        m.draw(s, STUB);
        n++;
      }
      return n;
    };
    // one period (2π / 5 s) sweeps 0.2 → 1 → 0.2 in steps of 0.05: 32 steps
    expect(redraws(76)).toBeGreaterThanOrEqual(30);
    m.apply({ enemiesOnField: false });
    expect(redraws(60)).toBe(1);
    expect(s.get(x, 300)).toBe(0);
  });
});

describe('state in, pixels out', () => {
  it('slides the bars at the Demo speed (浮点滑动 ×2.0) after the first frame', () => {
    const m = new HudModel();
    m.apply(SS2);
    m.update(0);
    expect(m.bars.hp).toBe(1);
    m.setHero({ hp: 50 });
    m.update(0.1);
    expect(m.bars.hp).toBeCloseTo(0.9, 6);
    expect(m.dirty).toBe(true);
  });

  it('shows the value badges right-aligned in the Demo order [护甲][治疗][伤害]', () => {
    const { s } = render();
    // the weapon card (row 2, badge row 188): heal 5 (sapphire) left of damage 3 (bone), one row above the digits
    const y = 188 + 3 + 1;
    expect(s.get(108 - 12, y)).toBe(BONE.base);
    expect(s.get(108 - 27 - 12, y)).toBe(SAPPHIRE.base);
  });

  it('plays the charge flash when a card reaches full charge', () => {
    const m = new HudModel();
    m.apply(SS2);
    m.update(0);
    const count = (): number => {
      const s = new Surface(960, 540);
      m.draw(s, STUB);
      let lit = 0;
      for (let x = 33; x < 80; x++) if (s.get(x, 215) === BONE.base) lit++;
      return lit;
    };
    const before = count();
    m.updateItem('blade', { charge: 1 });
    m.update(0.1);
    expect(count() - before).toBeGreaterThan(15);
    m.update(1);
    expect(count()).toBe(before);
  });
});

describe('taller layers (1440p: 1280×720 at ×2, 720p: 1280×720 at ×1)', () => {
  it('centres the 540-px design frame like UE letterboxes UI_主界面, the panel column runs the full height', () => {
    const m = new HudModel();
    m.apply(SS2);
    m.update(0);
    const s = new Surface(1280, 720);
    m.draw(s, STUB);
    const hp = PANEL.hpFrame;
    expect(s.get(hp.x + 5, hp.y + 90 + 4)).toBe(SAPPHIRE.base);
    expect(s.get(hp.x + 5, hp.y + 4)).not.toBe(SAPPHIRE.base);
    expect(s.get(5, 2)).not.toBe(0);
    expect(s.get(5, 717)).not.toBe(0);
    const hits = new HitMap();
    hits.set(m.regions(1280, 720));
    expect(hits.test(140, 130 + 90)?.id).toBe('skill:0');
    expect(hits.test(5, 700)?.id).toBe('panel');
    // a card's popup starts on the card, inside the centred frame (potion-a: y 111.75..147.75 + 90)
    m.cardPopup({ kind: 'charge', value: 5 }, 'potion-a', 720);
    const o = m.popups.list[0].origin!;
    expect(o.y).toBeGreaterThanOrEqual(111.75 + 90);
    expect(o.y).toBeLessThanOrEqual(147.75 + 90);
  });
});

describe('wide ×1 layers (1366×768, and 1920×969: a maximized browser on a 1080p monitor)', () => {
  for (const [w, h] of [
    [1366, 768],
    [1920, 969],
  ] as const) {
    it(`${w}×${h}: the play area runs from the panel to the layer's right edge`, () => {
      const m = new HudModel();
      m.apply({ ...SS2, turnStats: null, hero: { ...SS2.hero!, hp: 30 }, aiming: true, enemiesOnField: true });
      m.update(Math.PI / 10); // pulse at full opacity
      const s = new Surface(w, h);
      m.draw(s, STUB);
      const top = frameTop(h);
      // the quest bullet (UI_任务列表 12 units into 区域判断, bottom row of the design frame) next to the panel
      const lineTop = top + 540 - 8 - 16;
      expect(s.get(191, lineTop + 7)).toBe(BONE.dim);
      // status cell 0 (各种状态栏, padding 24): its frame starts 3 px into the 45-px cell at (191, 12)
      expect(s.get(191 + 3, top + 12 + 3)).toBe(BONE.faint);
      // the low-health frame hugs the panel and the layer's right edge, full height
      for (const y of [1, h >> 1, h - 2]) {
        expect(s.get(179, y)).toBe(DANGER.deep);
        expect(s.get(w - 1, y)).toBe(DANGER.deep);
      }
      expect(s.get(182, h >> 1)).toBe(0);
      // nothing else in the room
      for (let y = top + 100; y < top + 500; y += 7) for (let x = 400; x < w - 10; x += 5) expect(s.get(x, y)).toBe(0);

      const hits = new HitMap();
      hits.set(m.regions(w, h));
      const at = (x: number, y: number): string | null => hits.test(x, y)?.id ?? null;
      expect(at(191 + 22, top + 12 + 22)).toBe('status:0');
      expect(at(191 + 45 + 22, top + 12 + 22)).toBe('status:1');
      expect(at(140, top + 130)).toBe('skill:0');
      expect(at(140, top + 340)).toBe('codex');
      expect(at(60, top + 125)).toBe('item:potion-a');
      expect(at(5, h - 5)).toBe('panel');
      expect(at(w >> 1, h >> 1)).toBe(null);
      expect(at(w - 20, top + 300)).toBe(null);
    });
  }
});

describe('pointer targets', () => {
  it('maps every slot and button of the panel', () => {
    const { m } = render();
    const hits = new HitMap();
    hits.set(m.regions(960, 540));
    const at = (x: number, y: number): string | null => hits.test(x, y)?.id ?? null;
    expect(at(140, 130)).toBe('skill:0');
    expect(at(140, 280)).toBe('skill:3');
    expect(at(140, 340)).toBe('codex');
    expect(at(140, 390)).toBe('character');
    expect(at(140, 465)).toBe('retreat');
    expect(at(140, 495)).toBe('settings');
    expect(at(60, 125)).toBe('item:potion-a');
    expect(at(60, 203)).toBe('item:blade');
    expect(at(60, 245)).toBe('slot:equip:3'); // An empty equipment cell is now a drop target, below occupied cards.
    expect(at(100, 72)).toBe('hp');
    expect(at(46, 44)).toBe('level');
    expect(at(220, 40)).toBe('status:0');
    expect(at(600, 300)).toBe(null);
  });
});
