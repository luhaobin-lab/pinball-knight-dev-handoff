import { describe, expect, it } from 'vitest';
import { demoCurveAssets, 曲线表, type RichCurve } from '../../src/content/demo/index.ts';
import { CURVE_MAIN_LEG, CURVE_TERMINAL_LEG, evalRichCurve, type RichKey } from '../../src/core/launch/curves.ts';
import { HIT_STOP, legDuration, mainLegSpeed, STARTER_HERO, terminalLegSpeed } from '../../src/core/launch/index.ts';

/**
 * spec/launch-feel.vectors.json: its shape, its link to the rules of spec/launch-feel.md, and the values that can be
 * recomputed from the imported Demo data and the launch core (so the spec cannot drift from either).
 */
const raw = import.meta.glob<string>(['../../spec/launch-feel.md', '../../spec/launch-feel.vectors.json'], {
  query: '?raw',
  import: 'default',
  eager: true,
});
const md = raw['../../spec/launch-feel.md'] ?? '';
const doc = JSON.parse(raw['../../spec/launch-feel.vectors.json'] ?? '{}') as Record<string, unknown>;

interface Vector {
  readonly id: string;
  readonly event: string;
  readonly expected: unknown;
  readonly unit: string;
  readonly tolerance: unknown;
  readonly source: string;
  readonly clock?: string;
  readonly check?: string;
}

const vectors = (Array.isArray(doc.vectors) ? doc.vectors : []) as Vector[];
const events = new Set((Array.isArray(doc.events) ? doc.events : []) as string[]);
const units = new Set((Array.isArray(doc.units) ? doc.units : []) as string[]);
const vector = (id: string): Vector => {
  const found = vectors.find(x => x.id === id);
  if (!found) throw new Error(`no vector ${id}`);
  return found;
};
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isKeys = (x: unknown): x is [number, number][] =>
  Array.isArray(x) && x.length > 0 && x.every(k => Array.isArray(k) && k.length === 2 && isNum(k[0]) && isNum(k[1]));
const keysOf = (c: RichCurve): RichKey[] =>
  c.Keys.map(k => ({
    time: k.Time,
    value: k.Value,
    interp: k.InterpMode === 'RCIM_Cubic' ? 'cubic' : k.InterpMode === 'RCIM_Linear' ? 'linear' : 'constant',
    arriveTangent: k.ArriveTangent,
    arriveTangentWeight: k.ArriveTangentWeight,
    leaveTangent: k.LeaveTangent,
    leaveTangentWeight: k.LeaveTangentWeight,
    weightMode: k.TangentWeightMode === 'RCTWM_WeightedBoth' ? 'both' : k.TangentWeightMode === 'RCTWM_WeightedArrive' ? 'arrive' : k.TangentWeightMode === 'RCTWM_WeightedLeave' ? 'leave' : 'none',
  }));
const assetCurve = (asset: string, name: string): RichCurve => {
  const curve = demoCurveAssets[asset]?.curves.find(c => c.name === name);
  if (!curve || curve.class !== 'CurveFloat') throw new Error(`no curve ${asset} ${name}`);
  return curve.FloatCurve;
};

