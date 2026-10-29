import { describe, expect, it } from 'vitest';
import { PREVIEW_PULSE, type PulseLayout } from '../../src/core/launch/index.ts';
import { ARROW } from '../../src/game/cursor';
import { CHEVRON_SPAN, chevronStamp, DIGITS_5x7, type Pixel } from '../../src/game/overlay';
import { LIT, PreviewPulse } from '../../src/game/preview-pulse';

const heading = (k: number): [number, number] => [Math.cos((k * Math.PI) / 8), Math.sin((k * Math.PI) / 8)];
const key = (p: Pixel): string => `${p[0]},${p[1]}`;

describe('chevron stamps', () => {
  it('snap every direction to one of 16 fixed stamps, so every chevron of a leg is the same pixels', () => {
    for (let k = 0; k < 16; k++) {
      const [dx, dy] = heading(k);
      expect(chevronStamp(dx * 3, dy * 3)).toBe(chevronStamp(dx, dy));
      // anything within half a step of the heading
      const a = ((k + 0.45) * Math.PI) / 8;
      expect(chevronStamp(Math.cos(a), Math.sin(a))).toBe(chevronStamp(dx, dy));
    }
  });

  it('are at most 7×7 px, with a single-pixel tip ahead of the rest', () => {
    for (let k = 0; k < 16; k++) {
      const [dx, dy] = heading(k);
      const st = chevronStamp(dx, dy);
      const xs = st.map(p => p[0]);
      const ys = st.map(p => p[1]);
      expect(Math.max(...xs) - Math.min(...xs) + 1).toBeLessThanOrEqual(CHEVRON_SPAN);
      expect(Math.max(...ys) - Math.min(...ys) + 1).toBeLessThanOrEqual(CHEVRON_SPAN);
      const along = st.map(([x, y]) => x * dx + y * dy);
      const front = Math.max(...along);
      expect(along.filter(v => v > front - 0.5)).toHaveLength(1);
    }
    expect(CHEVRON_SPAN).toBe(7);
  });

  it('are golden 02’s cardinal v: arms back from the tip to (−4, ±3), steep by the tip', () => {
    expect(new Set(chevronStamp(1, 0).map(key))).toEqual(
      new Set(
        [
          [2, 0],
          [1, -1],
          [1, 1],
          [0, -1],
          [0, 1],
          [-1, -2],
          [-1, 2],
          [-2, -3],
          [-2, 3],
        ].map(p => key(p as unknown as Pixel)),
      ),
    );
  });

  it('are mirror-symmetric about their heading within 1 px, with equal arms', () => {
    for (let k = 0; k < 16; k++) {
      const [dx, dy] = heading(k);
      const st = chevronStamp(dx, dy);
      const along = st.map(([x, y]) => x * dx + y * dy);
      const [tx, ty] = st[along.indexOf(Math.max(...along))];
      for (const [x, y] of st) {
        const rx = x - tx;
        const ry = y - ty;
        const dot = rx * dx + ry * dy;
        const m = [tx + 2 * dot * dx - rx, ty + 2 * dot * dy - ry];
        expect(Math.min(...st.map(q => Math.hypot(q[0] - m[0], q[1] - m[1])))).toBeLessThanOrEqual(1);
      }
      // the pixels either side of the heading line through the tip
      const side = st.map(([x, y]) => (x - tx) * -dy + (y - ty) * dx);
      expect(side.filter(v => v > 1e-9).length).toBe(side.filter(v => v < -1e-9).length);
    }
  });

  it('never read as a digit or as the cursor: pixel IoU below 0.5 with every 5×7 digit at any offset', () => {
    const cells = (rows: readonly string[], on: (c: string) => boolean): Pixel[] => rows.flatMap((r, y) => [...r].flatMap((c, x) => (on(c) ? [[x, y] as const] : [])));
    const shapes = [...Object.values(DIGITS_5x7).map(g => cells(g, c => c === '1')), cells(ARROW, c => c !== '0')];
    for (let k = 0; k < 16; k++) {
      const st = new Set(chevronStamp(...heading(k)).map(key));
      for (const shape of shapes) {
        let best = 0;
        for (let ox = -24; ox <= 8; ox++)
          for (let oy = -24; oy <= 8; oy++) {
            const moved = new Set(shape.map(([x, y]) => `${x + ox},${y + oy}`));
            const both = [...st].filter(c => moved.has(c)).length;
            best = Math.max(best, both / (st.size + moved.size - both));
          }
        expect(best).toBeLessThan(0.5);
      }
    }
  });

  it('are quarter turns of each other', () => {
    for (let k = 0; k < 12; k++) {
      const a = chevronStamp(...heading(k));
      const b = chevronStamp(...heading(k + 4));
      expect(new Set(b.map(key))).toEqual(new Set(a.map(([x, y]) => key([-y, x]))));
    }
  });
});

