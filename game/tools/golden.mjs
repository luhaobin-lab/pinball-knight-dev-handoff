// node tools/golden.mjs [--golden 02-aim[,04-cast]] [--query "k=v"] [--out dir] [--nobuild] [--timeout seconds]
//   renders each golden frame's scene fresh (the GOLDEN recipes below) and compares it with the golden frame
// node tools/golden.mjs --golden 02-aim --frame shot.png [--crop x0,y0,x1,y1]
//   compares an existing PNG (a 1920x1080 frame gets the golden's crop unless --crop is given)
// node tools/golden.mjs --calibrate [--out dir] [--nobuild]
//   re-runs the calibration of the thresholds and checks that every case still lands where it should
// Visual regression against studio/golden/ on style metrics (README.md "Visual regression"). Prints
// JSON on stdout. Exit 0: every metric passes (or the calibration holds); 1: something warns (or a
// calibration case moved); 2: usage error; 3: a render or a file could not be produced.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { CHECKOUT, ROOT, buildCheckout, checkExtraQuery, launchChrome, log, numberOption, openScene, runTool, serve, slash, studioDir } from './lib/harness.mjs';
import { cropImage, decodePng, encodePng, parseRect, rectText } from './lib/image.ts';
import { THRESHOLDS, analyzeStyle, compareStyle } from './lib/style.ts';
import { desaturate, glow, goldTint, outlineVariants, reblock } from './lib/variants.ts';

/**
 * How each golden frame was rendered (1920x1080 viewport, default build). 01 and 04 are bit-identical
 * to these renders. 02 and 03 are frames 83 and 155 of the review clip, stepped with
 * window.__debug.advance; a still at the same time differs from them only by the film grain, which the
 * grade pass seeds with the render-frame counter (mean |Δ| 0.6 of 255).
 */
const GOLDEN = {
  '01-combat-zoom': { scene: 'play', t: 1.3, query: 'zoom=2&at=11.5,7' },
  '02-aim': { scene: 'play', t: 1.38, crop: '549,96,1749,966' },
  '03-kill': { scene: 'play', t: 2.58, crop: '549,96,1749,966' },
  '04-cast': { scene: 'cast', t: 1 },
};
const VIEWPORT = { width: 1920, height: 1080 };
const GOLDEN_DIR = path.join(ROOT, 'studio', 'golden');

const USAGE = `usage: node tools/golden.mjs [--golden a[,b]] [--frame file.png [--crop x0,y0,x1,y1]] [--query "k=v"] [--out dir] [--nobuild] [--timeout seconds]
       node tools/golden.mjs --calibrate [--out dir] [--nobuild]`;

