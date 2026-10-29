# src/core — deterministic rules

- **Owner**: per folder and per module (`studio/OWNERSHIP.md`, `studio/WAVE_A.md` §5 and Appendix W2).
- **Purpose**: the pure simulation: ricochet physics, damage, items, effects, enemy intents, map generation,
  run state. The aim preview and the real shot are the same function, so they always agree.
- **Rules** (enforced by `tsc -p src/core`, `tests/core/purity.test.ts` and `tests/core-contracts/layering.test.ts`):
  - no DOM, no three.js, no packages, no `Math.random` / `Date.now` / `performance.now`, no timers;
  - no frame-rate dependence: time advances in explicit steps;
  - erasable TypeScript only (no enums, namespaces, parameter properties) and relative imports with an explicit
    `.ts` extension, so Node runs it directly (`tools/bot.mjs`);
  - mechanics, formulas and numbers follow `spec/`; unknowns get `// SPEC-GAP: ...`.
- **Public API**: `rng.ts`: `createRng(seed)` returns `{ next, nextU32, int, range, chance, pick, shuffle,
  derive(key), getState, setState }`; plus `hashString`, `mixSeed`, `normalizeSeed`. Algorithm: sfc32 seeded by
  splitmix32, locked by golden tests. If `spec/` requires the Demo's own random stream (UE `FRandomStream`) for
  parity, add it beside this one instead of changing it.

## Layout and contracts (wave A, `studio/ARCHITECTURE.md` Appendix A, `studio/WAVE_A.md` §3)

| Folder | What | Owner |
|---|---|---|
| `api/` | The game API the shell and the bot use: `types.ts` (`GameOptions`, `Game`, saves, coverage), `commands.ts`, `view.ts`, `events.ts` (`PresentEvent`), `compose.ts` (`SysModule`, view / legal / command routing over the modules); `game.ts` (`createGame`) | core-contracts; `game.ts` core-sim |
| `sim/` | `world.ts` (World, SimClock, LatentService, PresentBus, Coverage, ModalService), `object.ts` (`BpObject`, `Fx`), `tags.ts` (`TagSet`), `types.ts`; the **generated** Demo classes: `actor` BP_ManeActor, `player`, `other`, `card`, `mode` 蓝图_动作游戏模式, `cult` 修炼系统, `cult-grid`, `controller`, `room`, `room-cell`, `junction`, `settlement` 蓝图_动画结算 | core-contracts (the runtime files `createWorld` adds: core-sim) |
| `ability/` | **generated** 蓝图_效果 / 蓝图_能力 / 蓝图_发射物; `dispatch.ts` (`fireLive`, `fireCopy`, `tickCopy`, `forLive`) | core-contracts; `dispatch.ts` core-ability |
| `bp/` | `index.ts`: the **generated** library facades 函数库_工具 / 技能 / 科学数 / 战斗日志; `structs.ts`: runtime structs (`make伤害`, `make治疗`, `make效果配置`, `效果配置From`, `makeHitResult`, `structOf`); `systems.ts`: the **generated** `Systems` table type; `widgets.ts`: the **generated** widget function facades other modules call (`UI_关卡地图页面` → map, `UI_冒险结束统计页` → run; add one by listing it in `fn-modules.json`) | core-contracts |
| `sys/<module>/` | The 26 modules of WAVE_A Appendix W2 (`createSystems` in `sys/index.ts`); each implements the Demo functions of its `<Module>Fns` interface | one card per module |
| `math/`, `rng/` | 科学数, stats, kismet, PRD and weights, UE `FRandomStream`, Rand15, RNG domains | core-math |

**Layers** (`tests/core-contracts/layering.test.ts`): `math`/`rng` import only themselves and `src/content/demo`;
`sim`/`ability`/`bp`/`text` add each other and `sys/index.ts`; a module under `sys/<m>/` imports the runtime and its
own folder, never another module (it calls other modules through the facade); `src/content/bp` imports the runtime;
type-only imports of the `api` contract files are allowed everywhere in core. `src/game`, `src/debug` and `src/audio`
never import the core internals (`sim`, `ability`, `bp`, `sys`, `math`, `text`) nor `src/content/bp` beyond its
`index.ts`; `src/ui` not even `api` (it gets plain view models).

### The facade (`tools/gen/facade.mjs`, decision D8)

