import { createAudio, CUE_NAMES, CUES, type Audio, type AudioEvent } from '../../audio/index.ts';
import { encodeWav, measure, mixDown, stealCut, stft, type CutMetrics, type Metrics } from '../../audio/qa/analysis.ts';
import { OUTPUT_LATENCY, renderCue, renderSteal, renderTimeline, renderWind, STEAL_CHECK, type Rendered, type Timed } from '../../audio/qa/offline.ts';
import { launchSequence, PINGPONG_SECONDS, pingPongSequence, SEQUENCE_SECONDS } from '../../audio/qa/sequence.ts';
import { addPixelOverlay, BONE_DIM, WHITE } from '../../game/overlay.ts';
import { defineScene } from '../types.ts';

/**
 * The launch's sounds (src/audio): a button per cue, "launch sequence" (one Demo launch over the wind loop,
 * src/audio/qa/sequence.ts), "ping-pong launch" (between two enemies: 音效并发_默认 overflows and steals voices) and
 * the wind toggle. The overlay draws the audio event log, a row per cue (filled = played, ring = dropped by
 * concurrency or while locked), the last 4 s. ?render=1 renders every cue at its nominal plan and both launches
 * offline, shows their spectrograms (marks: × = the play stole a voice), checks how a stolen voice ends (steal: one
 * voice stolen while the listener moves, nothing else playing) and publishes WAV, JSON and PNG on window.__audioSfx
 * (tests/audio-sfx/render.mjs writes them to disk).
 */

const ROWS: readonly string[] = [...CUE_NAMES, 'wind'];

interface State {
  audio: Audio;
  clock: number;
  sequence: { at: number; steps: Timed[] } | null;
  report: Report | null;
}

let st: State | null = null;

function button(label: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = label;
  b.style.cssText = 'display:block;width:100%;margin:2px 0;padding:4px 8px;font:12px monospace;color:#ece6d8;background:#141416;border:1px solid #6b665c;cursor:pointer';
  b.addEventListener('click', onClick);
  return b;
}

function panel(s: State): HTMLDivElement {
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:12px;top:12px;width:150px;padding:8px;background:#0b0b0cdd;border:1px solid #6b665c;z-index:4;font:12px monospace;color:#ece6d8';
  const gesture = (f: () => void) => () => {
    void s.audio.unlock();
    f();
  };
  for (const cue of CUE_NAMES) box.append(button(cue, gesture(() => s.audio.play(cue))));
  box.append(
    button('launch sequence', gesture(() => {
      s.sequence = { at: s.clock, steps: launchSequence() };
    })),
    button('ping-pong launch', gesture(() => {
      s.sequence = { at: s.clock, steps: pingPongSequence() };
    })),
  );
  let windOn = false;
  box.append(
    button('wind on/off', gesture(() => {
      windOn = !windOn;
      s.audio.loop('wind', windOn);
    })),
  );
  return box;
}

// ---- offline renders (?render=1) ----------------------------------------------------------------------------

interface Artifact {
  name: string;
  /** base64 */
  data: string;
}
interface CueReport {
  name: string;
  cue: string;
  demo: string;
  metrics: Metrics;
  events?: readonly AudioEvent[];
  /** The steal check: when the voice was stolen and its sources stopped (s, before the output latency), how it ended. */
  steal?: { at: number; stop: number } & CutMetrics;
}
interface Report {
  seed: number;
  cues: CueReport[];
  artifacts: Artifact[];
}

const base64 = (bytes: Uint8Array): string => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

const STOPS: readonly (readonly [number, number, number])[] = [[0, 0, 4], [40, 11, 84], [101, 21, 110], [159, 42, 99], [212, 72, 66], [245, 125, 21], [250, 193, 39], [252, 255, 164]];
const heat = (v: number): [number, number, number] => {
  const x = Math.min(1, Math.max(0, v)) * (STOPS.length - 1);
  const i = Math.min(STOPS.length - 2, Math.floor(x));
  const f = x - i;
  const mix = (c: number): number => Math.round(STOPS[i][c] * (1 - f) + STOPS[i + 1][c] * f);
  return [mix(0), mix(1), mix(2)];
};

