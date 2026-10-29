// Shared plumbing for the tools (shots, perf, package, review, golden):
// build the checkout this script lives in, serve it, drive the installed Chrome, always clean up.
// Everything human-readable goes to stderr; stdout is reserved for each tool's JSON result.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { browserLaunchOptions } from './browser-options.mjs';

/** Root of the checkout (main or a task worktree) that contains this script. */
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
/** Folder name of the checkout: "TAPTAPGAME_design" for main, the task id for a worktree. */
export const CHECKOUT = path.basename(ROOT);

export function log(...args) {
  console.error('[tools]', ...args);
}

export function slash(p) {
  return p.split(path.sep).join('/');
}

/** Studio scratch folder (outside the repo): $TAPTAP_STUDIO_DIR or the OS temp dir. */
export function studioDir() {
  if (process.env.TAPTAP_STUDIO_DIR) return process.env.TAPTAP_STUDIO_DIR;
  return path.join(os.tmpdir(), 'taptap-studio');
}

const BUILD_KEEP_MS = 30 * 60 * 1000;

/**
 * Vite-builds ROOT into a fresh folder under <studio>/tmp/builds/<checkout>/ (unique per run, so
 * concurrent runs never share files). With `reuse`, returns the newest previous build instead.
 */
export async function buildCheckout({ reuse = false, mode = 'production' } = {}) {
  const base = path.join(studioDir(), 'tmp', 'builds', CHECKOUT);
  const latestFile = path.join(base, `latest-${mode}.txt`);
  if (reuse) {
    const dir = fs.existsSync(latestFile) ? fs.readFileSync(latestFile, 'utf8').trim() : '';
    if (dir && fs.existsSync(path.join(dir, 'index.html'))) {
      log(`reusing build ${slash(dir)}`);
      return dir;
    }
    throw new Error(`--nobuild: no previous ${mode} build for ${CHECKOUT}; run once without --nobuild`);
  }
  const outDir = path.join(base, `${mode}-${Date.now()}-${process.pid}`);
  fs.mkdirSync(base, { recursive: true });
  const started = Date.now();
  const { build } = await import('vite');
  await build({
    root: ROOT,
    mode,
    logLevel: 'warn',
    configLoader: 'runner',
    cacheDir: path.join(base, 'vite-cache'),
    build: { outDir, emptyOutDir: true, reportCompressedSize: false },
  });
  fs.writeFileSync(latestFile, outDir);
  log(`built ${CHECKOUT} (${mode}) in ${((Date.now() - started) / 1000).toFixed(1)} s -> ${slash(outDir)}`);
  pruneBuilds(base, mode, outDir);
  return outDir;
}

