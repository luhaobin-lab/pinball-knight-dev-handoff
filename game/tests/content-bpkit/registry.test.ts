import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { batches, registry } from '../../src/content/bp/index.ts';
import { demoAnims } from '../../src/content/demo/anims.ts';
import { demoClasses } from '../../src/content/demo/classes.ts';
import { scopedClasses } from '../../src/content/demo/reachable.ts';
import { demoTags } from '../../src/content/demo/tags.ts';
import type { AnimDef, BpCtor, ClassDef, Tag } from '../../src/core/sim/types.ts';
import { assignOwners } from '../../tools/bp/batches.mjs';
import { computeReach } from '../../tools/data/reach.mjs';
import { ROOT } from './skeleton-fixtures.mjs';

// The registry rules of studio/ARCHITECTURE.md §7.3 over the modules registered so far (card content-bpkit).

const BP_DIR = path.join(ROOT, 'src/content/bp');
const SKILL = 'CatapultHero/BP/Skill/';
const STATIC_PATH = /static\s+(?:override\s+)?readonly\s+path(?:\s*:\s*\w+)?\s*=\s*'([^']+)'/g;
const DUMP = 'D:/TAPTAPGAME_codex/reference/dump';
// The player's live G2 passive requires the pickup base and vortex before Wave B. Keep their original owner,
// explicitly accounting for the two other env-hazards classes that remain outside the approved G2 content.
const G2_DEFERRED_ENV = new Set([
  `${SKILL}效果/可拾取物/蓝图_可拾取物_保护罩`,
  `${SKILL}效果/可拾取物/蓝图_可拾取物_尖刺`,
]);

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.ts') ? [path.join(dir, e.name)] : []));
}
const modules = walk(BP_DIR).filter(f => !f.startsWith(path.join(BP_DIR, 'batches')) && f !== path.join(BP_DIR, 'index.ts'));
const posix = (p: string) => p.split(path.sep).join('/');
/** Paths the core base classes declare (they register themselves, §7.3). */
const corePaths = new Set(walk(path.join(ROOT, 'src/core')).flatMap(f => [...fs.readFileSync(f, 'utf8').matchAll(STATIC_PATH)].map(m => m[1])));

// The manifests satisfy the core's DemoData contract structurally.
const _classes: Readonly<Record<string, ClassDef>> = demoClasses;
const _anims: Readonly<Record<string, AnimDef>> = demoAnims;
const _tags: readonly Tag[] = demoTags;
void [_classes, _anims, _tags];

describe('content registry', () => {
  const all: BpCtor[] = Object.values(batches).flat();

  it('registers every module exactly once, under a path the manifest knows', () => {
    expect(registry.size).toBe(all.length);
    for (const cls of all) expect(Object.hasOwn(demoClasses, cls.path), cls.path).toBe(true);
  });

  it("puts each module at its Demo path, declaring exactly its own class's path", () => {
    for (const file of modules) {
      const paths = [...fs.readFileSync(file, 'utf8').matchAll(STATIC_PATH)].map(m => m[1]);
      expect(paths, file).toHaveLength(1);
      expect(posix(path.relative(BP_DIR, file)), file).toBe(`${paths[0].slice('CatapultHero/BP/'.length)}.ts`);
    }
  });

  it('extends the TS class of the manifest parent', () => {
    for (const cls of all) {
      const parent = demoClasses[cls.path].parent;
      const proto = Object.getPrototypeOf(cls) as { path?: string };
      expect(proto.path ?? null, cls.path).toBe(parent);
    }
  });

  it('never declares tags (they come from the manifest)', () => {
    for (const file of modules) expect(fs.readFileSync(file, 'utf8'), file).not.toMatch(/OwnedGameplayTags\s*[=:]/);
  });

  it.skipIf(!fs.existsSync(`${DUMP}/blueprints-pseudo`))('registers each class in its owner card, and a card that started registers all it owns', () => {
    const owners = assignOwners(computeReach(DUMP));
    const ownerOf = (p: string) => owners.owner[p.slice(SKILL.length)];
    const registered = new Set([...registry.paths(), ...corePaths]);
    for (const [card, list] of Object.entries(batches)) {
      for (const cls of list) if (cls.path.startsWith(SKILL)) expect(ownerOf(cls.path), cls.path).toBe(card);
      if (list.length === 0) continue;
      const missing = (owners.cards[card] ?? []).map(s => SKILL + s).filter(p => !registered.has(p));
      expect(missing.filter(p => !(card === 'env-hazards' && G2_DEFERRED_ENV.has(p))), `${card} has undeclared partial implementation`).toEqual([]);
    }
    // Allowed unported for now: the scoped classes of cards that have not registered anything yet.
    const unported = scopedClasses.filter(p => !registered.has(p));
    for (const p of unported) {
      if (G2_DEFERRED_ENV.has(p)) { expect(ownerOf(p)).toBe('env-hazards'); continue; }
      expect(batches[ownerOf(p)]?.length ?? 0, p).toBe(0);
    }
  });
});
