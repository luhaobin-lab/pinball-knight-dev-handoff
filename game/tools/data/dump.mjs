// Reads the parts of the Demo dump that src/content/demo is generated from (read-only).
import fs from 'node:fs';
import path from 'node:path';

export const DEFAULT_DUMP = 'D:/TAPTAPGAME_codex/reference/dump';

export const dumpExists = (dumpDir = DEFAULT_DUMP) => fs.existsSync(path.join(dumpDir, 'datatables', 'CatapultHero'));

const slash = p => p.split(path.sep).join('/');

function walkJson(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkJson(full));
    else if (entry.name.endsWith('.json')) out.push(full);
  }
  return out;
}

/**
 * { datatables, curves, enums, structs }: arrays of { source, json } where `source` is the path relative to the
 * dump root (e.g. "datatables/CatapultHero/数据表/角色/数据表_玩家.json"), sorted by path.
 */
export function readDump(dumpDir = DEFAULT_DUMP) {
  const read = folder =>
    walkJson(path.join(dumpDir, folder)).map(file => ({
      source: slash(path.relative(dumpDir, file)),
      json: JSON.parse(fs.readFileSync(file, 'utf8')),
    }));
  return {
    datatables: read('datatables/CatapultHero'),
    curves: read('curves/CatapultHero'),
    enums: read('enums/CatapultHero'),
    structs: read('structs/CatapultHero'),
  };
}
