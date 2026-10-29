# src/content — game data

- **Owner**: the `content` lane (`src/content/**` and the importers in `tools/data/**`, see `studio/OWNERSHIP.md`).
- **Purpose**: the Demo's data, imported from the dump, is the single source of the game's numbers
  (`demo/`); our names and text will sit beside it, keyed by the Demo's row names.
- **Rules**: pure data and pure helpers under the same rules as `src/core` (type-checked with it, scanned by
  `tests/core/purity.test.ts`, runnable by Node directly). Rows carry the Demo's asset paths (sprites, sounds,
  blueprints) as plain strings for cross-reference only: our visuals key off row names in `src/procgen`.

## demo/ — the Ricochet Abyss Demo data

Generated from `D:/TAPTAPGAME_ref/dump` (read-only; conventions in its `REPORT.md`) by

```sh
node tools/data/import-demo.mjs            # regenerate src/content/demo
node tools/data/import-demo.mjs --check    # exit 1 if the files differ from what the dump produces
node tools/data/import-demo.mjs --dump <dir>
```

The output is deterministic; `tests/content-import/roundtrip.test.ts` runs the `--check` comparison as part of
`npm run check` (skipped when the dump is not on the machine). Never edit generated files by hand.

| File | What |
|---|---|
| `data/<表名>.ts` | one module per table, all 49 (45 DataTables + 4 合成数据表 composites), named as in the Demo |
| `data/曲线表.ts`, `data/评分衰减曲线.ts` | the two CurveTables |
| `data/curve-assets.ts` | the other 30 curve assets: blueprint timeline curves and the 轨迹渐变 colour ramp |
| `data/enums.ts`, `data/structs.ts` | the 23 user enums and 45 user structs (fields, raw GUID names, defaults) |
| `types.ts` | generated types: every struct, enum and table's row names |
| `tables.ts` | the named exports `index.ts` re-exports (live tables only) |
| `registry.ts` | every live table by asset path (opt-in: it imports all of them) |
| `manifest.json` | the import report: per table its source, row counts, dropped and flagged rows, sizes |
| `index.ts`, `composite.ts` | hand-written: accessors, and the composite-table merge |

Each `data/` module is `const table: DemoTable<Row, RowNames> = <JSON>; export default table;`: the payload is
plain JSON (one row per line), and `tsc` checks every row against `types.ts`. The modules are `.ts` rather than
`.json` because `src/content` may only import `.ts` modules (`tests/core/purity.test.ts`).

### Normalization

Row names, field names and table names stay as in the Demo (Chinese), so specs, the dump and the blueprint
pseudo-code can be cross-referenced. Rows keep the Demo's order (UE `GetDataTableRowNames`).

| Dump | Here |
|---|---|
| `结构_科学数 {系数, 指数}` | `{值, 系数, 指数}`: `值` = 系数 × 10^指数 exactly like `函数库_科学数.科学数变普通`, so it carries the same double rounding (1.1e2 → 110.00000000000001); use the raw pair for 科学数 arithmetic |
| FText `{text, en, ns, key}` | `{zh, en}`; `en` repeats `zh` where the Demo has no translation (what UE shows); culture-invariant texts are the same in both; empty is `{zh: '', en: ''}` |
| object reference `Class'/Game/Pkg.Obj'` | asset path `Pkg` (package path minus `/Game/`; `.Obj` appended only when it is not the package name or its `_C` class) |
| enum `{$enum, name, value, display}` | the display name (`demoEnums` maps it back to the UE value) |
| map | a plain object (the dump writes empty maps as `[]` and tag-keyed maps as `[{key, value}]`) |
| `GameplayTag {TagName}` / `GameplayTagContainer` | the tag string / an array of tag strings |
| `DataTableRowHandle` | `{DataTable: asset path or null, RowName}` |
| composite table | parent list only; rows are merged from the parents at load like `UCompositeDataTable` (a later parent's row replaces an earlier one in place) |
| curves | keys as dumped; `DefaultValue` and the extrapolations filled with the `FRichCurve` defaults the cooked assets omit |

### What is dropped, flagged or left out

- **Test rows are dropped** when the row key marks them as tests (`测试`) and no kept row references them: 31 rows
  (e.g. `数据表_玩家.测试`, `数据表_敌人_普通.*_测试`, `数据表_修炼物品_通用.测试附魔/测试人偶`). The Demo only reaches them
  through `蓝图_动作游戏模式.测试模式？`, which is off. `manifest.json` lists each one.
- **Rows that need care are kept and flagged** (`table.flags[row]`, also in `manifest.json`): designer notes stored as
  rows (`注意：…`, `---------`), references to rows that do not exist, references to deprecated tables, rows carrying
  the `Test`/`Tests` tag, and live texts without English.
- **过期 (deprecated) tables** (8) are kept in `data/` with `deprecated: true` but are not exported from `index.ts`
  or `registry.ts`; curve assets of deprecated blueprints are marked the same way in `demoCurveAssets`.
- Left out entirely: FText localization ids, enum `NewEnumeratorN` names in rows, class prefixes of references,
  struct GUIDs and property flags, curve export indices. Blueprints, widgets, levels, native code and config are not
  imported here.

### Using it

```ts
import { baseAttribute, findRow, resolveRowHandle, 数据表_修炼物品_通用, 数据表_技能_默认, 数据表_玩家 } from '../content/demo/index.ts';

const 旧剑 = 数据表_修炼物品_通用.rows.旧剑;          // typed row; row names are a union type
旧剑.属性.行动力;                                    // 15
baseAttribute(旧剑.科学词条, '基础伤害')?.值;        // 20 (the table's base source; runtime aggregation is src/core's job)
resolveRowHandle(数据表_玩家.rows.幽冥骑士.固定技能[0]!, [数据表_技能_默认]); // the 可控挥击 row
findRow(数据表_技能_默认, someRowName);              // undefined if absent
```

Import tables by name: every table is its own module, so a bundle keeps only the tables it uses (`registry.ts` is the
deliberate exception). Size: 4.3 MB of source in total, 4.2 MB of it in `data/`; all live tables minified come to
3.2 MB (130 KB gzip), one table such as `数据表_玩家` to 43 KB.
