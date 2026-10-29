/**
 * Pure text layout: rich-text parsing of the Demo's markup and greedy line breaking for mixed
 * CJK / Latin text. No DOM; tested in node (tests/p1-ui/text.test.ts).
 */

/** A run of text with an optional style tag (the Demo's `<强调>…</>` markup names). */
export interface StyledRun {
  readonly text: string;
  readonly style?: string;
}

export interface PlacedRun {
  readonly text: string;
  readonly style?: string;
  /** Pen offset from the line start, in font px. */
  readonly x: number;
  readonly width: number;
}

export interface LaidLine {
  readonly runs: readonly PlacedRun[];
  readonly width: number;
}

/**
 * Parses `plain <tag>styled</> plain` (the Demo's rich text) into runs. Nested tags are not used
 * by the Demo; an unknown or unclosed tag simply styles the rest of the string.
 */
export function parseRich(source: string): StyledRun[] {
  const runs: StyledRun[] = [];
  const re = /<([^<>/][^<>]*)>|<\/>/g;
  let style: string | undefined;
  let last = 0;
  for (let m = re.exec(source); m; m = re.exec(source)) {
    if (m.index > last) runs.push({ text: source.slice(last, m.index), style });
    style = m[1];
    last = m.index + m[0].length;
  }
  if (last < source.length) runs.push({ text: source.slice(last), style });
  return runs.filter(r => r.text.length > 0);
}

/** Replaces `{0}`, `{1}` … and `{name}` placeholders. */
export function format(template: string, ...args: (string | number)[]): string {
  return template.replace(/\{(\d+)\}/g, (all, i: string) => (args[Number(i)] !== undefined ? String(args[Number(i)]) : all));
}

/** No line may start with these (closing punctuation, kinsoku). */
const NO_START = new Set([...'，。、：；！？）」』》】〕…—·%）,.;:!?)]}%']);
/** No line may end with these (opening brackets). */
const NO_END = new Set([...'（「『《【〔([{']);

const isCjk = (ch: string): boolean => {
  const c = ch.codePointAt(0) ?? 0;
  return (c >= 0x2e80 && c <= 0x9fff) || (c >= 0xf900 && c <= 0xfaff) || (c >= 0xff00 && c <= 0xffef) || (c >= 0x3000 && c <= 0x303f);
};

interface Unit {
  chars: { ch: string; style?: string }[];
  width: number;
  space: boolean;
  forced: boolean;
}

/**
 * Greedy line breaking. Break opportunities: after spaces, between CJK characters (unless kinsoku
 * forbids it), at \u200b hints and at explicit newlines. Words longer than the line are split.
 */
export function breakLines(runs: readonly StyledRun[], maxWidth: number, advance: (ch: string) => number): LaidLine[] {
  const units: Unit[] = [];
  let cur: Unit | null = null;
  const flush = (): void => {
    if (cur && cur.chars.length) units.push(cur);
    cur = null;
  };
  for (const run of runs) {
    for (const ch of run.text.replace(/\r\n?/g, '\n')) {
      const piece = { ch, style: run.style };
      if (ch === '\n') {
        flush();
        units.push({ chars: [], width: 0, space: false, forced: true });
      } else if (ch === '\u200b') {
        flush();
      } else if (ch === ' ') {
        flush();
        units.push({ chars: [piece], width: advance(ch), space: true, forced: false });
      } else if (isCjk(ch) || NO_START.has(ch)) {
        const prev = units[units.length - 1];
        if (NO_START.has(ch) && (cur || (prev && !prev.space && !prev.forced))) {
          // glue closing punctuation to whatever precedes it
          const target: Unit = cur ?? prev;
          target.chars.push(piece);
          target.width += advance(ch);
          if (cur) flush();
        } else {
          flush();
          cur = { chars: [piece], width: advance(ch), space: false, forced: false };
          if (!NO_END.has(ch)) flush();
        }
      } else {
        if (!cur) cur = { chars: [], width: 0, space: false, forced: false };
        cur.chars.push(piece);
        cur.width += advance(ch);
      }
    }
  }
  flush();

  const lines: { chars: { ch: string; style?: string }[]; width: number }[] = [];
  let line: { ch: string; style?: string }[] = [];
  let width = 0;
  const endLine = (): void => {
    while (line.length && line[line.length - 1].ch === ' ') {
      width -= advance(' ');
      line.pop();
    }
    lines.push({ chars: line, width });
    line = [];
    width = 0;
  };
  for (const u of units) {
    if (u.forced) {
      endLine();
      continue;
    }
    if (u.space && line.length === 0) continue;
    if (width + u.width > maxWidth && line.length > 0 && !u.space) endLine();
    if (u.width > maxWidth && !u.space) {
      for (const c of u.chars) {
        const a = advance(c.ch);
        if (width + a > maxWidth && line.length) endLine();
        line.push(c);
        width += a;
      }
      continue;
    }
    line.push(...u.chars);
    width += u.width;
  }
  if (line.length || lines.length === 0) endLine();

  return lines.map(l => {
    const placed: PlacedRun[] = [];
    let x = 0;
    for (const c of l.chars) {
      const a = advance(c.ch);
      const last = placed[placed.length - 1];
      if (last && last.style === c.style) placed[placed.length - 1] = { ...last, text: last.text + c.ch, width: last.width + a };
      else placed.push({ text: c.ch, style: c.style, x, width: a });
      x += a;
    }
    return { runs: placed, width: l.width };
  });
}
