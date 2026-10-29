// npm run shots -- --scene a[,b] [--out dir] [--w 1920 --h 1080] [--t seconds]
//                  [--frames n --interval seconds] [--query extra] [--nobuild] [--timeout seconds] [--allow-blank]
// Builds this checkout, serves it, renders each debug scene in Chrome (GPU) at fixed time --t and
// saves PNGs. Prints a JSON array of the written files on stdout; exits 1 on any page error or on a
// blank frame (canvas luminance std < 2, i.e. background only, unless --allow-blank).
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { CHECKOUT, buildCheckout, canvasStats, launchChrome, log, numberOption, runTool, sceneUrl, serve, slash, studioDir, waitReady, watchPage } from './lib/harness.mjs';

const USAGE = 'usage: npm run shots -- --scene a[,b] [--out dir] [--w 1920 --h 1080] [--t seconds] [--frames n --interval seconds] [--query "k=v&k2=v2"] [--nobuild] [--timeout seconds] [--allow-blank]';

let values;
try {
  ({ values } = parseArgs({
    options: {
      scene: { type: 'string' },
      out: { type: 'string' },
      w: { type: 'string', default: '1920' },
      h: { type: 'string', default: '1080' },
      t: { type: 'string', default: '1' },
      frames: { type: 'string', default: '1' },
      interval: { type: 'string', default: '0.25' },
      query: { type: 'string', default: '' },
      nobuild: { type: 'boolean', default: false },
      timeout: { type: 'string', default: '120' },
      'allow-blank': { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
    strict: true,
  }));
} catch (error) {
  console.error(`${error.message}\n${USAGE}`);
  process.exit(2);
}
if (values.help || !values.scene) {
  console.error(USAGE);
  process.exit(values.help ? 0 : 2);
}

let options;
try {
  options = {
    scenes: values.scene.split(',').map(s => s.trim()).filter(Boolean),
    width: numberOption(values, 'w', { min: 1, integer: true }),
    height: numberOption(values, 'h', { min: 1, integer: true }),
    t: numberOption(values, 't', { min: 0 }),
    frames: numberOption(values, 'frames', { min: 1, integer: true }),
    interval: numberOption(values, 'interval', { min: 0 }),
    timeoutMs: numberOption(values, 'timeout', { min: 1 }) * 1000,
    outDir: path.resolve(values.out ?? path.join(studioDir(), 'shots', CHECKOUT)),
  };
} catch (error) {
  console.error(`${error.message}\n${USAGE}`);
  process.exit(2);
}

const files = [];
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
    for (const scene of options.scenes) {
      const context = await browser.newContext({ viewport: { width: options.width, height: options.height }, deviceScaleFactor: 1 });
      const pageErrors = [];
      try {
        const page = await context.newPage();
        watchPage(page, pageErrors, scene);
        await page.goto(sceneUrl(server.url, scene, { t: String(options.t), capture: '1' }, values.query), { waitUntil: 'load', timeout: options.timeoutMs });
        await waitReady(page, options.timeoutMs);
        for (let i = 0; i < options.frames; i++) {
          if (i > 0) {
            await page.evaluate(seconds => window.__debug?.advance(seconds), options.interval);
            await waitReady(page, options.timeoutMs);
          }
          const name = options.frames > 1 ? `${scene}-${String(i).padStart(2, '0')}.png` : `${scene}.png`;
          const file = path.join(options.outDir, name);
          await page.screenshot({ path: file, type: 'png' });
          files.push(slash(file));
          const stats = await canvasStats(page);
          log(`${name}: canvas luminance mean ${stats?.mean} std ${stats?.std}, ${stats?.colors} colours`);
          if (!values['allow-blank'] && (!stats || stats.std < 2)) pageErrors.push(`[${scene}] ${name} looks blank (luminance std ${stats?.std ?? 'n/a'})`);
        }
      } catch (error) {
        pageErrors.push(`[${scene}] ${error.message ?? error}`);
      } finally {
        errors.push(...pageErrors);
        await context.close().catch(() => {});
      }
    }
  } catch (error) {
    errors.push(String(error?.stack ?? error));
  }
}, { watchdogSeconds: 120 + options.scenes.length * (options.timeoutMs / 1000) * (options.frames + 1) });

process.stdout.write(`${JSON.stringify(files)}\n`);
for (const error of errors) log(error);
process.exitCode = errors.length ? 1 : 0;
