import type { Vector3Like } from 'three';
import { animLength, sample } from '../core/motion';
import { Surface } from '../core/surface';
import { abbreviate } from '../text/abbrev';
import { drawDigits, digitsWidth } from '../text/digits';
import { drawGlyph, glyph, type GlyphName } from '../style/glyphs';
import { BONE, DANGER, INK } from '../style/palette';
import { CURVES, INTENT_BOB } from './anims';
import { SCREEN } from './layout';

/**
 * Marks anchored to enemies, drawn on the world layer:
 * - UI_头顶状态条 (a screen-space WidgetComponent on BP_ManeActor at X −48, Z 40 units: below the
 *   body, toward the camera), 63×12 widget px → 32×6: HP, the HP that pending damage over time
 *   takes, armour on the lower half; 精英图标 adds the elite horns. It fades (切换可视): 透明度计数 moves 4 per
 *   second toward shown or hidden and the bar's alpha is 曲线表.血条显示曲线 of it, 0.25 s each way.
 * - UI_意图提示 (蓝图_效果_意图, a 200×51 world widget at Z 100): the intent icon and value,
 *   bobbing in 4-unit steps over 3 s (浮动). It does not fade: the effect hides it at once (SetHiddenInGame on
 *   进入战斗时, 蓝图_效果_意图 L848) and shows it at once.
 * - UI_弱点提示 (蓝图_效果_弱点, a 64×64 world widget at Z 100): the weak-point reticle, shown like the intent.
 * Enemy marks are red (ART_BIBLE §7: red only for enemies and danger).
 */
export type IntentKind = 'attack' | 'heal' | 'fortify' | 'special';

export interface EnemyMark {
  readonly id: string;
  /** The enemy's floor centre in world units (x, z on the floor, y up). */
  at: Vector3Like;
  /** Where its intent / weak point float; default 1.5625 tiles (Z 100 units) above `at`. */
  head?: Vector3Like;
  hp: number;
  hpMax: number;
  armor?: number;
  /** HP that pending damage over time will take. */
  dot?: number;
  elite?: boolean;
  intent?: { kind: IntentKind; value?: number };
  weak?: boolean;
  /**
   * The game hides the marks (BP_ManeActor.更新外观数据: outside 当前环节 2 and 8, dead, unrevealed, a boss): the head
   * bar fades out and the intent and weak point go at once. A mark left out of `setEnemies` fades out the same way.
   */
  hidden?: boolean;
}

/** One Demo tile is 64 units: the head bar's offset (X −48, Z 40) and the intent's height (Z 100). */
const UNIT = 1 / 64;
export const BAR_OFFSET = { z: 48 * UNIT, y: 40 * UNIT } as const;
export const HEAD_HEIGHT = 100 * UNIT;

/** 63×12 widget px (各种UI_Sprite4, 21×4 texels) on the 0.5 grid. */
const BAR = { w: 32, h: Math.round(12 * SCREEN.scale) };

const INTENT_GLYPH: Record<IntentKind, GlyphName> = { attack: 'attack', heal: 'heal', fortify: 'fortify', special: 'special' };

/** 浮动 (a looping world widget, × 0.375 px per unit): 0, −4, −8, −12, −8, −4 units, 0.5 s each. */
export function intentBob(time: number): number {
  const loop = animLength(INTENT_BOB);
  return -Math.round(-sample(INTENT_BOB, 'dy', ((time % loop) + loop) % loop) * 0.375);
}

/** UI_头顶状态条.切换可视's speed: 透明度计数 per second. */
const FADE_RATE = 4;

interface Shown {
  mark: EnemyMark;
  /** 透明度计数 (0 hidden … 1 shown) and the alpha it last gave. */
  count: number;
  alpha: number;
  /** In the latest setEnemies and not hidden. */
  shown: boolean;
}

type Project = (p: Vector3Like) => { x: number; y: number; depth: number };

/** The marks of every enemy the game reports, with the head bars' fades. Pure model; `draw` is the world layer's. */
export class EnemyMarks {
  private readonly marks = new Map<string, Shown>();

  /** The game's marks, replaced every call; marks it leaves out fade out from where they were. */
  set(list: readonly EnemyMark[]): void {
    const seen = new Set<string>();
    for (const mark of list) {
      seen.add(mark.id);
      const m = this.marks.get(mark.id);
      // a new bar starts hidden (透明度计数 0) and fades in
      if (m) Object.assign(m, { mark, shown: !mark.hidden });
      else this.marks.set(mark.id, { mark, count: 0, alpha: 0, shown: !mark.hidden });
    }
    for (const [id, m] of this.marks) if (!seen.has(id)) m.shown = false;
  }

