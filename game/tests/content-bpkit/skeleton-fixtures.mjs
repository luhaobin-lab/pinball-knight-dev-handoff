// The 5 classes whose generated skeletons are committed under tests/content-bpkit/skeletons and typechecked by
// `npm run check` (acceptance "5 generated skeletons compile"). Regenerate: node tests/content-bpkit/skeleton-fixtures.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { modulePath, moduleSource } from '../../tools/bp/skeleton.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const BASE = 'tests/content-bpkit/skeletons';
export const DUMP = 'D:/TAPTAPGAME_codex/reference/dump';
export const FIXTURES = [
  'CatapultHero/BP/Skill/效果/物品/蓝图_效果_吸血',
  'CatapultHero/BP/Skill/Ability/奖励/蓝图_奖励_获取物品',
  'CatapultHero/BP/Skill/发射物/蓝图_发射物_箭矢',
  'CatapultHero/BP/Skill/效果/玩家/精神状态/蓝图_效果_精神状态',
  'CatapultHero/BP/Skill/效果/玩家/精神状态/蓝图_效果_精神状态_饥饱',
];

/** [file relative to the checkout, source] of every fixture. */
export function generate(classes) {
  return FIXTURES.map(asset => {
    const pseudoText = fs.readFileSync(path.join(DUMP, 'blueprints-pseudo', `${asset}.txt`), 'utf8');
    const blueprint = JSON.parse(fs.readFileSync(path.join(DUMP, 'blueprints', `${asset}.json`), 'utf8'));
    return [modulePath(asset, BASE), moduleSource({ asset, batch: 'content-bpkit', classes, pseudoText, blueprint, root: ROOT, base: BASE })];
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { demoClasses } = await import('../../src/content/demo/classes.ts');
  for (const [rel, src] of generate(demoClasses)) {
    fs.mkdirSync(path.dirname(path.join(ROOT, rel)), { recursive: true });
    fs.writeFileSync(path.join(ROOT, rel), src);
    console.error(`wrote ${rel}`);
  }
}
