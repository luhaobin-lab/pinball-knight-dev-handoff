import { describe, expect, it } from 'vitest';
import { CUE_NAMES, CUES, GROUPS, WIND, type CueName } from '../../src/audio/cues.ts';
import { nominalPlan, PATCH, windPlan } from '../../src/audio/patch.ts';
import { WAVES } from '../../src/audio/waves.ts';

// Expected values are the Demo's (dump raw/Game/CatapultHero/声音/*.json, decoded by tmp/feel/scripts/metasound3.py).

describe('the cue table', () => {
  it('has exactly the contract cues, each with valid layers, waves and a finishing layer', () => {
    expect([...CUE_NAMES].sort()).toEqual(['arrow', 'block', 'bump', 'charge', 'death', 'hit', 'launch', 'step', 'swing']);
    for (const name of CUE_NAMES) {
      const cue = CUES[name];
      expect(cue.layers.length, name).toBeGreaterThan(0);
      expect(cue.finishLayer, name).toBeLessThan(cue.layers.length);
      expect(GROUPS[cue.group], name).toBeDefined();
      for (const l of cue.layers) for (const w of l.waves) expect(WAVES[w], `${name}: ${w}`).toBeDefined();
    }
  });

  it('launch: a random pick of the three large whooshes, attached to the hero, no high-pass', () => {
    const l = CUES.launch.layers[0];
    expect(l.waves.map(w => WAVES[w].demo)).toEqual(['mWooshLarge1', 'mWooshLarge2', 'mWooshLarge3']);
    expect([l.highpass, l.maxTime, l.volume, CUES.launch.group, CUES.launch.space]).toEqual([0, 3, 1, 'many', 'listener']);
  });

  it('bump: the punch at +2.24 st and the armour clank from 0.2 s in at +5 st, volume 0.8', () => {
    const [punch, clank] = CUES.bump.layers;
    expect(WAVES[punch.waves[0]].demo).toBe('IMPACT_Punch_01_mono');
    expect([punch.pitch, punch.tempo, punch.maxTime, punch.volume, punch.highpass]).toEqual([2.24, 1, 1, 1, 0]);
    expect(WAVES[clank.waves[0]].demo).toBe('击中盔甲4');
    expect(WAVES[clank.waves[0]].start).toBe(0.2);
    expect([clank.pitch, clank.volume, clank.maxTime]).toEqual([5, 0.8, 1]);
    expect([CUES.bump.gain, CUES.bump.group, CUES.bump.space]).toEqual([1, 'default', 'world']);
  });

  it('swing: 挥剑 at tempo 0.8, +3 st, high-pass 500 Hz, volume 4', () => {
    const l = CUES.swing.layers[0];
    expect(WAVES[l.waves[0]].demo).toBe('挥剑');
    expect([l.tempo, l.pitch, l.highpass, l.volume, l.maxTime, CUES.swing.group]).toEqual([0.8, 3, 500, 4, 3, 'many']);
  });

  it('hit: the flesh transient from 0.35 s (volume 0.7, ±5 st) and the splatter 0.1 s later (tempo 1.51, ±5 st)', () => {
    const [flesh, splatter] = CUES.hit.layers;
    expect(WAVES[flesh.waves[0]].demo).toBe('剑击中肉体');
    expect(WAVES[flesh.waves[0]].start).toBe(0.35);
    expect([flesh.volume, flesh.pitchRandom, flesh.maxTime, flesh.delay, flesh.highpass]).toEqual([0.7, 5, 1, 0, 0]);
    expect(WAVES[splatter.waves[0]].demo).toBe('水爆炸');
    expect([splatter.tempo, splatter.pitchRandom, splatter.delay, splatter.highpass, splatter.volume]).toEqual([1.51, 5, 0.1, 500, 1]);
    // OnFinished comes from the flesh layer (1.01 s)
    expect(CUES.hit.finishLayer).toBe(0);
    expect(nominalPlan(CUES.hit).lifetime).toBeCloseTo(1.01, 9);
  });

  it('death: 流血 at volume 0.7, 最长时间 1 s', () => {
    const l = CUES.death.layers[0];
    expect(WAVES[l.waves[0]].demo).toBe('流血');
    expect([l.volume, l.maxTime, l.highpass, CUES.death.group]).toEqual([0.7, 1, 0, 'many']);
  });

  it('step: 踩树叶2 with one U(1, 3) roll scaling volume 0.352 and pitch 1.04 st, 8 voices one per 0.2 s', () => {
    const l = CUES.step.layers[0];
    expect(WAVES[l.waves[0]].demo).toBe('踩树叶2');
    expect(l.roll).toEqual([1, 3]);
    expect(l.volume).toBeCloseTo(0.352, 5);
    expect(l.pitch).toBeCloseTo(1.04, 5);
    expect(GROUPS[CUES.step.group]).toMatchObject({ demo: '音效并发_脚步', maxCount: 8, retrigger: 0.2 });
  });

  it('charge: the cast chime at tempo 1.04, cut at 2 s, 2D', () => {
    const l = CUES.charge.layers[0];
    expect(WAVES[l.waves[0]].demo).toBe('Spell_PA_Judgement_Revamp_Cast_01');
    expect(l.tempo).toBeCloseTo(1.04, 5);
    expect(l.maxTime).toBeCloseTo(2, 5);
    expect(CUES.charge.space).toBe('screen');
  });

  it('every cue lives until its finishing layer’s envelope ends (attack 0.01 s + 最长时间)', () => {
    const lifetimes = Object.fromEntries(CUE_NAMES.map(c => [c, Number(nominalPlan(CUES[c]).lifetime.toFixed(4))])) as Record<CueName, number>;
    expect(lifetimes).toEqual({ launch: 3.01, bump: 1.01, swing: 3.01, hit: 1.01, death: 1.01, step: 1.01, charge: 2.01, block: 3.01, arrow: 3.01 });
    expect(PATCH).toEqual({ randomSemitones: 5, attack: 0.01 });
  });

  it('the concurrency assets', () => {
    expect(GROUPS.default).toMatchObject({ demo: '音效并发_默认', maxCount: 6, retrigger: 0 });
    expect(GROUPS.many).toMatchObject({ demo: '音效并发_大量', maxCount: 24, retrigger: 0.01 });
  });

  it('wind: storm loop at 15 × Speed st (Speed 0.63 at rest and on every knight leg), low-pass 1 kHz, gain 0.4 × Speed²', () => {
    expect(WIND.speed).toBeCloseTo(1700 / 2700, 12);
    expect(WIND.lowpass).toBe(1000);
    expect(WAVES[WIND.wave].demo).toBe('stormloop');
    const plan = windPlan(0);
    expect(plan.pitch).toBeCloseTo(15 * WIND.speed, 12);
    expect(plan.rate).toBeCloseTo(2 ** ((15 * WIND.speed) / 12), 12);
    expect(plan.gain).toBeCloseTo(0.4 * WIND.speed ** 2 * 10 ** (WAVES.storm.trimDb / 20), 12);
  });
});
