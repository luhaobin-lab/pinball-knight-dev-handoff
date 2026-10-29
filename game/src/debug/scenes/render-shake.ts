import { HIT_STOP, hitStopDilation } from '../../core/launch/index.ts';
import type { CameraShakeKind, PassContext } from '../../render/api';
import { CAMERA_SHAKES, peakShakeUu, PX_PER_UU } from '../../render/camera-shake';
import { defineScene, type SceneContext } from '../types';
import play from './play';

/**
 * The Demo's camera shakes (renderer.fx.cameraShake, src/render/README.md "Camera shakes") over the reference
 * combat room (the play scene, built from src/game/reference-room.ts), which stands in its aim pose: play gets the
 * parameters without ?t and ?auto, so it never launches, and the canvas takes no clicks.
 * A scripted sequence repeats every 3 s (scene seconds): bounces at 0.20, 0.42, 0.61 and 0.78 (a wall chain that
 * keeps restarting 摄像机晃动_零点六), damage at 1.20 with its contact's hit-stop (shakeTime follows the core's
 * HIT_STOP track from the next frame: 0.2× for 7 frames, 1.5× for 3, then 1×) and a crit at 1.80. The readout shows
 * the running shakes and the summed screen offset; ?plot=1 draws the offset over time per kind instead.
 */

const EVENTS: readonly { at: number; kind: CameraShakeKind }[] = [
  { at: 0.2, kind: 'bounce' },
  { at: 0.42, kind: 'bounce' },
  { at: 0.61, kind: 'bounce' },
  { at: 0.78, kind: 'bounce' },
  { at: 1.2, kind: 'damage' },
  { at: 1.8, kind: 'crit' },
];
/** The sequence repeats with this period (s); the crit has blended out by 2.1 s. */
const PERIOD = 3;
/** The plot's time axis (s). */
const PLOT_SPAN = 2.4;

interface Sample {
  t: number;
  scale: number;
  /** FxState.shakeX / shakeY: internal pixels. */
  x: number;
  y: number;
  shakes: { kind: CameraShakeKind; weight: number; x: number; y: number }[];
}

declare global {
  interface Window {
    /** This scene's per-frame log of the current repetition, for measurement scripts. */
    __renderShake?: { readonly samples: readonly Sample[] };
  }
}

interface State {
  /** Scene time at which the current repetition started. */
  start: number;
  fired: number;
  /** Game seconds since the damage contact, advanced in dilated time, or null outside a hit-stop. */
  hitGame: number | null;
  /** This frame's shake-time scale and sequence time. */
  scale: number;
  t: number;
  samples: Sample[];
  seed: number;
  readout: HTMLElement;
  plot: HTMLCanvasElement | null;
}

let st: State | null = null;

async function setup(ctx: SceneContext): Promise<void> {
  // play scripts its shot whenever ?t or ?auto is set: hand it the same context without them
  const params = new URLSearchParams(ctx.params);
  params.delete('t');
  params.delete('auto');
  await play.setup(Object.create(ctx, { params: { value: params } }) as SceneContext);
  const { renderer } = ctx;
  renderer.canvas.style.pointerEvents = 'none';
  renderer.fx.shakeSeed(ctx.seed);

  const readout = document.createElement('pre');
  readout.style.cssText =
    'position:fixed;left:16px;top:16px;margin:0;padding:10px 14px;font:15px/1.45 ui-monospace,Consolas,monospace;' +
    'color:#f0efec;background:#0d0d0dd9;border:1px solid #383835;pointer-events:none;z-index:6;white-space:pre';
  document.body.append(readout);
  let plot: HTMLCanvasElement | null = null;
  if (ctx.params.get('plot') === '1') {
    plot = document.createElement('canvas');
    plot.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:7;pointer-events:none';
    document.body.append(plot);
  }
  const state: State = { start: 0, fired: 0, hitGame: null, scale: 1, t: 0, samples: [], seed: ctx.seed, readout, plot };
  st = state;
  window.__renderShake = {
    get samples() {
      return state.samples;
    },
  };
  renderer.addPass('overlay', { name: 'render-shake-readout', order: 1000, render: record });
}

function update(ctx: SceneContext, dt: number): void {
  play.update?.(ctx, dt);
  const s = st;
  if (!s) return;
  const fx = ctx.renderer.fx;
  if (ctx.time - s.start >= PERIOD - 1e-9) {
    s.start += PERIOD;
    s.fired = 0;
    s.hitGame = null;
    s.samples = [];
  }
  // this frame's dt ran before any event of this frame: the hit-stop applies from the next frame on
  s.scale = 1;
  if (s.hitGame !== null) {
    s.scale = hitStopDilation(s.hitGame);
    s.hitGame += dt * s.scale;
    if (s.hitGame >= HIT_STOP.duration) s.hitGame = null;
  }
  s.t = ctx.time - s.start;
  while (s.fired < EVENTS.length && s.t >= EVENTS[s.fired].at - 1e-9) {
    const e = EVENTS[s.fired++];
    fx.cameraShake(e.kind);
    if (e.kind === 'damage') s.hitGame = 0;
  }
  fx.shakeTime(s.scale);
}

