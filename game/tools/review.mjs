// node tools/review.mjs --scene <name> [--query "k=v"] [--stills t1,t2,...] [--clip seconds [--from t] [--fps 60]]
//                       [--crop x0,y0,x1,y1] [--out dir] [--nobuild] [--w 1920 --h 1080] [--gif-mb 12] [--keep-frames] [--timeout seconds]
// The reviewers' pack for one debug scene, from one build of this checkout:
//   still-<t>.png, plus still-<t>-crop.png with --crop: fresh page loads at ?t= (the same pixels as npm run shots)
//   clip.mp4: H.264 4:2:0 at --fps, each frame stepped deterministically with window.__debug.advance
//   clip.gif: the clip on the internal pixel grid (nearest neighbour), one global palette, no dither, <= --gif-mb
//   pack.json: the commit, the scene and every file with its probed properties
// Prints pack.json on stdout; exits 1 if anything failed (whatever was made is still listed).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { CHECKOUT, ROOT, buildCheckout, canvasStats, checkExtraQuery, launchChrome, log, numberOption, openScene, runTool, serve, slash, studioDir, waitReady } from './lib/harness.mjs';
import { parseRect, rectText } from './lib/image.ts';
import { probeGif, probeMp4 } from './lib/media.ts';
import { STEP_HZ, clipCrop, clipSteps, parseTimes, sortFrames } from './lib/pack.ts';

const USAGE = `usage: node tools/review.mjs --scene name [--query "k=v"] [--stills t1,t2,...] [--clip seconds [--from t] [--fps 60]]
                             [--crop x0,y0,x1,y1] [--out dir] [--nobuild] [--w 1920 --h 1080] [--gif-mb 12] [--keep-frames] [--timeout seconds]`;
const BLENDER = process.env.BLENDER ?? 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe';
const PYTHON = process.env.PYTHON ?? 'python';
const LIB = path.join(path.dirname(fileURLToPath(import.meta.url)), 'lib');
const ENCODE_TIMEOUT_MS = 15 * 60 * 1000;

let values;
try {
  ({ values } = parseArgs({
    options: {
      scene: { type: 'string' },
      query: { type: 'string', default: '' },
      stills: { type: 'string' },
      clip: { type: 'string' },
      from: { type: 'string', default: '0' },
      fps: { type: 'string', default: '60' },
      crop: { type: 'string' },
      out: { type: 'string' },
      nobuild: { type: 'boolean', default: false },
      w: { type: 'string', default: '1920' },
      h: { type: 'string', default: '1080' },
      'gif-mb': { type: 'string', default: '12' },
      'keep-frames': { type: 'boolean', default: false },
      timeout: { type: 'string', default: '120' },
      help: { type: 'boolean', default: false },
    },
    strict: true,
  }));
} catch (error) {
  console.error(`${error.message}\n${USAGE}`);
  process.exit(2);
}
if (values.help || !values.scene || values.scene.includes(',') || (!values.stills && !values.clip)) {
  console.error(values.help ? USAGE : `${USAGE}\n--scene (one) and at least one of --stills and --clip are required`);
  process.exit(values.help ? 0 : 2);
}

let options;
try {
  options = {
    stills: values.stills ? parseTimes(values.stills) : [],
    clip: values.clip ? numberOption(values, 'clip', { min: 1 / STEP_HZ }) : 0,
    from: numberOption(values, 'from', { min: 0 }),
    fps: numberOption(values, 'fps', { min: 1, integer: true }),
    crop: values.crop ? parseRect(values.crop) : null,
    width: numberOption(values, 'w', { min: 16, integer: true }),
    height: numberOption(values, 'h', { min: 16, integer: true }),
    gifBytes: Math.floor(numberOption(values, 'gif-mb', { min: 0.1 }) * 1024 * 1024),
    timeoutMs: numberOption(values, 'timeout', { min: 1 }) * 1000,
    outDir: path.resolve(values.out ?? path.join(studioDir(), 'review', CHECKOUT, values.scene)),
  };
  checkExtraQuery(values.query);
  if (options.fps > STEP_HZ) throw new Error(`--fps must be at most ${STEP_HZ}: the router steps in 1/${STEP_HZ} s`);
  if (options.crop && (options.crop.x1 > options.width || options.crop.y1 > options.height)) throw new Error(`--crop ${values.crop} exceeds the ${options.width}x${options.height} viewport`);
} catch (error) {
  console.error(`${error.message}\n${USAGE}`);
  process.exit(2);
}
if (options.clip && STEP_HZ % options.fps) log(`note: ${options.fps} fps does not divide ${STEP_HZ}; frames are spaced unevenly by whole router steps`);

