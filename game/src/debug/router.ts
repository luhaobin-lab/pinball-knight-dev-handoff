import { createRenderer, type DebugView, type PixelRenderer, type RenderStats } from '../render/api';
import { createRng, normalizeSeed } from '../core/rng';
import { INTERNAL_HEIGHT } from '../render/density';
import type { DebugScene, SceneContext } from './types';

/**
 * Debug router: `?scene=<name>&seed=&t=&frames=&paused=` (README.md). Loads
 * src/debug/scenes/<name>.ts, steps it in real time or deterministically, and reports to tools
 * through window.__ready / window.__error / window.__debug.
 */

type SceneModule = Partial<DebugScene> & { default?: DebugScene };

const loaders = import.meta.glob<SceneModule>('./scenes/*.ts');
const SCENES = new Map(Object.entries(loaders).map(([path, load]) => [path.slice('./scenes/'.length, -'.ts'.length), load]));

const DEFAULT_SCENE = 'hello';
/** Fixed step of deterministic mode, in seconds. */
const STEP = 1 / 60;

export interface DebugStats extends RenderStats {
  scene: string;
  time: number;
  renderTime: number;
  /** CPU milliseconds of the last update + render. */
  cpuMs: number;
  gpu: string;
}

export interface DebugHandle {
  readonly scene: string;
  readonly renderer: PixelRenderer;
  /** CPU milliseconds of the last update + render (cheap to read every frame). */
  readonly cpuMs: number;
  /** Steps `seconds` deterministically (fixed 1/60 s steps), renders, then sets __ready again. */
  advance(seconds: number): Promise<void>;
  stats(): DebugStats;
}

declare global {
  interface Window {
    __ready?: boolean;
    __error?: string;
    __scenes?: string[];
    __debug?: DebugHandle;
  }
}

const VIEWS: readonly DebugView[] = ['final', 'lit', 'light', 'irradiance', 'surface', 'ramp', 'normal', 'emissive', 'depth', 'overlay'];

interface Params {
  scene: string;
  view: DebugView;
  seed: number;
  t: number | null;
  frames: number;
  paused: boolean;
  capture: boolean;
  stats: boolean;
}

function readParams(q: URLSearchParams): Params {
  const tRaw = q.get('t');
  const t = tRaw === null ? null : Number(tRaw);
  if (t !== null && !(t >= 0)) throw new Error(`?t must be a non-negative number of seconds, got "${tRaw}"`);
  const framesRaw = q.get('frames');
  const frames = framesRaw === null ? (t === null ? 3 : 1) : Number(framesRaw);
  if (!Number.isInteger(frames) || frames < 1) throw new Error(`?frames must be a positive integer, got "${framesRaw}"`);
  const seedRaw = q.get('seed') ?? '1';
  const pausedRaw = q.get('paused');
  const view = (q.get('view') ?? 'final') as DebugView;
  if (!VIEWS.includes(view)) throw new Error(`?view must be one of ${VIEWS.join(', ')}, got "${view}"`);
  return {
    scene: q.get('scene') || DEFAULT_SCENE,
    view,
    seed: normalizeSeed(/^-?\d+$/.test(seedRaw) ? Number(seedRaw) : seedRaw),
    t,
    frames,
    paused: pausedRaw === null ? t !== null : pausedRaw !== '0' && pausedRaw !== 'false',
    capture: q.has('capture'),
    stats: q.has('stats'),
  };
}

async function loadScene(name: string): Promise<DebugScene> {
  const load = SCENES.get(name);
  if (!load) throw new Error(`unknown scene "${name}"; available: ${[...SCENES.keys()].sort().join(', ')}`);
  const mod = await load();
  const scene = mod.default ?? (mod as DebugScene);
  if (typeof scene.setup !== 'function') throw new Error(`src/debug/scenes/${name}.ts must export setup(ctx) or a default defineScene({...})`);
  if (scene.name !== name) throw new Error(`src/debug/scenes/${name}.ts declares name "${scene.name}"; it must equal the file name`);
  return scene;
}

function showError(message: string): void {
  const box = document.createElement('pre');
  box.textContent = message;
  box.style.cssText = 'position:fixed;left:12px;top:12px;right:12px;margin:0;padding:12px;font:12px/1.4 monospace;white-space:pre-wrap;color:#ffd7d7;background:#3a0d14ee;border:1px solid #ff6b81;z-index:10';
  document.body.append(box);
}

const nextTask = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));
const nextFrame = (): Promise<void> => new Promise(resolve => requestAnimationFrame(() => resolve()));

/** Compiler log of `shader` plus the source lines around each reported error line. */
function shaderReport(gl: WebGLRenderingContext, shader: WebGLShader, kind: string): string {
  const log = gl.getShaderInfoLog(shader)?.trim();
  if (!log) return '';
  const source = gl.getShaderSource(shader)?.split('\n') ?? [];
  const lines = [...new Set([...log.matchAll(/ERROR: \d+:(\d+)/g)].map(m => Number(m[1])))].slice(0, 3);
  const excerpts = lines.map(n =>
    source
      .slice(Math.max(0, n - 3), n + 2)
      .map((text, i) => `${Math.max(1, n - 2) + i}| ${text}`)
      .join('\n'),
  );
  return [`${kind} shader:`, log, ...excerpts].join('\n');
}

