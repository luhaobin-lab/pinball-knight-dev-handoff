// node tests/audio-sfx/render.mjs [--out dir] [--seed n] [--nobuild]
// Builds this checkout, opens the audio-sfx debug scene with ?render=1 in Chrome (tools/lib/harness.mjs: own
// server and browser, always cleaned up), and writes what the scene rendered offline: <cue>.wav, <cue>.json,
// <cue>.png (spectrogram) for every cue, the wind loop, the launch sequence, the ping-pong launch and the steal check,
// summary.json and a page shot.
// Default --out: D:/TAPTAPGAME_studio/shots/audio-sfx/. Prints the written files as JSON.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { buildCheckout, launchChrome, openScene, runTool, serve, slash, studioDir } from '../../tools/lib/harness.mjs';

const { values } = parseArgs({
  options: { out: { type: 'string' }, seed: { type: 'string', default: '1' }, nobuild: { type: 'boolean', default: false } },
  strict: true,
});
const outDir = path.resolve(values.out ?? path.join(studioDir(), 'shots', 'audio-sfx'));
const written = [];

await runTool(
  async addCleanup => {
    fs.mkdirSync(outDir, { recursive: true });
    const dist = await buildCheckout({ reuse: values.nobuild });
    const server = await serve(dist);
    addCleanup(server.close);
    const { browser } = await launchChrome();
    addCleanup(() => browser.close());
    const { page, context, errors } = await openScene(browser, server.url, 'audio-sfx', { t: 0, query: `render=1&seed=${values.seed}`, timeoutMs: 300_000 });
    addCleanup(() => context.close());
    const report = await page.evaluate(() => window.__audioSfx);
    if (!report) throw new Error('the scene published no window.__audioSfx');
    for (const a of report.artifacts) {
      const file = path.join(outDir, a.name);
      fs.writeFileSync(file, Buffer.from(a.data, 'base64'));
      written.push(slash(file));
    }
    const summary = path.join(outDir, 'summary.json');
    fs.writeFileSync(summary, JSON.stringify({ seed: report.seed, cues: report.cues.map(c => ({ name: c.name, demo: c.demo, ...c.metrics, ...(c.steal ? { steal: c.steal } : {}) })) }, null, 1));
    written.push(slash(summary));
    const shot = path.join(outDir, 'audio-sfx.png');
    await page.screenshot({ path: shot });
    written.push(slash(shot));
    if (errors.length) throw new Error(errors.join('\n'));
  },
  { watchdogSeconds: 900 },
);

process.stdout.write(`${JSON.stringify(written)}\n`);
