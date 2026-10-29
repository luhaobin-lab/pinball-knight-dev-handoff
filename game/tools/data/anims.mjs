// The animation manifest (src/content/demo/anims.ts, studio/ARCHITECTURE.md §4.8): every PaperZD flipbook sequence
// under 精灵片 with its length (ΣFrameRun / FramesPerSecond of its flipbook) and its notifies, and the sequence list
// of every live table row that has 动画.精灵动画序列. Read from dump/raw (the cooked packages).
import fs from 'node:fs';
import path from 'node:path';

/** UPaperFlipbook defaults the cooked package omits. */
const FLIPBOOK_FPS_DEFAULT = 15;
const FRAME_RUN_DEFAULT = 1;
const byCodePoint = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function walk(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .sort((a, b) => byCodePoint(a.name, b.name))
    .flatMap(e => (e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.json') ? [path.join(dir, e.name)] : []));
}

/** "/Game/CatapultHero/X/Y.0" -> "CatapultHero/X/Y". */
const packageOf = objectPath => objectPath.replace(/^\/Game\//, '').replace(/\.\d+$/, '');
const className = cls => /'\/Game\/([^.']+)\./.exec(cls)?.[1] ?? /'([^']+)'/.exec(cls)?.[1] ?? cls;

/** Notify properties kept: numbers, booleans, strings and object references (as package paths). */
function notifyProps(props) {
  const out = {};
  for (const [k, v] of Object.entries(props ?? {})) {
    if (k === 'Name' || k === 'Time' || k === 'Duration' || k === 'TrackIndex') continue;
    if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') out[k] = v;
    else if (v && typeof v === 'object' && typeof v.ObjectPath === 'string') out[k] = packageOf(v.ObjectPath);
  }
  return out;
}

/** sequences: asset path -> { length, flipbooks, frames, fps, notifies }. */
export function readAnims(dumpDir) {
  const rawRoot = path.join(dumpDir, 'raw', 'Game');
  const readPackage = pkg => JSON.parse(fs.readFileSync(path.join(rawRoot, `${pkg}.json`), 'utf8'));
  const flipbooks = new Map();
  const flipbook = pkg => {
    if (!flipbooks.has(pkg)) {
      const fb = readPackage(pkg).find(e => e.Type === 'PaperFlipbook');
      if (!fb) throw new Error(`${pkg}: no PaperFlipbook export`);
      const fps = fb.Properties.FramesPerSecond ?? FLIPBOOK_FPS_DEFAULT;
      const frames = (fb.Properties.KeyFrames ?? []).reduce((n, k) => n + (k.FrameRun ?? FRAME_RUN_DEFAULT), 0);
      flipbooks.set(pkg, { fps, frames, length: fps === 0 ? 0 : frames / fps });
    }
    return flipbooks.get(pkg);
  };

  const sequences = {};
  for (const file of walk(path.join(rawRoot, 'CatapultHero', '精灵片'))) {
    const exports = JSON.parse(fs.readFileSync(file, 'utf8'));
    const seq = Array.isArray(exports) ? exports.find(e => e.Type === 'PaperZDAnimSequence_Flipbook') : undefined;
    if (!seq) continue;
    const asset = packageOf(seq.Package);
    const books = (seq.Properties.AnimData ?? []).map(d => d.Animation?.ObjectPath).filter(Boolean).map(packageOf);
    const main = books.length ? flipbook(books[0]) : { fps: 0, frames: 0, length: 0 };
    const notifies = exports
      .filter(e => e !== seq && e.Outer?.ObjectPath && packageOf(e.Outer.ObjectPath) === asset)
      .map(e => ({
        class: className(e.Class),
        name: e.Properties?.Name ?? e.Name,
        time: e.Properties?.Time ?? 0,
        // SPEC-GAP: a notify state's Duration is omitted when it equals the PaperZD default; 0 here, as for plain notifies.
        duration: e.Properties?.Duration ?? 0,
        track: e.Properties?.TrackIndex ?? 0,
        ...notifyProps(e.Properties),
      }))
      .sort((a, b) => a.time - b.time || byCodePoint(a.name, b.name));
    sequences[asset] = { path: asset, length: main.length, frames: main.frames, fps: main.fps, flipbooks: books, notifies };
  }
  return Object.fromEntries(Object.entries(sequences).sort(([a], [b]) => byCodePoint(a, b)));
}

/** 'table:row' -> its 动画.精灵动画序列 (asset paths), for every live row that has one. */
export function actorAnims(tableRows) {
  const out = {};
  for (const [t, r, row] of tableRows) {
    const list = row?.动画?.精灵动画序列;
    if (Array.isArray(list)) out[`${t}:${r}`] = list;
  }
  return out;
}
