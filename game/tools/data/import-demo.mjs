// node tools/data/import-demo.mjs [--dump D:/TAPTAPGAME_ref/dump] [--check]
//
// Regenerates src/content/demo from the Ricochet Abyss Demo dump: data/ (one typed module per table and curve table,
// plus curve assets, enums and structs), types.ts, tables.ts, registry.ts and manifest.json; and the blueprint-side
// manifests (tools/data/manifests.mjs): demo/{classes,anims,tags,widgets,reachable}.ts and text/strings.ts (from the
// text folder beside the dump). The output is deterministic. --check writes nothing and exits 1 when the files on
// disk differ from what the dump produces. The dump is only read. Logs go to stderr, the JSON summary to stdout.
import { parseArgs } from 'node:util';
import { buildDemoContent } from './build.mjs';
import { DEFAULT_DUMP, dumpExists } from './dump.mjs';
import { buildManifests } from './manifests.mjs';
import { compareGenerated, compareManifests, writeGenerated, writeManifests } from './output.mjs';

const { values } = parseArgs({
  options: { dump: { type: 'string', default: DEFAULT_DUMP }, check: { type: 'boolean', default: false } },
  strict: true,
});
if (!dumpExists(values.dump)) {
  console.error(`dump not found: ${values.dump}`);
  process.exit(2);
}

const demo = buildDemoContent(values.dump);
const { files, manifest } = demo;
const manifests = buildManifests(values.dump, demo);
const diff = compareGenerated(files);
const mdiff = compareManifests(manifests.files);
if (values.check) {
  for (const rel of diff.changed) console.error(`out of date: src/content/demo/${rel}`);
  for (const rel of diff.stale) console.error(`stale: src/content/demo/${rel}`);
  for (const rel of mdiff.changed) console.error(`out of date: src/content/${rel}`);
} else {
  writeGenerated(files, diff);
  writeManifests(manifests.files, mdiff);
  console.error(`wrote ${diff.changed.length + mdiff.changed.length} file(s), removed ${diff.stale.length} under src/content`);
}

const changed = diff.changed.length + mdiff.changed.length;
const upToDate = changed === 0 && diff.stale.length === 0;
process.stdout.write(`${JSON.stringify({ check: values.check, upToDate, changed, stale: diff.stale.length, ...manifest.totals, manifests: manifests.summary })}\n`);
if (values.check && !upToDate) process.exit(1);
