import { hashString } from '../core/rng.ts';
import { addBubbles, addGrains, addModes, addNoiseBand, addSweep, dice, env, fadeEdges, normalizePeak, saturate, seamlessLoop, type Bubble, type Grain, type Mode, type Samples } from './dsp.ts';

/**
 * The procedural stand-ins for the Demo's wave assets (dump raw/Game/CatapultHero/声音/原素材/*.json gives each
 * file's name, length and rate; the audio itself is not in the dump). Each keeps the role, length and layer job of
 * its file, reskinned for the beetle knight in a corrupted fungal crypt (art bible §9: only the skin changes).
 *
 * `render(sampleRate, pitch, time)` multiplies every frequency by `pitch` and every duration by `time`, so the
 * shared patch's pure pitch shift (音高) and its pitch-compensated tempo (播放速度) are exact; the patch's random
 * ±5 semitones are a resample (playbackRate) like UE's Wave Player. Waves are peak-normalized to 1 ("library
 * files"); `trimDb` is the level of the stand-in file, set by measured RMS (README, balance table). A wave whose
 * Demo cue starts playback later (Start Time) begins at that point: `start` documents it. `rate` 0.5 renders at
 * half the context rate: the Demo's 22.05 kHz files, and the storm, which only ever plays through a 1 kHz low-pass.
 */

export type WaveId =
  | 'whoosh1'
  | 'whoosh2'
  | 'whoosh3'
  | 'punch'
  | 'clank'
  | 'swing'
  | 'flesh'
  | 'splatter'
  | 'splat'
  | 'step'
  | 'chime'
  | 'metalShield'
  | 'shield'
  | 'arrow'
  | 'storm';

export interface WaveDef {
  /** The Demo wave asset this one stands in for. */
  readonly demo: string;
  /** The Demo file's duration in seconds (dump). */
  readonly demoDuration: number;
  /** Where the Demo cue starts playing the file (Start Time); the procedural wave begins there. */
  readonly start: number;
  /** Render rate relative to the context's. */
  readonly rate: 1 | 0.5;
  /** Level of the stand-in file in dB relative to peak 1. */
  readonly trimDb: number;
  render(sampleRate: number, pitch: number, time: number): Samples;
}

const seedOf = (id: string, layer = 0): number => (hashString(`audio-wave:${id}`) + layer * 0x9e3779b1) >>> 0;
const alloc = (sampleRate: number, seconds: number): Samples => new Float32Array(Math.max(1, Math.ceil(seconds * sampleRate)));
const attacks = new Map<number, (t: number) => number>();
/** 1 − e^(−t/τ): a soft strike edge (cached per τ, so curves stay allocation-free). */
const attack = (seconds: number): ((t: number) => number) => {
  let curve = attacks.get(seconds);
  if (!curve) {
    curve = t => 1 - Math.exp(-t / seconds);
    attacks.set(seconds, curve);
  }
  return curve;
};
const TAU = 2 * Math.PI;

/**
 * A pass-by of air: a wide body band, an air band and a narrow resonance whose centres follow the swell (the
 * audible sweep), plus a hiss edge.
 */
function whoosh(id: WaveId, duration: number, peak: number, body: [number, number], air: [number, number], flutterHz: number): WaveDef['render'] {
  return (sr, p, s) => {
    const D = duration * s;
    const out = alloc(sr, D);
    const a = env.swell(peak * s, D, 1.7);
    const follow = (lo: number, hi: number) => (t: number) => (lo + (hi - lo) * Math.pow(a(t), 0.8)) * p;
    // the sapphire scarf flutters in the rush: a light amplitude ripple on the air band
    const flutter = (t: number) => 1 + 0.12 * Math.sin((TAU * flutterHz * t) / s);
    addNoiseBand(out, sr, { seed: seedOf(id, 0), from: 0, to: D, mode: 'bp', frequency: follow(body[0], body[1]), q: 0.8, amp: t => 0.9 * a(t) });
    addNoiseBand(out, sr, { seed: seedOf(id, 1), from: 0, to: D, mode: 'bp', frequency: follow(air[0], air[1]), q: 1.3, amp: t => 0.5 * a(t) * flutter(t) });
    addNoiseBand(out, sr, { seed: seedOf(id, 3), from: 0, to: D, mode: 'bp', frequency: follow(air[0] * 0.7, air[1] * 0.9), q: 3.5, amp: t => 0.35 * Math.pow(a(t), 1.2) });
    addNoiseBand(out, sr, { seed: seedOf(id, 2), from: 0, to: D, mode: 'bp', frequency: () => 4500 * p, q: 0.7, amp: t => 0.06 * Math.pow(a(t), 1.6) });
    fadeEdges(out, sr, 0.002, 0.012);
    normalizePeak(out);
    return out;
  };
}