function pruneBuilds(base, mode, keep) {
  for (const name of fs.readdirSync(base)) {
    const dir = path.join(base, name);
    if (!name.startsWith(`${mode}-`) || dir === keep) continue;
    try {
      if (Date.now() - fs.statSync(dir).mtimeMs > BUILD_KEEP_MS) fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // In use by a concurrent run, or already gone.
    }
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.map': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

/** Static file server for `dir` on a free 127.0.0.1 port. */
export async function serve(dir) {
  const root = path.resolve(dir);
  const sockets = new Set();
  const server = http.createServer(async (req, res) => {
    try {
      let rel = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
      if (rel.endsWith('/')) rel += 'index.html';
      const file = path.resolve(root, `.${rel}`);
      if (!file.startsWith(root + path.sep)) {
        res.writeHead(403).end();
        return;
      }
      const body = await fsp.readFile(file);
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  server.on('connection', socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  return {
    url: `http://127.0.0.1:${port}/`,
    close: () =>
      new Promise(resolve => {
        for (const socket of sockets) socket.destroy();
        server.close(() => resolve());
      }),
  };
}

const GPU_ARGS = [...(process.platform === 'win32' ? ['--use-angle=d3d11'] : []), '--ignore-gpu-blocklist', '--enable-gpu-rasterization'];
const SOFTWARE_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];

async function webgl2Renderer(browser) {
  const page = await browser.newPage();
  try {
    return await page.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return null;
      const info = gl.getExtension('WEBGL_debug_renderer_info');
      return String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    });
  } finally {
    await page.close();
  }
}

/**
 * Launches the configured browser (Playwright Chromium by default) headless with GPU flags; falls back to
 * SwiftShader when the GPU path fails or offers no WebGL2. Returns { browser, gpu }.
 */
export async function launchChrome({ extraArgs = [] } = {}) {
  const { chromium } = await import('playwright');
  const attempts = [
    { label: 'gpu', args: [...GPU_ARGS, ...extraArgs] },
    { label: 'swiftshader', args: [...SOFTWARE_ARGS, ...extraArgs] },
  ];
  let lastError = null;
  for (const attempt of attempts) {
    let browser = null;
    try {
      browser = await chromium.launch(browserLaunchOptions({ headless: true, args: attempt.args, timeout: 60_000 }));
      const gpu = await webgl2Renderer(browser);
      if (gpu) {
        if (attempt.label !== 'gpu') log(`GPU path unavailable; using ${attempt.label}`);
        return { browser, gpu };
      }
      lastError = new Error(`no WebGL2 with ${attempt.label}`);
    } catch (error) {
      lastError = error;
    }
    await browser?.close().catch(() => {});
  }
  throw new Error(`could not start Chrome with WebGL2: ${lastError?.message ?? lastError}`);
}

/** Collects page exceptions, console errors, failed requests and crashes into `errors`. */
export function watchPage(page, errors, label) {
  page.on('pageerror', error => errors.push(`[${label}] uncaught: ${error.stack || error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(`[${label}] console.error: ${message.text()}`);
    else if (message.type() === 'warning') log(`[${label}] warning: ${message.text()}`);
  });
  page.on('requestfailed', request => errors.push(`[${label}] request failed: ${request.url()} ${request.failure()?.errorText ?? ''}`));
  page.on('crash', () => errors.push(`[${label}] page crashed`));
}

/** Waits for window.__ready or window.__error; throws on __error. */
export async function waitReady(page, timeoutMs) {
  await page.waitForFunction(() => window.__ready === true || typeof window.__error === 'string', null, { timeout: timeoutMs, polling: 50 });
  const error = await page.evaluate(() => window.__error ?? null);
  if (error) throw new Error(`page reported an error:\n${error}`);
}

/**
 * Luminance statistics of the page's WebGL canvas, sampled at 160×90 (needs ?capture=1 so the drawing
 * buffer is preserved). A standard deviation near 0 means a blank frame.
 */
export async function canvasStats(page) {
  return page.evaluate(() => {
    const source = document.querySelector('canvas');
    if (!source) return null;
    const w = 160;
    const h = 90;
    const context = new OffscreenCanvas(w, h).getContext('2d');
    context.drawImage(source, 0, 0, w, h);
    const data = context.getImageData(0, 0, w, h).data;
    let sum = 0;
    let sumSq = 0;
    const colors = new Set();
    for (let i = 0; i < data.length; i += 4) {
      const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      sum += l;
      sumSq += l * l;
      colors.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
    }
    const mean = sum / (w * h);
    return { mean: Math.round(mean * 100) / 100, std: Math.round(Math.sqrt(Math.max(0, sumSq / (w * h) - mean * mean)) * 100) / 100, colors: colors.size };
  });
}

/**
 * Opens `scene` at fixed time `t` (deterministic steps, paused, drawing buffer kept) in a fresh
 * browser context and waits until it is ready. Page errors collect in the returned `errors`; the
 * caller closes `context`.
 */
export async function openScene(browser, serverUrl, scene, { t, query = '', width = 1920, height = 1080, timeoutMs = 120_000 }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const errors = [];
  try {
    const page = await context.newPage();
    watchPage(page, errors, scene);
    await page.goto(sceneUrl(serverUrl, scene, { t: String(t), capture: '1' }, query), { waitUntil: 'load', timeout: timeoutMs });
    await waitReady(page, timeoutMs);
    return { page, context, errors };
  } catch (error) {
    await context.close().catch(() => {});
    throw new Error([`[${scene}] ${error?.message ?? error}`, ...errors].join('\n'));
  }
}

/** Router parameters the capture tools set themselves (deterministic time, kept drawing buffer). */
const TOOL_PARAMS = new Set(['scene', 't', 'capture', 'paused', 'frames']);

/** Throws a usage error when an extra query would override a parameter the tool controls. */
export function checkExtraQuery(query) {
  const taken = [...new URLSearchParams(query.replace(/^\?/, '')).keys()].filter(key => TOOL_PARAMS.has(key));
  if (taken.length) throw new Error(`--query must not set ${taken.join(', ')}: the tool controls ${[...TOOL_PARAMS].join(', ')}`);
}

/** Debug-router URL for `scene` with extra query parameters (an object and/or a raw "a=1&b=2" string). */
export function sceneUrl(base, scene, params, extra = '') {
  const query = new URLSearchParams({ scene, ...params });
  for (const [key, value] of new URLSearchParams(extra.replace(/^\?/, ''))) query.set(key, value);
  return `${base}index.html?${query}`;
}

/** Runs `main(cleanup)`; registered cleanups always run (also on Ctrl+C and on the watchdog). */
export async function runTool(main, { watchdogSeconds = 600 } = {}) {
  const tasks = [];
  let cleaned = false;
  const cleanup = async () => {
    if (cleaned) return;
    cleaned = true;
    for (const task of tasks.reverse()) {
      await Promise.resolve()
        .then(task)
        .catch(error => log(`cleanup failed: ${error?.message ?? error}`));
    }
  };
  const abort = (reason, code) => {
    log(reason);
    void cleanup().finally(() => process.exit(code));
  };
  process.once('SIGINT', () => abort('interrupted', 130));
  process.once('SIGTERM', () => abort('terminated', 143));
  const watchdog = setTimeout(() => abort(`watchdog: gave up after ${watchdogSeconds} s`, 3), watchdogSeconds * 1000);
  watchdog.unref();
  try {
    return await main(task => tasks.push(task));
  } finally {
    clearTimeout(watchdog);
    await cleanup();
  }
}

/** Parses a numeric CLI option; throws a usage error when it is missing, out of range or not an integer. */
export function numberOption(values, name, { min = -Infinity, integer = false } = {}) {
  const value = Number(values[name]);
  if (!Number.isFinite(value) || value < min || (integer && !Number.isInteger(value))) {
    throw new Error(`--${name} must be ${integer ? 'an integer' : 'a number'} >= ${min}, got "${values[name]}"`);
  }
  return value;
}
