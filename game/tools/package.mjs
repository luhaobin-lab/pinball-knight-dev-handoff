// npm run package [-- --scene play] [--out dir] [--name file.html] [--check]
// Builds this checkout in "package" mode (one JS chunk) and inlines it into one self-contained HTML
// file that runs from file:// with no network: delivery/棺材板下.html, or <dir>/index.html with --out
// (for static hosting). With --scene the page opens that debug scene whenever its URL names none (a
// tiny inline script adds ?scene=<name> via history.replaceState before the module runs). --check
// opens the file from file:// in Chrome and waits until the scene has rendered. Prints JSON { file, bytes, scene }.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { ROOT, buildCheckout, launchChrome, log, runTool, slash, waitReady, watchPage } from './lib/harness.mjs';

const USAGE = 'usage: npm run package [-- --scene name] [--out dir] [--name file.html] [--check]';

let values;
try {
  ({ values } = parseArgs({
    options: {
      scene: { type: 'string' },
      out: { type: 'string' },
      name: { type: 'string' },
      check: { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
    strict: true,
  }));
  if (values.scene && !fs.existsSync(path.join(ROOT, 'src', 'debug', 'scenes', `${values.scene}.ts`))) {
    throw new Error(`--scene: no src/debug/scenes/${values.scene}.ts in this checkout`);
  }
} catch (error) {
  console.error(`${error.message}\n${USAGE}`);
  process.exit(2);
}
if (values.help) {
  console.error(USAGE);
  process.exit(0);
}

/** Runs before the module: adds the default scene to a URL without one, keeping any other parameters. */
const defaultScene = scene =>
  `<script>(function(){var q=new URLSearchParams(location.search);if(q.has('scene'))return;q.set('scene',${JSON.stringify(scene)});` +
  `try{history.replaceState(null,'','?'+q+location.hash)}catch(e){location.replace('?'+q+location.hash)}})()</script>`;

let result = null;
const errors = [];
await runTool(async addCleanup => {
  const dist = await buildCheckout({ mode: 'package' });
  let html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
  const assets = fs.readdirSync(path.join(dist, 'assets'));
  const scripts = assets.filter(f => f.endsWith('.js'));
  if (scripts.length !== 1) throw new Error(`expected exactly one JS chunk in package mode, found: ${scripts.join(', ') || 'none'}`);
  const js = fs.readFileSync(path.join(dist, 'assets', scripts[0]), 'utf8');
  const css = assets
    .filter(f => f.endsWith('.css'))
    .map(f => fs.readFileSync(path.join(dist, 'assets', f), 'utf8'))
    .join('\n');
  html = html
    .replace(/<script\b[^>]*\bsrc="[^"]*"[^>]*><\/script>/g, '')
    .replace(/<link\b[^>]*\brel="(?:stylesheet|modulepreload)"[^>]*>/g, '')
    .replace('</head>', () => `${values.scene ? defaultScene(values.scene) : ''}${css ? `<style>${css}</style>` : ''}</head>`)
    .replace('</body>', () => `<script type="module">${js.replaceAll('</script', '<\\/script')}</script></body>`);
  const external = [...html.matchAll(/\b(?:src|href)="(?!data:|#)([^"]+)"/g)].map(m => m[1]);
  if (external.length) throw new Error(`external references remain: ${external.join(', ')}`);
  const folder = path.resolve(values.out ?? path.join(ROOT, 'delivery'));
  fs.mkdirSync(folder, { recursive: true });
  const file = path.join(folder, values.name ?? (values.out ? 'index.html' : '棺材板下.html'));
  fs.writeFileSync(file, html);
  result = { file: slash(file), bytes: Buffer.byteLength(html), scene: values.scene ?? null };
  log(`packaged ${scripts[0]} into ${slash(file)}`);

  if (values.check) {
    const { browser } = await launchChrome();
    addCleanup(() => browser.close());
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    watchPage(page, errors, 'package');
    await page.goto(pathToFileURL(file).href, { waitUntil: 'load', timeout: 60_000 });
    await waitReady(page, 60_000);
    const opened = await page.evaluate(() => ({ scene: window.__debug?.scene ?? null, search: location.search }));
    if (values.scene && opened.scene !== values.scene) errors.push(`the page opened scene "${opened.scene}", expected "${values.scene}"`);
    result.check = { ...opened, errors: errors.length };
    log(`checked from file://: scene ${opened.scene}, URL ${opened.search}`);
  }
}).catch(error => errors.push(String(error?.stack ?? error)));

process.stdout.write(`${JSON.stringify(result)}\n`);
for (const error of errors) log(error);
process.exitCode = errors.length || !result ? 1 : 0;
