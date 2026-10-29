import { describe, expect, it } from 'vitest';
import { tilesToUu, uuToTiles } from '../../src/core/launch/units.ts';
import { STEAL, STEAL_STOPS } from '../../src/audio/engine.ts';
import { createAudio, type Audio } from '../../src/audio/index.ts';
import { attenuation } from '../../src/audio/patch.ts';
import { stealCut } from '../../src/audio/qa/analysis.ts';
import { pingPongSequence } from '../../src/audio/qa/sequence.ts';
import { mockContext, type MockNode, type MockParam } from './mock-audio.ts';

const FRAME = 1 / 60;
/** The hero moving east at 2600 uu/s, as on a knight leg (tiles). */
const hero = (frame: number) => ({ x: 4 + uuToTiles(2600 * FRAME * frame), z: 3 });

/** What one voice was built from: its chains' distance gains and pans (sum → pan → out), its sources. */
interface Built {
  readonly out: MockParam[];
  readonly pan: MockParam[];
  readonly sources: MockNode[];
}

interface Steal {
  readonly voice: number;
  readonly t: number;
  /** ctx.calls index before the play that stole it. */
  readonly mark: number;
}

/** A running mock context and an audio whose play() records the nodes of every voice and every steal. */
async function rig() {
  const ctx = mockContext({ sampleRate: 8000 });
  const audio = createAudio({ seed: 1, context: () => ctx, now: () => ctx.currentTime, prewarm: false });
  await audio.unlock();
  const voices = new Map<number, Built>();
  const steals: Steal[] = [];
  const tracked = Object.create(audio) as Audio;
  tracked.play = (cue, opts) => {
    const from = ctx.nodes.length;
    const mark = ctx.calls.length;
    audio.play(cue, opts);
    const { params } = audio.events[audio.events.length - 1];
    const made = ctx.nodes.slice(from);
    const panners = made.filter(n => n.kind === 'panner');
    if (params.played) voices.set(params.voice as number, { out: panners.map(p => p.outputs[0].param('gain')), pan: panners.map(p => p.param('pan')), sources: made.filter(n => n.kind === 'source') });
    if (params.evicted != null) steals.push({ voice: params.evicted as number, t: ctx.currentTime, mark });
  };
  const after = (mark: number, target: object, op?: string) => ctx.calls.slice(mark).filter(c => c.target === target && (!op || c.op === op));
  /** Everything scheduled on a stolen voice from its steal on: only the fade, and one stop per source. */
  const expectFadedOut = (s: Steal) => {
    const v = voices.get(s.voice);
    expect(v, `voice ${s.voice}`).toBeDefined();
    for (const out of v?.out ?? []) {
      expect(after(s.mark, out).map(c => [c.op, ...c.args])).toEqual([
        ['gain.gain.cancelScheduledValues', s.t],
        ['gain.gain.setTargetAtTime', 0, s.t, STEAL],
      ]);
    }
    for (const pan of v?.pan ?? []) expect(after(s.mark, pan)).toHaveLength(0);
    for (const src of v?.sources ?? []) expect(after(s.mark, src, 'source.stop').map(c => c.args[0])).toEqual([s.t + STEAL * STEAL_STOPS]);
  };
  return { ctx, audio: tracked, voices, steals, after, expectFadedOut };
}

describe('voice stealing (concurrency eviction)', () => {
  it('a stolen voice fades to silence while the listener moves every frame, and only then stops', async () => {
    const { ctx, audio, voices, steals, after, expectFadedOut } = await rig();

    // six contacts fill 默认 (MaxCount 6); the listener follows the hero every frame
    for (let f = 0; f < 6; f++) {
      ctx.currentTime = f * FRAME;
      audio.play('bump', hero(f));
      audio.setListener(hero(f).x, hero(f).z);
    }
    expect([...voices.values()].every(v => v.out.length === 1 && v.sources.length === 2)).toBe(true);

    // the seventh steals the farthest one (the oldest: the hero has moved on); the frame's listener update follows
    ctx.currentTime = 6 * FRAME;
    const mark = ctx.calls.length;
    audio.play('bump', hero(6));
    expect(steals).toEqual([{ voice: 1, t: 6 * FRAME, mark }]);
    audio.setListener(hero(6).x, hero(6).z);
    for (let f = 7; f <= 10; f++) {
      ctx.currentTime = f * FRAME;
      audio.setListener(hero(f).x, hero(f).z);
    }
    expectFadedOut(steals[0]);

    // the voices still playing glide on every listener update, to their attenuation at the new distance
    const listener = hero(10);
    for (let id = 2; id <= 6; id++) {
      const v = voices.get(id) as Built;
      const glides = after(mark, v.out[0], 'gain.gain.setTargetAtTime');
      expect(glides).toHaveLength(5);
      const place = hero(id - 1);
      expect(glides.at(-1)?.args[0]).toBeCloseTo(attenuation(tilesToUu(Math.hypot(place.x - listener.x, place.z - listener.z))), 9);
      expect(after(mark, v.pan[0], 'panner.pan.setTargetAtTime')).toHaveLength(5);
    }

    // teardown steals the rest; the stolen voice is not stopped twice
    const end = ctx.calls.length;
    audio.dispose();
    for (const s of (voices.get(1) as Built).sources) expect(after(end, s, 'source.stop')).toHaveLength(0);
    for (let id = 2; id <= 7; id++) expect(after(end, (voices.get(id) as Built).out[0]).map(c => c.op)).toEqual(['gain.gain.cancelScheduledValues', 'gain.gain.setTargetAtTime']);
  });

  it('the ping-pong launch between two enemies steals 默认 voices on its last two contacts, every one faded out', async () => {
    const { ctx, audio, steals, expectFadedOut } = await rig();
    for (const step of pingPongSequence()) {
      ctx.currentTime = step.t;
      step.run(audio);
    }
    expect(steals.length).toBeGreaterThanOrEqual(4);
    steals.forEach(expectFadedOut);
  });

  it('the render check tells a cut from a fade (qa/analysis.ts stealCut)', () => {
    const SR = 48000;
    const [steal, stop] = [0.1, 0.1 + STEAL * STEAL_STOPS];
    /** A 440-Hz voice over a quiet room tail, stolen at `steal`: cut at `stop`, or faded first as the engine does. */
    const voice = (fade: boolean): Float32Array => {
      let n = 1;
      const x = new Float32Array(SR / 4);
      for (let i = 0; i < x.length; i++) {
        const t = i / SR;
        n = (n * 1664525 + 1013904223) >>> 0;
        const level = t < steal || !fade ? 1 : Math.exp(-(t - steal) / STEAL);
        x[i] = (t < stop ? 0.3 * Math.sin(2 * Math.PI * 440 * t) * level : 0) + 0.002 * (n / 2 ** 31 - 1);
      }
      return x;
    };
    const cut = stealCut([voice(false)], SR, steal, stop);
    const faded = stealCut([voice(true)], SR, steal, stop);
    expect(cut.beforeDb).toBeCloseTo(faded.beforeDb, 6);
    expect(cut.residualDb).toBeGreaterThan(-3);
    expect(cut.stepDb).toBeGreaterThan(20);
    expect(faded.residualDb).toBeLessThan(-40);
    expect(faded.stepDb).toBeLessThan(3);
  });
});