/** IMPACT_Punch_01 → the chitin knock: a falling thump, a hollow shell's short modes, a slap and a mid smack. */
function punch(sr: number, p: number, s: number): Samples {
  const D = 0.377 * s;
  const out = alloc(sr, D);
  addSweep(out, sr, { from: 0, to: D, frequency: t => (75 + 115 * Math.exp(-t / (0.016 * s))) * p, amp: t => 0.85 * Math.exp(-t / (0.075 * s)) * attack(0.0006)(t), h2: 0.3, h3: 0.12 });
  const shell: Mode[] = [
    [1, 1, 0.05],
    [1.62, 0.75, 0.038],
    [2.35, 0.55, 0.028],
    [3.18, 0.4, 0.02],
    [4.4, 0.3, 0.014],
  ].map(([r, amp, tau]) => ({ frequency: 520 * r * p, amp: amp * 0.6, tau: tau * s }));
  addModes(out, sr, 0, shell, 0.0004);
  addNoiseBand(out, sr, { seed: seedOf('punch', 0), from: 0, to: 0.06 * s, mode: 'bp', frequency: () => 2200 * p, q: 1.2, amp: t => 0.4 * Math.exp(-t / (0.006 * s)) * attack(0.0003)(t) });
  addNoiseBand(out, sr, { seed: seedOf('punch', 2), from: 0, to: 0.15 * s, mode: 'bp', frequency: () => 900 * p, q: 1, amp: t => 0.35 * Math.exp(-t / (0.018 * s)) * attack(0.0004)(t) });
  addNoiseBand(out, sr, { seed: seedOf('punch', 1), from: 0, to: 0.25 * s, mode: 'bp', frequency: () => 300 * p, q: 1.5, amp: t => 0.3 * Math.exp(-t / (0.03 * s)) * attack(0.001)(t) });
  saturate(out, 1.6);
  fadeEdges(out, sr, 0, 0.02);
  normalizePeak(out);
  return out;
}

/**
 * 击中盔甲4 from its Start Time 0.2 s → the carapace clank: the pearl plates' inharmonic ring, already 0.2 s
 * into its decay (the knock layer carries the strike), beating pairs for the shimmer, a buzzing plate rattle.
 */
function clank(sr: number, p: number, s: number, duration = 1.007 - 0.2, start = 0.2): Samples {
  const D = duration * s;
  const out = alloc(sr, D);
  const d = dice(seedOf('clank'));
  const ratios = [1, 1.53, 2.21, 2.72, 3.47, 4.31, 5.62];
  const amps = [1, 0.8, 0.62, 0.55, 0.4, 0.3, 0.2];
  const taus = [0.3, 0.24, 0.2, 0.17, 0.14, 0.11, 0.08];
  const ring: Mode[] = [];
  ratios.forEach((r, i) => {
    const level = amps[i] * Math.exp(-start / taus[i]) * 0.5;
    const beat = d.range(0.6, 1.8);
    for (const sign of [-1, 1]) ring.push({ frequency: (610 * r + sign * beat) * p, amp: level, tau: taus[i] * s, phase: d.range(0, TAU) });
  });
  addModes(out, sr, 0, ring, 0);
  const buzz = d.range(0, TAU);
  addNoiseBand(out, sr, {
    seed: seedOf('clank', 1),
    from: 0,
    to: D,
    mode: 'bp',
    frequency: () => 2600 * p,
    q: 2.5,
    amp: t => 0.18 * Math.exp(-t / (0.12 * s)) * (0.6 + 0.4 * Math.sin((TAU * 47 * t) / s + buzz)),
  });
  for (const [at, amp] of [[0.025, 0.12], [0.07, 0.09], [0.135, 0.06]] as const) {
    addModes(out, sr, at * s, ratios.slice(2, 6).map(r => ({ frequency: 610 * r * p * d.range(0.97, 1.03), amp, tau: d.range(0.01, 0.02) * s })), 0.0003);
  }
  fadeEdges(out, sr, 0.003, 0.03);
  normalizePeak(out);
  return out;
}

