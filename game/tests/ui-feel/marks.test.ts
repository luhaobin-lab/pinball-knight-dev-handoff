import { describe, expect, it } from 'vitest';
import { Surface } from '../../src/ui/core/surface';
import { EnemyMarks, type EnemyMark } from '../../src/ui/hud/marks';
import { DANGER } from '../../src/ui/style/palette';

/** World (tiles) → layer px: x and z 20 px per tile, y up 20 px; everything on screen. */
const project = (p: { x: number; y: number; z: number }): { x: number; y: number; depth: number } => ({ x: p.x * 20, y: p.z * 20 - p.y * 20, depth: 0 });

const MARK: EnemyMark = { id: 'jelly', at: { x: 10, y: 0, z: 10 }, head: { x: 10, y: 2, z: 10 }, hp: 3, hpMax: 5, intent: { kind: 'attack', value: 9 } };

/** Alphas of the bar's red fill and whether the intent (red, above the bar) is drawn. */
function look(marks: EnemyMarks): { bar: number; intent: boolean } {
  const s = new Surface(400, 300);
  marks.draw(s, project, 0);
  let bar = 0;
  let intent = false;
  for (let y = 0; y < s.h; y++)
    for (let x = 0; x < s.w; x++) {
      const c = s.get(x, y);
      if ((c & 0xffffff) !== (DANGER.base & 0xffffff)) continue;
      if (y > 195) bar = Math.max(bar, c >>> 24);
      else intent = true;
    }
  return { bar, intent };
}

describe('UI_头顶状态条.切换可视: the head bar fades at 4 per second through 血条显示曲线', () => {
  it('fades a new bar in over 0.25 s (透明度计数 0 → 1, alpha smoothstep)', () => {
    const marks = new EnemyMarks();
    marks.set([MARK]);
    marks.update(0.0625);
    // 透明度计数 0.25 → 血条显示曲线 (flat tangents) 0.15625
    expect(look(marks).bar).toBe(Math.round(0.15625 * 255));
    marks.update(0.0625);
    expect(look(marks).bar).toBe(Math.round(0.5 * 255));
    marks.update(0.125);
    expect(look(marks).bar).toBe(255);
    expect(marks.update(0.1)).toBe(false); // at rest
  });

  it('fades out when hidden while the intent goes at once (蓝图_效果_意图 hides it on 进入战斗时)', () => {
    const marks = new EnemyMarks();
    marks.set([MARK]);
    marks.update(1);
    expect(look(marks)).toEqual({ bar: 255, intent: true });
    marks.set([{ ...MARK, hidden: true }]);
    marks.update(0.125);
    expect(look(marks)).toEqual({ bar: Math.round(0.5 * 255), intent: false });
    marks.update(0.125);
    expect(look(marks).bar).toBe(0);
    // and back in when the hero aims again
    marks.set([MARK]);
    expect(look(marks).intent).toBe(true);
    marks.update(0.125);
    expect(look(marks).bar).toBe(Math.round(0.5 * 255));
  });

  it('fades a mark the game leaves out (a dead enemy) from where it was, then forgets it', () => {
    const marks = new EnemyMarks();
    marks.set([MARK]);
    marks.update(1);
    marks.set([]);
    marks.update(0.125);
    expect(look(marks).bar).toBe(Math.round(0.5 * 255));
    marks.update(0.2);
    marks.update(0.01);
    expect(marks.empty).toBe(true);
  });

  it('blends the composited bar once, so every pixel of a fading bar has the same alpha', () => {
    const marks = new EnemyMarks();
    marks.set([{ ...MARK, intent: undefined, elite: true, armor: 2, dot: 1 }]);
    marks.update(0.125);
    const s = new Surface(400, 300);
    marks.draw(s, project, 0);
    const alphas = new Set<number>();
    for (const c of s.data) if (c >>> 24) alphas.add(c >>> 24);
    expect([...alphas]).toEqual([Math.round(0.5 * 255)]);
  });
});