The 19 Demo system classes and libraries are declared by the generator from the pseudo-code; never edit the generated
files (they say so in their first line). Change `tools/gen/facade.mjs`, `tools/gen/fn-modules.json` (function → module)
or `tools/gen/names.json` (D11 renames) and run `node tools/gen/facade.mjs` (`--check` exits 1 when stale, `--report`
prints the function table). `tests/core-contracts/generator.test.ts` re-reads the pseudo independently and checks every
function and plain variable.

- **Fields**: one per blueprint variable, initialised with its CDO default (inherited CDO overrides become
  `override` fields). Widget, component, timeline-internal, `K2Node_`/`Temp_` variables are not declared.
- **Methods**: one per Demo function, delegating to exactly one module:
  `造成即时伤害(伤害数据) → world.sys.damage.BP_ManeActor?.造成即时伤害(this, 伤害数据)`. Libraries take the calling
  object as the world context first: `函数库_工具.吸附到网格(ctx, InVec, 偏移, 吸附大小)` → `sys.kernel.函数库_工具`.
  A subclass override delegates under its own class (`sys.<m>.BP_Actor_Card.结束行动`).
- **Missing implementation**: the method calls `world.unported('<Class>.<fn>')` (throws when `world.strict`, else counts
  in coverage) and returns the neutral value of its return type. Buckets that are not modules: `present` and `engine`
  (input mappings, component delegates) are no-ops, `dead` always calls `unported`, `math` (函数库_科学数) calls
  `src/core/math` directly.
- **Signatures**: inputs in pseudo order; `[out]` parameters come back as one object `{ out1, out2, ReturnValue? }`, a lone
  `[return]` as the return type. `[ref]` objects, arrays, maps and structs are shared JS references, so in-place writes
  reach the caller. A `[ref]` scalar the body assigns is passed in and also returned as an out field of the same name
  (callers store it back): only `函数库_工具.递减强化属性` → `{ 被强化属性 }`. A struct passed **by value** in UE is a
  copy: an implementation that mutates one copies it first.
- **Types**: object references `X | null` (Demo subclasses by their generated base, other actors `BpObject | null`);
  assets and classes `AssetPath | null`; Text `FText { zh, en }`; Name's zero value is `'None'`; RandomStream is the
  `UeStream` of `rng/ue.ts` (advanced in place); TimerHandle is the latent timer name (`string`); InputRange
  `{ Min, Max }`; engine enums `number`; UI widgets `unknown`. Data-shaped structs keep their content key names
  (`structOf('结构_角色', …)`); runtime structs (`伤害`, `治疗`, `效果配置`) use mangled names.
- **Names** (D11): characters that cannot appear in an identifier are dropped at the end and replaced by `_` inside
  (`是敌人？` → `是敌人`, `添加装备掉落(旧)` → `添加装备掉落_旧`); the generator fails on a collision inside a class
  unless `names.json` resolves it (`被抓起？` → `被抓起_Q`, `科学数<=` → `科学数小于等于`).

Implementing a module (`src/core/sys/damage/index.ts`):

```ts
import type { Systems } from '../../bp/systems.ts';
export const damage: Systems['damage'] = {
  BP_ManeActor: { 造成即时伤害(self, 伤害数据) { /* port of BP_ManeActor L…, labels in comments */ } },
  commands: { /* only modules with player commands */ },
};
```

**Tests before `wa/sim`**: `tests/fixtures/stub-world.ts` gives an inert World: `stubWorld({ sys, systems, strict,
registry, data })` with a manual clock (runs only in `advance` / `runUntil`), recorded latent calls (`latentCalls`,
`fireLatent(i)`), recorded `fx` calls, `unportedCalls`, a working modal service and `spawn` / `destroy`; `blankDef()`
makes a ClassDef for direct construction (`new BP_ManeActor(w, blankDef())`).

## Launch (`launch/`)

The Demo's launch, collision and ricochet system, ported 1:1 from the native `LaunchTrajectoryLibrary` and the
Blueprints that drive it (`碰撞预览圈`, `蓝图_效果_可控弹射`, `蓝图_效果_可控反弹时交互`). Sources: the drafts
`native-trajectory`, `launch-movement` and `trajectory-preview` in `D:/TAPTAPGAME_ref/spec-drafts/`, checked against
the dump (cited next to each rule in the code). Import from `launch/index.ts`.