/**
 * 挥剑 → the whirlwind slash: the spin passes the blade by twice, each a narrow resonant swish rising and falling
 * with its swell over a wider body, plus an air edge and a faint blade ring.
 */
function swing(sr: number, p: number, s: number): Samples {
  const D = 0.853 * s;
  const out = alloc(sr, D);
  const passes = [
    { at: 0, peak: 0.075, end: 0.28, lo: 1100, hi: 4200, amp: 1 },
    { at: 0.13, peak: 0.085, end: 0.3, lo: 950, hi: 3600, amp: 0.7 },
  ];
  passes.forEach((pass, i) => {
    const b = env.swell(pass.peak * s, pass.end * s, 2);
    const centre = (t: number) => (pass.lo + (pass.hi - pass.lo) * b(t)) * p;
    const from = pass.at * s;
    const to = (pass.at + pass.end) * s;
    addNoiseBand(out, sr, { seed: seedOf('swing', i * 2), from, to, mode: 'bp', frequency: centre, q: 4.5, amp: t => pass.amp * b(t) });
    addNoiseBand(out, sr, { seed: seedOf('swing', i * 2 + 1), from, to, mode: 'bp', frequency: t => 0.6 * centre(t), q: 1.2, amp: t => 0.5 * pass.amp * b(t) });
    addNoiseBand(out, sr, { seed: seedOf('swing', 8 + i), from, to, mode: 'bp', frequency: () => 6500 * p, q: 0.8, amp: t => 0.05 * pass.amp * b(t) });
  });
  addModes(out, sr, 0.03 * s, [3300, 4900, 6700].map((f, i) => ({ frequency: f * p, amp: [0.05, 0.03, 0.02][i], tau: [0.2, 0.15, 0.1][i] * s })), 0.002);
  addNoiseBand(out, sr, { seed: seedOf('swing', 5), from: 0.28 * s, to: D, mode: 'bp', frequency: () => 1500 * p, q: 0.7, amp: t => 0.06 * Math.exp(-t / (0.15 * s)) * attack(0.02 * s)(t) });
  saturate(out, 1.3);
  fadeEdges(out, sr, 0.002, 0.05);
  normalizePeak(out);
  return out;
}

/**
 * 剑击中肉体 from its Start Time 0.35 s → the blade into fungal flesh: the edge going in, a mid thwack, a thick
 * thunk, a wet resonant squelch, torn fibres and a few closing bubbles.
 */
function flesh(sr: number, p: number, s: number): Samples {
  const D = 0.5 * s;
  const out = alloc(sr, D);
  const d = dice(seedOf('flesh'));
  addNoiseBand(out, sr, { seed: seedOf('flesh', 0), from: 0, to: 0.06 * s, mode: 'bp', frequency: () => 3200 * p, q: 0.9, amp: t => 0.35 * Math.exp(-t / (0.007 * s)) * attack(0.0003)(t) });
  addNoiseBand(out, sr, { seed: seedOf('flesh', 3), from: 0, to: 0.12 * s, mode: 'bp', frequency: () => 1100 * p, q: 1.3, amp: t => 0.5 * Math.exp(-t / (0.014 * s)) * attack(0.0004)(t) });
  addSweep(out, sr, { from: 0, to: D, frequency: t => (105 + 125 * Math.exp(-t / (0.02 * s))) * p, amp: t => 0.85 * Math.exp(-t / (0.07 * s)) * attack(0.0008)(t), h2: 0.35, h3: 0.15 });
  addNoiseBand(out, sr, {
    seed: seedOf('flesh', 1),
    from: 0,
    to: D,
    mode: 'bp',
    frequency: t => (340 + 620 * Math.exp(-t / (0.05 * s))) * p,
    q: 2.5,
    amp: t => 0.85 * Math.exp(-t / (0.065 * s)) * (1 + 0.35 * Math.sin((TAU * 31 * t) / s)) * attack(0.002)(t),
  });
  const fibres: Grain[] = Array.from({ length: 6 }, () => ({ t: d.range(0.005, 0.07) * s, dur: 0.002 * s, frequency: d.range(1500, 3200) * p, q: 2, amp: 0.25 }));
  addGrains(out, sr, seedOf('flesh', 2), fibres);
  const bubbles: Bubble[] = Array.from({ length: 6 }, (_, i) => ({
    t: (0.02 + i * 0.033 + d.range(0, 0.02)) * s,
    frequency: d.range(300, 700) * p,
    rise: 1.6,
    dur: d.range(0.015, 0.03) * s,
    amp: 0.3 - i * 0.03,
  }));
  addBubbles(out, sr, bubbles);
  saturate(out, 2);
  fadeEdges(out, sr, 0, 0.04);
  normalizePeak(out);
  return out;
}