  /** Advances the fades by `dt` real seconds (UMG ticks undilated); true while a bar is changing. */
  update(dt: number): boolean {
    let changed = false;
    for (const [id, m] of this.marks) {
      const target = m.shown ? 1 : 0;
      if (m.count === target && m.alpha === target) {
        if (!m.shown) this.marks.delete(id);
        continue;
      }
      // the Tick moves 透明度计数, sets the alpha from the curve, then stops at the bound
      m.count += (m.shown ? 1 : -1) * FADE_RATE * dt;
      m.alpha = CURVES.barShow.at(m.count);
      m.count = Math.max(0, Math.min(1, m.count));
      changed = true;
    }
    return changed;
  }

  get empty(): boolean {
    return this.marks.size === 0;
  }

  /** Draws the marks; returns false when there is nothing to show. */
  draw(s: Surface, project: Project, time: number): boolean {
    let drew = false;
    for (const { mark: m, alpha, shown } of this.marks.values()) {
      if (alpha > 0) {
        const b = project({ x: m.at.x, y: m.at.y + BAR_OFFSET.y, z: m.at.z + BAR_OFFSET.z });
        if (Math.abs(b.depth) <= 1) {
          drawHeadBar(s, Math.round(b.x - BAR.w / 2), Math.round(b.y - BAR.h / 2), m, alpha);
          drew = true;
        }
      }
      if (!shown) continue;
      const head = m.head ?? { x: m.at.x, y: m.at.y + HEAD_HEIGHT, z: m.at.z };
      const h = project(head);
      if (Math.abs(h.depth) > 1) continue;
      if (m.weak) {
        // 蓝图_效果_弱点 sits at its own weak point; without one it hangs just under the intent
        const g = glyph('weak');
        drawGlyph(s, 'weak', Math.round(h.x - g.w / 2), Math.round(h.y - g.h / 2) + 8, { main: DANGER.base, outline: INK.deep });
        drew = true;
      }
      if (m.intent) {
        drawIntent(s, Math.round(h.x), Math.round(h.y) + intentBob(time), m.intent.kind, m.intent.value);
        drew = true;
      }
    }
    return drew;
  }
}

// SPEC-GAP: the frames 各种UI_Sprite4 (normal) and Sprite3 (精英图标 81×30) are sprites without pixels;
// the bar keeps the 63×12 box with an ink rim, elites get red horns
function drawHeadBar(s: Surface, x: number, y: number, m: EnemyMark, alpha: number): void {
  // SetColorAndOpacity fades the composited widget: draw it opaque, then blend it once
  const bar = new Surface(BAR.w + 2, BAR.h + 4);
  const max = Math.max(1, m.hpMax);
  const inner = BAR.w - 2;
  const hp = Math.max(0, Math.min(1, m.hp / max));
  const safe = Math.max(0, Math.min(hp, (m.hp - (m.dot ?? 0)) / max));
  bar.origin(1, 2);
  bar.fill(0, 0, BAR.w, BAR.h, INK.deep);
  bar.fill(1, 1, inner, BAR.h - 2, INK.base);
  const ws = Math.round(inner * safe);
  const wh = Math.round(inner * hp);
  bar.fill(1, 1, ws, BAR.h - 2, DANGER.base);
  if (wh > ws) bar.fill(1 + ws, 1, wh - ws, BAR.h - 2, DANGER.deep);
  const armor = Math.max(0, Math.min(1, (m.armor ?? 0) / max));
  if (armor > 0) bar.fill(1, Math.ceil(BAR.h / 2), Math.max(1, Math.round(inner * armor)), BAR.h - 1 - Math.ceil(BAR.h / 2), BONE.dim);
  if (m.elite) {
    for (const ex of [-1, BAR.w - 1]) {
      bar.fill(ex, -2, 2, BAR.h + 4, INK.deep);
      bar.fill(ex + (ex < 0 ? 0 : 1), -1, 1, BAR.h + 2, DANGER.base);
    }
  }
  s.blit(bar, x - 1, y - 2, alpha);
}

function drawIntent(s: Surface, cx: number, cy: number, kind: IntentKind, value?: number): void {
  const g = glyph(INTENT_GLYPH[kind]);
  const text = value !== undefined ? abbreviate(value) : '';
  const w = g.w + (text ? 2 + digitsWidth(text, 7) : 0);
  const x = cx - Math.round(w / 2);
  drawGlyph(s, INTENT_GLYPH[kind], x, cy - Math.floor(g.h / 2), { main: DANGER.base, outline: INK.deep });
  if (text) drawDigits(s, text, x + g.w + 2, cy - 3, 7, { color: DANGER.base, outline: INK.deep });
}
