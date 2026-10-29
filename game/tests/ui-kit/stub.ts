import type { TextFont } from '../../src/ui/text/font';

/** Same metrics as the pixel font: 16-px lines, CJK 12 px wide, Latin 6. */
export const STUB: TextFont = {
  line: 16,
  measure: t => [...t].reduce((w, ch) => w + ((ch.codePointAt(0) ?? 0) > 0x2e80 ? 12 : 6), 0),
  draw: (s, text, x, y, style) => {
    const w = STUB.measure(text);
    s.fill(x, y + 2, w, 12, style.color, style.opacity ?? 1);
    return w;
  },
};