/** Spectrogram (log frequency 40 Hz–20 kHz, 80 dB) above a 5-ms RMS envelope (−60..0 dBFS), with event marks. */
function spectrogram(r: Rendered, title: string, m: Metrics, marks: readonly { t: number; label: string }[]): HTMLCanvasElement {
  const W = 960;
  const SPEC = 300;
  const ENV = 70;
  const HEAD = 22;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = HEAD + SPEC + ENV + 16;
  const g = c.getContext('2d')!;
  g.fillStyle = '#0b0b0c';
  g.fillRect(0, 0, c.width, c.height);
  const mono = mixDown(r.channels);
  const seconds = mono.length / r.sampleRate;
  const { power, binHz, hopSeconds } = stft(mono, r.sampleRate, 2048, 256);
  let top = 1e-20;
  for (const f of power) for (const v of f) top = Math.max(top, v);
  const img = g.createImageData(W, SPEC);
  const fLo = 40;
  const fHi = Math.min(20000, r.sampleRate / 2);
  for (let x = 0; x < W; x++) {
    const frame = power[Math.min(power.length - 1, Math.floor(((x / W) * seconds) / hopSeconds))];
    for (let y = 0; y < SPEC; y++) {
      const hz = fLo * Math.pow(fHi / fLo, 1 - y / (SPEC - 1));
      const db = 10 * Math.log10((frame[Math.min(frame.length - 1, Math.round(hz / binHz))] + 1e-20) / top);
      const [cr, cg, cb] = heat((db + 80) / 80);
      const o = (y * W + x) * 4;
      img.data[o] = cr;
      img.data[o + 1] = cg;
      img.data[o + 2] = cb;
      img.data[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, HEAD);
  g.font = '12px monospace';
  g.fillStyle = '#ece6d8';
  g.fillText(`${title}   peak ${m.peakDb} dBFS   RMS ${m.rmsDb}   max50 ${m.rmsMax50Db}   centroid ${m.centroidHz} Hz   onset ${(m.onset * 1000).toFixed(1)} ms   length ${m.duration} s`, 6, 15);
  for (const hz of [100, 1000, 10000]) {
    const y = HEAD + (1 - Math.log(hz / fLo) / Math.log(fHi / fLo)) * (SPEC - 1);
    g.fillRect(0, y, 8, 1);
    g.fillText(hz >= 1000 ? `${hz / 1000}k` : `${hz}`, 10, y + 4);
  }
  const w5 = Math.round(0.005 * r.sampleRate);
  g.strokeStyle = '#76f2d2';
  g.beginPath();
  for (let x = 0; x < W; x++) {
    const i0 = Math.floor((x / W) * mono.length);
    let sum = 0;
    for (let i = i0; i < Math.min(mono.length, i0 + w5); i++) sum += mono[i] * mono[i];
    const y = HEAD + SPEC + ENV - Math.min(1, Math.max(0, (10 * Math.log10(sum / w5 + 1e-12) + 60) / 60)) * (ENV - 4);
    if (x) g.lineTo(x, y);
    else g.moveTo(x, y);
  }
  g.stroke();
  g.fillStyle = '#8a857a';
  for (let k = 0; k <= Math.floor(seconds * 10 + 1e-9); k++) {
    const x = ((k / 10) / seconds) * W;
    g.fillRect(x, HEAD + SPEC, 1, k % 5 ? 4 : 8);
    if (k % 5 === 0) g.fillText((k / 10).toFixed(1), x + 2, HEAD + SPEC + ENV + 12);
  }
  g.fillStyle = '#ffffff';
  // each label on the first row where it clears the previous one
  const rowEnds: number[] = [];
  for (const mk of marks) {
    const x = (mk.t / seconds) * W;
    g.fillRect(x, HEAD, 1, SPEC);
    let row = rowEnds.findIndex(end => end < x);
    if (row < 0) row = rowEnds.push(0) - 1;
    rowEnds[row] = x + 6 + g.measureText(mk.label).width;
    g.fillText(mk.label, x + 2, HEAD + 12 + row * 12);
  }
  return c;
}

async function renderAll(seed: number, gallery: HTMLDivElement): Promise<Report> {
  const report: Report = { seed, cues: [], artifacts: [] };
  const publish = (name: string, cue: string, demo: string, r: Rendered, extra: Pick<CueReport, 'events' | 'steal'> = {}): void => {
    const metrics = measure(r.channels, r.sampleRate);
    const { events, steal } = extra;
    const marks = steal
      ? [{ t: steal.at, label: 'steal' }, { t: steal.stop, label: 'stop' }]
      : (events ?? []).filter(e => e.params.played === true && e.cue !== 'step').map(e => ({ t: e.t, label: e.params.evicted != null ? `${e.cue}×` : e.cue }));
    const canvas = spectrogram(r, name, metrics, marks);
    const entry: CueReport = { name, cue, demo, metrics, ...extra };
    report.cues.push(entry);
    report.artifacts.push(
      { name: `${name}.wav`, data: base64(encodeWav(r.channels, r.sampleRate)) },
      { name: `${name}.png`, data: canvas.toDataURL('image/png').split(',')[1] },
      { name: `${name}.json`, data: base64(new TextEncoder().encode(JSON.stringify(entry, null, 1))) },
    );
    canvas.style.cssText = 'width:280px;height:auto;margin:2px;border:1px solid #333';
    gallery.append(canvas);
  };
  for (const cue of CUE_NAMES) {
    const variants = CUES[cue].layers[0].waves.length;
    const seconds = cue === 'charge' ? 3.6 : 2.6;
    for (let v = 0; v < variants; v++) publish(variants > 1 ? `${cue}-${v + 1}` : cue, cue, CUES[cue].demo, await renderCue(cue, v, seed, seconds));
  }
  publish('wind', 'wind', '音效_风循环', await renderWind(seed, 6));
  const { rendered, events } = await renderTimeline(launchSequence(), seed, SEQUENCE_SECONDS);
  publish('sequence', 'sequence', 'one launch (demo-juice §1)', rendered, { events });
  const pingPong = await renderTimeline(pingPongSequence(), seed, PINGPONG_SECONDS);
  publish('pingpong', 'pingpong', 'a launch between two enemies (音效并发_默认 steals)', pingPong.rendered, { events: pingPong.events });
  const stolen = await renderSteal(seed);
  const cut = stealCut(stolen.rendered.channels, stolen.rendered.sampleRate, stolen.stealAt + OUTPUT_LATENCY, stolen.stopAt + OUTPUT_LATENCY);
  publish('steal', 'hit', `a hit stolen ${STEAL_CHECK.age.toFixed(3)} s in, the listener moving every frame`, stolen.rendered, { steal: { at: stolen.stealAt, stop: stolen.stopAt, ...cut } });
  return report;
}

declare global {
  interface Window {
    __audioSfx?: Report;
    /** The scene's live audio, for QA automation (events, state). */
    __audio?: Audio;
  }
}

export default defineScene({
  name: 'audio-sfx',
  description: 'Procedural launch SFX: a button per cue, the launch sequence over the wind, ?render=1 offline renders',
  async setup(ctx) {
    const s: State = { audio: createAudio({ seed: ctx.seed }), clock: 0, sequence: null, report: null };
    st = s;
    window.__audio = s.audio;
    document.body.append(panel(s));
    if (ctx.params.get('render') === '1') {
      const gallery = document.createElement('div');
      gallery.style.cssText = 'position:fixed;left:180px;top:8px;width:1440px;height:470px;overflow:hidden;display:flex;flex-wrap:wrap;align-content:flex-start;z-index:3';
      document.body.append(gallery);
      s.report = await renderAll(ctx.seed, gallery);
      window.__audioSfx = s.report;
    }
    addPixelOverlay(ctx.renderer, c => {
      const events = s.report?.cues.find(e => e.name === 'sequence')?.events ?? s.audio.events;
      const live = !s.report;
      const span = live ? 4 : SEQUENCE_SECONDS;
      const right = live ? performance.now() / 1000 : SEQUENCE_SECONDS;
      const x0 = 110;
      const x1 = c.canvas.width - 20;
      const y0 = 300;
      c.g.font = '10px monospace';
      ROWS.forEach((row, i) => {
        const y = y0 + i * 26;
        c.line(x0, y, x1, y, BONE_DIM);
        c.g.fillStyle = WHITE;
        c.g.fillText(row, 40, y + 3);
        for (const e of events) {
          if (e.cue !== row) continue;
          const x = x1 - ((right - e.t) / span) * (x1 - x0);
          if (x < x0 || x > x1) continue;
          if (e.params.played === true) c.dot(x, y - 4, WHITE, 4);
          else c.ring(x, y - 3, 3, BONE_DIM, 0, true);
        }
      });
      for (let k = 0; k <= span * 2; k++) c.px(x1 - ((span - k / 2) / span) * (x1 - x0), y0 + ROWS.length * 26 - 14, WHITE, 1, k % 2 ? 3 : 6);
    });
  },
  update(_ctx, dt) {
    const s = st;
    if (!s) return;
    s.clock += dt;
    const seq = s.sequence;
    if (!seq) return;
    while (seq.steps.length && seq.steps[0].t <= s.clock - seq.at) seq.steps.shift()?.run(s.audio);
    if (!seq.steps.length) s.sequence = null;
  },
});