let values;
try {
  ({ values } = parseArgs({
    options: {
      golden: { type: 'string' },
      frame: { type: 'string' },
      crop: { type: 'string' },
      query: { type: 'string', default: '' },
      out: { type: 'string' },
      nobuild: { type: 'boolean', default: false },
      timeout: { type: 'string', default: '120' },
      calibrate: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
    strict: true,
  }));
} catch (error) {
  console.error(`${error.message}\n${USAGE}`);
  process.exit(2);
}
if (values.help) {
  console.error(USAGE);
  process.exit(0);
}

/** "02", "02-aim", "02-aim.png" or a path to a PNG. */
function resolveGolden(name) {
  if (/[\\/]/.test(name) || (fs.existsSync(name) && fs.statSync(name).isFile())) {
    const file = path.resolve(name);
    return { id: path.basename(file, '.png'), file };
  }
  const files = fs.readdirSync(GOLDEN_DIR).filter(f => f.endsWith('.png'));
  const base = name.replace(/\.png$/, '');
  const hit = files.find(f => f.slice(0, -4) === base) ?? files.find(f => f.split('-')[0] === base);
  if (!hit) throw new Error(`no golden frame "${name}" in ${slash(GOLDEN_DIR)} (have ${files.join(', ')})`);
  return { id: hit.slice(0, -4), file: path.join(GOLDEN_DIR, hit) };
}

let options;
try {
  if (values.frame && !values.golden) throw new Error('--frame needs --golden');
  if (values.calibrate && (values.frame || values.golden || values.query)) throw new Error('--calibrate renders its own cases; it takes only --out, --nobuild and --timeout');
  checkExtraQuery(values.query);
  if (values.crop && !values.frame) throw new Error('--crop applies to --frame; rendered goldens use their recipe crop');
  const names = values.calibrate ? '' : (values.golden ?? Object.keys(GOLDEN).join(','));
  options = {
    goldens: names.split(',').map(s => s.trim()).filter(Boolean).map(resolveGolden),
    crop: values.crop ? parseRect(values.crop) : null,
    timeoutMs: numberOption(values, 'timeout', { min: 1 }) * 1000,
    outDir: path.resolve(values.out ?? path.join(studioDir(), 'shots', CHECKOUT, values.calibrate ? 'golden-calibration' : 'golden')),
  };
  if (values.frame && options.goldens.length !== 1) throw new Error('--frame compares with exactly one --golden');
  if (!values.frame) for (const g of options.goldens) if (!GOLDEN[g.id]) throw new Error(`no render recipe for golden "${g.id}"; compare a PNG with --frame instead`);
} catch (error) {
  console.error(`${error.message}\n${USAGE}`);
  process.exit(2);
}

const readPng = async file => decodePng(fs.readFileSync(file));
const goldens = new Map();
/** The golden frame's image and style statistics (computed once). */
async function goldenOf(g) {
  if (!goldens.has(g.id)) {
    const image = await readPng(g.file);
    goldens.set(g.id, { image, stats: analyzeStyle(image) });
  }
  return goldens.get(g.id);
}

/** The part of `image` compared with golden `g`: --crop, else the recipe's crop when a full 1920x1080 frame comes in. */
async function partOf(g, image) {
  const golden = (await goldenOf(g)).image;
  const recipeCrop = GOLDEN[g.id]?.crop;
  const fullFrame = image.width === VIEWPORT.width && image.height === VIEWPORT.height;
  const crop = options.crop ?? (recipeCrop && fullFrame && (image.width !== golden.width || image.height !== golden.height) ? parseRect(recipeCrop) : null);
  const part = crop ? cropImage(image, crop) : image;
  if (part.width !== golden.width || part.height !== golden.height) {
    throw new Error(`the compared frame is ${part.width}x${part.height} but golden ${g.id} is ${golden.width}x${golden.height}; pass --crop x0,y0,x1,y1`);
  }
  return { part, crop: crop ? rectText(crop) : null };
}

async function compare(g, part) {
  const report = compareStyle((await goldenOf(g)).stats, analyzeStyle(part));
  return { verdict: report.verdict, warnings: report.metrics.filter(m => m.verdict === 'warn').map(m => m.metric), metrics: report.metrics };
}

const output = { verdict: 'pass', thresholds: THRESHOLDS, results: [] };
let exitCode = 0;

if (values.frame) {
  try {
    const g = options.goldens[0];
    const { part, crop } = await partOf(g, await readPng(values.frame));
    output.results.push({ golden: slash(path.relative(ROOT, g.file)), frame: slash(path.resolve(values.frame)), crop, ...(await compare(g, part)) });
  } catch (error) {
    console.error(error.message);
    process.exit(3);
  }
} else {
  const errors = [];
  await runTool(async addCleanup => {
    try {
      fs.mkdirSync(options.outDir, { recursive: true });
      const dist = await buildCheckout({ reuse: values.nobuild });
      const server = await serve(dist);
      addCleanup(server.close);
      const { browser, gpu } = await launchChrome();
      addCleanup(() => browser.close());
      log(`chrome webgl2: ${gpu}`);
      /** Renders golden `g`'s recipe (plus `query`, optionally at another time), saves and returns the compared part. */
      const render = async (g, { query = '', t = GOLDEN[g.id].t, name = g.id } = {}) => {
        const recipe = GOLDEN[g.id];
        const fullQuery = [recipe.query, query].filter(Boolean).join('&');
        const { page, context, errors: pageErrors } = await openScene(browser, server.url, recipe.scene, { t, query: fullQuery, ...VIEWPORT, timeoutMs: options.timeoutMs });
        try {
          const shot = await decodePng(await page.screenshot({ type: 'png' }));
          if (pageErrors.length) throw new Error(pageErrors.join('\n'));
          const { part, crop } = await partOf(g, shot);
          const file = path.join(options.outDir, `${name}.png`);
          fs.writeFileSync(file, await encodePng(part));
          log(`${name}: ${recipe.scene} t=${t}${fullQuery ? ` ${fullQuery}` : ''}${crop ? ` crop ${crop}` : ''} -> ${slash(file)}`);
          return { part, file: slash(file), render: { scene: recipe.scene, t, query: fullQuery }, crop };
        } finally {
          await context.close().catch(() => {});
        }
      };
      if (values.calibrate) {
        await calibrate(render);
      } else {
        for (const g of options.goldens) {
          const { part, file, render: recipe, crop } = await render(g, { query: values.query });
          output.results.push({ golden: slash(path.relative(ROOT, g.file)), frame: file, render: recipe, crop, ...(await compare(g, part)) });
        }
      }
    } catch (error) {
      errors.push(String(error?.stack ?? error));
    }
  }, { watchdogSeconds: 120 + (values.calibrate ? 14 : options.goldens.length + 1) * (options.timeoutMs / 1000) });
  for (const error of errors) log(error);
  if (errors.length) exitCode = 3;
}

/**
 * The calibration of THRESHOLDS: fresh renders of every golden recipe and the aim still drifting must
 * pass; a density change, the un-graded resolve, desaturation, a gold grade, a screen-wide glow and
 * black or missing outlines must warn on the metric meant to catch them.
 */
async function calibrate(render) {
  const aimGolden = resolveGolden('02-aim');
  const castGolden = resolveGolden('04-cast');
  const fresh = new Map();
  for (const id of Object.keys(GOLDEN)) {
    const g = resolveGolden(id);
    fresh.set(id, (await render(g, { name: `${id}-fresh` })).part);
  }
  const aim = fresh.get('02-aim');
  const cast = fresh.get('04-cast');
  const view = async (g, v) => (await render(g, { query: `view=${v}`, name: `${g.id}-${v}` })).part;
  const lit = { aim: await view(aimGolden, 'lit'), cast: await view(castGolden, 'lit') };
  const outlines = { aim: outlineVariants(aim, lit.aim, await view(aimGolden, 'overlay')), cast: outlineVariants(cast, lit.cast, await view(castGolden, 'overlay')) };
  const cases = [
    ...[...fresh].map(([id, image]) => ({ name: 'fresh render of the recipe', golden: id, image, expect: 'pass' })),
    { name: 'aim still drifting (t=1.2)', golden: '02-aim', image: (await render(aimGolden, { t: 1.2, name: '02-aim-t1.2' })).part, expect: 'pass' },
    { name: '?res=pixel (640x360, x3)', golden: '02-aim', image: (await render(aimGolden, { query: 'res=pixel', name: '02-aim-pixel' })).part, expect: ['pixel.block'] },
    { name: '?res=pixel (640x360, x3)', golden: '04-cast', image: (await render(castGolden, { query: 'res=pixel', name: '04-cast-pixel' })).part, expect: ['pixel.block'] },
    { name: '?view=lit (no outline pass, no grade)', golden: '02-aim', image: lit.aim, expect: ['outline.band'] },
    { name: '?view=lit (no outline pass, no grade)', golden: '04-cast', image: lit.cast, expect: ['outline.band'] },
    { name: 'desaturated 50%', golden: '02-aim', image: desaturate(aim, 0.5), expect: ['saturation.regions'] },
    { name: 'desaturated 50%', golden: '04-cast', image: desaturate(cast, 0.5), expect: ['saturation.regions'] },
    { name: 'gold grade 30%', golden: '02-aim', image: goldTint(aim, 0.3), expect: ['hue.histogram', 'saturation.regions'] },
    { name: 'gold grade 30%', golden: '04-cast', image: goldTint(cast, 0.3), expect: ['hue.histogram', 'saturation.regions'] },
    { name: 'desaturated 50% + gold grade 30%', golden: '02-aim', image: goldTint(desaturate(aim, 0.5), 0.3), expect: ['hue.histogram', 'saturation.regions'] },
    { name: 'desaturated 50% + gold grade 30%', golden: '04-cast', image: goldTint(desaturate(cast, 0.5), 0.3), expect: ['hue.histogram', 'saturation.regions'] },
    { name: 'screen-wide glow 30%', golden: '02-aim', image: glow(aim, 0.3), expect: ['luminance.mean', 'luminance.histogram'] },
    { name: 'screen-wide glow 30%', golden: '04-cast', image: glow(cast, 0.3), expect: ['luminance.mean', 'luminance.histogram'] },
    { name: 'black outlines (comic style)', golden: '02-aim', image: outlines.aim.black, expect: ['outline.band', 'outline.ink'] },
    { name: 'black outlines (comic style)', golden: '04-cast', image: outlines.cast.black, expect: ['outline.band', 'outline.ink'] },
    { name: 'outlines removed', golden: '02-aim', image: outlines.aim.removed, expect: ['outline.band'] },
    { name: 'outlines removed', golden: '04-cast', image: outlines.cast.removed, expect: ['outline.band'] },
    { name: 're-pixelated to 3 px blocks', golden: '02-aim', image: reblock(aim, 3), expect: ['pixel.block'] },
  ];
  let moved = 0;
  for (const c of cases) {
    const g = resolveGolden(c.golden);
    const { verdict, warnings, metrics } = await compare(g, c.image);
    const ok = c.expect === 'pass' ? verdict === 'pass' : c.expect.every(m => warnings.includes(m));
    if (!ok) moved++;
    let frame;
    if (c.expect !== 'pass') {
      frame = path.join(options.outDir, `${c.golden}-case-${c.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()}.png`);
      fs.writeFileSync(frame, await encodePng(c.image));
    }
    output.results.push({ case: c.name, golden: slash(path.relative(ROOT, g.file)), expect: c.expect, ok, verdict, warnings, values: Object.fromEntries(metrics.map(m => [m.metric, m.value])), ...(frame ? { frame: slash(frame) } : {}) });
    log(`${ok ? 'ok  ' : 'MOVED'} ${c.golden.padEnd(15)} ${c.name.padEnd(38)} ${metrics.map(m => `${m.verdict === 'warn' ? '!' : ' '}${m.value}`).join(' ')}`);
  }
  if (moved) log(`${moved} calibration case(s) moved; read README.md "Visual regression" before touching THRESHOLDS`);
  output.calibration = moved ? 'moved' : 'holds';
}

if (values.calibrate) {
  output.verdict = output.calibration ?? 'failed';
  if (output.verdict !== 'holds' && exitCode === 0) exitCode = 1;
} else {
  output.verdict = output.results.length && output.results.every(r => r.verdict === 'pass') ? 'pass' : 'warn';
  if (output.verdict !== 'pass' && exitCode === 0) exitCode = 1;
}
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
process.exitCode = exitCode;
