import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { demoClasses } from '../../src/content/demo/classes.ts';
import { batchSource, tsType } from '../../tools/bp/skeleton.mjs';
import { DUMP, FIXTURES, ROOT, generate } from './skeleton-fixtures.mjs';
import { 蓝图_效果_精神状态_饥饱 } from './skeletons/Skill/效果/玩家/精神状态/蓝图_效果_精神状态_饥饱.ts';
import { 蓝图_效果_精神状态 } from './skeletons/Skill/效果/玩家/精神状态/蓝图_效果_精神状态.ts';

// tools/bp/skeleton.mjs: the 5 committed skeletons under ./skeletons are what the tool generates today, and
// `npm run check` typechecks them against the generated core declarations.

describe.skipIf(!fs.existsSync(`${DUMP}/blueprints-pseudo`))('skeletons', () => {
  it('are up to date with the tool', () => {
    const out = generate(demoClasses);
    expect(out).toHaveLength(FIXTURES.length);
    for (const [rel, src] of out) expect(fs.readFileSync(path.join(ROOT, rel), 'utf8').replaceAll('\r\n', '\n'), rel).toBe(src);
  });

  it('extend the manifest parent and carry the asset path', () => {
    expect(蓝图_效果_精神状态_饥饱.path).toBe('CatapultHero/BP/Skill/效果/玩家/精神状态/蓝图_效果_精神状态_饥饱');
    expect(Object.getPrototypeOf(蓝图_效果_精神状态_饥饱)).toBe(蓝图_效果_精神状态);
  });
});

describe('batch registration', () => {
  it('adds the import and the entry to the pre-created batch file, once', () => {
    const empty = "/** Batch `bp-items-2`. */\nimport type { BpCtor } from '../../../core/sim/types.ts';\n\nconst batch: readonly BpCtor[] = [];\nexport default batch;\n";
    const once = batchSource(empty, 'src/content/bp/batches/bp-items-2.ts', 'src/content/bp/Skill/效果/物品/蓝图_效果_吸血.ts', '蓝图_效果_吸血');
    expect(once).toContain("import { 蓝图_效果_吸血 } from '../Skill/效果/物品/蓝图_效果_吸血.ts';");
    expect(once).toContain('const batch: readonly BpCtor[] = [\n  蓝图_效果_吸血,\n];');
    const twice = batchSource(once, 'src/content/bp/batches/bp-items-2.ts', 'src/content/bp/Skill/效果/物品/蓝图_效果_X.ts', '蓝图_效果_X');
    expect(twice).toContain('  蓝图_效果_吸血,\n  蓝图_效果_X,\n];');
    expect(batchSource(twice, 'src/content/bp/batches/bp-items-2.ts', 'src/content/bp/Skill/效果/物品/蓝图_效果_X.ts', '蓝图_效果_X')).toBe(twice);
  });
  it('maps blueprint types to TS types', () => {
    expect(tsType('Double')).toBe('number');
    expect(tsType('Array<Struct<GameplayTag>>')).toBe('string[]');
    expect(tsType('Map<Str, Int>')).toBe('Record<string, number>');
    expect(tsType('Struct<结构_科学数>')).toBe('{ 系数: number; 指数: number }');
    expect(tsType('Object<BP_ManeActor_C>')).toBe('unknown');
  });
});
