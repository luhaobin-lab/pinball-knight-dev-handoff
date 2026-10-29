import { describe, expect, it } from 'vitest';
import { cardBox, cardLayout, GRID, padBox, PANEL, playArea, rowTop, screenRect, SIDE, slotBox, toPx, TURN_STATS } from '../../src/ui/hud/layout';

/** Within `tol` px of a measurement on ss2.jpg (screen px ÷ 2). */
const near = (actual: number, measured: number, tol = 2): void => expect(Math.abs(actual - measured)).toBeLessThanOrEqual(tol);

describe('UE canvas slots (the raw widget values)', () => {
  it('resolves anchors, offsets and alignment like a CanvasPanelSlot', () => {
    // UI_背包栏_3d.Border_0 (HP): anchor (0,1), pos (274,-1246), size 316×28, alignment (0.5,0.5)
    expect(slotBox({ anchor: [0, 1], pos: [274, -1246], size: [316, 28], align: [0.5, 0.5] }, 480, 1440)).toEqual({ x: 116, y: 180, w: 316, h: 28 });
    // UI_主界面.区域判断 at its combat width: anchor (1,0.5), pos (0,-540), alignment (1,0)
    expect(slotBox({ anchor: [1, 0.5], pos: [0, -540], size: [1563, 1080], align: [1, 0] }, 1920, 1080)).toEqual({ x: 357, y: 0, w: 1563, h: 1080 });
  });

  it('applies UE margins (left, top, right, bottom)', () => {
    expect(padBox({ x: 184, y: 80, w: 204, h: 44 }, [12, 12, 8, 12])).toEqual({ x: 196, y: 92, w: 184, h: 20 });
  });

  it('converts the two widget spaces to whole pixels, rounding edges not sizes', () => {
    expect(toPx({ x: 120, y: 184, w: 308, h: 20 }, SIDE)).toEqual({ x: 42, y: 69, w: 116, h: 8 });
    expect(screenRect({ anchor: [1, 0], pos: [-36, 372], size: [400, 635], align: [1, 0] }, 960, 540)).toEqual({ x: 742, y: 186, w: 200, h: 318 });
    expect(TURN_STATS.slot.size).toEqual([400, 635]);
  });
});

describe('the side panel lands on ss2.jpg', () => {
  it('HP and stamina frames (Image_69 / Image_2)', () => {
    expect(PANEL.hpFrame).toEqual({ x: 42, y: 69, w: 116, h: 8 });
    expect(PANEL.staminaFrame).toEqual({ x: 42, y: 87, w: 116, h: 8 });
    // ss2: HP fill 87–313 × 139–151 px, stamina fill 174–187
    near(PANEL.hpFrame.x, 43.5);
    near(PANEL.hpFrame.x + PANEL.hpFrame.w, 156.5);
    near(PANEL.hpFrame.y, 69.5);
    near(PANEL.staminaFrame.y, 87);
  });

  it('the level lozenge, corruption and EXP', () => {
    // ss2: lozenge tips 61–125 × 56–119
    near(PANEL.level.x + PANEL.level.w / 2, 46.5);
    near(PANEL.level.y + PANEL.level.h / 2, 43.75);
    expect(PANEL.corruption).toEqual({ x: 71, y: 35, w: 69, h: 7 });
    expect(PANEL.exp).toEqual({ x: 71, y: 54, w: 78, h: 2 });
  });

  it('the four skill slots, scaled 1.333 about the column top-right', () => {
    expect(PANEL.skills.map(r => r.y)).toEqual([112, 162, 211, 261]);
    for (const r of PANEL.skills) expect([r.x, r.w]).toEqual([120, 45]);
    // ss2 slot frames: 244–328 × 225 / 325 / 424 / 523
    [112.5, 162.5, 212, 261.5].forEach((y, i) => near(PANEL.skills[i].y, y));
  });

  it('the button tiles', () => {
    expect(PANEL.codex).toEqual({ x: 122, y: 317, w: 42, h: 45 });
    expect(PANEL.character).toEqual({ x: 122, y: 368, w: 42, h: 45 });
    expect(PANEL.retreat).toEqual({ x: 122, y: 452, w: 42, h: 27 });
    expect(PANEL.settings).toEqual({ x: 129, y: 486, w: 29, h: 23 });
    // ss2: codex art 248–325 × 632–717, character 736–820
    near(PANEL.codex.y, 316);
    near(PANEL.character.y, 368);
  });

  it('the item grid: 10 rows of 104 units (39 px) from 110', () => {
    expect(GRID.rect).toEqual({ x: 29, y: 110, w: 78, h: 390 });
    expect(Array.from({ length: 11 }, (_, r) => rowTop(r))).toEqual([110, 149, 188, 227, 266, 305, 344, 383, 422, 461, 500]);
  });

  it('cards: the 220-unit UI_修炼牌 centred on its rows', () => {
    expect(cardBox(0, 1)).toEqual({ x: 80, y: 292, w: 220, h: 108 });
    expect(cardBox(4, 2)).toEqual({ x: 80, y: 708, w: 220, h: 212 });
    const L = cardLayout(0, 1);
    expect(L.face).toEqual({ x: 32, y: 112, w: 74, h: 35 });
    // ss2: card frame 65–213 × 224–294; badge "15" 167–217 × 226–247; "×2" right edge 192 on row 2; pips end 193
    near(L.face.x, 32.5);
    near(L.face.y + L.face.h, 147);
    near(L.badgeRight - 2, 108.5);
    near(L.badgeTop + 3, 113);
    near(cardLayout(2, 1).combo.x + cardLayout(2, 1).combo.w - 2, 96);
    near(L.durabilityRight, 96.5);
    expect(L.socketY).toEqual([130]);
    expect(cardLayout(0, 3).socketY).toEqual([157, 169, 181]);
  });
});

describe('the play area (区域判断)', () => {
  it('is the right 1563 units in combat, starting at the side panel (178.5 px)', () => {
    expect(playArea(960, 540)).toEqual({ x: 179, y: 0, w: 781, h: 540 });
  });

  it('stays next to the panel on wider layers and runs to their right edge', () => {
    // 1366×768 and 1920×969 viewports get ×1 HUD layers of their own size
    expect(playArea(1366, 768)).toEqual({ x: 179, y: 0, w: 1187, h: 768 });
    expect(playArea(1920, 969)).toEqual({ x: 179, y: 0, w: 1741, h: 969 });
  });
});