/** Runs after fx.update in the overlay stage: logs this frame's offsets and refreshes the readout and the plot. */
function record(pctx: PassContext): void {
  const s = st;
  if (!s || pctx.dt === 0) return;
  const fx = pctx.fx;
  s.samples.push({
    t: s.t,
    scale: s.scale,
    x: fx.shakeX,
    y: fx.shakeY,
    shakes: fx.cameraShakes.map(r => ({ kind: r.kind, weight: r.weight, x: r.x, y: r.y })),
  });
  const sign = (v: number, digits: number): string => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(digits);
  const lines = [`t ${s.t.toFixed(3)} s   shake time ×${s.scale.toFixed(2)}${s.scale !== 1 ? ' (hit-stop)' : ''}`];
  for (const r of fx.cameraShakes) {
    lines.push(`${r.shake} ${r.kind.padEnd(6)} w ${r.weight.toFixed(2)}  x ${sign(r.x, 2)} uu  y ${sign(r.y, 2)} uu`);
  }
  if (fx.cameraShakes.length === 0) lines.push('no camera shake running');
  lines.push(`camera offset on screen  x ${sign(fx.shakeX, 0)} px  y ${sign(fx.shakeY, 0)} px  (internal pixels, snapped)`);
  s.readout.textContent = lines.join('\n');
  if (s.plot) drawPlot(s.plot, s.samples, s.seed);
}

const INK = { surface: '#1a1a19', page: '#0d0d0d', primary: '#f0efec', secondary: '#c3c2b7', muted: '#898781', grid: '#2c2c2a', base: '#383835' };
/** Categorical slots 1 and 2 (dark): screen x and screen y. */
const SERIES = { x: '#3987e5', y: '#d95926' };
const HIT_STOP_WASH = 'rgba(240,239,236,0.08)';

interface Panel {
  title: string;
  unit: string;
  max: number;
  value(sample: Sample): { x: number; y: number; envelope: number } | null;
}

function kindPanel(kind: CameraShakeKind, max: number): Panel {
  const call = CAMERA_SHAKES[kind];
  const peak = peakShakeUu(kind);
  return {
    title: `${kind} · ${call.shake} · outer radius ${call.outerRadius} · peak ${peak.toFixed(1)} uu`,
    unit: 'uu',
    max,
    value: sample => {
      const r = sample.shakes.find(v => v.kind === kind);
      return r ? { x: r.x, y: r.y, envelope: peak * r.weight } : { x: 0, y: 0, envelope: 0 };
    },
  };
}

const PANELS: readonly Panel[] = [
  kindPanel('bounce', 12),
  kindPanel('damage', 25),
  kindPanel('crit', 90),
  {
    title: `camera offset on screen · the classes summed × ${PX_PER_UU} px per uu, snapped to whole internal pixels`,
    unit: 'px',
    max: 32,
    value: sample => ({ x: sample.x, y: sample.y, envelope: 0 }),
  },
];

