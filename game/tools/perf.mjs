// npm run perf -- --scene x [--seconds 5] [--w 1920 --h 1080] [--warmup 1] [--query extra] [--vsync] [--nobuild]
// Runs a debug scene in real time in Chrome (GPU, frame-rate limit off unless --vsync) and prints
// JSON: rAF frame times (mean, p50, p95, p99, max), CPU time per frame, draw calls and triangles.
import { parseArgs } from 'node:util';
import { buildCheckout, launchChrome, log, numberOption, runTool, sceneUrl, serve, waitReady, watchPage } from './lib/harness.mjs';

const USAGE = 'usage: npm run perf -- --scene name [--seconds 5] [--w 1920 --h 1080] [--warmup 1] [--query "k=v"] [--vsync] [--nobuild] [--timeout seconds]';

let values;
try {
  ({ values } = parseArgs({
    options: {
      scene: { type: 'string' },
      seconds: { type: 'string', default: '5' },
      w: { type: 'string', default: '1920' },
      h: { type: 'string', default: '1080' },
      warmup: { type: 'string', default: '1' },
      query: { type: 'string', default: '' },
      vsync: { type: 'boolean', default: false },
      nobuild: { type: 'boolean', default: false },
      timeout: { type: 'string', default: '120' },
      help: { type: 'boolean', default: false },
    },
    strict: true,
  }));
} catch (error) {
  console.error(`${error.message}\n${USAGE}`);
  process.exit(2);
}
if (values.help || !values.scene || values.scene.includes(',')) {
  console.error(USAGE);
  process.exit(values.help ? 0 : 2);
}

let options;
try {
  options = {
    seconds: numberOption(values, 'seconds', { min: 0.5 }),
    warmup: numberOption(values, 'warmup', { min: 0 }),
    width: numberOption(values, 'w', { min: 1, integer: true }),
    height: numberOption(values, 'h', { min: 1, integer: true }),
    timeoutMs: numberOption(values, 'timeout', { min: 1 }) * 1000,
  };
} catch (error) {
  console.error(`${error.message}\n${USAGE}`);
  process.exit(2);
}

const summarize = samples => {
  const sorted = [...samples].sort((a, b) => a - b);
  const at = q => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  const mean = sorted.reduce((s, v) => s + v, 0) / Math.max(1, sorted.length);
  const round = v => Math.round(v * 1000) / 1000;
  return { mean: round(mean), p50: round(at(0.5)), p95: round(at(0.95)), p99: round(at(0.99)), max: round(sorted.at(-1) ?? 0) };
};

const errors = [];
let result = null;
await runTool(async addCleanup => {
  try {
    const dist = await buildCheckout({ reuse: values.nobuild });
    const server = await serve(dist);
    addCleanup(server.close);
    const extraArgs = values.vsync ? [] : ['--disable-frame-rate-limit', '--disable-gpu-vsync'];
    const { browser, gpu } = await launchChrome({ extraArgs });
    addCleanup(() => browser.close());
    log(`chrome webgl2: ${gpu}`);
    const context = await browser.newContext({ viewport: { width: options.width, height: options.height }, deviceScaleFactor: 1 });
    addCleanup(() => context.close());
    const page = await context.newPage();
    watchPage(page, errors, values.scene);
    await page.goto(sceneUrl(server.url, values.scene, { paused: '0' }, values.query), { waitUntil: 'load', timeout: options.timeoutMs });
    await waitReady(page, options.timeoutMs);
    await page.waitForTimeout(options.warmup * 1000);
    const sample = await page.evaluate(async seconds => {
      const frameMs = [];
      const cpuMs = [];
      await new Promise(resolve => {
        let start = 0;
        let last = 0;
        const tick = now => {
          if (start === 0) {
            start = last = now;
          } else {
            frameMs.push(now - last);
            cpuMs.push(window.__debug?.cpuMs ?? 0);
            last = now;
          }
          if (now - start < seconds * 1000) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
      });
      return { frameMs, cpuMs, stats: window.__debug?.stats() ?? null };
    }, options.seconds);
    const frame = summarize(sample.frameMs);
    result = {
      scene: values.scene,
      viewport: { width: options.width, height: options.height },
      vsync: values.vsync,
      seconds: options.seconds,
      frames: sample.frameMs.length,
      fps: Math.round((1000 / Math.max(frame.mean, 1e-6)) * 10) / 10,
      frameMs: frame,
      cpuMs: summarize(sample.cpuMs),
      calls: sample.stats?.calls ?? null,
      triangles: sample.stats?.triangles ?? null,
      lights: sample.stats ? { total: sample.stats.lights, visible: sample.stats.lightsVisible } : null,
      passes: sample.stats?.passes ?? null,
      internal: sample.stats?.internal ?? null,
      output: sample.stats?.output ?? null,
      gpu,
    };
  } catch (error) {
    errors.push(String(error?.stack ?? error));
  }
}, { watchdogSeconds: 120 + options.seconds + options.warmup + options.timeoutMs / 1000 });

if (result) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
for (const error of errors) log(error);
process.exitCode = errors.length || !result ? 1 : 0;