/** 水爆炸 → the ichor splatter: a bright wet slap sweeping down, spray drops and ticks, and a puff of spores. */
function splatter(sr: number, p: number, s: number): Samples {
  const D = 0.643 * s;
  const out = alloc(sr, D);
  const d = dice(seedOf('splatter'));
  addNoiseBand(out, sr, {
    seed: seedOf('splatter', 0),
    from: 0,
    to: D,
    mode: 'bp',
    frequency: t => (900 + 1500 * Math.exp(-t / (0.07 * s))) * p,
    q: 1.1,
    amp: t => Math.exp(-t / (0.11 * s)) * attack(0.002)(t) * Math.max(0, 1 - t / D),
  });
  addNoiseBand(out, sr, { seed: seedOf('splatter', 1), from: 0, to: 0.35 * s, mode: 'bp', frequency: () => 450 * p, q: 1, amp: t => 0.4 * Math.exp(-t / (0.05 * s)) * attack(0.002)(t) });
  const drops: Bubble[] = [];
  const ticks: Grain[] = [];
  for (let i = 0; i < 18; i++) {
    const t = d.range(0.04, 0.5);
    const fade = Math.exp(-t / 0.2);
    if (d.next() < 0.6) drops.push({ t: t * s, frequency: d.range(900, 2600) * p, rise: 1.4, dur: d.range(0.008, 0.015) * s, amp: 0.25 * fade });
    else ticks.push({ t: t * s, dur: d.range(0.002, 0.004) * s, frequency: d.range(3000, 6000) * p, q: 3, amp: 0.3 * fade });
  }
  addBubbles(out, sr, drops);
  addGrains(out, sr, seedOf('splatter', 2), ticks);
  const puff = env.swell(0.015 * s, 0.2 * s);
  addNoiseBand(out, sr, { seed: seedOf('splatter', 3), from: 0, to: 0.2 * s, mode: 'hp', frequency: () => 2500 * p, q: 0.7, amp: t => 0.15 * puff(t) });
  saturate(out, 1.8);
  fadeEdges(out, sr, 0, 0.03);
  normalizePeak(out);
  return out;
}

/** 流血 → the death's spore burst: a fleshy pop, a wet plop and squelch, the airy spore "pfff", then bubbles. */
function splat(sr: number, p: number, s: number): Samples {
  const D = 1.184 * s;
  const out = alloc(sr, D);
  const d = dice(seedOf('splat'));
  addSweep(out, sr, { from: 0, to: 0.5 * s, frequency: t => (90 + 170 * Math.exp(-t / (0.015 * s))) * p, amp: t => 0.75 * Math.exp(-t / (0.06 * s)) * attack(0.0008)(t), h2: 0.3, h3: 0.1 });
  addNoiseBand(out, sr, { seed: seedOf('splat', 0), from: 0, to: 0.4 * s, mode: 'bp', frequency: t => (300 + 350 * Math.exp(-t / (0.03 * s))) * p, q: 3, amp: t => 0.6 * Math.exp(-t / (0.05 * s)) * attack(0.001)(t) });
  addNoiseBand(out, sr, {
    seed: seedOf('splat', 1),
    from: 0.02 * s,
    to: D,
    mode: 'bp',
    frequency: t => (380 + 720 * Math.exp(-t / (0.1 * s))) * p,
    q: 2.2,
    amp: t => 0.55 * Math.exp(-t / (0.18 * s)) * attack(0.01 * s)(t) * (1 + 0.4 * Math.sin((TAU * 22 * t) / s)),
  });
  const spores = env.swell(0.025 * s, 0.6 * s);
  addNoiseBand(out, sr, { seed: seedOf('splat', 2), from: 0.03 * s, to: 0.63 * s, mode: 'bp', frequency: () => 4000 * p, q: 0.6, amp: t => 0.35 * spores(t) });
  const bubbles: Bubble[] = Array.from({ length: 8 }, (_, i) => ({
    t: (0.15 + i * 0.1 + d.range(0, 0.05)) * s,
    frequency: d.range(350, 900) * p,
    rise: 1.5,
    dur: 0.02 * s,
    amp: 0.25 - i * 0.025,
  }));
  addBubbles(out, sr, bubbles);
  saturate(out, 1.8);
  fadeEdges(out, sr, 0, 0.05);
  normalizePeak(out);
  return out;
}