describe('launch-feel vectors: shape', () => {
  it('has the header and enough vectors', () => {
    expect(doc.spec).toBe('spec/launch-feel.md');
    expect(doc.frameRate).toBe(60);
    expect(vectors.length).toBeGreaterThanOrEqual(80);
  });

  it('every vector has an id, a known event, an expected value, a known unit, a tolerance and a source', () => {
    const ids = new Set<string>();
    for (const x of vectors) {
      expect(x.id, JSON.stringify(x)).toMatch(/^FEEL-\d{3}(\.[a-z])?$/);
      expect(ids.has(x.id), `duplicate ${x.id}`).toBe(false);
      ids.add(x.id);
      for (const part of x.event.split('→')) expect(events.has(part), `${x.id}: unknown event ${part}`).toBe(true);
      expect(x.expected, x.id).not.toBeUndefined();
      expect(units.has(x.unit), `${x.id}: unknown unit ${x.unit}`).toBe(true);
      expect(typeof x.source === 'string' && x.source.length > 10, `${x.id}: source`).toBe(true);
      if (x.clock !== undefined) expect(['game', 'real', 'frame'], x.id).toContain(x.clock);
    }
  });

  it('tolerances fit the expected value: key lists take {t, v}, everything else a non-negative number', () => {
    for (const x of vectors) {
      if (isKeys(x.expected)) {
        const tol = x.tolerance as { t?: unknown; v?: unknown };
        expect(isNum(tol.t) && tol.t >= 0 && isNum(tol.v) && tol.v >= 0, `${x.id}: key tolerance`).toBe(true);
        const times = x.expected.map(k => k[0]);
        expect(times[0], `${x.id}: keys start at 0`).toBe(0);
        for (let i = 1; i < times.length; i++) expect(times[i]! > times[i - 1]!, `${x.id}: key times increase`).toBe(true);
      } else {
        expect(isNum(x.tolerance) && x.tolerance >= 0, `${x.id}: tolerance`).toBe(true);
      }
      const range = x.expected as { min?: unknown; max?: unknown };
      if (range && typeof range === 'object' && !Array.isArray(range) && isNum(range.min) && isNum(range.max)) {
        expect(range.min <= range.max, `${x.id}: range`).toBe(true);
      }
    }
  });

  it('every vector belongs to a rule of the spec, and every rule id is defined once', () => {
    const defined = [...md.matchAll(/^\*\*(FEEL-\d{3}) — /gm)].map(m => m[1]!);
    expect(new Set(defined).size, 'duplicate rule ids').toBe(defined.length);
    expect(defined.length).toBeGreaterThanOrEqual(60);
    const rules = new Set(defined);
    for (const x of vectors) expect(rules.has(x.id.slice(0, 8)), `${x.id}: no rule ${x.id.slice(0, 8)} in the spec`).toBe(true);
    const covered = new Set(vectors.map(x => x.id.slice(0, 8)));
    expect(covered.size / rules.size).toBeGreaterThan(0.8);
  });

  it('every SPEC-GAP named by a vector is listed in the spec', () => {
    for (const x of vectors) {
      for (const m of `${x.source} ${x.check ?? ''}`.matchAll(/SPEC-GAP G(\d+)/g)) {
        expect(md, `${x.id}: G${m[1]}`).toMatch(new RegExp(`^\\| G${m[1]} \\|`, 'm'));
      }
    }
  });
});

