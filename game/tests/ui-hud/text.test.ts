import { describe, expect, it } from 'vitest';
import { breakLines, format, parseRich } from '../../src/ui/text/layout';

/** Fusion Pixel 12 advances: CJK 12 px, Latin 6 px, space 6 px; zero-width hints 0. */
const adv = (ch: string): number => (ch === '\u200b' ? 0 : (ch.codePointAt(0) ?? 0) > 0x2e80 ? 12 : 6);
const text = (lines: ReturnType<typeof breakLines>): string[] => lines.map(l => l.runs.map(r => r.text).join(''));

describe('rich text (the Demo markup)', () => {
  it('splits styled runs', () => {
    expect(parseRich('获得<天赋>2</>层<词条>心流</>。')).toEqual([
      { text: '获得', style: undefined },
      { text: '2', style: '天赋' },
      { text: '层', style: undefined },
      { text: '心流', style: '词条' },
      { text: '。', style: undefined },
    ]);
  });

  it('formats placeholders', () => {
    expect(format('通过第{0}层', '3/36')).toBe('通过第3/36层');
    expect(format('{0} 充能/每次反弹', 20)).toBe('20 充能/每次反弹');
  });
});

describe('line breaking', () => {
  it('breaks CJK between characters and keeps closing punctuation off the line start', () => {
    const lines = breakLines([{ text: '心流会自动抵消技能释放后产生的冷却回合。' }], 12 * 18, adv);
    expect(text(lines)).toEqual(['心流会自动抵消技能释放后产生的冷却回', '合。']);
    const tight = breakLines([{ text: '冷却回合。' }], 12 * 4, adv);
    expect(text(tight)[1].startsWith('。')).toBe(false);
  });

  it('breaks Latin at spaces and splits words longer than the line', () => {
    expect(text(breakLines([{ text: 'Infuse grants charge' }], 6 * 12, adv))).toEqual(['Infuse', 'grants', 'charge']);
    expect(text(breakLines([{ text: 'abcdefghij' }], 6 * 4, adv))).toEqual(['abcd', 'efgh', 'ij']);
  });

  it('honours zero-width hints, explicit newlines and keeps styles per run', () => {
    expect(text(breakLines([{ text: 'Use\r\nitem' }], 999, adv))).toEqual(['Use', 'item']);
    const lines = breakLines(parseRich('提升\u200b{0}<强调>弹射距离</>'), 999, adv);
    expect(lines[0].runs.map(r => r.style)).toEqual([undefined, '强调']);
    expect(lines[0].width).toBe(12 * 2 + 6 * 3 + 12 * 4);
  });
});