/** 踩树叶2 → the fungal crunch: dense crackle of dry gills, a soft squish of moss, a short rustle. */
function step(sr: number, p: number, s: number): Samples {
  const D = 0.524 * s;
  const out = alloc(sr, D);
  const d = dice(seedOf('step'));
  const grains: Grain[] = [];
  const tail = 1 - Math.exp(-0.2 / 0.06);
  for (let i = 0; i < 55; i++) {
    const t = -0.06 * Math.log(1 - d.next() * tail);
    grains.push({ t: t * s, dur: d.range(0.0006, 0.003) * s, frequency: d.logRange(1200, 4500) * p, q: d.range(1.5, 3), amp: d.range(0.3, 1) * Math.exp(-t / 0.08) });
  }
  for (let i = 0; i < 25; i++) {
    const t = d.range(0.15, 0.45);
    grains.push({ t: t * s, dur: d.range(0.001, 0.0025) * s, frequency: d.logRange(1800, 6000) * p, q: 2, amp: 0.12 * Math.exp(-(t - 0.15) / 0.12) });
  }
  addGrains(out, sr, seedOf('step', 0), grains);
  const squish = env.ad(0.003 * s, 0.035 * s);
  addNoiseBand(out, sr, { seed: seedOf('step', 1), from: 0, to: 0.25 * s, mode: 'bp', frequency: () => 380 * p, q: 1.2, amp: t => 0.4 * squish(t) });
  fadeEdges(out, sr, 0.0005, 0.03);
  normalizePeak(out);
  return out;
}

/** Spell_PA_Judgement_Revamp_Cast_01 → the spore-light chime: a rising cast swish, a bright arpeggiated chime, glints, a glow. */
function chime(sr: number, p: number, s: number): Samples {
  const D = 2.796 * s;
  const out = alloc(sr, D);
  const d = dice(seedOf('chime'));
  addNoiseBand(out, sr, {
    seed: seedOf('chime', 0),
    from: 0,
    to: 1.6 * s,
    mode: 'bp',
    frequency: t => (1800 + 3700 * Math.min(1, t / (0.25 * s))) * p,
    q: 1.4,
    amp: t => 0.35 * (t < 0.2 * s ? (t / (0.2 * s)) ** 2 : Math.exp(-(t - 0.2 * s) / (0.35 * s))),
  });
  [1318.5, 1975.5, 2637.0].forEach((f, i) => {
    const level = [1, 0.8, 0.6][i] * 0.15;
    const partials: Mode[] = [
      { frequency: (f - 1.2) * p, amp: level, tau: 0.9 * s },
      { frequency: (f + 1.2) * p, amp: level, tau: 0.9 * s },
      { frequency: f * 2.76 * p, amp: level * 0.7, tau: 0.3 * s },
      { frequency: f * 5.4 * p, amp: level * 0.3, tau: 0.12 * s },
    ];
    addModes(out, sr, (0.16 + i * 0.03) * s, partials, 0.0015);
  });
  for (let i = 0; i < 14; i++) {
    addModes(out, sr, d.range(0.25, 1.4) * s, [{ frequency: d.range(3000, 8000) * p, amp: d.range(0.04, 0.1), tau: d.range(0.04, 0.09) * s }], 0.001);
  }
  const glow = env.swell(0.6 * s, D, 1.4);
  for (const f of [659.3, 987.8]) {
    addSweep(out, sr, { from: 0.2 * s, to: D, frequency: () => f * p, amp: t => 0.12 * glow(t + 0.2 * s) * (1 + 0.3 * Math.sin((TAU * 6 * t) / s)) });
  }
  fadeEdges(out, sr, 0.002, 0.08);
  normalizePeak(out);
  return out;
}

/** Loop length of stormloop in seconds (dump: 206855 samples at 48 kHz). */
export const STORM_LOOP_SECONDS = 4.309479;

/**
 * stormloop → the crypt draught: a pink-noise body and a whistling howl under periodic gusts (whole cycles per
 * loop) and a hiss edge, made seamless by a crossfade. Rendered at rate 1; the loop's playbackRate and low-pass
 * do the rest, as in 音效_风循环.
 */
