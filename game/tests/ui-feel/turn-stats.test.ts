import { describe, expect, it } from 'vitest';
import { Surface } from '../../src/ui/core/surface';
import { screenRect, TURN_STATS } from '../../src/ui/hud/layout';
import { HudModel } from '../../src/ui/hud/model';
import type { TurnStats } from '../../src/ui/hud/state';
import type { TextFont } from '../../src/ui/text/font';
import { BONE } from '../../src/ui/style/palette';

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

// 回合统计 on the 960 × 540 frame: the block (742, 186, 200 × 318), the 240-unit rule at 86 → row 229, x 822..941
const BOX = screenRect(TURN_STATS.slot, 960, 540);
const RIGHT = BOX.x + BOX.w;
const RULE_Y = BOX.y + Math.round(TURN_STATS.ruleTop * 0.5);
/** 回合统计's pivot (0.8, 0.1) of the 400 × 635 block. */
const PIVOT = { x: BOX.x + 160, y: BOX.y + 31.75 };

const BOUNCE: TurnStats = { rank: 'D', progress: 0.1, lines: [{ value: '1', label: '反弹' }] };
const HIT: TurnStats = { rank: 'D', progress: 0.6, lines: [{ value: '1', label: '反弹' }, { value: '6', label: '所有伤害' }] };

function draw(m: HudModel): Surface {
  const s = new Surface(960, 540);
  m.draw(s, STUB);
  return s;
}

/** The rule on screen: its left end (it starts left of every letter) and its alpha, on the rows near 229. */
function rule(s: Surface): { left: number; alpha: number } | null {
  for (let y = RULE_Y - 3; y <= RULE_Y + 3; y++) {
    for (let x = 700; x < 880; x++) {
      const c = s.get(x, y);
      if (c >>> 24 && (c & 0xffffff) === (BONE.base & 0xffffff)) return { left: x, alpha: c >>> 24 };
    }
  }
  return null;
}

function model(): HudModel {
  const m = new HudModel();
  m.update(0);
  return m;
}

describe('回合统计出现: the launch’s first scored event brings the block in', () => {
  it('fades in over 0.1 s and pops 1.1 about its pivot (0.8, 0.1)', () => {
    const m = model();
    m.beginLaunch();
    m.rate(BOUNCE);
    m.update(0);
    expect(rule(draw(m))).toBeNull(); // opacity 0 at the first key
    m.update(0.05);
    const early = rule(draw(m))!;
    // opacity 0.733 drawn in 1/32 steps; X scale 1.0667 about the pivot
    expect(early.alpha).toBe(Math.round((23 / 32) * 255));
    expect(early.left).toBeCloseTo(PIVOT.x + (RIGHT - 120 - PIVOT.x) * 1.066696, -0.5);
    m.update(0.0489);
    const peak = rule(draw(m))!;
    expect(peak.alpha).toBe(255);
    expect(peak.left).toBeCloseTo(PIVOT.x + (RIGHT - 120 - PIVOT.x) * 1.1, -0.5);
    m.update(0.2);
    expect(rule(draw(m))!.left).toBe(RIGHT - 120);
  });
});

describe('评级更新: every later event bumps the rank and the rule', () => {
  it('stretches the rule 1.1 → 1 in X about 0.8 of its width over 0.2 s', () => {
    const m = model();
    m.beginLaunch();
    m.rate(BOUNCE);
    m.update(0.3);
    m.rate(HIT);
    m.update(0);
    // pivot at the rule's 0.8: its left end moves out by 0.1 × 0.8 × 120 px
    expect(rule(draw(m))!.left).toBe(Math.round(RIGHT - 24 - 0.8 * 120 * 1.1));
    m.update(0.1);
    expect(rule(draw(m))!.left).toBe(Math.round(RIGHT - 24 - 0.8 * 120 * 1.05));
    m.update(0.11);
    expect(rule(draw(m))!.left).toBe(RIGHT - 120);
  });
});