/** Small multiples, one per kind plus the summed screen offset; one shared time axis. */
function drawPlot(canvas: HTMLCanvasElement, samples: readonly Sample[], seed: number): void {
  const w = Math.round(window.innerWidth * devicePixelRatio);
  const h = Math.round(window.innerHeight * devicePixelRatio);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const g = canvas.getContext('2d')!;
  g.setTransform(w / 1920, 0, 0, h / 1080, 0, 0);
  g.fillStyle = INK.page;
  g.fillRect(0, 0, 1920, 1080);
  const left = 120;
  const right = 1860;
  const top = 146;
  const panelH = 186;
  const gap = 34;
  const tx = (t: number): number => left + (t / PLOT_SPAN) * (right - left);
  const font = (px: number, weight = 400): string => `${weight} ${px}px system-ui, "Segoe UI", sans-serif`;

  g.fillStyle = INK.primary;
  g.font = font(24, 600);
  g.fillText(`renderer.fx.cameraShake: the Demo's camera shakes over the scripted sequence (seed ${seed})`, left, 40);
  g.fillStyle = INK.secondary;
  g.font = font(16);
  g.fillText('Camera offset per kind in uu (x right, y up) with its ±peak × blend-weight envelope; the hit-stop slows the shakes.', left, 66);
  // legend
  const legend: [string, string][] = [
    [SERIES.x, 'x: camera-local Y (screen right)'],
    [SERIES.y, 'y: camera-local Z (screen up)'],
  ];
  let lx = left;
  g.font = font(15);
  for (const [color, label] of legend) {
    g.strokeStyle = color;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(lx, 91);
    g.lineTo(lx + 22, 91);
    g.stroke();
    g.fillStyle = INK.secondary;
    g.fillText(label, lx + 30, 96);
    lx += 40 + g.measureText(label).width + 28;
  }
  g.fillStyle = 'rgba(195,194,183,0.14)';
  g.fillRect(lx, 84, 22, 14);
  g.fillStyle = INK.secondary;
  g.fillText('envelope ±peak × weight', lx + 30, 96);
  lx += 30 + g.measureText('envelope ±peak × weight').width + 28;
  g.fillStyle = HIT_STOP_WASH;
  g.fillRect(lx, 84, 22, 14);
  g.fillStyle = INK.secondary;
  g.fillText('hit-stop (shake time ≠ 1×)', lx + 30, 96);

  const bottom = top + PANELS.length * panelH + (PANELS.length - 1) * gap;
  PANELS.forEach((_, k) => {
    g.fillStyle = INK.surface;
    g.fillRect(left, top + k * (panelH + gap), right - left, panelH);
  });
  // hit-stop windows, across every panel: a sample's scale covers the frame that ends at it
  g.fillStyle = HIT_STOP_WASH;
  for (let i = 0; i < samples.length; i++) {
    if (samples[i].scale === 1) continue;
    const t0 = i > 0 ? samples[i - 1].t : samples[i].t - 1 / 60;
    g.fillRect(tx(t0), top, tx(samples[i].t) - tx(t0), bottom - top);
  }

  PANELS.forEach((p, k) => {
    const y0 = top + k * (panelH + gap);
    const mid = y0 + panelH / 2;
    const vy = (v: number): number => mid - (Math.max(-p.max, Math.min(p.max, v)) / p.max) * (panelH / 2);
    // gridlines and y ticks at 0, ±max/2, ±max
    g.font = font(13);
    g.textAlign = 'right';
    for (const f of [-1, -0.5, 0, 0.5, 1]) {
      const yy = Math.round(vy(f * p.max)) + 0.5;
      g.strokeStyle = f === 0 ? INK.base : INK.grid;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(left, yy);
      g.lineTo(right, yy);
      g.stroke();
      g.fillStyle = INK.muted;
      g.fillText(`${f * p.max > 0 ? '+' : ''}${+(f * p.max).toFixed(1)} ${p.unit}`, left - 10, yy + 4);
    }
    g.textAlign = 'left';
    g.fillStyle = INK.secondary;
    g.font = font(15, 600);
    g.fillText(p.title, left + 10, y0 + 20);

    const values = samples.map(sm => ({ t: sm.t, v: p.value(sm) }));
    // envelope wash
    g.fillStyle = 'rgba(195,194,183,0.14)';
    g.beginPath();
    values.forEach(({ t, v }, i) => (i === 0 ? g.moveTo(tx(t), vy(v ? v.envelope : 0)) : g.lineTo(tx(t), vy(v ? v.envelope : 0))));
    for (let i = values.length - 1; i >= 0; i--) g.lineTo(tx(values[i].t), vy(-(values[i].v?.envelope ?? 0)));
    g.closePath();
    g.fill();
    // the two axes; the screen offset steps from frame to frame
    for (const axis of ['x', 'y'] as const) {
      g.strokeStyle = SERIES[axis];
      g.lineWidth = 2;
      g.lineJoin = 'round';
      g.lineCap = 'round';
      g.beginPath();
      values.forEach(({ t, v }, i) => {
        const yy = vy(v ? v[axis] : 0);
        if (i === 0) g.moveTo(tx(t), yy);
        else if (p.unit === 'px') {
          g.lineTo(tx(t), vy(values[i - 1].v?.[axis] ?? 0));
          g.lineTo(tx(t), yy);
        } else g.lineTo(tx(t), yy);
      });
      g.stroke();
    }
  });

  // event markers and the time axis
  g.font = font(14);
  for (const e of EVENTS) {
    const x = Math.round(tx(e.at)) + 0.5;
    g.strokeStyle = 'rgba(137,135,129,0.55)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x, top - 6);
    g.lineTo(x, bottom);
    g.stroke();
    g.fillStyle = INK.secondary;
    g.textAlign = 'center';
    g.fillText(e.kind, x, top - 12);
  }
  g.fillStyle = INK.muted;
  g.font = font(13);
  for (let t = 0; t <= PLOT_SPAN + 1e-9; t += 0.2) {
    const x = Math.round(tx(t)) + 0.5;
    g.strokeStyle = INK.base;
    g.beginPath();
    g.moveTo(x, bottom);
    g.lineTo(x, bottom + 6);
    g.stroke();
    g.fillText(`${t.toFixed(1)} s`, x, bottom + 22);
  }
  g.textAlign = 'left';
}

export default defineScene({
  name: 'render-shake',
  description: "the Demo's camera shakes on a scripted sequence over the reference room, with a readout; ?plot=1 plots them",
  setup,
  update,
});