function storm(sr: number): Samples {
  const L = STORM_LOOP_SECONDS;
  const loop = Math.round(L * sr);
  const out = new Float32Array(loop + Math.round(0.25 * sr));
  const d = dice(seedOf('storm'));
  const ph = [0, 0, 0].map(() => d.range(0, TAU));
  const w = TAU / L;
  // slow swells only: played 1.7× faster, a loop-length cycle is a 2.5-s swell; faster harmonics would throb
  const gust = (t: number) => 0.62 + 0.22 * Math.sin(w * t + ph[0]) + 0.1 * Math.sin(2 * w * t + ph[1]);
  const to = out.length / sr;
  addNoiseBand(out, sr, { seed: seedOf('storm', 0), from: 0, to, mode: 'bp', colour: 'pink', frequency: t => 220 * (1 + 0.4 * (gust(t) - 0.62)), q: 0.7, amp: gust });
  addNoiseBand(out, sr, { seed: seedOf('storm', 1), from: 0, to, mode: 'bp', colour: 'pink', frequency: t => 300 + 60 * Math.sin(w * t + ph[2]), q: 9, amp: t => 0.25 * gust(t) ** 2 });
  addNoiseBand(out, sr, { seed: seedOf('storm', 2), from: 0, to, mode: 'hp', frequency: () => 2000, q: 0.7, amp: t => 0.15 * gust(t) });
  const result = seamlessLoop(out, loop);
  normalizePeak(result);
  return result;
}

export const WAVES: Readonly<Record<WaveId, WaveDef>> = {
  // Source durations/rates, with the already-approved carapace ring/air synthesis. These are new generated
  // timbres, not recovered original PCM; no waveform equivalence or original listening comparison is claimed.
  metalShield: { demo: 'MetalShieldBlock3', demoDuration: 0.5761451, start: 0, rate: 0.5, trimDb: -4.5, render: (sr,p,s) => clank(sr,p,s,0.5761451,0) },
  shield: { demo: '盾牌', demoDuration: 1.2026985, start: 0, rate: 1, trimDb: -4.5, render: (sr,p,s) => clank(sr,p,s,1.2026985,0) },
  arrow: { demo: '飞箭', demoDuration: 0.41902494, start: 0, rate: 1, trimDb: 1.1, render: whoosh('arrow',0.41902494,0.075,[240,650],[950,2700],39) },
  whoosh1: { demo: 'mWooshLarge1', demoDuration: 0.45278913, start: 0, rate: 0.5, trimDb: 1.8, render: whoosh('whoosh1', 0.45278913, 0.16, [170, 480], [650, 1900], 31) },
  whoosh2: { demo: 'mWooshLarge2', demoDuration: 0.3628118, start: 0, rate: 0.5, trimDb: 1.5, render: whoosh('whoosh2', 0.3628118, 0.12, [200, 560], [800, 2300], 35) },
  whoosh3: { demo: 'mWooshLarge3', demoDuration: 0.24231292, start: 0, rate: 0.5, trimDb: 1.1, render: whoosh('whoosh3', 0.24231292, 0.075, [240, 650], [950, 2700], 39) },
  punch: { demo: 'IMPACT_Punch_01_mono', demoDuration: 0.37653062, start: 0, rate: 1, trimDb: -4.5, render: punch },
  clank: { demo: '击中盔甲4', demoDuration: 1.0069388, start: 0.2, rate: 0.5, trimDb: -4.5, render: clank },
  swing: { demo: '挥剑', demoDuration: 0.85333335, start: 0, rate: 1, trimDb: -10.6, render: swing },
  flesh: { demo: '剑击中肉体', demoDuration: 4.885964, start: 0.35, rate: 1, trimDb: 2.7, render: flesh },
  splatter: { demo: '水爆炸', demoDuration: 0.6433333, start: 0, rate: 1, trimDb: -4.9, render: splatter },
  splat: { demo: '流血', demoDuration: 1.1840136, start: 0, rate: 1, trimDb: 1.5, render: splat },
  step: { demo: '踩树叶2', demoDuration: 0.52351475, start: 0, rate: 1, trimDb: -0.5, render: step },
  chime: { demo: 'Spell_PA_Judgement_Revamp_Cast_01', demoDuration: 2.7962132, start: 0, rate: 1, trimDb: 1.4, render: chime },
  storm: { demo: 'stormloop', demoDuration: STORM_LOOP_SECONDS, start: 0, rate: 0.5, trimDb: -2.7, render: sr => storm(sr) },
};