describe('launch-feel vectors agree with the Demo data and the launch core', () => {
  it('FEEL-010/011: leg speeds and durations', () => {
    expect([0, 1, 2, 3].map(mainLegSpeed)).toEqual(vector('FEEL-010').expected);
    const durations = (vector('FEEL-010.b').expected as number[]).map((d, i) => [d, legDuration(500, mainLegSpeed(i))]);
    for (const [want, got] of durations) expect(got).toBeCloseTo(want!, 4);
    expect(legDuration(500, terminalLegSpeed(mainLegSpeed(3)))).toBeCloseTo(vector('FEEL-011').expected as number, 4);
  });

  it('FEEL-003.b: the first 60-fps step of a 500-uu leg 0', () => {
    const step = evalRichCurve(CURVE_MAIN_LEG, 1 / 60 / legDuration(500, mainLegSpeed(0))) * 500;
    const x = vector('FEEL-003.b');
    expect(Math.abs(step - (x.expected as number))).toBeLessThanOrEqual(0.1);
  });

  it('FEEL-040: the hit-stop keys are the core HIT_STOP and the 时间变速 curve', () => {
    const keys = vector('FEEL-040').expected as [number, number][];
    expect(HIT_STOP.steps.map(s => [s.from, s.dilation])).toEqual(keys);
    const track = assetCurve('CatapultHero/BP/Skill/效果/蓝图_效果_时间变速', 'CurveFloat_0_1').Keys.map(k => [k.Time, k.Value]);
    expect(track).toEqual(keys);
    expect(HIT_STOP.duration).toBe(0.25);
    const loss = keys[1]![0] / keys[0]![1] + (keys[2]![0] - keys[1]![0]) / keys[1]![1] - keys[2]![0];
    expect(loss).toBeCloseTo(vector('FEEL-040.d').expected as number, 4);
    expect(keys[1]![0] / keys[0]![1]).toBeCloseTo(vector('FEEL-040.c').expected as number, 6);
  });

  it('FEEL-050/023: the recoil samples are 48 uu × the 可控反弹动画 track', () => {
    const track = keysOf(assetCurve('CatapultHero/BP/Skill/效果/蓝图_效果_可控反弹动画', 'CurveFloat_0'));
    for (const id of ['FEEL-050', 'FEEL-023']) {
      for (const [t, uu] of vector(id).expected as [number, number][]) expect(48 * evalRichCurve(track, t)).toBeCloseTo(uu, 0);
    }
  });

  it('FEEL-031/032: shake amplitudes are 250 × (1 − 500 / R)', () => {
    const amp = (r: number): number => 250 * (1 - 500 / r);
    expect(amp(520)).toBeCloseTo(vector('FEEL-031').expected as number, 2);
    expect(amp(550)).toBeCloseTo(vector('FEEL-032').expected as number, 2);
    expect(amp(750)).toBeCloseTo(vector('FEEL-032.b').expected as number, 2);
  });

  it('FEEL-080: the trail is 高度 − 10 wide', () => {
    expect(STARTER_HERO.height - 10).toBe(vector('FEEL-080').expected);
  });

  it('FEEL-101: the number travel curve is 曲线表 伤害提示曲线', () => {
    const curve = keysOf(曲线表.rows.伤害提示曲线);
    for (const [t, v] of vector('FEEL-101').expected as [number, number][]) expect(evalRichCurve(curve, t)).toBeCloseTo(v, 3);
  });

  it('FEEL-072: the corpse darkening curve reaches 1 at 1.2 s', () => {
    const curve = keysOf(assetCurve('CatapultHero/BP/Actor/BP_Actor_Other', 'CurveFloat_0'));
    expect(evalRichCurve(curve, vector('FEEL-072').expected as number)).toBeCloseTo(1, 6);
    expect(evalRichCurve(curve, 0.6)).toBeLessThan(1);
  });

  it('FEEL-113: the reference launch of §4 replays to the listed frames under the 60-fps frame model', () => {
    // legs of 500 uu; contact 2 hostile; a leg ends in the first frame whose curve reaches 1; the next leg moves
    // from the next frame; a hostile contact sets dilation 0.2 for the next frame, the 0.25-s track runs in game time.
    const dt = 1 / 60;
    const legs = [0, 1, 2, 3].map(i => ({ speed: mainLegSpeed(i), curve: CURVE_MAIN_LEG, hostile: i === 1 }));
    legs.push({ speed: terminalLegSpeed(mainLegSpeed(3)), curve: CURVE_TERMINAL_LEG, hostile: false });
    const ends: number[] = [];
    let leg = 0;
    let elapsed = 0;
    let dilation = 1;
    let hitStop: number | null = null;
    for (let frame = 0; frame < 400 && leg < legs.length; frame++) {
      const gameDt = dt * dilation;
      let next = 1;
      if (hitStop !== null) {
        hitStop += gameDt;
        if (hitStop >= HIT_STOP.duration) hitStop = null;
        else for (const s of HIT_STOP.steps) if (hitStop >= s.from) next = s.dilation;
      }
      const { speed, curve, hostile } = legs[leg]!;
      const duration = legDuration(500, speed);
      elapsed = Math.min(elapsed + gameDt, duration);
      if (elapsed >= duration || evalRichCurve(curve, elapsed / duration) >= 1) {
        ends.push(frame);
        if (hostile) {
          hitStop = 0;
          next = HIT_STOP.steps[0]!.dilation;
        }
        leg++;
        elapsed = 0;
      }
      dilation = next;
    }
    expect(ends.slice(0, 4)).toEqual(vector('FEEL-113').expected);
    expect(ends[4]).toBe(vector('FEEL-113.b').expected);
  });
});