const layout = (total: number, markers: number[] = []): PulseLayout => ({
  mainSegments: [{ start: 0, length: total }],
  markerDistances: markers,
  terminalSegment: null,
  totalLength: total,
});

describe('preview pulse (trajectory-preview TRAJEC-045…048)', () => {
  it('TRAJEC-V11: past the end plus the tail it waits the 0.35 s gap off the chain, then restarts at 0', () => {
    const p = new PreviewPulse();
    const l = layout(1000);
    p.update(0, l);
    p.head = 1490;
    p.update(1 / 60, l);
    expect(p.lineHead).toBe(-PREVIEW_PULSE.frontWidth - 1);
    // 0.35 s of 60-fps frames, quantised to whole frames
    let frames = 0;
    while (p.lineHead < 0 && frames < 60) {
      p.update(1 / 60, l);
      frames++;
    }
    expect(frames).toBeGreaterThanOrEqual(21);
    expect(frames).toBeLessThanOrEqual(22);
    expect(p.lineHead).toBe(0);
    p.update(0.1, l);
    expect(p.lineHead).toBeCloseTo(140, 9);
  });

  it('advances 1400 uu/s, the first active frame by 0, and stops on an empty chain', () => {
    const p = new PreviewPulse();
    p.update(0.5, layout(2000));
    expect(p.lineHead).toBe(0);
    p.update(0.5, layout(2000));
    expect(p.lineHead).toBe(700);
    p.update(0.5, layout(0));
    expect(p.lineHead).toBe(700);
    p.update(0.5, layout(2000));
    expect(p.lineHead).toBe(700);
  });

  it('lights the line to 1.5 at the head, fading over 70 uu ahead and 500 uu behind to the rest level 0.25 (F-11)', () => {
    const p = new PreviewPulse();
    p.update(0, layout(5000));
    p.update(1, layout(5000));
    expect(p.lineHead).toBe(1400);
    expect(p.line(1400)).toBeCloseTo(1.5, 9);
    expect(p.line(1400 + 35)).toBeCloseTo(0.25 + 1.25 * 0.5, 9);
    expect(p.line(1400 + 70)).toBeCloseTo(0.25, 9);
    expect(p.line(1400 - 250)).toBeCloseTo(0.25 + 1.25 * 0.5, 9);
    expect(p.line(1400 - 500)).toBeCloseTo(0.25, 9);
    expect(p.line(0)).toBeCloseTo(0.25, 9);
    // the two bone steps: lit from 49 uu ahead to 350 uu behind
    expect([1400 + 48, 1400 + 50, 1400 - 349, 1400 - 351].map(s => p.line(s) >= LIT)).toEqual([true, false, true, false]);
  });

  it('flashes a marker once per cycle as the head crosses it: 1.5 falling as x²(3 − 2x) to 0.25 over 0.25 s (F-12)', () => {
    const p = new PreviewPulse();
    const l = layout(1000, [700]);
    p.update(0, l);
    p.update(0.49, l);
    expect(p.marker(0)).toBeCloseTo(0.25, 9);
    p.update(0.02, l);
    expect(p.marker(0)).toBeCloseTo(1.5, 9);
    p.update(0.125, l);
    expect(p.marker(0)).toBeCloseTo(0.25 + 1.25 * 0.5, 9);
    p.update(0.125, l);
    expect(p.marker(0)).toBeCloseTo(0.25, 9);
    // a cycle is (1000 + 500) / 1400 + 0.35 ≈ 1.42 s: the next flashes come at ≈ 1.92 s and ≈ 3.34 s
    let flashes = 0;
    let was = false;
    for (let i = 0; i < 180; i++) {
      p.update(1 / 60, l);
      const on = p.marker(0) > 0.26;
      if (on && !was) flashes++;
      was = on;
    }
    expect(flashes).toBe(2);
  });
});
