// Validates evidence integrity independently of browser rendering; no gameplay or source writes.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
const root = path.resolve(process.argv[2] ?? 'spec/parity/catalog');
const d = JSON.parse(fs.readFileSync(path.join(root, 'catalog.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const sha = b => createHash('sha256').update(b).digest('hex');
for (const x of manifest.outputs) assert.equal(sha(fs.readFileSync(path.join(root, x.name))), x.sha256, `output hash:${x.name}`);
assert.deepEqual(d.validation.errors, []);
assert.equal(new Set(d.rows.map(r => r.id)).size, d.rows.length);
assert.equal(d.summary.tables, d.tables.length);
assert.equal(d.rows.length, 2546);
assert.equal(d.classes.length, 793);
assert.equal(d.functions.length, 5240);
assert.ok(d.functions.every(f => f.endsInEndOfScript));
const rawCache = new Map(), physical = d.rows.filter(r => !r.composite);
for (const row of d.rows) {
  const file = path.join(d.referenceRoot, row.source.path);
  if (!rawCache.has(file)) { const text = fs.readFileSync(file, 'utf8'); rawCache.set(file, { text, json: JSON.parse(text) }); }
  const source = rawCache.get(file);
  assert.ok(Object.hasOwn(source.json.rows, row.row), `source row exists:${row.id}`);
  assert.ok(source.text.split('\n')[row.source.line - 1].includes(JSON.stringify(row.row)), `exact source row line:${row.id}`);
  assert.equal(sha(source.text), row.source.sha256);
  assert.ok(row.data && row.source.pointer && row.implementation && row.differences.length);
  for (const dep of row.requiredClasses) assert.ok(d.classes.some(c => c.path === dep), `class dependency resolves:${row.id} -> ${dep}`);
  if (row.mechanics) for (const group of ['fixedSkills', 'randomNormalSkills', 'randomEliteSkills']) for (const skill of row.mechanics[group]) {
    if (!skill.rowId) continue; assert.ok(skill.source && skill.parameters && skill.conditions && skill.classAndEffects, `full skill data:${row.id} ${skill.rowId}`);
  }
}
assert.equal(physical.filter(r => r.category === 'item' && r.reachable === 'demo-reachable-static').length, 172);
assert.equal(physical.filter(r => r.category === 'talent' && r.reachable === 'demo-reachable-static').length, 93);
assert.equal(physical.filter(r => ['enemy', 'boss'].includes(r.category) && r.reachable === 'demo-reachable-static').length, 14);
assert.equal(physical.filter(r => r.category === 'map-tile' && r.reachable === 'demo-reachable-static').length, 21);
const eye = d.rows.find(r => r.id === '数据表_敌人_普通#眼球');
assert.ok(eye.requiredClasses.includes('CatapultHero/BP/Skill/效果/敌人/蓝图_效果_吸血'));
assert.ok(!eye.requiredClasses.includes('CatapultHero/BP/Skill/效果/物品/蓝图_效果_吸血'), 'ambiguous short class names must not create false missing dependencies');
const boss = d.rows.find(r => r.id === '数据表_敌人_普通#守门人');
assert.equal(boss.mechanics.fixedSkills.length, 7);
assert.ok(boss.differences.some(x => x.includes('首领_守门人')));
assert.ok(d.nativeInventory.criticalGaps.some(g => g.id === 'NATIVE-PRD-SEQUENCE'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const embedded = html.slice(html.indexOf('<script id="catalogue" type="application/json">') + '<script id="catalogue" type="application/json">'.length, html.indexOf('</script>'));
assert.equal(JSON.parse(embedded).sourceCommit, d.sourceCommit);
new vm.Script(html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>')));
console.log(JSON.stringify({ valid: true, rows: d.rows.length, physicalRows: physical.length, classes: d.classes.length, functions: d.functions.length, sourceTablesChecked: rawCache.size, outputHashesChecked: manifest.outputs.length, duplicateNameRegression: 'passed', HTML: 'embedded JSON and executable script parse' }, null, 2));