function gpuName(renderer: PixelRenderer): string {
  const context = renderer.gl.getContext();
  const info = context.getExtension('WEBGL_debug_renderer_info');
  return String(info ? context.getParameter(info.UNMASKED_RENDERER_WEBGL) : context.getParameter(context.RENDERER));
}

export async function startDebugRouter(canvas: HTMLCanvasElement): Promise<void> {
  let failed = false;
  const fail = (error: unknown): void => {
    if (failed) return;
    failed = true;
    const message = error instanceof Error ? (error.stack ?? error.message) : String(error);
    window.__error = message;
    window.__ready = false;
    showError(message);
  };
  window.addEventListener('error', e => fail(e.error ?? e.message));
  window.addEventListener('unhandledrejection', e => fail(e.reason));
  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    fail(new Error('WebGL context lost'));
  });
  window.__ready = false;
  window.__scenes = [...SCENES.keys()].sort();

  try {
    const query = new URLSearchParams(location.search);
    const params = readParams(query);
    const def = await loadScene(params.scene);
    const renderer = createRenderer(canvas, { preserveDrawingBuffer: params.capture, internalHeight: INTERNAL_HEIGHT });
    renderer.debugView = params.view;
    renderer.gl.debug.onShaderError = (gl, program, vertex, fragment) => {
      const log = [gl.getProgramInfoLog(program)?.trim(), shaderReport(gl, vertex, 'vertex'), shaderReport(gl, fragment, 'fragment')].filter(Boolean).join('\n');
      fail(new Error(`shader compile/link error in scene "${def.name}":\n${log}`));
    };
    const ctx: { -readonly [K in keyof SceneContext]: SceneContext[K] } = {
      renderer,
      scene: renderer.scene,
      camera: renderer.camera,
      fx: renderer.fx,
      seed: params.seed,
      rng: createRng(params.seed),
      params: query,
      time: 0,
      frame: 0,
    };
    await def.setup(ctx);
    for (const problem of renderer.validate()) console.warn(`[scene ${def.name}] ${problem}`);

    let cpuMs = 0;
    const step = (dt: number, advance: boolean): void => {
      if (failed) return;
      const start = performance.now();
      const gameDt = advance ? dt * renderer.fx.timeScale : 0;
      ctx.time += gameDt;
      def.update?.(ctx, gameDt);
      renderer.render(advance ? dt : 0);
      ctx.frame++;
      cpuMs = performance.now() - start;
    };
    const stepFixed = async (seconds: number): Promise<number> => {
      const steps = Math.round(seconds / STEP);
      for (let i = 0; i < steps && !failed; i++) {
        step(STEP, true);
        if (i % 30 === 29) await nextTask();
      }
      return steps;
    };
    const ready = async (): Promise<void> => {
      await nextFrame();
      await nextFrame();
      if (!failed) window.__ready = true;
    };

    const gpu = gpuName(renderer);
    window.__debug = {
      scene: def.name,
      renderer,
      get cpuMs() {
        return cpuMs;
      },
      async advance(seconds) {
        window.__ready = false;
        // A frame that advanced time was already presented; an extra one would reseed the film grain and count
        // impact frames down twice.
        if ((await stepFixed(seconds)) === 0) step(0, false);
        await ready();
      },
      stats: () => ({ ...renderer.stats(), scene: def.name, time: ctx.time, renderTime: renderer.time, cpuMs, gpu }),
    };
    if (params.stats) showStats(window.__debug);

    const paused = params.paused;
    window.addEventListener('resize', () => {
      renderer.resize();
      if (paused) step(0, false);
    });

    if (params.t !== null) await stepFixed(params.t);
    if (paused || params.t !== null) {
      for (let i = 0; i < params.frames; i++) step(paused ? 0 : STEP, !paused);
      await ready();
      if (paused) return;
    }

    let rendered = 0;
    let last = performance.now();
    const loop = (now: number): void => {
      if (failed) return;
      step(Math.min((now - last) / 1000, 0.1), true);
      last = now;
      if (++rendered === params.frames) void ready();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(now => {
      last = now;
      loop(now);
    });
  } catch (error) {
    fail(error);
  }
}

function showStats(handle: DebugHandle): void {
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:8px;bottom:8px;padding:4px 8px;font:11px/1.3 monospace;color:#d8f5ec;background:#0008;pointer-events:none;z-index:5;white-space:pre';
  document.body.append(box);
  let frames = 0;
  let since = performance.now();
  const tick = (now: number): void => {
    frames++;
    if (now - since >= 500) {
      const s = handle.stats();
      box.textContent = `${handle.scene}  ${((frames * 1000) / (now - since)).toFixed(0)} fps  cpu ${s.cpuMs.toFixed(2)} ms\n${s.calls} calls  ${s.triangles} tris  lights ${s.lightsVisible}/${s.lights}  ${s.internal.width}x${s.internal.height} x${s.internal.scale}`;
      frames = 0;
      since = now;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