**Frame and units.** A top-down plane: x east, y south (= the renderer's z); angles turn from +x toward +y.
Distances are Unreal units (uu), 64 per tile: `tilesToUu`, `uuToTiles`, `tilePointToUu(x, z)`,
`uuPointToTiles(p)`. Times are game seconds.

```ts
const world = createLaunchWorld({ grid, bodies, circles, boxes, pickups });
const preview = computeLaunchPreview(world, hero, aimVector(hero, cursor), { hero: STARTER_HERO }); // every aim change
const launch = planLaunch(preview);                       // on release
const { position, velocity, leg } = samplePlayback(launch, t);   // every frame, t = game time since release
for (const c of launch.contacts) { /* c.time, c.kind, c.hit, c.bounce, c.reacts, contactAttack(c, STARTER_HERO) */ }
```

- **World** (`createLaunchWorld`). `grid`: the floor cells (a `RoomLayout` from
  `src/procgen/architecture/layout.ts` fits as is); every other cell, and everything outside the grid, is one wall
  actor, like the Demo's single wall mesh. `circles` / `boxes`: static solids; the default tag 环境.房间.有弹性
  bounces, tag 可交互.角色.环境 blocks but ends the chain. `bodies`: enemies (centre, radius = the Demo row's 宽度,
  optional half-height 高度); their tags are the bounce flags, default 可交互.角色.AI.仇恨 (hostile). `pickups`:
  回弹漩涡 with `gravity: { strength: 1.4, radius: 500 }`. The world is immutable; rebuild it when bodies move or
  die (cheap).
- **Preview** (`computeLaunchPreview`): the chain the aim shows. `legs` are the displayed circles 0..K. Draw
  chevrons along `leg.line` (legs bend near a vortex) and the marker at `leg.end` by `leg.marker`: `enemy` =
  dashed ring, `wall` = dot + arc facing `leg.hit.normal`, `none` = dot. `terminal.line` is the last line (no
  marker); `terminal` is null when it cannot be built. Circle 0 aims along the cursor snapped to whole degrees, each
  next leg along the previous `bounceDirection`. `pulse` holds the chain offsets of the Demo's travelling
  highlight (`PREVIEW_PULSE`).
- **Launch** (`planLaunch`, `蓝图_效果_可控弹射`): main leg i replays `preview.legs[i].path` at
  `min(2000 + 300·疲劳, 6000)` uu/s along the ease-out curve 可控反弹曲线; 疲劳 rises after every main leg that was
  not a gravity bounce. Then the terminal leg replays `preview.terminal.path` at 0.3 × the last speed along
  可控终末确定曲线. Every main leg ends in its circle's contact (`contacts`, in time order); the terminal ends in none.
  The paths are the preview's own objects, so the hero goes exactly where the aim showed. `complete` is false
  only when a displayed circle has no playable path (its native leg failed); the launch stops before it, as the
  Demo's does.
- **Sampling** (`samplePlayback`): position, velocity (uu/s) and leg index (−1 before the release,
  `legs.length` at rest) at any game time.
- **Release**: build the preview from the hero's current position and plan from that preview. The Demo refuses a
  release when circle 0 starts more than 8 uu from the hero (LAUNCH-007), so recompute it if the hero was moved.
- **Contacts** carry what the effect pipeline needs (launch-movement LAUNCH-045…059): `kind` (`enemy` = hostile:
  hit-stop and melee target; `wall` = any other blocking actor; `gravity` = a deferred bounce in the air), `hit`
  (actor, normal, impact point), `bounce` (`ordinary` spends the Bounce Limit, `gravity` a vortex credit, `none` =
  leg 0 on something it may not bounce off), `reacts` (the hero gets 反弹中: item charge, the 反弹 stats, camera
  shake, 反弹时 effects, the squash of a touched body), `speed` (for the squash and the bump sound).
  `contactAttack(contact, hero)` is `melee` (knight on a hostile body), `ranged` (hunter on anything else, only while
  enemies are on the field) or null. `launch.movementRange` is the 乱舞 stat. Within one contact the Demo runs, in
  order: the hero's 碰撞时 effects, the bump feedback, 反弹中 (hit-stop, charge, stats, shake, 反弹时, squash), the
  attack, then the mirrored contact on a touched body (launch-movement §9.2); a gravity contact runs only 反弹中.
- **Hit-stop**: for 0.25 game seconds after an enemy contact, game time advances at
  `hitStopDilation(gameTime − contact.time)` × real time (`HIT_STOP`); the caller's clock applies it.
- **Heroes**: `STARTER_HERO` (幽冥骑士, whose mechanics the beetle knight keeps: 宽度 56, 高度 56, Bounce Limit 4,
  Launch Distance 500, melee on enemy contacts) and `SOUL_HUNTER` (Bounce Limit 5, ranged on wall contacts); sources
  in `settings.ts`.

### Replacing `src/game/ricochet.ts`

The placeholder works in tiles on the renderer's (x, z); the core in uu on (x, y). Convert with `tilePointToUu` /
`uuPointToTiles`.

| Placeholder | Core launch |
|---|---|
| `worldFromCells(w, d, cells, bodies)` | `createLaunchWorld({ grid: { width: w, depth: d, cells }, bodies, circles })`: `kind: 'enemy'` bodies go to `bodies` (uu centre and radius, string ids), `kind: 'solid'` to `circles` |
| `cast(world, p, dx, dz, r, max)` | `sweepProbe(world, a, b, probe, ignore)`: one swept probe (the chain does the casting) |
| `plan(world, start, dirX, dirZ)` | `planLaunch(computeLaunchPreview(world, tilePointToUu(start.x, start.z), { x: dirX, y: dirZ }))` |
| `Plan.legs[i]`, `!leg.terminal` | `preview.legs[i]` (geometry) and `launch.legs[i]` (timing) |
| `Plan.legs[last]`, `leg.terminal` | `preview.terminal` and the last of `launch.legs` (`terminal: true`) |
| `leg.from`, `leg.to` | `leg.start`, `leg.end`; draw `leg.line` |
| `leg.contact`: wall / enemy / solid / none | `leg.marker`: wall / enemy / none; `leg.hit.actor.kind`: wall / solid / body |
| `leg.id` | `leg.hit.actor.id` |
| `leg.normal`, `leg.point` | `leg.hit.normal`, `leg.hit.impactPoint` |
| `leg.speed`, `leg.t0`, `leg.t1` | `launch.legs[i].speed`, `.start`, `.end` (uu/s, s) |
| `Plan.duration` | `launch.duration` |
| `sample(plan, t)` → `{ pos, vel, leg }` | `samplePlayback(launch, t)` → `{ position, velocity, leg }` |
| hit effects when `legs[k].t1 <= t` | step through `launch.contacts` by `time`; damage `c.hit.actor.id` when `contactAttack(c, STARTER_HERO) === 'melee'` |
| `DEMO` constants | `STARTER_HERO`, `LAUNCH_RULES` (uu): radius 56, preview probe 53.2, leg 500, terminal cap 96 |
| `DEMO.bounces = 5`, `speedUp = 1.18` (placeholders) | Bounce Limit 4 (knight), +300 uu/s per counted bounce, terminal at 0.3 × the last speed |

What changes on screen: leg ends are the hero centre at contact (`end`), not the wall; after the last counted
bounce the terminal leg runs the whole next leg (up to Launch Distance or the next obstacle), otherwise at most
96 uu; a leg may end in the air and still bounce (vortex credit); main legs ease out instead of running at
constant speed.

### Spec gaps and draft corrections

- Continuous time: a leg lasts exactly its duration and the next starts at once. The Demo ends legs on frame
  boundaries and resumes the launch after a latent action (native-trajectory U-10).
- Ideal geometry: Chaos contact offsets and touching rules are unknown (U-04).
- The chain is the steady state of the Demo's per-frame circle updates; their one-frame lags (trajectory-preview
  E-1…E-3) are not reproduced. A hidden circle always marks its pickups (no effect on the launch).
- Draft correction: `BuildLegacyPreviewMain` also clears `MainPath` when the native leg fails
  (exe@0x1445a8623–0x1445a8652), so a failed circle has no stale path; native-trajectory NATIVE-060 omits this.
- Not ported: the follower modes the Blueprints never use (constant-speed `StartFollowing`,
  `StartLegacyStraightLeg`; vectors NT-V50/V51/V57/V59), the native pulse clock and marker flash (presentation;
  NT-V60…V62), the blind (状态.致盲) display, enemies' physics launches (`蓝图_效果_弹射`).

**Tests** (`tests/core-launch/`): the drafts' vectors NT-V01…V47, V49, V52…V56, V58, V63, V64, V66; LM-TV-01…06,
09…24, 28, 36…38, 43…45; TRAJEC-V01, V02, V04…V10, V12, V15, V19, V20, V29, V30; plus properties over hundreds of
aims in the reference room: determinism, preview == playback, the reflection law on walls and circles, no
penetration, and no tunnelling at 6000 uu/s.