const git = args => spawnSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', windowsHide: true }).stdout?.trim() ?? '';
const pack = {
  dir: slash(options.outDir),
  scene: values.scene,
  query: values.query,
  viewport: { width: options.width, height: options.height },
  commit: { checkout: CHECKOUT, head: git(['rev-parse', 'HEAD']), dirty: git(['status', '--porcelain']).length > 0 },
  gpu: null,
  internal: null,
  stills: [],
  clip: null,
  files: [],
  errors: [],
};
const file = name => path.join(options.outDir, name);
const addFile = (kind, target, extra = {}) => pack.files.push({ kind, file: slash(target), bytes: fs.statSync(target).size, ...extra });
const clipRect = r => ({ x: r.x0, y: r.y0, width: r.x1 - r.x0, height: r.y1 - r.y0 });

function run(command, args, what) {
  const r = spawnSync(command, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: ENCODE_TIMEOUT_MS, windowsHide: true });
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`${what} failed (exit ${r.status}): ${(r.stderr || r.stdout || '').trim().slice(-2000)}`);
  return r.stdout;
}

/** Blank-frame check, as in tools/shots.mjs (canvas luminance std < 2 means background only). */
async function checkNotBlank(page, label) {
  const stats = await canvasStats(page);
  if (!stats || stats.std < 2) pack.errors.push(`${label} looks blank (luminance std ${stats?.std ?? 'n/a'})`);
}

await runTool(async addCleanup => {
  try {
    fs.mkdirSync(options.outDir, { recursive: true });
    const dist = await buildCheckout({ reuse: values.nobuild });
    const server = await serve(dist);
    addCleanup(server.close);
    const { browser, gpu } = await launchChrome();
    addCleanup(() => browser.close());
    pack.gpu = gpu;
    log(`chrome webgl2: ${gpu}`);
    const open = t => openScene(browser, server.url, values.scene, { t, query: values.query, width: options.width, height: options.height, timeoutMs: options.timeoutMs });

    for (const t of options.stills) {
      const { page, context, errors } = await open(t);
      try {
        pack.internal ??= await page.evaluate(() => window.__debug?.stats().internal ?? null);
        const still = { t, file: slash(file(`still-${t}.png`)) };
        await page.screenshot({ path: file(`still-${t}.png`), type: 'png' });
        addFile('still', file(`still-${t}.png`), { t, width: options.width, height: options.height });
        if (options.crop) {
          await page.screenshot({ path: file(`still-${t}-crop.png`), type: 'png', clip: clipRect(options.crop) });
          addFile('still-crop', file(`still-${t}-crop.png`), { t, crop: rectText(options.crop) });
          still.crop = slash(file(`still-${t}-crop.png`));
        }
        await checkNotBlank(page, `still t=${t}`);
        pack.stills.push(still);
        log(`still t=${t} -> ${still.file}`);
      } finally {
        pack.errors.push(...errors);
        await context.close().catch(() => {});
      }
    }

    if (options.clip) await renderClip(open, addCleanup);
  } catch (error) {
    pack.errors.push(String(error?.stack ?? error));
  }
}, { watchdogSeconds: 300 + (options.stills.length + 1) * (options.timeoutMs / 1000) + Math.round(options.clip * options.fps) * 2 + (2 * ENCODE_TIMEOUT_MS) / 1000 });

