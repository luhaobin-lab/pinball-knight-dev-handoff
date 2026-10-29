# tools/bp — blueprint porting tools (card content-bpkit)

All three read the Demo dump (`D:/TAPTAPGAME_ref/dump`, read-only) and the manifests that
`node tools/data/import-demo.mjs` generates (`src/content/demo/{classes,anims,tags,widgets,reachable}.ts`,
`src/content/text/strings.ts`). Conventions: `studio/ARCHITECTURE.md` §7.

| Command | What |
|---|---|
| `node tools/bp/skeleton.mjs <asset> --batch <card> [--force] [--dry]` | Writes `src/content/bp/<path>.ts` (header, class extending the manifest parent, CDO field initializers, one method per function/event with its pseudo-code as comments), registers it in `src/content/bp/batches/<card>.ts` and writes `tests/<card>/<name>.test.ts`. Existing module and test files are kept unless `--force`. `<asset>` may omit `CatapultHero/BP/`. |
| `node tools/bp/batches.mjs [--out file] [--compare owners.json]` | Owner card of every scoped skill class (hand map `tools/bp/owners.mjs`, then the 效果/物品 and 效果/天赋 folder batches split by pseudo lines) → `D:/TAPTAPGAME_studio/tmp/bp-owners.json`. |
| `node tools/bp/coverage.mjs [--report report.json] [--card id] [--json]` | Ported / stubbed (and, with a bot report, hit) scoped classes per owner card. A class is ported when a module declaring `static … path = '<asset>'` is imported by a batch file (or lives in `src/core`). |

Skeleton notes:

- Overrides copy the parent's TS signature (searched up the manifest parent chain, `src/core` bases included) and call
  `super` until translated; a function the blueprint introduces calls `this.world.unported('<Class>.<fn>')`. If an
  override's base signature is not found, the skeleton says so with a `SPEC-GAP` comment and declares it from the pseudo
  types.
- Inherited CDO overrides are listed as comments (never redeclare a base field); the runtime applies them from
  `classes.ts` (`overrides`).
- Event bodies are the ubergraph section that starts at the event's entry label; shared tail labels (`goto L1056`) are
  in the other sections or at the end of the ubergraph.

Reachability (`tools/data/reach.mjs`, scope in `tools/data/scope.mjs`) is the authoritative port of the planner's
`plan_scope.py` (349 classes) and of the architect's `content_stats.py` (495 live classes); both reproduce exactly.