describe('更新闪烁: the line an event touches flashes', () => {
  /** The flash bar is the only translucent bone left of the values: its alpha, or 0. */
  const bar = (s: Surface, row: number): number => {
    const y = BOX.y + Math.round(TURN_STATS.linesTop * 0.5) + row * STUB.line + 8;
    let a = 0;
    for (let x = RIGHT - 120; x < RIGHT - 70; x++) {
      const c = s.get(x, y);
      if ((c & 0xffffff) === (BONE.base & 0xffffff) && c >>> 24 < 255) a = Math.max(a, c >>> 24);
    }
    return a;
  };

  it('wipes in by 0.1 s, holds to 0.3 s and is gone by 1.0 s, on the new line and on an updated one', () => {
    const m = model();
    m.beginLaunch();
    m.rate(BOUNCE);
    m.update(0.1);
    expect(bar(draw(m), 0)).toBeGreaterThan(0); // the first line flashes as it comes in
    m.update(1.0);
    m.rate(HIT);
    m.update(0.1);
    const s = draw(m);
    expect(bar(s, 1)).toBeGreaterThan(0); // 所有伤害 is new
    expect(bar(s, 0)).toBe(0); // 反弹 did not change in this event
    m.update(0.2);
    expect(bar(draw(m), 1)).toBeGreaterThan(0);
    m.update(0.7);
    expect(bar(draw(m), 1)).toBe(0);
    m.rate({ ...HIT, lines: [{ value: '2', label: '反弹' }, HIT.lines[1]] });
    m.update(0.15);
    expect(bar(draw(m), 0)).toBeGreaterThan(0);
  });
});

describe('回合统计结束 and the UMG states', () => {
  it('holds 1 s, fades to half by 2 s and is gone by 3 s', () => {
    const m = model();
    m.apply({ turnStats: HIT });
    m.update(0);
    m.endTurnStats();
    m.update(0.9);
    expect(rule(draw(m))!.alpha).toBe(255);
    m.update(1.1);
    expect(rule(draw(m))!.alpha).toBe(Math.round(0.5 * 255));
    m.update(1.0);
    expect(rule(draw(m))).toBeNull();
  });

  it('an event stops the fade where it is (StopAnimation keeps state); the next launch fades in from 0', () => {
    const m = model();
    m.apply({ turnStats: HIT });
    m.endTurnStats();
    m.update(2.0);
    m.rate(HIT); // the same launch: 评级更新 only
    m.update(0.05);
    expect(rule(draw(m))!.alpha).toBe(Math.round(0.5 * 255));
    m.beginLaunch();
    m.rate(BOUNCE);
    m.update(0);
    expect(rule(draw(m))).toBeNull();
  });

  it('brings a removed block back in with the next event (setTurnStats(null), then an event)', () => {
    const m = model();
    m.apply({ turnStats: HIT });
    m.apply({ turnStats: null });
    m.rate(BOUNCE);
    m.update(0.05);
    expect(rule(draw(m))!.alpha).toBe(Math.round((23 / 32) * 255));
  });

  it('the first event of a launch clears the old lines (统计词条框.ClearChildren)', () => {
    const m = model();
    m.apply({ turnStats: HIT });
    m.beginLaunch();
    m.rate({ rank: 'D', progress: 0, lines: [{ value: '9', label: '击杀敌人' }] });
    m.update(0.3);
    const s = draw(m);
    // one line left: nothing drawn on the second line's row
    const y = BOX.y + Math.round(TURN_STATS.linesTop * 0.5) + STUB.line + 8;
    let ink = 0;
    for (let x = RIGHT - 120; x < RIGHT; x++) if (s.get(x, y) >>> 24) ink++;
    expect(ink).toBe(0);
  });

  it('redraws the 2-s fade in opacity steps, not every frame', () => {
    const m = model();
    m.apply({ turnStats: HIT });
    m.update(0);
    draw(m);
    m.endTurnStats();
    let redraws = 0;
    for (let i = 0; i < 180; i++) {
      m.update(1 / 60);
      if (m.dirty) {
        redraws++;
        draw(m);
      }
    }
    expect(redraws).toBeLessThanOrEqual(34);
    expect(redraws).toBeGreaterThanOrEqual(28);
  });
});