/** Renders the clip frame by frame, then encodes the MP4 and the GIF and checks what came out. */
async function renderClip(open, addCleanup) {
  const steps = clipSteps(options.from, options.clip, options.fps);
  const framesDir = values['keep-frames'] ? file('frames') : path.join(studioDir(), 'tmp', 'review-frames', `${CHECKOUT}-${process.pid}-${Date.now()}`);
  fs.rmSync(framesDir, { recursive: true, force: true });
  fs.mkdirSync(framesDir, { recursive: true });
  if (!values['keep-frames']) addCleanup(() => fs.rmSync(framesDir, { recursive: true, force: true }));

  const { page, context, errors } = await open(options.from);
  let rect;
  try {
    pack.internal = await page.evaluate(() => window.__debug?.stats().internal ?? null);
    const block = pack.internal?.scale ?? 1;
    rect = clipCrop(options.crop, options.width, options.height, block);
    if (options.crop && rectText(rect) !== rectText(options.crop)) log(`clip crop ${rectText(options.crop)} snapped to the ${block}px grid: ${rectText(rect)}`);
    const started = Date.now();
    for (let i = 0; i < steps.length; i++) {
      if (steps[i] > 0) {
        await page.evaluate(seconds => window.__debug.advance(seconds), steps[i] / STEP_HZ);
        await waitReady(page, options.timeoutMs);
      }
      await page.screenshot({ path: path.join(framesDir, `f${String(i).padStart(5, '0')}.png`), type: 'png', clip: clipRect(rect) });
      if (i === 0 || i === steps.length - 1) await checkNotBlank(page, `clip frame ${i}`);
      if (i % 60 === 59) log(`clip frame ${i + 1}/${steps.length}`);
    }
    log(`clip: ${steps.length} frames in ${((Date.now() - started) / 1000).toFixed(1)} s`);
  } finally {
    pack.errors.push(...errors);
    await context.close().catch(() => {});
  }
  const frames = steps.length;
  pack.clip = { from: options.from, seconds: frames / options.fps, fps: options.fps, frames, crop: rectText(rect), block: pack.internal?.scale ?? 1, mp4: null, gif: null, framesDir: values['keep-frames'] ? slash(framesDir) : null };
  // the encoders take frames in numeric order; make sure that order is exactly the rendered sequence
  const listed = sortFrames(fs.readdirSync(framesDir).filter(name => name.endsWith('.png')));
  if (listed.length !== frames || listed.some((name, i) => name !== `f${String(i).padStart(5, '0')}.png`)) {
    pack.errors.push(`expected frames f00000..f${String(frames - 1).padStart(5, '0')} in ${slash(framesDir)}, found ${listed.length}`);
    return;
  }

  try {
    const mp4 = file('clip.mp4');
    fs.rmSync(mp4, { force: true });
    run(BLENDER, ['-b', '--factory-startup', '--python', path.join(LIB, 'encode_mp4_blender.py'), '--', framesDir, String(options.fps), mp4], 'Blender H.264 encode');
    const info = probeMp4(fs.readFileSync(mp4));
    pack.clip.mp4 = slash(mp4);
    addFile('mp4', mp4, info);
    const w = rect.x1 - rect.x0;
    const h = rect.y1 - rect.y0;
    if (info.codec !== 'avc1' || info.chroma !== '4:2:0' || info.frames !== frames || info.width !== w || info.height !== h) {
      pack.errors.push(`clip.mp4 is ${info.codec} ${info.chroma} ${info.width}x${info.height} with ${info.frames} frames; expected avc1 4:2:0 ${w}x${h} with ${frames}`);
    }
    log(`clip.mp4: ${info.codec} ${info.chroma} ${info.width}x${info.height} ${info.frames} frames at ${info.fps} fps, ${(fs.statSync(mp4).size / 1048576).toFixed(1)} MB`);
  } catch (error) {
    pack.errors.push(String(error?.message ?? error));
  }

  try {
    const gif = file('clip.gif');
    fs.rmSync(gif, { force: true });
    const summary = JSON.parse(run(PYTHON, ['-I', path.join(LIB, 'encode_gif.py'), framesDir, String(options.fps), String(pack.clip.block), String(options.gifBytes), gif], 'GIF encode').trim().split('\n').at(-1));
    const info = probeGif(fs.readFileSync(gif));
    pack.clip.gif = slash(gif);
    addFile('gif', gif, { ...info, fps: summary.fps, scale: summary.scale });
    if (info.localPalettes > 0 || info.globalColors === 0) pack.errors.push(`clip.gif has ${info.localPalettes} local colour tables; expected one global palette`);
    if (info.durationMs > 0 && Math.abs(info.durationMs - pack.clip.seconds * 1000) > 50) pack.errors.push(`clip.gif lasts ${info.durationMs} ms; the clip lasts ${pack.clip.seconds * 1000} ms`);
    log(`clip.gif: ${info.width}x${info.height} (grid / ${1 / summary.scale}) ${info.frames} frames at ${summary.fps} fps, ${info.durationMs} ms, ${(fs.statSync(gif).size / 1048576).toFixed(1)} MB`);
  } catch (error) {
    pack.errors.push(String(error?.message ?? error));
  }
}

fs.mkdirSync(options.outDir, { recursive: true });
fs.writeFileSync(file('pack.json'), `${JSON.stringify(pack, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(pack, null, 2)}\n`);
for (const error of pack.errors) log(error);
process.exitCode = pack.errors.length ? 1 : 0;
