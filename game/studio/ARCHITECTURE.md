<!-- Step 0 output (2026-10-23), committed by the orchestrator. Planner scripts and data: D:/TAPTAPGAME_studio/tmp/step0/ (scripts/, owners.json, reach.txt). -->
# 《棺材板下》 prototype architecture (step 0, architect)

2026-10-23. Input to wave A and wave B of `方案-v4-原型优先.md`. Author: the architect (step 0). Not a spec: rules and
numbers stay in `spec/`, the drafts and the dump; this document fixes **where code goes, how the pieces talk, who owns
what, and in which order the agents build it**.

Reading order for an agent: §0 (decisions), §3 (layout and lanes), the section of your system, §6 (public API), §7
(content conventions), your task card (§12 or §13), Appendix A (contracts).

Scope note. The step-0 scope audit runs in parallel and produces the authoritative "原型内容清单". Where this
document assumes scope (run structure, which chapters, which exclusive items appear), it says so (§14) and the audit
wins.

---

## 0. Summary and decisions

The prototype is the whole Demo, played in the browser and headless, with placeholder art. The Demo is data tables plus
blueprint logic: 49 tables / 2546 rows, 590 skill blueprints (Ability 129, 效果 446, 发射物 12, 3 bases), about 25 K
pseudo-lines of system blueprints (actors, game mode, inventory, rooms) and 23.6 K lines of widget logic. Our
measurements (scripts in `D:/TAPTAPGAME_studio/tmp/step0/scripts/`):

- **495 of the 590 skill blueprints are reachable** from live data or live blueprints (73.6 K pseudo-lines). The other
  95 are 过期, test, or talent classes that only deprecated tables reference.
- The content blueprints call **429 distinct functions**: about 170 are Demo functions (BP_ManeActor 43,
  函数库_工具 38, 函数库_技能 21, 蓝图_动作游戏模式 20, BP_Actor_Card 18, 函数库_科学数 12, 修炼系统 11,
  蓝图_能力 8, BP_Actor_Player 7, 蓝图_效果 4, 函数库_战斗日志 3, BP_Actor_Other 1); the rest are engine nodes
  (arrays, math, spawn, attach, tags, traces, timers, Niagara, sound).
- 411 of the 727 live skill rows use one generic ability, `蓝图_能力_给自身加被动`; behaviour lives in the effects.

From this follow the decisions every task builds on:

| # | Decision | Why |
|---|---|---|
| D1 | **Demo-shaped runtime.** `src/core` mirrors the Demo's object model: BP_ManeActor / Player / Other / Card actors, `蓝图_能力` abilities, `蓝图_效果` effects, `蓝图_发射物` projectiles, the game mode (`蓝图_动作游戏模式`), the cultivation system (`修炼系统`). Everything content code touches keeps the Demo's names. | 590 blueprints are translated by ~30 agents. A 1:1 structure makes translation mechanical, review a side-by-side read, and the Demo's quirks (live-array skips, cached flags, re-entrant round ends) come out right without special cases. |
| D2 | **Discrete-event simulation in game time.** A deterministic scheduler runs latent nodes (Delay, timers, timelines, animation callbacks) with UE semantics. Animation lengths and notify times are imported data. The hero launch is precomputed (`src/core/launch`); physics and projectiles are sub-stepped only while active. | The bot plays a run in well under a second; the browser and the bot run the same code. |
| D3 | **Synchronous dispatch with explicit loop semantics** (live index loop vs snapshot copy), re-entrancy allowed, exactly where the verified specs say. | `spec/turn-flow.md` TURN-029/068 and SCM §2 make these observable. |
| D4 | **UE-parity randomness.** `UeStream` (FRandomStream) where a blueprint uses a stream, `Rand15` per domain (`meta`, `level`, `combat`, `loot`) elsewhere, with the Demo's quantised formulas (core-math CORE-M-120…129). The existing sfc32 (`src/core/rng.ts`) stays for procedural art and cosmetic draws. | Draw order per domain is part of the rules; exact quantised probabilities. |
| D5 | **One TypeScript module per Demo blueprint**, under `src/content/bp/` mirroring the dump path, generated from a skeleton (citation header + pseudo-code as comments), registered by asset path through per-batch index files, with a stub fallback for unported classes (the bot counts stub hits). | No shared hot file between 30 agents; coverage is measurable. |
| D6 | **A generated facade with fixed ownership.** Every Demo system function (≈730 across 19 classes and libraries) exists once as a typed method or library function in `src/core/bp/`, delegating to exactly one system module. A0 generates it; each system task owns one module and never edits the facade. | Many systems add behaviour to the same Demo classes (BP_ManeActor has 128 functions); delegation removes the conflicts. |
| D7 | **State plus modal decisions, and presentation events.** Everything the Demo waits on the player for (talent pick, event choice, loot box, Victory/Failure panel, warning dialog, map) is a core *modal* answered by a Command. The core never waits for the renderer. Discrete visual and audio moments are `PresentEvent`s carrying the Demo asset path; continuous things (positions, HP, statuses) are read from state. | Headless bot, deterministic replays, the game layer is a pure consumer. |
| D8 | **Game logic in Demo widgets moves to core.** `UI_主界面.筛选天赋`, `UI_地图格` and `UI_关卡地图页面` (map generation), `UI_天赋选项` (level gain) and the like are ported into `src/core`; `src/ui` only draws view models. | The bot needs that logic; the UI lane stays independent. |
| D9 | **Bot-first acceptance.** Headless runs on every merge, 1000 runs on the train, determinism digests, coverage. | v4 principle 4. |
| D10 | **Save = the Demo's save structs** (`结构_存档_*`, `EMS_基础存档`) with the Demo's snapshot semantics (saves at phases 8 and 9). | 1:1 continue/reset-room behaviour (SCM-010/036, TURN-095). |
| D11 | **Naming rule for Demo identifiers** (§4.11): Demo names verbatim; characters that cannot appear in a JS identifier are dropped at the end and replaced by `_` inside. | Greppable, mechanical, collision-checked by the generator. |
| D12 | **Wave A is staged** (4 stages, 17 cards, ≤ 8 in parallel). Contracts and the math kernel come first; then the runtime; then the systems; then the G2 integration. | Avoids agents coding against moving code; every card is ≤ 3 h. |

---

## 1. The codebase today and what we reuse

| Area | What exists (main @ f0f1f64) | Verdict for the prototype |
|---|---|---|
| `src/core/launch/` (2.4 K lines) | The Demo's launch, preview chain, playback and contacts, ported 1:1 from the native disassembly; vectors NT/LM/TRAJEC; properties (preview == playback, no tunnelling). | **Keep unchanged.** It is the hero's `蓝图_效果_可控弹射` motion. `sweepProbe` also serves traces and projectile sweeps. The `LaunchWorld` is rebuilt from the field at every aim (cheap, already documented). |
| `src/core/rng.ts` | sfc32 + splitmix, `derive(key)`. | **Keep** for procedural art and `fx` draws. Gameplay uses the new UE-parity domains (D4). |
| `src/core/README.md`, `src/core/tsconfig.json`, `tests/core/purity.test.ts` | Purity rules: no DOM, no packages, no timers, no dynamic import, `.ts` imports, erasable TS. | **Keep and extend**: the purity test already scans `src/core/**` and `src/content/**`, so every new folder is covered. Add a layering test (§3.3). |
| `src/content/demo/` | All 49 tables, curves, enums, structs; typed rows; deterministic importer with `--check`. | **Keep**; it is the data source. Extend the importer with class, animation, tag, widget and text manifests (card A2). |
| `src/game/` | G1 glue: `overlay`, `launch-preview`, `preview-pulse`, `cursor`, `pointer`, `hit-stop`, `popups`, `auto-aim`, `roster`, `reference-room`; stand-ins `hero.ts`, `loadout.ts`, `turn-score.ts`, `placeholder-combat.ts`. | **Keep** the presentation modules (aim drawing, cursor, pointer, popups, hit-stop clock, roster). **Replace** the stand-ins with core (`hero.ts` → stamina/hero rows, `loadout.ts` → inventory + charge, `turn-score.ts` → rating, `placeholder-combat.ts` → damage). `auto-aim.ts`'s scoring idea moves into the scripted bot policy. |
| `src/ui/` (3.4 K lines) | Ink & Bone pixel UI: `Surface`, pixel font, rich text, hit testing, screen and world layers; the combat HUD 1:1 with `UI_主界面`/`UI_背包栏_3d`; popups with the Demo curves. | **Keep the HUD** as the combat screen. Add a page kit and pages (cards A5, A14). |
| `src/render/` | Deferred toon pixel renderer, contract `api.ts`. | Unchanged. |
| `src/procgen/architecture/`, `props/` | `buildRoom(spec)` from a `RoomLayout` grid; northstar room. | Build every room from the core `RoomPlan` through a small adapter in `src/game` (RoomPlan → RoomSpec). |
| `src/procgen/creatures/` | Beetle knight (approved), 4 small fry (`acolyte`, `wickling`, `jelly`, `skull`). | Hero + the 4 stand-ins of `roster.ts` (结晶, 眼球, 大肠, 水母脑). Every other row uses the placeholder kit (§8.4). |
| `src/debug/` | Router, scenes `play`, `cast`, `architecture`, `ui-hud`, `core-launch`, `hello`, `contract`. | Keep. Add the scene `game-loop` (the full game, also driven by the bot in the browser) so tools work unchanged. |
| `tools/` | shots, perf, package, review, golden, data import; `bot.mjs` placeholder. | Keep. `bot.mjs` becomes the harness (card A6); add `tools/train.mjs`, `tools/gen/` (facade), `tools/bp/` (skeletons, coverage). |
| `tests/` | 31 files, 491 tests, `vitest run` in ~8 s; `tsc` (TS 7) < 1 s per project. | Keep; budget for ~2 000 tests in ≤ 60 s by the end of wave B. |
| Parked branches | `task/spec-feel`, `render-shake`, `vfx-launch`, `creatures-feel`, `audio-sfx`, `ui-feel`. | Stay parked until after G3. They will plug into the cue table `src/game/cues.ts` (§8.3), which is the only hook they need. |

---

## 2. Sources of truth per system

| System | Spec state | Vectors | Main Demo sources |
|---|---|---|---|
| Turn loop, missions, panels, floor end | **verified** `spec/turn-flow.md` | TF-TV-01…42 | 蓝图_动作游戏模式, BP_ManeActor, BP_Actor_Player/Other, 蓝图_主角色控制器, 蓝图_动画结算, BP_Mission, 蓝图_任务目标_*, UI_战斗结束统计页 |
| Stamina, Corruption, mental states | **verified** `spec/stamina-corruption-mental.md` | SCM-TV-01…43 | 蓝图_效果_玩家被动, 精神状态/*, 蓝图_效果_终级抉择, 函数库_工具.修改体力点 |
| Science numbers, stats, parameters, text, PRD, RNG | draft core-math | CORE-M-TV ×57 | 函数库_科学数, 函数库_工具, 函数库_技能, RollPRDBatch |
| Ability / effect / projectile framework | draft ability-framework | ABILIT-TV ×34 | 蓝图_能力, 蓝图_效果, 蓝图_发射物, generic abilities and effects |
| Hero launch, preview, contacts | drafts launch-movement, native-trajectory, trajectory-preview (**ported**: `src/core/launch`) | LM-TV ×50, NT-V ×66, TRAJEC-V ×34 | 可控弹射, 反弹中, 可控反弹时交互, 反弹时攻击 |
| Damage, heal, crit, weak spot, kills | draft damage-crit-weakspot | DMG-TV ×56 | BP_ManeActor damage functions, 受伤, 弱点, 爆炸, 闪电链, 函数库_战斗日志 |
| Combat statuses | draft combat-statuses | COMBAT-TV ×42 | 持续伤害, 格挡, 闪避, 易伤, 眩晕, 免疫状态 |
| Charge, Infuse, Echocast, durability | draft charge-infuse-echocast | CHARGE-TV ×35 | BP_Actor_Card, 给装备的物品充能, 蓝图_效果.连击处理 |
| Turn rating | draft rating-shot-stats | RATING-TV ×50 | 结算评分, 重复惩罚, 评分衰减曲线 |
| Enemy AI, intents, elites, growth | draft enemy-ai-intents | EAI-TV ×45 | 选择技能, 预测AI行动, 精英化敌人, 成长属性 |
| Enemies (3 families), bosses (3 tiers) | drafts | ECB-TV ×38, ENEMIE-TV ×29, BOSS-G-TV ×30; eyeball/knight-larva/puppet-dragon in prose | per draft |
| Heroes and skills | draft heroes-skills | HEROES-TV ×26 | Ability/玩家, 效果/玩家 |
| Map, room, hazards, inventory, loot, shop/events, crafting, economy, camp, enchantments, talents ×3, curses, tutorial, save, codex, items ×8, effects ×9, UI ×18 | **no draft** (planned in `_plan/units.json`, never written) | — | read the pseudo-code directly, cite labels (v4 §3.3); the unit scopes in `units.json` are the checklists |

Rule for every task (unchanged from the agent guide): verified spec > draft > pseudo-code > text. Where a draft and the
bytecode disagree, the bytecode wins and the task records it.

---

## 3. Architecture overview

### 3.1 Layers and data flow

```
 pointer / keys ──► src/game  input → Command          src/ui  (pages, HUD: pixels only)
                    screens, room view, actor views ◄── view models ──┘
                         │ send(cmd) · advance(dt) · view · drainEvents()
                         ▼
                    src/core/api       Game  (the only door into the core)
                         │
   ┌─────────────────────┴──────────────────────────────────────────────────────────┐
   │ systems   turn · stamina · damage · launch · charge · ai · physics · inventory   │
   │           rewards · talents · map · room · run · meta · save · rating · text     │
   ├───────────────────────────────────────────────────────────────────────────────────┤
   │ bp facade Demo function names (BP_ManeActor/Player/Other/Card, 游戏模式, 修炼系统, │
   │           函数库_工具/技能/科学数/战斗日志) → exactly one system module each        │
   ├───────────────────────────────────────────────────────────────────────────────────┤
   │ sim       world · clock · objects · actors · effects · abilities · projectiles    │
   │           dispatch · stacking · cooldowns · settlements · animations · tags · bus │
   ├───────────────────────────────────────────────────────────────────────────────────┤
   │ math (科学数, 词条, kismet numerics, PRD, weights) · rng (UeStream, Rand15) · launch │
   └───────────────────────────────────────────────────────────────────────────────────┘
        ▲ tables + manifests                              ▲ classes (injected)
   src/content/demo  (generated)                     src/content/bp  (one module per Demo blueprint)
```

The composition root (`src/game/app.ts` in the browser, `tools/bot` headless) imports `src/core/api` and
`src/content/bp/index.ts` and passes the class registry into `createGame`. The core never imports `src/content/bp`.

### 3.2 Folder tree and owners

Owners are task ids (§12, §13). After its wave a folder reverts to its lane in `studio/OWNERSHIP.md` (orchestrator
updates it: new lanes `bp`, `sys`, `placeholder`).

```
src/core/
  rng.ts                      existing (art, fx)                                    integrator
  launch/                     existing 1:1 launch                                   core (frozen; fixes via needs)
  math/   sci.ts stats.ts kismet.ts                                                  A0 core-contracts
          prob.ts             PRD, 传统概率判断, 权重选取 family, 递减强化属性, 随机化        A3 core-map
  rng/    ue.ts domains.ts    UeStream, Rand15, domain seeding                       A0
  text/   describe.ts numfmt.ts   根据参数生成文本, 生成能力描述参数, 数字缩写,             A4 core-inventory
                              科学数字缩写, 词条说明参数 (the combat log lives in sys/damage)
  sim/    world.ts clock.ts object.ts tags.ts bus.ts registry.ts coverage.ts         A1 core-runtime
          (A0 commits them with compilable placeholder bodies; A1 replaces the bodies)
          actor.ts player.ts other.ts card.ts mode.ts cult.ts   generated facades     A0 (regenerated, never hand-edited)
          settle.ts anim.ts   蓝图_动画结算, animation callbacks                       A1
  ability/ effect.ts ability.ts dispatch.ts apply.ts cooldown.ts params.ts           A1 (params.ts: A0)
           projectile.ts      蓝图_发射物 base                                        A11 core-ai
  bp/     index.ts            library facades 函数库_工具/技能/科学数/战斗日志 (generated) A0
          structs.ts          runtime structs 伤害, 治疗, 效果配置, HitResult            A0
          systems.ts          Systems table: one entry per module (generated stubs)  A0
  sys/    kernel/  ability/  turn/  stamina/  damage/  launch/  charge/  ai/          one folder per system,
          physics/ inventory/ rewards/ talents/ map/ room/ run/ meta/ save/ rating/   owner = the card that
                                                                                     implements it (Appendix B)
          (A0 generates each folder's index.ts exporting the unported default; the owner replaces it)
  api/    types.ts commands.ts view.ts events.ts                                     A0 (contracts)
          game.ts compose.ts  createGame, the composition of systems                  A1 (game.ts), A0 (compose.ts)
src/content/
  demo/                       existing tables (generated)                           content lane
  demo/classes.ts anims.ts tags.ts widgets.ts reachable.ts   (generated manifests)  A2 content-bpkit
  text/strings.ts             strings.json → zh/en by key (generated)               A2
  bp/                         translated blueprints, path = dump path minus CatapultHero/BP/
     Skill/Ability/…  Skill/效果/…  Skill/发射物/…  环境/…                            owner per file (cards)
     batches/<task-id>.ts     index of the classes a task ported                    that task
     index.ts                 imports every batch file (all slots pre-created)      A0
src/game/                     shell, screens, room view, actor views, input, cues    A15 game-shell
src/ui/
  kit/                        page kit (pages, stack, widgets)                      A5 ui-kit
  pages/<page>/               one folder per page: model.ts (view model) + page.ts  A5 / A14 per page
  hud/                        existing combat HUD                                   ui lane
src/procgen/placeholder/      placeholderEnemy/Boss/Prop, itemIcon                  parallel placeholder task
src/debug/scenes/game-loop.ts the full game for tools and bot-in-browser            A15
tools/gen/facade.mjs          facade + systems generator                            A0
tools/bp/skeleton.mjs coverage.mjs batches.mjs                                      A2
tools/bot.mjs, tools/bot/**, tools/train.mjs                                        A6 tools-bot
tests/<task-id>/              each task's tests; tests/fixtures/ (shared fixtures)   task; fixtures: A1 then integrator
```

### 3.3 Import rules (a layering test enforces them, card A0)

| Module | May import |
|---|---|
| `core/math`, `core/rng` | each other, `content/demo` types |
| `core/sim`, `core/ability`, `core/bp` | the above, `core/launch`, `content/demo` |
| `core/sys/*` | the above, other systems **only through the facade** (`world.sys.x` or the Demo-named method), never another system's files |
| `core/api` | everything in core; receives `content/bp` by injection |
| `content/bp` | `core/sim`, `core/ability`, `core/bp`, `core/math`, `core/rng`, `content/demo`, other `content/bp` modules (parent classes only) |
| `src/game` | `core/api` (and the types it re-exports), `src/ui`, `src/render`, `src/procgen`, `content/demo` (names, text) |
| `src/ui` | `src/ui`, `content/text` (strings); never `src/core` (it receives plain view models) |
| `tools/bot` | `core/api`, `content/bp/index.ts` |

---

## 4. The core runtime (`src/core/sim`, `src/core/ability`, `src/core/bp`)

### 4.1 World and objects

- `World` owns: the clock, RNG domains, data (tables + manifests), the class registry with stub fallback, the game mode
  object (`world.mode`, 蓝图_动作游戏模式's variables and facade), the cultivation system (`world.cult`, 修炼系统), the
  system table (`world.sys`), the presentation bus, coverage counters, and an id counter.
- Every Demo object is a `BpObject`: `id` (monotonic per world: creation order is part of determinism), `def` (its
  `ClassDef` from the manifest), `valid`, `location`, `attachParent`, `OwnedGameplayTags` (for GameplayTagActor
  subclasses: effects and actors), the latent helpers (§4.6) and `fx` (§4.9).
- **Spawning** reproduces deferred spawn: `world.spawn(cls, init)` constructs the object (field initializers = CDO
  defaults), runs `init` (the blueprint's `SetObjectPropertyByName` and exposed-on-spawn writes), then
  `ReceiveBeginPlay`. Callers then run the explicit calls the blueprint makes (`激活效果`, `激活发射物`, …).
- **Destroying** (`K2_DestroyActor`) marks `valid = false`, cancels the object's scheduled entries and removes it from
  nothing else: arrays keep stale entries exactly as UE does (TURN-102: a destroyed actor left in an array keeps its
  slot; `IsValid` is false; `Array_Length` still counts it).
- `world.isValid(x)` is the Demo's `IsValid`.

### 4.2 Actors

`BP_ManeActor` holds every variable of the Demo class (≈190; A0 generates the declarations from the pseudo `var` lines,
Appendix B), with Demo names and CDO defaults. The important groups:

| Group | Fields (Demo names, mangled per §4.11) |
|---|---|
| identity | 角色配置 (the row), 名字, 唯一ID, 种子, 角色类型 ('玩家' / '深渊' / '中立' / '修炼牌'), 品质, 等级, 成长率, 是精英, 标签 |
| stats | 词条 (`词条映射`, §4.10), 当前生命, 当前最大生命, 生命百分比, 当前护甲值, 当前魔力, 当前最大魔力, 魔力百分比, 溢出的治疗量, 溢出的体力, 格挡层计数, 闪避层计数, 总持续伤害映射, 剩余持续性伤害 … |
| body | 宽度, 高度, location (uu, x east, y south as `core/launch`, z up), 速度方向, 当前物理速度, 最大物理速度, 初始冲量, 初始质量 |
| turn | 疲劳了 (true), 移动中, 死掉了, 战斗状态, 行动力, 当前行动力, 行动结束实例 [], 动画可打断, 已揭示 |
| abilities / effects | 拥有的效果 [], 拥有的主动能力 [], 拥有的被动能力 [], 拥有的附魔能力 (Map ability → 名), 可释放能力 [], 当前能力, 当前目标, 释放技能中, 预制技能顺序组, 当前预制技能序号 |
| combat bookkeeping | 当前造伤数据, 当前受伤数据, 当前治疗数据, 暴击保护计数, 战斗数据统计, 反弹角度历史, 伤害提示延迟, 治疗提示延迟 … |

`BP_Actor_Player` (the hero, `world.mode.玩家角色`), `BP_Actor_Other` (enemies, neutrals, props) and `BP_Actor_Card`
(items **are** actors: charge in 当前行动力, durability in 词条.生命, enchantments in 拥有的附魔能力) extend it with their own
variables. TS class names are the Demo class names (D11).

Lists are plain arrays in Demo order. Insertion order is semantics (`场上所有` = draw order, `已装备牌` = equip order,
CHARGE-040), so no system may sort them or iterate a `Set` for gameplay.

### 4.3 Effects (`蓝图_效果`, ability-framework §4.E–4.H)

- Fields as ABILIT §2 (持续时长, 触发间隔, 剩余时长, 持续回合, 叠加层数, 剩余回合, 触发次数, 触发时机, 销毁延迟, 临时, 已销毁,
  连击计数, 无延迟连击, 伤害数据, 治疗数据, 实际治疗值, 命中数据, 词条数值, 当前附加效果).
- Base behaviour (final methods): `激活效果` (ABILIT-042: turn path or real-time path with the looping timer and the
  per-frame countdown), `持续效果` (ABILIT-045, fires on the expiring tick too), `销毁效果` (ABILIT-047: before-hook,
  optional latent delay, removal from both owner lists at once, after-hook, destroy), `更新时间` (ABILIT-053),
  `装上时触发`/`卸下时触发` defaults (ABILIT-057/058), `连击处理` (ABILIT-049 with the type-7 settlements).
- Hooks content overrides: `激活后触发`, `持续中触发(时机)`, `装上时触发`, `卸下时触发`, `销毁前触发`, `销毁后触发`,
  `额外子触发(结算数值, 触发次数)`, `连击处理`, `ReceiveTick` (rare).
- The class's CDO `OwnedGameplayTags` come from the manifest (never typed by hand). The `效果.时机.创建时` gate
  (ABILIT-041) reads them.
- Apply / refresh / stack / unique (`附加效果前处理`, `存在同名效果`, `存在同类效果`, `获取效果名`, ABILIT-050…056) live
  in `core/ability/apply.ts`.

### 4.4 Abilities (`蓝图_能力`, ability-framework §4.A–4.D)

- `添加技能` builds an ability from a skill row (`结构_技能`), copies the row fields (`初始化`, ABILIT-004), routes it
  (enchant / passive / active, ABILIT-005) and runs passives immediately.
- Final methods: `初始化`, `检查条件` (with the two global draws, ABILIT-011…019), `消耗处理`, `释放开始` (chant via
  `蓝图_效果_吟唱`), `释放预处理`, `释放结束`, `创建冷却效果` (ABILIT-033…038), `更新技能描述`.
- Virtual: `子初始化`, `检查子条件`, `被选中`, `执行技能(是读档)`, `预览目标`, `特殊结算(发射物)`.
- Parameters: `函数库_技能.获取技能参数` (CORE-M-071/072) in `core/ability/params.ts` (A0, needed everywhere).
- Talents enter through `添加天赋` (ABILIT-010), owned by rewards (A13).

### 4.5 Dispatch (ability-framework §4.H, §6; turn-flow TURN-029)

Each dispatch site is code in the system that owns the Demo function that dispatches (Appendix B): 新一天时 / 房间完毕时 /
有敌人死亡 / 结束层时 / 进入战斗时 in turn; 造成伤害前/后, 受到伤害前/后, 死亡前, 格挡前/后 … in damage; 减少/增加体力后 in
stamina; 自身完成充能 / 有物品完成充能 in charge; 物品发生变更, 分解后 in inventory; 释放技能前/后 in the ability base;
反弹时 in launch. They all use three helpers:

```ts
fireLive(list, tag, setPayload?, opts?)   // live index loop: re-reads length, sees appends, skips after self-removal
fireCopy(list, tag, setPayload?, opts?)   // snapshot: copy first, IsValid each entry
tickCopy(list, tag, opts?)                // turn start: 持续效果() instead of 持续中触发 (TURN-022, ABILIT-062)
// opts: { skip?: Set<蓝图_效果>, record?: Set<蓝图_效果> } for the 已触发效果 de-duplication
```

The tag test is hierarchical (`HasMatchingGameplayTag`: owned equals the query or is a child). Which helper a site uses
is written in its spec; where no spec exists the pseudo-code tells (a loop re-reading `Array_Length` is live; a loop over
a `临时数组` copy is a snapshot).

### 4.6 Time, latent nodes and the scheduler (`sim/clock.ts`)

- Time is **game seconds** (double). The canonical frame is 1/60 s: "next tick" means the next frame boundary, and
  per-frame countdowns (`剩余时长 −= DeltaSeconds`) resolve at the first frame boundary at or after expiry. Exact Demo
  frames are TURN-GAP-05; this is the documented closest behaviour.
- Entries run in `(time, insertion sequence)` order. An entry may schedule entries at the same time; they run after it in
  the same `advance`.
- Global time dilation (hit-stop `HIT_STOP`, `全局时间变速` on death) does **not** exist in the core: game logic runs in
  game time, and the dilation curve only maps real time to game time in the shell (`src/game/clock.ts`). The core emits
  `time.dilation` events so the shell knows when (§6.4).
- Latent helpers on every `BpObject` (UE semantics, keyed by the blueprint's node label so translators can copy it):

| Blueprint node | TS | Semantics |
|---|---|---|
| `Delay(t)` | `this.delay('L1234', t, () => …)` | one latch per node per object: a call while pending is ignored |
| `RetriggerableDelay(t)` | `this.retriggerableDelay('L1234', t, …)` | a call while pending restarts it |
| `DelayUntilNextTick` | `this.nextTick('L1234', …)` | next frame boundary |
| `K2_SetTimerDelegate(fn, rate, loop, InitialStartDelay)` | `this.setTimer('name', rate, loop, fn, initialStartDelay)` | first call after `rate + initialStartDelay`; `rate ≤ 0` creates no timer (ABILIT-043) |
| `K2_ClearAndInvalidateTimerHandle` | `this.clearTimer('name')` | |
| Timeline `PlayFromStart/Play/Reverse/ReverseFromEnd/Stop` | `this.timeline('名字', mode, { update?, finished? })` | length and tracks from the class manifest |
| `PlayAnimationOverrideWithCallbacks(seq)` | `this.playAnim(actor, seq, { completed?, cancelled?, notify? })` | length and notify times from the animation manifest; also emits `actor.anim` |
| `ReceiveTick` | `override ReceiveTick(dt)`, enabled with `this.setTickEnabled(true)` | runs at frame boundaries while enabled |

- Continuous processes (enemy physics, projectiles, gravity pulls) register with `clock.addProcess` and are stepped at
  1/120 s while active. Nothing else depends on frame rate.
- `advance(dt)` (browser) and `runUntil(stop)` (bot: jump from entry to entry) produce identical results for the same
  inputs at the same game times; a test asserts it.

### 4.7 Settlements (`蓝图_动画结算`, `sim/settle.ts`)

The Demo gates parts of the flow on animation-settlement trees (`模式动画结算数组`, `出场动画结算数组`,
`所有动画结算数组`, `当前模式结算实例`; types 0 container, 4 到战斗, 7 连击结算, 8 材料飞翔 …). They are core objects
with `延迟`, children activated one after another (TURN-012), and `结算结束判断` firing `房间完毕触发时机` in phase 8
(TURN-013). Durations come from the animation manifest (appearance animations; bosses wait for theirs). Echo settlements
release the action-end barrier when they fire (TURN-050). Overlap behaviour is TURN-GAP-19: port as written.

### 4.8 Animations as data (`content/demo/anims.ts`, `sim/anim.ts`)

The importer (A2) resolves every `PaperZDAnimSequence_Flipbook` to its flipbook length (`ΣFrameRun / FramesPerSecond`)
and its notifies (`动画攻击检测` with its time and Duration, `精灵声音播放`, …), and maps each actor row's
`动画.精灵动画序列[i]` to them. The core uses the lengths wherever the Demo waits on an animation (appearance, slime
escape, enemy attack windows, death) and fires notifies as callbacks. The game layer gets the same data in
`actor.anim` events and may play anything of that length.

### 4.9 Presentation emitter (`this.fx`)

Every object has `fx`, which turns presentation nodes into `PresentEvent`s (§6.4): Niagara (`vfx`), sounds (`sound`),
camera shakes (`shake`), flipbooks (`flipbook`), material flashes (`flash`), widgets with visible meaning
(`headUp` = 进行抬头提醒, `popup` = 创建伤害提示 / 治疗 / 充能, `ui` = 更新增减益格 and similar), the combat log (`log`),
BGM (`bgm`). Arguments are the Demo asset path or widget name, so the game layer's cue table can map them. Pure widget
plumbing with no visible effect is dropped. Presentation never feeds back into rules.

### 4.10 Numbers, stats, structs

- `科学数 = { 系数, 指数 }` and every `函数库_科学数` operation with its quirks (CORE-M-010…019) in `core/math/sci.ts`.
  Gameplay quantities stay science numbers wherever the Demo keeps them (SCM-014: the stamina drift is behaviour).
- `词条映射 = Map<string, { 计算类型: '加算' | '乘算'; 来源映射: Map<string, 科学数> }>` with
  `获取科学映射词条`, `添加科学映射值`, `移除科学映射值`, `科学映射原始值` (CORE-M-050…058). JS `Map` insertion order
  stands in for TMap order (only rounding can differ; SPEC-GAP noted in A0).
- UE numeric primitives with exact semantics (`FTrunc` 32-bit wrap, `Round`, `GridSnap_Float`, `Divide_IntInt`,
  `Percent_*`, `Log`, float32 via `Math.fround`) in `core/math/kismet.ts` (CORE-M-030).
- Runtime structs that hold object references (`伤害`, `治疗`, `效果配置`, `HitResult`) in `core/bp/structs.ts`, with
  `make伤害(partial)` etc. filling the struct defaults from `demoStructs` (e.g. 结构_伤害 defaults to 来源 攻击, 类型 流血,
  所需回合 3, 触发次数 1). Enum values are the display strings the tables use (`'物理'`, `'攻击'` …).

### 4.11 Names (D11)

- Demo identifiers are used verbatim: class names (`蓝图_效果_吸血`), functions (`造成即时伤害`), variables (`当前生命`),
  struct fields, enum display strings, tags, row names.
- A character that cannot appear in a JS identifier is **dropped at the end** of the name and **replaced by `_`
  inside**: `疲劳了？` → `疲劳了`, `存在同类效果？` → `存在同类效果`, `增加金币/收入` → `增加金币_收入`,
  `失去生命/护甲` → `失去生命_护甲`, `抽取特定类型卡牌到场上（碰撞）` → `抽取特定类型卡牌到场上_碰撞`,
  `科学数乘除*/` → `科学数乘除`, `日志//输出` → `日志__输出`. The generator (A0) refuses collisions within a class.
- Data rows keep their original keys (`row["唯一？"]`): the importer output is unchanged; runtime structs use the mangled
  names; the struct adapters in `core/bp/structs.ts` are the only bridge.
- Engine-side code (scheduler, world, bot, game shell) uses English names.

### 4.12 Determinism and errors

- No `Math.random`, clocks, timers, DOM or packages in `src/core` and `src/content` (existing purity test).
- Every random draw goes through a named domain (§4.13). Preview code (aim preview, intents display, tooltips) never
  draws (CORE-M-127); decisions displayed before they execute are drawn once and stored.
- `game.digest()` hashes the full state (actors, effects, scheduler, RNG states); same seed and same commands give the
  same digest.
- Bad input never throws: `send` returns `{ ok: false, reason }`. Internal invariant violations throw (`CoreError`); the
  bot reports them as crashes with the seed and the command log.
- **Unported code**: a facade function with no implementation calls `world.unported('BP_ManeActor.终结目标')`, and a
  class with no module gets a runtime stub built from its manifest (the parent's behaviour, manifest tags and vars). In
  `strict` mode (unit tests, and G2 for the systems it claims) both throw; otherwise they return a neutral value and
  count in coverage.

### 4.13 Randomness (`core/rng`, CORE-M-123…129)

| Domain | Generator | Seeded | Used by |
|---|---|---|---|
| `全局种子` | `UeStream` | run start from `runSeed` (replaces `SeedRandomStream`) | every 全局种子 call site: 权重选取/权重强化数值 in the game mode, 筛选地图格池, 生成随机装备 and card 种子, 本轮种子, per-tile streams of UI_地图格 |
| seeded locals | `UeStream` | exactly the blueprint seed (`种子`, `层种子`) | 初始区间, BP_Actor_Equip, 精英化装备, 获取附魔标签, 结束层/死亡创建物品, BP_ManeActor.初始化 shuffle |
| `meta` | `Rand15` | `fnv1a32('meta') ^ runSeed` | out-of-combat unseeded draws (talent offers, reward abilities, 筛选物品生成, 创建路口 …) |
| `level` | `Rand15` | `… ^ floorIndex·0x9E3779B9` at floor creation | room build, spawn points, decorations, 抽取特定类型 positions and delays |
| `combat` | `Rand15` | `… ^ combatIndex·0x9E3779B9` at combat start | PRD, 传统概率判断, 检查条件, AI choice, target picks, 疲劳结算, 添加行动力 |
| `loot` | `Rand15` | `… ^ combatIndex·0x9E3779B9` | drops, currency counts |
| `fx` | sfc32 (`src/core/rng.ts`) | free | cosmetic only, never in core rules |

The table of all 152 random call groups with their domain is CORE-M-129; translators use it. Draw counts per function
are fixed (CORE-M-125), including the Demo's wasted draws (the second `检查条件` roll, the gauge U drawn for every card).

---

## 5. Systems

Each system is a folder in `src/core/sys/` implementing the facade functions Appendix B assigns to it, plus the Demo
blueprints its card ports. One owner per folder per wave. Systems share state exactly where the Demo keeps it (the game
mode's variables `world.mode.*`, the cultivation system's `world.cult.*`, actor variables) and call each other only
through Demo functions, so no system needs another system's private API. Each `sys/<m>/index.ts` exports `system` (the
facade implementation), `commands`, `legal` and `view` (§6.5); keep those names, `compose.ts` imports them.

### 5.1 Turn machine (`sys/turn`) — verified spec turn-flow

Phases (`枚举_环节`), room setup to first turn (TURN-001…014), turn start with the five passes and the barrier
(TURN-020…035), `新回合后` with the gauge and the mission check (TURN-036…039), the player turn gate (TURN-041…046:
launch on release, interactions as turn actions), action end and its barrier (TURN-049…053, hidden action ends),
the enemy phase hook (TURN-059…062), round end and re-entrancy (TURN-065…068), deaths (TURN-073…077), win/lose,
panels, Continue (TURN-079…088), teardown, floor end, junction, room reset (TURN-095…102). Decks and field lists
(牌库/场上/墓地, `抽取特定类型卡牌到场上_碰撞`, `创建角色`, `判断场上内容` caches), missions (`BP_Mission` and the 8
goals), and the hero's interactions (`交互角色`, `交互到商人`, `交互到不可拾取物品`). Panels become modals (§6.3).

### 5.2 Stamina, Corruption, mental states (`sys/stamina`) — verified spec SCM

`改变体力`, `修改体力点` (with the savings scaling and the double application), `疲劳结算`, `增加腐化` with the first
overflow and `终级抉择`, the mental-state framework (`获得精神状态`, `精神状态` base, the four reachable states 饥饿,
饱腹, 疼痛, 幸运; Flowstate `光阴`), `临时属性（精神）`, the hero passive `蓝图_效果_玩家被动` (every hero action end:
−5 Stamina, then `执行AI行动`), save snapshot semantics (SCM-010/036).

### 5.3 Damage and healing (`sys/damage`) — draft damage-crit-weakspot

`造成即时伤害 → 受到即时伤害 → 失去生命_护甲` with every dispatch (造成伤害前/后, 受到伤害前/后, 失去生命后),
`伤害加成`, `计算基础伤害倍率`, crit (`会心判断` with PRD on `combat`, `会心触发`, R18 doubling), weak spots
(`生成弱点`, 90° arc), immunity / dodge / block order (`免疫处理`, `闪避处理`, `格挡处理`), DoT (`造成/受到/结算持续伤害`,
pools per round and type), heals (`获得治疗`, overheal, DoT removal), death (`可死亡检查`, `检查死亡` with 死亡前,
`角色死亡`, `终结目标`, `杀死敌人时`), area helpers (`对周围敌人造成伤害`), and the combat log lines. The status effect
classes (持续伤害, 格挡, 闪避, 易伤, 眩晕, 免疫状态, 精神状态_格挡/闪避 …) are its first ported blueprints.

### 5.4 Hero launch and contacts (`sys/launch`) — core/launch + drafts launch-movement, charge, rating

`蓝图_能力_挥击` (the launch skill class of 可控挥击 and 可控反蹬箭) and `蓝图_效果_可控弹射` turn a release into
`planLaunch(computeLaunchPreview(…))` and schedule every `launch.contacts[i]` at its game time. Each contact runs the
Demo's order (launch-movement §9.2): 碰撞时 effects, bump feedback, `反弹中` (hit-stop event, charge, stats, shake,
反弹时, squash), the attack (`发动攻击`, `近战捕获攻击目标`; ranged `远程捕获攻击目标` for the hunter), the mirrored
contact on the touched body. The hero position in state is `samplePlayback(launch, t)`. Launch end → `结束行动`.
Charge (`sys/charge`): `给装备的物品充能` on each counted bounce, card `添加行动力`, completion events with
`触发次数 = trunc(当前行动力/100)` and the equip-order loop (CHARGE-020…047), Infuse (CHARGE-050…058), durability.
Rating (`sys/rating`): `结算评分`, `重复惩罚` with the cubic `评分衰减曲线`, `回合评分`, letters, `更新回合/轮回战斗统计`.

### 5.5 Enemy AI and physics (`sys/ai`, `sys/physics`) — draft enemy-ai-intents, launch-movement §J

Skill choice (`检查技能条件`, `选择技能`: uniform pick among castable actives, boss rotations via
`递进预制技能顺序`), intents (`效果_意图`: icon by the first 类型 tag, number = 参数[0] × stat, stored at decision time),
floor growth (`获取当前层成长率`, `成长属性`, `乘数强化属性`), elites (`精英化敌人`, pity, caps, the five affixes in wave B),
the AI cast loop is in turn (`执行AI行动`). Physics: a deterministic 2D circle-body solver against the room grid walls
(same geometry as `LaunchWorld`), restitution 1.0, friction 0.4 average-combine, impulses
`Δv = |I|·(质量/50)/clamp(质量, 0, 300)` (LAUNCH-076/077), speed cap `最大物理速度`, stop at speed < 5; the
deceleration source is unknown (LAUNCH-083, GAP-07): a linear damping constant tuned so a 眼球弹射 travels the Demo's
distance on the captures, marked SPEC-GAP. Also `给有物理添加冲量`, `根据体重添加冲击`, `以目标为中心释放冲击`, corpses.
The projectile base `蓝图_发射物` (ABILIT-083…095) is here: straight motion at `速度`, overlap with capsules via swept
circles, range checks, pierce, safety timeout, stop sequence, barrier participation.

### 5.6 Inventory and items (`sys/inventory`) — no draft (unit inventory-equipment)

The equipment column and backpack (`修炼物品格子组`: sizes 1/2/3 rows, `整理并寻找可摆位置`, `检查空间`,
`放入物品到指定格`), locked cells (`锁定格`, `创建锁定格`), positions and adjacency for conditions (`获取相邻牌`, 枚举_位置,
最上方 = last of the filtered list, `筛选修炼物品`, `技能条件筛选物品`), card actors (`生成卡牌`: level from quality
`2^(品质−1)`, `处理词条`/`成长词条` growth CORE-M-061, enchant slots by size), item flows (`获取牌`, `装备牌`, `卸下牌`,
`使用牌`, `使用牌后处理`, `移除物品`, `判断是否可置入`, combat lock R44), the equip hooks (`装备目标`/`卸载目标` →
`装上时触发`/`卸下时触发` and `物品发生变更`). Crafting, combining, dismantling yields and enchantment flows land in wave B
(the functions exist from A0 and are stubbed). Item text (`core/text`): `根据参数生成文本`, `生成能力描述参数`,
`更新技能描述` formatting, `数字缩写`, `科学数字缩写`, `词条说明参数` (CORE-M-080…087), so tooltips render the Demo's
strings per quality.

### 5.7 Rewards, loot, EXP and talents (`sys/rewards` A12, `sys/talents` A13) — no draft (units loot-rewards, progression-economy, talents-general-levelup)

`创建奖励` (the room's reward ability per map cell), the combat reward `蓝图_奖励_复合奖励` and `获取地图宝藏` (the loot
box after Victory), `获取物品_*` offers (`蓝图_奖励_获取物品`: count, cost, refreshes, give-up, min quality, enchant chance
0.25, all-heroes), `筛选物品生成`, `刷新生成牌`, `全拿未拾取牌`, drops (`触发掉落`, `添加装备掉落`, `添加材料掉落`,
`非酋保护机制`, `近期X次…`), currencies (`增加金币_收入`, `掉落货币`, `蓝图_货币` pickups), EXP and levels (`增加经验`,
`尝试提升等级`, `升级玩家` with the turn-start barrier, `曲线表.经验值所需曲线`), the talent offer (`UI_主界面.筛选天赋`
ported to core, `UI_天赋选项` level gain via `递减强化属性`, reroll, give up, `添加天赋`), boss talents
(`首领天赋获取`), room rewards (`事件抉择`, `获取经验`, `无`, `初始奖励A`), interaction abilities (`点击交互` family,
`精核矿`).

### 5.8 Map, room, junction (`sys/map`, `sys/room`) — no draft (units map-generation, room-generation)

Map: chapters from `数据表_任务条_默认` (graph, 最大层数, 关卡分支), floors and boss floors
(`判断接下来是否是首领层`), tiles per floor as the Demo builds them (`UI_关卡地图页面`, `UI_地图格` per-tile streams from
`全局种子.InitialSeed`, `筛选地图格池`, `选取地图格层标签`, `更新地图格层标签队列`, `数据表_标签队列`), unlock floors
(`解锁层数`), rewards per tile (`奖励类型` weighted, `获取层数品质`), tile save state (`结构_存档_地图格`), difficulty
stars, Endless. Room: `创建地块` from `当前层配置` (sizes, 程序生成, 回廊, 手动房间图, 拼接表 = 数据表_瓷砖配置_矩形),
`蓝图_房间`/`蓝图_房间格子` (auto-tiling 获取拼接编号, decorations 摆放装饰品/创建装饰品池 from 固定/随机装饰品),
player spawn, fog (`迷雾处理`), the junction (`创建路口`, `激活路口`, `交互路口`). Output: a `RoomPlan` (floor cells at
1 tile = 64 uu, solids, decorations, spawn data, fog, background) that the turn machine spawns into and the game layer
renders. For G2 the room generator may return the northstar-like fixed layout per room type (SPEC-GAP), with the real
generator in wave B (`core-room`).

### 5.9 Run flow, meta and save (`sys/run`, `sys/meta`, `sys/save`)

The screen state machine (§6.1), run start (`新的轮回`, hero select, abyss level, starting reward), run end
(`进入死亡结算`, `激活冒险统计页面`, score), Demo completion after the first boss (R57) with Continue = Endless, camp
(`返回营地`, phase 14) in its minimal form, unlocks (`判断解锁`, 已解锁英雄: the hunter at 积分等级 4), the content
filter for G2 (`ported` only), save/load: the `EMS_基础存档` fields plus the actor SaveGame data (`保存英雄信息` snapshot
at phases 8/9, `保存主动技能`, `保存天赋`, `保存精神状态`, `保存持续伤害`, card `结构_存档_仓库物品`, tiles
`结构_存档_地图格`, RNG states), versioned JSON.

---

## 6. Public API (`src/core/api`)

Full TypeScript in Appendix A.8–A.9. Summary:

```ts
const game = createGame({ seed, content: registry, save?, strict?, filter: 'ported' | 'all', debug? });
game.view            // GameView: screen, phase, inputOpen, modal, run, hero, field, room, map, inventory, launch, log, time
game.legal()         // CommandSpec[]: what the current state accepts (aim releases are a parametrised spec)
game.send(cmd)       // CommandResult { ok, reason? }
game.advance(dt)     // game seconds (the shell applies dilation)
game.runUntilInput() // bot: run the scheduler until the core needs input / is idle / ended / timed out
game.preview(aim)    // LaunchPreview from the current state, phase 2 only, no RNG
game.drainEvents()   // PresentEvent[] since the last drain, with game timestamps
game.save() / game.digest() / game.coverage
```

### 6.1 Screens

`screen` is derived from core state: `title` (序幕 / 新的冒险 / 继续冒险) → `heroSelect` → a run: `map` (phase 9) ⇄
`room` (phases 8, 0, 2, 3, 20, 19, 18, 11, 12) → … → `death` (soul-ball settlement) → `runEnd` (phase 13) → `camp`
(phase 14) → `heroSelect`. The prologue is a run on the chapter row 新手关 (7 floors, then 营地).

```
title ─序幕──► run(新手关01…07) ──────────────────────────────► camp
  └──新的冒险─► heroSelect ─start─► run(chapter …) ─death/abandon─► death ─► runEnd ─► camp
                                     map ⇄ room(8→0→2→3→20→…→19→18→11) → next floor
                                     boss floor → Victory → boss talents → [Demo complete: 继续 = Endless] → runEnd
camp ─新的冒险/portal─► heroSelect
```

### 6.2 Commands

Every player input is a `Command` (Appendix A.8): title, hero select, `map.enter`, `aim.release` (the launch, TURN-042),
`skill.press/target/cancel` (slots 1–4), `interact` (any clickable actor: chests, harvestables, merchant, shelves,
statues, bedroll, junction), item commands (`item.move/use/dismantle/combine/enchant/craft/extract`), modal answers
(`modal.pick/reroll/skip`), loot (`loot.take/takeAll/close`), panel (`panel.continue/retry`), the warning dialog
(`menu.resetRoom/abandon/saveQuit`), `runEnd.continue`, camp commands. `legal()` mirrors the Demo's gates (phase,
`玩家可与环境交互`, combat lock, costs), so the bot's random policy only tries accepted actions.

### 6.3 Modals

Anything that blocks the Demo's flow until the player acts is `view.modal`: `multiChoice` (talent pick from level-up,
talent room, scroll or boss; event choices; `终结抉择`), `loot` (UI_物品盒子), `panel` (Victory/Failure), `runEnd`,
`warning` (UI_警告提示), `enchantReplace`, `craft`, `death` (soul balls, skippable). The turn-start barrier treats an
open talent pick as a participant (TURN-034/035), exactly as the Demo's `UI_主界面` does.

### 6.4 Presentation events

`PresentEvent` (Appendix A.9) carries a game time `t` and is one of: `actor.spawn/despawn/reveal/hide/anim/flash/squash/
hit/die`, `launch.start/contact/end`, `popup` (damage, heal, charge, infuse, stamina, corruption, text), `vfx`, `sound`,
`shake`, `time.dilation`, `headUp`, `log`, `bgm`, `ui` (open/close transitions). The shell interpolates positions from
state, plays events, and never answers them.

### 6.5 Who handles what (no shared hot file)

`api/game.ts` (A1) only routes. Each system module exports `commands` (handlers keyed by command type), `legal(world)`
(its `CommandSpec`s) and its `view` slice; `api/compose.ts` (A0) lists the modules once. Modals are a kernel service
(`world.mode.openModal(view, onAnswer)`, A1) that blocking systems call.

| Commands / view slice | Module (card) |
|---|---|
| `title.*`, `hero.*`, `runEnd.continue`, `camp.*`, `menu.*` (reset room, abandon, save and quit); `view.screen`, `view.run` | run / meta (A13) |
| `map.*`; `view.map` | map (A3) |
| `aim.release`, `interact`, `panel.*`, `skill.*` (the gate `根据操作执行技能`; slots in wave B); `view.phase`, `view.inputOpen`, `view.field`, `view.log` | turn (A7) |
| `view.launch`, the hero position | launch (A10) |
| `item.*`; `view.inventory` | inventory (A4; craft/enchant handlers in wave B) |
| `loot.*` | rewards (A12) |
| `modal.*` for talent picks, boss talents and events | talents (A13) |
| `view.hero` (vitals, statuses, skills) | kernel (A1) with stamina (A8) and damage (A9) fields |
| `view.room` | map/room (A3; wave B `core-room`) |
| `view.modal` | kernel modal service (A1) |

---

## 7. Content registration and translation

### 7.1 Generated manifests (card A2)

| File | Content |
|---|---|
| `src/content/demo/classes.ts` | every BP class under `BP/Skill`, `BP/环境`, `BP/Actor` that content spawns: `path`, `name`, `parent`, `kind`, CDO `tags` (inherited and redirected), own `vars` with CDO defaults (mangled names, struct values runtime-shaped), `timelines` (length, tracks), `components` data the logic reads (sphere radii, ProjectileMovement fields, widget draw sizes), `rows` (live `table:row` references), `reachable` |
| `src/content/demo/anims.ts` | anim sequences → flipbook length and notifies; actor row → sequence indexes |
| `src/content/demo/tags.ts` | the 370 registered tags + 2 redirects (DefaultGameplayTags.ini) |
| `src/content/demo/widgets.ts` | resolved slot rects (1920×1080 units and 960×540 px) of the widgets the pages use |
| `src/content/demo/reachable.ts` | reachable class paths (authoritative version of the 495 counted in §0) |
| `src/content/text/strings.ts` | `strings.json`: zh/en by namespace and key |

### 7.2 One module per blueprint

Path: `src/content/bp/<dump path minus CatapultHero/BP/>.ts`, e.g.
`src/content/bp/Skill/效果/物品/蓝图_效果_吸血.ts`. The skeleton tool writes it:

```sh
node tools/bp/skeleton.mjs CatapultHero/BP/Skill/效果/物品/蓝图_效果_吸血 --batch bp-items-2
```

It produces the header, the class extending the parent's module, field initializers from the CDO, one override per
event and function the blueprint defines with the pseudo-code pasted as a comment, a registration line in
`batches/<batch>.ts`, and a test skeleton. A finished module, for illustration (pseudo `L20…L1056`):

```ts
/**
 * 蓝图_效果_吸血 — heals the hero by 参数[0] × the damage dealt by the ability's owner (its item), except DoT types.
 * Demo: CatapultHero/BP/Skill/效果/物品/蓝图_效果_吸血 (dump/blueprints-pseudo/…/效果/物品/蓝图_效果_吸血.txt)
 * Parent: 蓝图_效果. CDO tags (manifest): 效果.时机.造成伤害后. Rows: see classes.ts.
 * Batch: bp-items-2.
 */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能, 函数库_科学数 } from '../../../../../core/bp/index.ts';
import { make治疗 } from '../../../../../core/bp/structs.ts';
import { sciOf, 科学数零 } from '../../../../../core/math/sci.ts';
import type { Tag } from '../../../../../core/sim/types.ts';

export class 蓝图_效果_吸血 extends 蓝图_效果 {
  static readonly path = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_吸血';
  来源名字 = '元素伤害%';
  叠加值 = 0;
  计数 = 0;

  // L20
  override 持续中触发(_时机: Tag): void {
    const mine = this.来自技能!.拥有者 === this.伤害数据.来自角色;
    const dot = this.world.mode.持续伤害类型.includes(this.伤害数据.伤害类型);
    if (!(!dot && mine)) return; // → L1056
    const hero = this.world.mode.玩家角色!;
    const p = hero.K2_GetActorLocation();
    const { 参数值 } = 函数库_技能.获取技能参数(this, this.来自技能!, 0, false);
    const amount = 函数库_科学数.科学数乘除(this.伤害数据.伤害数值, sciOf(参数值, 0), false);
    hero.获得治疗(make治疗({ 治疗整数: amount, 治疗百分比: 科学数零, 触发次数: 1, 特效位置: { x: p.x + hero.高度, y: p.y, z: p.z }, 来自技能: this.来自技能, 释放者: hero }), false, false);
  }
}
```

### 7.3 Registry

- `src/content/bp/batches/<task-id>.ts`: `export default [蓝图_效果_吸血, …] as const;` — owned by the task.
- `src/content/bp/index.ts` (A0) imports **every planned batch file** (wave A cards and wave B batches of §13, created
  empty) and exports `registry`: `Map<AssetPath, BpCtor>` built from each class's `static path`. No agent edits it;
  a new batch is added by the integrator.
- Core base classes (`蓝图_能力`, `蓝图_效果`, `蓝图_发射物`, actors) register themselves through `core/ability`.
- `tests/content-bpkit/registry.test.ts` (A2): every module is registered exactly once; `static path` matches the file
  and the manifest; the TS parent equals the manifest parent; no module declares tags; every reachable class is either
  registered or on the current wave's allowed-unported list (the list must shrink to empty by wave C).

### 7.4 Translation conventions (all content tasks)

1. **Structure.** One class per blueprint, named as the blueprint, extending the TS class of its manifest parent.
   Events and functions are methods with the same names; a call to the event's own name inside its override is a
   parent call (`super.持续中触发(时机)`) — ability-framework §1 explains how the bytecode shows it.
2. **Fields.** Blueprint variables are fields with their CDO defaults. Never redeclare a base field (ES2022 class fields
   would reset it); use `declare` if a narrower type is needed. Ubergraph locals that survive a latent node become fields
   prefixed `ug_`.
3. **Control flow.** Turn `goto` into structured code that keeps the statement order; put the label of each block in a
   comment (`// L1056`). Sequence nodes (`push_flow`/`pop_flow`) run each branch to completion in order.
4. **Pure nodes are evaluated per use** (TURN §2: a pure node feeding two statements is evaluated twice, which matters
   for random nodes). Copy that, do not cache.
5. **Latent nodes** use the helpers of §4.6 with the node's label as key.
6. **Calls.** Demo functions through the facade (`hero.获得治疗(…)`, `函数库_技能.获取技能参数(ctx, …)`): library
   functions take the calling object as first argument (the world context). Engine nodes through `core/bp` kismet helpers
   (`Array_*` with UE semantics, `Vector_*`, `MapRangeClamped`, traces as `world.trace.sphere(…)` over the launch
   geometry). If a needed Demo function is missing or unimplemented, write the call anyway and list it under `needs`;
   never re-implement it locally.
7. **Loops.** Copy the loop kind: a loop that indexes the live array uses `forLive(arr, (x, i) => …)`; a loop over a
   copy uses `for (const x of [...arr])`.
8. **Randomness.** Use the domain CORE-M-129 assigns to the call site (`this.world.rng.combat` …), with the exact UE
   primitive (`RandomFloatInRange`, `Array_Shuffle` …) from `core/rng`.
9. **Structs.** Build runtime structs with `make伤害({...})`, `make治疗({...})`, `效果配置From(row)`; never hand-fill
   defaults.
10. **Presentation** nodes become `this.fx.*` calls with the Demo asset path; widget plumbing without visible effect is
    dropped with a comment.
11. **Quirks.** Reproduce them and mark `// QUIRK (Lnnnn): …`. Unknown engine behaviour: closest documented behaviour and
    `// SPEC-GAP: …`.
12. **Text** shown to the player keeps the loc key (`text('数据表_技能_修炼物品', '761E648A…')`); our renamed strings come
    later from `src/content` text tables.
13. **Tests** (§7.5) cite the labels they cover.

### 7.5 Tests per module

Every module has at least one vector "state before → trigger → state after", and every non-trivial branch one more.
Fixtures (A1, `tests/fixtures/`):

```ts
const w = combatFixture({ hero: '幽冥骑士', enemies: ['眼球'], equip: [{ row: '旧剑', quality: 1 }], seed: 1 });
w.fire(w.effect('旧剑', '蓝图_效果_蓄能造成额外伤害'), '效果.时机.自身完成充能');
w.hit({ from: w.hero, to: w.enemies[0], amount: 20, type: '物理' });     // runs the real damage pipeline
w.turnStart(); w.launch({ deg: -60 }); w.runUntilInput();
expect(w.hpOf(w.enemies[0])).toBe(…); expect(w.events('popup')).toMatchObject([...]);
```

Spec and draft vectors become tests in the system tasks (TF-TV, SCM-TV, ABILIT-TV …). Content batches add their
per-module vectors and a bot coverage check (§10.4).

---

## 8. The game layer (`src/game`, card A15)

### 8.1 Shell

| File | Role |
|---|---|
| `app.ts` | `startGame(canvas, opts)`: renderer, HUD, page stack, `createGame`, the frame loop |
| `loop.ts` | per frame: input → `send`; real dt → game dt (`clock.ts`) → `advance`; `drainEvents` → handlers; screen controller update; render |
| `clock.ts` | real ↔ game time: the hit-stop curve (`HIT_STOP`, generalising `hit-stop.ts`), `全局时间变速` on death, pauses while a modal is open |
| `input.ts` | pointer and keys → Commands: aim preview while phase 2, `aim.release` on mouse **release** (TURN-042), keys 1–4, ESC, drag and drop of cards with the 0.35 s hold, right-click menu |
| `screens/{title,hero,map,room,run-end,camp,death}.ts` | one controller per screen: maps `game.view` to page view models or to the 3D room |
| `room/build.ts` | `RoomView` → `RoomSpec` → `buildRoom` (existing kit); decorations through the placeholder kit |
| `room/actors.ts` | actor views from `actor.*` events and `view.field` (positions interpolated from state) |
| `room/aim.ts` | the existing `launch-preview`, `preview-pulse`, `overlay`, `cursor` on `game.preview(aim)` |
| `bind/*.ts` | `GameView` → `CombatHudState` and page view models; text through `src/content/text` |
| `cues.ts` | asset path / widget name → our presentation: placeholder flashes, rings, popups now; the parked feel branches later |

### 8.2 Actor views

```ts
interface ActorView { root: THREE.Object3D; radius: number; height: number; headY: number;
  setState(s: ActorVisualState): void; update(dt: number, t: number): void; dispose(): void }
```

Factory order: the hero → `BeetleKnight`; rows in `roster.ts` STAND_IN (结晶, 眼球, 大肠, 水母脑) → `Mob`; bosses →
`placeholderBoss(row)`; other enemy rows → `placeholderEnemy(row)`; neutral rows (`数据表_道具_通用`: chests, harvest,
ore, statue …), decorations, pickups, terrain and projectiles → `placeholderProp(kind)`.

### 8.3 Cues

`cues.ts` maps `vfx`/`sound`/`shake`/`flash` events by Demo asset path (e.g. `粒子_Hit_01`, `摄像机晃动_零点二`) to a
handler. Unknown paths fall back to a generic placeholder per event kind and are counted (a debug overlay lists them).
The feel branches will replace handlers here without touching core.

### 8.4 Placeholder kit (parallel task; integration points)

```ts
// src/procgen/placeholder/index.ts
export interface ActorVisualState { mode: 'idle' | 'move' | 'attack' | 'cast' | 'hit' | 'die' | 'dead' | 'hidden';
  facing: number; flash?: number; elite?: boolean; squash?: number }
export interface ActorVisual extends ActorView {}
export function placeholderEnemy(row: { name: string; 宽度: number; 高度: number; 标签: readonly string[] }, opts: { seed: number; elite?: boolean }): ActorVisual;
export function placeholderBoss(row: { name: string; 宽度: number; 高度: number; 标签: readonly string[] }, opts: { seed: number }): ActorVisual;
export type PropKind = 'chest' | 'altar' | 'harvest' | 'ore' | 'statue' | 'merchant' | 'shelf' | 'anvil' | 'bedroll'
  | 'junction' | 'spikes' | 'bouncePad' | 'shieldGen' | 'stoneWall' | 'pillar' | 'jar' | 'brazier' | 'coffin'
  | 'candles' | 'pickup.speed' | 'pickup.shield' | 'pickup.spike' | 'pickup.currency' | 'terrain.acid'
  | 'terrain.lava' | 'terrain.ghost' | 'terrain.poison' | 'projectile';
export function placeholderProp(kind: PropKind, opts: { seed: number; radius?: number }): ActorVisual;
export interface PixelSprite { w: number; h: number; data: Uint32Array } // straight-alpha RGBA, like src/ui Surface
export function itemIcon(row: string, size: 16 | 24 | 32 | 48): PixelSprite;
```

The shell maps rows to `PropKind` (`src/game/views/kinds.ts`). Names on placeholders are the Demo row names until G3.

---

## 9. The UI (`src/ui`, cards A5 and A14)

- **Kit** (`src/ui/kit`): `Page` (`layout(rect)`, `draw(surface, t)`, `hit(x, y)`, `pointer(e)`, `key(e)`), `PageStack`
  (base page + modals, dim, input routing, open/close transitions), widgets on the existing `Surface` and pixel font:
  `Panel` (ink frame, 1-px bevel), `Button` (normal/hover/pressed/disabled), `RichLabel` (the 富文本 styles of
  `富文本_悬停显示_默认` and `富文本_天赋选择`, CORE-M-087), `Grid`, `List`, `Bar`, `Icon` (PixelSprite), `Tooltip`
  (UI_悬停提示 modes), `Menu` (UI_物品交互菜单). Layout rects come from `content/demo/widgets.ts` (the Demo widgets at
  2× our grid), so pages are 1:1 in layout from the start.
- **Pages** (`src/ui/pages/<page>/{model.ts,page.ts}`): each page receives a plain view model defined in its own
  `model.ts` and emits intents (`{ kind: 'pick', option }`), which `src/game` turns into Commands. Functional versions
  first (Ink & Bone frames, real text, real layout, no animation polish).

| Page | Demo widgets | Card |
|---|---|---|
| map | UI_关卡地图页面, UI_地图格, UI_关卡选项, UI_难度星级, UI_任务列表/条目 | A5 |
| loot window | UI_物品盒子, UI_拾取提示, UI_奖励提示 | A5 |
| tooltip, keyword tooltip | UI_悬停提示, UI_词条说明, UI_技能词条, UI_装备词条, UI_属性词条 | A5 |
| item context menu | UI_物品交互菜单, UI_物品交互按钮, UI_分解框 | A5 |
| Victory/Failure panel | UI_战斗结束统计页, UI_角色战斗统计 | A5 |
| multi-choice (talents, events, boss talents) | UI_天赋选项 ×3, reroll / give up | A14 |
| hero select | UI_英雄选择页, UI_英雄头像, UI_介绍词条, UI_深渊级别 | A14 |
| title / camp menu | UI_营地主菜单 (minimal: new run, prologue, continue, settings stub) | A14 |
| run end | UI_冒险结束统计页, UI_冒险统计词条 | A14 |
| warning dialog | UI_警告提示 | A14 |
| boss bar, cast bar, price tag, combat log | UI_首领状态条, UI_被交互条, UI_商品价格, UI_战斗日志/UI_日志词条 | A14 |
| shop, anvil, craft, enchant replace, stash, potential, codex, settings | — | wave B/C |

---

## 10. The bot (`tools/bot`, card A6)

### 10.1 Harness

`npm run bot -- --runs 1000 --policy scripted|random|mix --seed 1 --workers 18 [--hero 幽冥骑士] [--filter ported|all]
[--floors N] [--force-items a,b] [--force-talents a,b] [--force-enemies a,b] [--max-sim 7200] [--strict]
[--determinism N] [--coverage] [--out dir] [--compare prev.json]`. Worker threads run one game each; a run is
`createGame` → loop { `runUntilInput()`; policy picks a command from `legal()`; `send` } until `ended`, a crash,
a softlock or `--max-sim`.

### 10.2 Policies

- `random`: uniform over `legal()` with weights per command kind; aims uniform in whole degrees.
- `scripted`: greedy and simple: best of 360 aims by preview score (enemy contacts first, then bounces — the scoring of
  `auto-aim.ts`), first affordable offer with the most stats, take-all loot, equip the strongest, map cells by a fixed
  preference (combat > chest > event > rest), events option 0, Continue on panels.
- `replay`: a command log (for reproducing a crash).

### 10.3 Metrics (`report.json`)

`{ runs, policy, seed, crashes, softlocks, timeouts, victories, deaths, demoCompleted, winRate, floors: {mean,p50,p90},
turns: {mean}, simMinutes: {mean,p50}, estMinutes: {mean,p50}, damagePerTurn: {mean,p50,p95}, hpLossPerCombat,
goldEarned, itemsHeld, talentsTaken, coverage: { classesHit, stubsHit: [{path,count}], unportedCalls: [{fn,count}] },
errors: [{ seed, message, stack, commandLog }], digest }`. `estMinutes` = (sim seconds + Σ modelled think time per
command kind) / 60, a sanity check of the ≥ 30 min target next to the real check (floors and turns per run vs the Demo).

### 10.4 Detection

- **Crash**: any exception escaping `send`/`runUntilInput`.
- **Softlock**: no legal command and nothing scheduled while the run is not ended; or 50 consecutive accepted commands
  that leave the digest unchanged; or more than 300 turns in one room; or a phase unchanged for 600 sim seconds.
- **Determinism**: `--determinism N` runs N seeds twice (and once in `advance(1/60)` steps instead of `runUntilInput`)
  and compares digests.
- **Coverage**: classes executed, stubs hit, unported facade calls; `--force-*` options put chosen content into runs so
  each batch can prove its classes run (§13.4).

### 10.5 In the browser

`?scene=game-loop&bot=scripted&seed=7&speed=2` runs a policy inside the real game, which `npm run review` records for
the GIFs of gates and daily builds.

---

## 11. Testing and the merge train

| When | What | Budget |
|---|---|---|
| Every task before review | `npm run check`; its own tests; `npm run bot -- --runs 100 --policy mix` once the game exists | — |
| Every merge (integrator, on the branch rebased on main) | `npm run check` (tsc ×2 + vitest), `npm run data:check`, `npm run bot -- --runs 200 --policy mix --workers 18` (0 crashes, 0 softlocks), `npm run bot -- --determinism 10` | ≤ 3 min |
| Train, every 2–3 h on main | the above + `npm run bot -- --runs 1000 --compare <last>` + coverage report + `npm run build` + `npm run shots -- --scene game-loop --query "bot=scripted&seed=3&stop=<screen>"` for title, map, room, panel, loot, camp + `npm run perf -- --scene game-loop --seconds 10` + `npm run golden` (warn only) | ≤ 15 min |
| Train failure | revert the merges of that train in reverse order until green, re-queue them with the failing seed | — |

Alarms on the train compare against the previous report: any crash or softlock, determinism mismatch, a coverage drop,
win rate or floors-per-run moving more than 15 % without a balance-relevant merge, test time over 60 s.

---

## 12. Wave A — system skeleton (17 cards, 4 stages)

Stages run in order; inside a stage all cards run in parallel. After each stage the integrator merges in the listed
order and runs the train. Every card: target card first (agent guide rule 2), worktree `task/<id>`, ≤ 3 h, one code
review, at most 2 fix rounds, SPEC-GAP over grinding.

```
Stage 1 (3):  A0 core-contracts · A2 content-bpkit · A5 ui-kit
Stage 2 (5):  A1 core-runtime · A3 core-map · A4 core-inventory · A6 tools-bot · A14 ui-pages
Stage 3 (8):  A7 core-turn · A8 core-stamina · A9 core-damage · A10 core-launch · A11 core-ai
              A12 core-rewards · A13 core-run · A15 game-shell
Stage 4 (1):  A16 game-g2  (thin full loop, G2 pack)
Critical path: A0 → A1 → A7/A9/A10 → A16  (≈ 4 × 3 h + 3 × 0.5 h merges)
```

Merge order inside a stage: stage 1 A0 → A2 → A5; stage 2 A1 → A3 → A4 → A6 → A14; stage 3 A9 → A8 → A7 → A10 → A11
→ A12 → A13 → A15 (damage first: most systems call it). Stage-3 cards call each other only through the facade; their
unit tests replace the other systems with doubles (`withSystems({ damage: fake })` from `tests/fixtures`), and the real
seams are closed in A16.

Common acceptance for every card: `npm run check` green, purity and layering tests green, no edits outside the card's
paths (reviewer checks `git diff --name-only main...task/<id>`), SPEC-GAPs listed in the result.

### A0 `core-contracts` — contracts, exact math kernel, facade (stage 1)

- **Paths**: `src/core/api/{types,commands,view,events}.ts`, `src/core/api/compose.ts`, `src/core/sim/types.ts`,
  `src/core/sim/{actor,player,other,card,mode,cult}.ts` (generated facades and variable declarations only),
  `src/core/bp/{index,structs,systems}.ts`, `src/core/sys/*/index.ts` (generated unported defaults), `src/core/math/
  {sci,stats,kismet}.ts`, `src/core/rng/{ue,domains}.ts`, `src/core/ability/params.ts`, `src/content/bp/index.ts` +
  empty `src/content/bp/batches/*.ts` for every card of §12 and §13, `tools/gen/facade.mjs`, `tests/core-contracts/`,
  `src/core/README.md`.
- **Inputs**: this document (Appendix A, B); core-math §3, §4, §6, §7, §10 (CORE-M-010…075, 120…125); the pseudo
  signatures of the 19 system classes and libraries (Appendix B list).
- **Provides**: every type and signature other cards build against; `科学数` and `词条` math; UE numerics; UE RNG and
  domains; `获取技能参数`; the facade (`BP_ManeActor` etc. with ≈730 Demo functions, each delegating to `world.sys.<module>`
  and defaulting to `unported`); the systems table; the batch registry. The files of `src/core/sim/` and
  `src/core/ability/` that A1 and A11 implement, `src/core/math/prob.ts` (A3) and `src/core/text/*.ts` (A4) are
  committed with their exported signatures and placeholder bodies (`throw new Error('A1')`), so every card of stages 2
  and 3 compiles against real files from the first merge.
- **Generator**: `tools/gen/facade.mjs` parses `function <name>(<params>)` and `out` parameters from the pseudo files
  and maps UE types (Bool → boolean, Int/Byte/Double → number, Str/Name → string, Text → FText, Struct<结构_科学数> →
  科学数, Struct<结构_伤害> → 伤害, Struct<Vector> → Vec3, Struct<GameplayTag> → Tag, Object<X_C> → the TS class,
  Class<X_C> → AssetPath, Array<T> → T[], Map<K,V> → Map<K,V>, Byte<枚举_X> → 枚举_X); outputs become a returned object
  named after the out parameters; the trailing world-context parameter becomes the first `ctx` argument of library
  functions. It applies the naming rule (§4.11) and fails on collisions. The module of each function is Appendix B.
- **Acceptance**: CORE-M-TV vectors for science numbers, comparisons, stat maps, `获取技能参数`, UeStream sequences (seed
  0 and 90) and Rand15 primitives; generator test: every function of the 19 pseudo files is present exactly once with the
  module of Appendix B; layering test (§3.3); a world created with all-unported systems typechecks and `createGame`
  returns a game whose `view.screen === 'title'`.
- **DoD**: merged first; the integrator updates OWNERSHIP.md with the folder owners of §3.2.
- **Deps**: none. Suggested: Opus, effort high.

### A2 `content-bpkit` — manifests, skeleton generator, coverage tooling (stage 1)

- **Paths**: `tools/data/**` (new importers next to `import-demo.mjs`), `src/content/demo/{classes,anims,tags,widgets,
  reachable}.ts`, `src/content/text/strings.ts`, `tools/bp/{skeleton,coverage,batches}.mjs`, `tests/content-bpkit/`.
- **Inputs**: `dump/blueprints/**.json` (`parent_chain`, `cdo.properties`, `variables`, `timelines`, `components`),
  `dump/raw/Game/CatapultHero/精灵片/**` (AnimSequences, flipbooks), `dump/config/…/DefaultGameplayTags.ini`,
  `dump/widgets/**`, `text/strings.json`; ability-framework §6 (CDO tags), §13 (tag tree); §7 of this document.
- **Provides**: the manifests (§7.1); `skeleton.mjs` (§7.2) writing the module, the batch line and the test skeleton;
  `coverage.mjs` (ported / stubbed / hit, from a bot coverage JSON); `batches.mjs` reproducing §13's batch lists from
  the reachable set (sorted code-point order, contiguous chunks balanced by pseudo lines).
- **Acceptance**: `data:check` covers the new outputs (deterministic); CDO tags of 20 sampled classes equal the
  `// CDO overrides` lines of their pseudo files; tags inherited through parents (e.g. 精神状态 subclasses); anim lengths
  for 10 sequences recomputed by hand; skeletons for 5 classes compile; the registry test (§7.3) exists and passes with
  zero modules; reachable count reported (compare with 495 in §0, explain differences).
- **Deps**: none (uses the asset path and naming conventions of this document). Suggested: Opus, effort medium.

### A5 `ui-kit` — page kit and the first pages (stage 1)

- **Paths**: `src/ui/kit/**`, `src/ui/pages/{map,loot,tooltip,item-menu,panel}/**`, `src/debug/scenes/ui-pages.ts`,
  `tests/ui-kit/`.
- **Inputs**: §9; the widgets of those pages (`dump/widgets/CatapultHero/BP/UI/…`); their widget logic where it only
  formats (the rules go to core); the ART_BIBLE §7 (Ink & Bone); the existing `src/ui` (Surface, font, rich text,
  hit).
- **Provides**: the kit API (§9); five pages driven by view-model fixtures; `?scene=ui-pages&page=<id>` showing each with
  sample data.
- **Acceptance**: unit tests for layout rects (from the widget data until A2's `widgets.ts` lands, then switched),
  hit-testing and states; `npm run shots -- --scene ui-pages --query "page=map"` (and the 4 others) render without
  errors; screenshots looked at next to the Demo captures where they exist (`screens/layout/*.json`, demo-shot-09/12).
- **Deps**: none. Suggested: Opus, effort medium.

### A1 `core-runtime` — world, clock, objects, effects, abilities (stage 2)

- **Paths**: `src/core/sim/{world,clock,object,tags,bus,registry,coverage,settle,anim}.ts` (bodies of A0's
  placeholders), `src/core/ability/{effect,ability,dispatch,apply,cooldown}.ts`, `src/core/sys/kernel/**` (the kernel
  functions of Appendix B: the generated facades delegate to it, A1 never edits them), `src/core/sys/ability/**`,
  `src/core/api/game.ts`, generic blueprints `src/content/bp/Skill/Ability/蓝图_能力_{给自身加被动,给自身加被动_多个,
  给目标加被动}.ts` and `src/content/bp/Skill/效果/蓝图_效果_{冷却,吟唱}.ts`, `src/content/bp/batches/core-runtime.ts`,
  `tests/fixtures/**`, `tests/core-runtime/`. The other generic classes go to their wave-B users (召唤 and 给自身附加效果
  → `enemy-crystal`, 给自身加主动 → `bp-hero-knight`, 给自身加被动_特殊描述 → `bp-rewards`, 空, 玩家不可交互, 天罚 →
  `bp-props-2`, 物品类型数修改自身属性 → `bp-items-8`).
- **Inputs**: ability-framework §2–§4.J, §7, §8, §11, §12 (ABILIT-001…082); turn-flow §2 engine semantics, TURN-023/024/
  029/030; §4 of this document; the class manifest format (A2).
- **Provides**: §4 complete: spawn/destroy semantics, the scheduler with latent helpers, hierarchical tags, dispatch
  helpers, apply/stack/unique, cooldowns (turn and seconds), the chant effect, settlements, animation callbacks, the
  registry with stub fallback and coverage, `createGame` wiring (`view`, `send`, `advance`, `runUntilInput`,
  `drainEvents`, `digest`), the combat test fixtures.
- **Acceptance**: ABILIT-TV vectors except projectiles; scheduler properties (`advance` in frames ≡ `runUntil`;
  `(time, seq)` order; Delay latch; RetriggerableDelay; timer first-call timing); live vs copy dispatch skip cases
  (TF-TV-30 shape); destroy during dispatch; deterministic ids; stub fallback counts hits; strict mode throws.
- **Deps**: A0 (merged), A2 manifests (format; tests use a hand fixture if A2 is not merged yet). Suggested: Opus, effort
  high. Highest-risk card: the reviewer reads the ABILIT rule list against the code.

### A3 `core-map` — map generation and the probability library (stage 2)

- **Paths**: `src/core/math/prob.ts`, `src/core/sys/map/**`, `tests/core-map/`.
- **Inputs**: core-math §9 (CORE-M-090…110: PRD incl. the native batch, 传统概率判断, 权重选取, 权重创建数组,
  拆分权重数据表, 合并权重掉落池, 递减强化属性, 随机化); pseudo: `UI_关卡地图页面`, `UI_地图格`, 蓝图_动作游戏模式
  (`筛选关卡`, `筛选地图格池`, `选取地图格层标签`, `更新地图格层标签队列`, `判断接下来是否是首领层`, `新一层` map part,
  `创建路口`), 蓝图_通用路口 (`激活路口`, `交互路口`); tables 任务条_默认, 关卡_固定地点, 地图格, 标签队列; units.json
  `map-generation` scope; demo-shot-09/12/14 (map page layout and tile tooltips).
- **Provides**: `MapSys` functions (Appendix B "map", map part), map state (`MapView`), tile rewards and quality, chapter
  and boss floors, junction placement and use; the probability library for everyone.
- **Acceptance**: CORE-M-TV PRD/weight vectors; seeded map outputs as golden JSON (3 seeds × first 3 floors) with
  invariants (3 lanes, connected, every cell's 解锁层数 respected, boss floor where `判断接下来是否是首领层` says, tile
  rewards drawn from `奖励类型` weights); `获取层数品质` boundaries (23/24/47/48).
- **Deps**: A0. SPEC-GAPs expected (no draft). Suggested: Opus, effort high.

### A4 `core-inventory` — grid, card instances, item flows, item text (stage 2)

- **Paths**: `src/core/sys/inventory/**`, `src/core/text/**`, `tests/core-inventory/`.
- **Inputs**: pseudo `修炼系统`, `修炼物品格子组`, `修炼物品格子`, `BP_Actor_Card`, `函数库_工具` inventory helpers
  (Appendix B "inventory"); core-math §6.6 (growth), §8 (text); charge-infuse-echocast §durability (CHARGE-090…096);
  units.json `inventory-equipment`, `ui-item-card`, `ui-tooltip` scopes; rules R44–R53.
- **Provides**: equipment column and backpack with sizes and locks, placement and auto-arrangement, adjacency and
  positions, card creation (`生成卡牌`, `升级此牌`, `处理词条`), equip/unequip/use/remove flows calling the equip hooks
  through the facade, the combat lock; tooltip text rendering (`更新技能描述`, `根据参数生成文本`, `生成能力描述参数`,
  `数字缩写`, `科学数字缩写`, `词条说明参数`); `InventoryView`.
- **Acceptance**: CORE-M-TV text vectors (the six capture matches of CORE-M-088); placement vectors (sizes 1/2/3,
  locked rows, moving within and between grids); positions (最上方 = last, 相邻 …) for 10 handmade layouts; 旧剑 base
  damage 20/40/80/160 by quality; tooltip strings of 旧剑, 生命药剂, 旧盾 at Bronze and Gold match the Demo text with
  the trailing-space rule.
- **Deps**: A0 (card actors use the facade; tests may use A1's fixtures once merged, else a minimal local world).
  Suggested: Opus, effort high.

### A6 `tools-bot` — harness, policies, metrics, merge train (stage 2)

- **Paths**: `tools/bot.mjs`, `tools/bot/**`, `tools/train.mjs`, `tests/tools-bot/`, `tools/README.md` (bot and train
  sections).
- **Inputs**: §10, §11; `src/core/api` contracts (A0).
- **Provides**: the CLI and report of §10; worker pool; `random`, `scripted` (skeleton, completed in A16), `replay`
  policies; softlock and determinism detection; `--compare`; `tools/train.mjs` running §11's train steps with a summary.
- **Acceptance**: against `tools/bot/fake-game.mjs` (a scripted fake implementing the API: menus, a map, rooms that end
  after N actions, a deliberate softlock seed and a crash seed): crash and softlock are detected with seeds and
  command logs; determinism mismatch detected on a fake with a nondeterministic switch; 1000 fake runs finish in < 30 s
  on 18 workers; the real `createGame` from A0/A1 runs to the title screen.
- **Deps**: A0. Suggested: Opus, effort medium.

### A14 `ui-pages` — the remaining G2 pages (stage 2)

- **Paths**: `src/ui/pages/{multi-choice,hero-select,title,run-end,warning,boss-bar,cast-bar,price-tag,combat-log}/**`,
  `tests/ui-pages/`.
- **Inputs**: §9; widgets UI_天赋选项, UI_英雄选择页, UI_英雄头像, UI_介绍词条, UI_深渊级别, UI_营地主菜单,
  UI_冒险结束统计页, UI_冒险统计词条, UI_警告提示, UI_首领状态条, UI_被交互条, UI_商品价格, UI_战斗日志, UI_日志词条;
  `screens/layout/talent_pick.json`; demo-shot-01 (title).
- **Provides**: nine pages on the A5 kit with fixtures in `?scene=ui-pages`.
- **Acceptance**: as A5 (layout tests from `widgets.ts`, shots for each page, looked at).
- **Deps**: A5 (merged), A2 (`widgets.ts`). Suggested: Opus, effort medium.

### A7 `core-turn` — the turn machine (stage 3)

- **Paths**: `src/core/sys/turn/**`, `src/content/bp/Skill/Ability/Mission/BP_Mission.ts`, `src/content/bp/Skill/效果/
  任务/*.ts` (8 goals), `src/content/bp/Skill/效果/蓝图_效果_退出回合开始检查.ts`, `src/content/bp/batches/core-turn.ts`,
  `tests/core-turn/`.
- **Inputs**: **`spec/turn-flow.md`** (all rules, §5 event order, §10 vectors); enemy-ai-intents ENEMY--011…025 (gauge
  and AI loop); pseudo of the owned blueprints.
- **Provides**: Appendix B "turn"; panels and loot as modals; `view.phase`, `view.inputOpen`, `view.field`.
- **Acceptance**: **TF-TV-01…42** as unit tests (with doubles for AI casts and damage where a vector needs them); the §5
  event order for one room reproduced call for call by a recording double; re-entrant round end (TF-TV-38); stale
  neutral entries (TF-TV-39).
- **Deps**: A1, A3 (floor entry and junction hand-off through the facade). Suggested: Opus, effort high.

### A8 `core-stamina` — Stamina, Corruption, mental states (stage 3)

- **Paths**: `src/core/sys/stamina/**`, `src/content/bp/Skill/效果/玩家/{蓝图_效果_玩家被动,蓝图_效果_临时属性（精神）,
  蓝图_效果_终级抉择}.ts`, `src/content/bp/Skill/效果/玩家/精神状态/{蓝图_效果_精神状态,…_饥饱,…_疼痛,…_幸运,…_光阴}.ts`,
  `src/content/bp/Skill/Ability/玩家/蓝图_能力_获得精神状态.ts`, `src/content/bp/Skill/Ability/道具/蓝图_能力_恢复体力.ts`,
  `src/content/bp/batches/core-stamina.ts`, `tests/core-stamina/`.
- **Inputs**: **`spec/stamina-corruption-mental.md`**.
- **Provides**: Appendix B "stamina"; the hero passive; the Ultimate Choice modal request (its reward goes through
  rewards).
- **Acceptance**: **SCM-TV-01…43**; the 20-step stamina drift (SCM-011 QUIRK); live-walk skip of SCM-TV-34.
- **Deps**: A1. Suggested: Opus, effort high.

### A9 `core-damage` — damage, healing, death, statuses (stage 3)

- **Paths**: `src/core/sys/damage/**` (including the combat log, 函数库_战斗日志), status blueprints `src/content/bp/Skill/效果/蓝图_效果_{受伤,持续伤害,格挡,闪避,易伤,眩晕,免疫状态,免疫状态_转阶,
  免疫抵消伤害时,爆炸,闪电链}.ts`, `…/效果/敌人/蓝图_效果_{弱点,碰撞伤害}.ts`, `…/效果/玩家/精神状态/
  蓝图_效果_精神状态_{格挡,闪避}.ts`, `src/content/bp/batches/core-damage.ts`, `tests/core-damage/`.
- **Inputs**: drafts damage-crit-weakspot (DAMAGE rules, DMG-TV), combat-statuses (COMBAT rules, COMBAT-TV); core-math
  PRD (A3).
- **Provides**: Appendix B "damage"; popups, flashes, death events; the log lines.
- **Acceptance**: **DMG-TV ×56** and **COMBAT-TV ×42** (the order inside `失去生命_护甲` from bytecode), crit PRD draw
  counts on `combat`.
- **Deps**: A1, A3 (prob). Suggested: Opus, effort high.

### A10 `core-launch` — hero launch, contacts, charge, rating (stage 3)

- **Paths**: `src/core/sys/{launch,charge,rating}/**`, `src/content/bp/Skill/Ability/玩家/蓝图_能力_挥击.ts`,
  `src/content/bp/Skill/效果/蓝图_效果_{可控弹射,反弹中,可控反弹时交互,反弹时攻击,可控反弹动画,时间变速,残影,闪烁,
  蓄能攻击时XX,蓄能碰撞XX时XX}.ts`, `…/效果/物品/蓝图_效果_蓄能造成额外伤害.ts`, `src/content/bp/batches/core-launch.ts`,
  `tests/core-launch-sys/`.
- **Inputs**: `src/core/launch/README.md`; drafts launch-movement (LAUNCH-001…072, §9.2), charge-infuse-echocast
  (CHARGE-001…068), rating-shot-stats (RATING rules); heroes-skills HEROES-001…016 (the two launch skills).
- **Provides**: the launch as a game action (TURN-043 → `释放开始` → `可控弹射` → contacts → `结束行动`), the hero
  position in state, hit-stop and shake events, charge per bounce and completions, Infuse, the turn rating and
  `回合统计` data for the HUD.
- **Acceptance**: LM-TV vectors of the contact order and leg speeds (the motion vectors already pass in core/launch);
  **CHARGE-TV ×35**; **RATING-TV ×50**; 旧剑's "next 3 attacks +20" (REPORT spot check) end to end in a fixture.
- **Deps**: A1, A4 (equipped cards), A9 through the facade. Suggested: Opus, effort high.

### A11 `core-ai` — enemy AI, physics, projectiles, first enemies (stage 3)

- **Paths**: `src/core/sys/{ai,physics}/**`, `src/core/ability/projectile.ts`, blueprints `src/content/bp/Skill/效果/
  敌人/蓝图_效果_{意图,酸液池,血卵孵化,肉弹战车}.ts`, `…/效果/蓝图_效果_{弹射,地形}.ts`, `…/Ability/敌人/蓝图_能力_
  {弹射,治愈_强固,大肠酸液}.ts`, `src/content/bp/batches/core-ai.ts`, `tests/core-ai/`.
- **Inputs**: drafts enemy-ai-intents (ENEMY--011…089, EAI-TV), launch-movement §J/§K (physics launch, impulses),
  ability-framework §4.K (projectiles), enemies-eyeball-slime §E–F, enemies-intestine (大肠酸液, 孵化), boss-gatekeeper
  (肉弹战车 usage).
- **Provides**: Appendix B "ai" and "physics"; intents in `view.field`; the enemies 眼球, 大肠, 大肠血卵 fully playable;
  肉弹战车 for the G2 boss.
- **Acceptance**: **EAI-TV ×45** (gauge, selection, intents, stagger, growth at floors 1/6/12, elite rolls); LM-TV-29/30
  impulses; projectile lifecycle (barrier join/leave, pierce, timeout) vectors from ABILIT-083…095; a 眼球 room fixture
  that runs 10 turns without stalling.
- **Deps**: A1, A9 through the facade. Suggested: Opus, effort high.

### A12 `core-rewards` — rewards, loot, drops, currencies (stage 3)

- **Paths**: `src/core/sys/rewards/**`, blueprints `src/content/bp/Skill/Ability/奖励/{蓝图_奖励_复合奖励,
  蓝图_奖励_获取物品,蓝图_奖励_获取经验,蓝图_奖励_无,蓝图_奖励_初始奖励A}.ts`, `…/效果/玩家/{蓝图_效果_获取地图宝藏,
  蓝图_效果_获取轮回宝藏}.ts`, `…/效果/可拾取物/蓝图_货币.ts`, `…/Ability/道具/{蓝图_能力_点击交互,…_任务宝箱,…_打开盒子,
  …_采集,蓝图_能力_精核矿}.ts`, `src/content/bp/batches/core-rewards.ts`, `tests/core-rewards/`.
- **Inputs**: pseudo of those blueprints and of the game-mode/修炼系统 reward functions (Appendix B "rewards", loot
  part); turn-flow TURN-046, 087, 096 (loot box flow); tables 掉落池, 修炼物品_*, 技能_奖励, 道具_通用; units.json
  `loot-rewards`, `progression-economy` scopes.
- **Provides**: the loot modal, chests and harvest interactions, item offers, drops and currencies, the content filter
  for pools (`filter: 'ported'`).
- **Acceptance**: drop-pool sampling matches weights (χ² over 10 000 seeded draws per pool); 获取物品 offer counts and
  quality floors; the Victory → loot → `结束当前层` order (TF-TV-22 shape) end to end; chest room completes.
- **Deps**: A1, A3, A4. Suggested: Opus, effort high.

### A13 `core-run` — run flow, EXP and level-up, talents, events, save v0 (stage 3)

- **Paths**: `src/core/sys/{run,meta,save,talents}/**`, blueprints
  `src/content/bp/Skill/效果/玩家/{蓝图_效果_升级获取天赋,蓝图_效果_首领天赋获取}.ts`, `…/Ability/奖励/{蓝图_奖励_获取天赋,
  蓝图_能力_事件抉择}.ts`, `src/content/bp/batches/core-run.ts`, `tests/core-run/`.
- **Inputs**: turn-flow TURN-034 (level-up barrier), 084–088, 095; SCM (snapshot saves); ability-framework ABILIT-010
  (添加天赋); pseudo `UI_主界面.筛选天赋`/`开启多选一`, `UI_天赋选项`, `蓝图_动作游戏模式` (`新的轮回`, `英雄死亡后初始化`,
  `返回营地`, `尝试提升等级`, `增加经验`), `BP_Actor_Player.升级玩家`, `UI_英雄选择页`, `UI_冒险结束统计页`, `EMS_基础存档`;
  units.json `talents-general-levelup`, `talents-boss`, `save-settings`, `camp-statue-quests` scopes.
- **Provides**: screens and transitions of §6.1, hero select with the two heroes and unlocks, run start and end, Demo
  completion and Endless prompt, level-up and talent picks (generic talents through the generic abilities), boss talents,
  event choices, the minimal camp, save/load at map phases.
- **Acceptance**: TF-TV-08 (two level-ups in one turn start) end to end; talent offer filtering (排除天赋池, 天赋上限,
  ≤ 5 actives) vectors; save → load at phase 9 → identical digest after the same commands; title → hero → map → (fake
  room completes) → run end → camp → title with a scripted command list.
- **Deps**: A1, A3, A4. Suggested: Opus, effort high.

### A15 `game-shell` — the browser game (stage 3)

- **Paths**: `src/game/**` (new files; keep the existing presentation modules), `src/debug/scenes/game-loop.ts`,
  `tests/game-shell/`; `needs`: `src/main.ts` (no `scene` → `startGame`), `index.html` if required.
- **Inputs**: §8; `src/core/api` (A0), `src/ui` kit and pages (A5, A14), the placeholder kit API (§8.4; use local
  fallbacks if it is not merged), the existing `play` scene (how the reference room is built and drawn).
- **Provides**: the shell of §8 with all screens, the combat room on core, the HUD bound to core, the aim preview on
  `game.preview`, actor views, cues, `?bot=` autoplay.
- **Acceptance**: with A6's fake game: every screen reachable and drawn (`npm run shots -- --scene game-loop` per
  screen); with the real core (once stage-3 branches merge into the G2 branch): the reference room plays one launch with
  the HUD showing core numbers; 60 fps at 1080p in the room (`npm run perf`).
- **Deps**: A0, A5, A14; A6 (fake). Suggested: Opus, effort medium.

### A16 `game-g2` — thin full loop (stage 4, gate G2)

- **Paths**: integration fixes in any wave-A folder (the integrator role for this card), `src/content/bp/batches/
  game-g2.ts` for the handful of extra content blueprints (below), `tests/game-g2/`.
- **Content**: hero 幽冥骑士; enemies 眼球, 大肠, 大肠血卵; boss 守门人 with its shared action 肉弹战车 only (its own
  skills and phase passive come with `boss-gatekeeper` in wave B; SPEC-GAP for G2); items 旧剑, 旧盾, 旧匕首, 生命药剂,
  体力药剂 and the item effects they need; generic talents of 数据表_天赋_新新通用 that use generic abilities only; rooms 简单/普通战斗,
  宝箱房, 抉择房_0, 属性房, 恢复点 (bedroll), 首领战斗; filter `ported`.
- **Acceptance**: browser: title → hero select → map → combat, chest, event rooms → boss → Victory → loot → run end →
  camp → title, without console errors (`npm run shots -- --scene game-loop --query "bot=scripted&seed=3&stop=<screen>"`
  for each screen, looked at); bot: `npm run bot -- --runs 1000 --policy mix --filter ported` → 0 crashes, 0 softlocks,
  0 timeouts, ≥ 50 % of scripted runs reach the boss floor (a sanity bar, not balance), determinism 20/20; coverage report
  attached; review pack (`npm run review -- --scene game-loop --query "bot=scripted&seed=3" --clip 20`) with GIF and
  stills; `npm run package -- --scene game-loop --out D:/TAPTAPGAME_studio/review/g2/site`.
- **Deps**: all of wave A. Suggested: Opus, effort high; the orchestrator may add a second agent for bot triage.

---

## 13. Wave B — content port

### 13.1 Size

After wave A (81 classes, 14.4 K pseudo-lines claimed by the system cards), **414 reachable skill classes, 59.1 K
pseudo-lines** remain, plus ~25 environment blueprints (decorations, shop, statues, camp, about 5 K lines) and the
content systems that have no draft (enchanting, crafting, shop/events, curses, camp, hazards, room generation), and the
verification of 200 items and 147 talents. Throughput assumption from the drafts and the 吸血 sample: ~2.3 K
pseudo-lines (15–24 classes) with tests per 3-hour card.

Remaining skill classes by folder (count / pseudo-lines): 效果/物品 153 / 18 545 · 效果/天赋 79 / 12 167 ·
效果/敌人 31 / 5 845 · Ability/敌人 26 / 5 132 · Ability/玩家 13 / 2 699 · Ability/道具 19 / 2 290 ·
效果/玩家/精神状态 13 / 2 206 · 发射物 12 / 2 061 · Ability/奖励 14 / 1 654 · 效果/玩家 10 / 1 498 ·
效果/可拾取物 4 / 1 131 · 效果/道具 9 / 905 · 效果/过期 (reachable) 5 / 712 · Ability (generic) 5 / 649 ·
Ability/诅咒 9 / 627 · 效果 (top) 6 / 585 · Ability/天赋 6 / 434.

### 13.2 Round B1 — 33 cards in parallel (after G2 is approved)

Batches of 效果/物品 and 效果/天赋 are contiguous ranges of the code-point-sorted folder (A2's `batches.mjs` reproduces
them); classes listed under another card are excluded from the range. Line counts are pseudo-lines.

| Card | Classes | ≈ Classes / lines | Inputs |
|---|---|---|---|
| `bp-items-1` | 效果/物品 `XX等于XX` … `反弹灌注物品` | 24 / 2 324 | pseudo; units.json effects-item-1 scope; the item rows using them (manifest `rows`) |
| `bp-items-2` | `吸血` … `抓钩` | 19 / 2 382 | effects-item-1/2 scopes |
| `bp-items-3` | `投手之握` … `有机核心` | 19 / 2 335 | effects-item-2 |
| `bp-items-4` | `朝敌人投射（充能）` … `烈焰短剑` + 发射物 剑气, 灼热射线 | 17 / 2 390 | effects-item-2, ability-framework §4.K |
| `bp-items-5` | `焚天兜帽` … `碰撞生成地形` | 16 / 2 382 | effects-item-2/3 |
| `bp-items-6` | `碰撞造成即时伤害` … `蓄能获得生命or护甲` | 23 / 2 290 | effects-item-3 |
| `bp-items-7` | `蓄能造成持续伤害` … `附魔修改英雄属性` (without the 附魔修改* classes) | 19 / 2 130 | effects-item-3/4 |
| `bp-items-8` | `附魔悬停物品` … `黑洞法杖B加成` (without 附魔悬停物品) + 效果 物品类型数修改自身属性 + 发射物 旋风01 | 17 / 2 340 | effects-item-4, ABILIT-081 |
| `bp-talents-1` | 效果/天赋 `临时词条属性（不预算）` … `回流` | 18 / 2 621 | effects-talent-1 scope; talent rows |
| `bp-talents-2` | `固甲石` … `搜刮者` | 16 / 2 255 | effects-talent-2 |
| `bp-talents-3` | `敏锐直觉` … `燃烧效能` | 14 / 2 636 | effects-talent-2 |
| `bp-talents-4` | `特定层获得精核` … `血痂` | 16 / 2 527 | effects-talent-3 |
| `bp-talents-5` | `血铸壁垒` … `蓝图_精神效果_生成拾取物` + Ability/天赋 (6) | 21 / 2 562 | effects-talent-3, effects-talent-1 (abilities) |
| `bp-hero-knight` | Ability/玩家 举盾, 冲锋斩, 幻影斩, 野蛮冲撞, 血祭之力, 给物品附加效果, 给英雄附加效果, 给英雄和物品附加效果; 效果/玩家 举盾, 幻影斩, 野蛮冲撞, 必定会心, 临时属性_预算/不预算（结束层销毁）, 解放判断; generic 给自身加主动 (talent → skill) | 17 / 2 610 | heroes-skills |
| `bp-hero-hunter` | 弹跳连射, 瞄准射击, 腾跃 (ability + effect), 跳向目标位置, 投掷_圆形区域, 投掷_地形区域; 发射物 箭矢, 弹跳箭, 抓钩; the hunter's unlock | 10 / 2 750 | heroes-skills, ability-framework §4.K |
| `enemy-eyeball` | 眼球_融合, 眼球包, 新手关眼球包(2), 盗宝黏菌, 西瓜猪: 融合弹射, 反弹时融合, 眼球抛出, 眼球包打开, 黏菌逃跑, 西瓜猪 | 6 / 1 020 + rows | enemies-eyeball-slime |
| `enemy-intestine` | 大肠团, 血卵_坏卵: 大肠喷射 (ability + projectile), 投射, 毒气, 反弹创建地形, 死期将至, 死亡创建地形, 受伤毒气 | 8 / 1 020 + rows | enemies-intestine (ENEMIE-TV) |
| `enemy-crystal` | 结晶, 结晶簇, 水母脑, 章鱼脑: 八面散射, 晶刺, 电场, 反击状态, 死亡创建尖刺, 电网, 召唤 (ability + effect), 给自身附加效果, 脑波 | 10 / 1 490 + rows | enemies-crystal-brain (ECB-TV) |
| `enemy-elites` | the 5 affixes: 偏转力场, 吸血 (enemy), 地裂 + 地裂伤害, 筑墙 + 筑墙地形 + 石墙 (decoration), 强韧; orphan rows 肉弹旋风, 气刃地震, 大眼地震 (+UP, + effect); elite and growth verification | 12 / 2 350 | enemy-ai-intents §elites, §11 orphans |
| `boss-gatekeeper` | 守门人: 重锤, 连环重锤 (ability + effect), 熔岩道, 撕咬搜寻, 目视, 首领_守门人, 岩浆地板, 飞跃重击 | 9 / 2 385 | boss-gatekeeper (BOSS-G-TV ×30) |
| `boss-knight-larva` | 结晶骑士 (旋风地震, 结晶骑士_结晶/冲刺/冲刺归位, 首领_结晶骑士) + 弑神幼虫 (酸雨, 酸液虹吸, 寄生赠礼, 首领_弑神幼虫) | 9 / 1 780 | boss-knight-larva |
| `boss-puppet-dragon` | 重生傀儡 (充电, 弹幕压制, 穿透电击, 首领_重生傀儡) + 幽焰龙 (火环, 闪现, 幽焰龙_闪现, 召唤齐刘海, 首领_幽焰龙) + 齐刘海 (齐刘海飞弹, 幽魂池) + 火球精 (死亡发射投射物, 岩浆球) | 13 / 2 230 | boss-puppet-dragon |
| `core-room` | the real room generator (§5.8) + the game-side room build mapping + 效果 探索 (fog) | vertical | units.json room-generation; `rooms.txt` of the scope audit |
| `bp-pickups` | 效果/可拾取物 (可拾取物, 保护罩, 加速点, 尖刺); decorations 地刺 (+ 组件_地刺), 弹力法阵 | 7 / 2 130 | hazards-decorations scope |
| `bp-decor` | 保护罩生成器 (+ `+`), 解密柱子, 触发能力机关 (+ 充电塔), 路口机关, 火盆, 罐子, 棺材A/B, 蜡烛堆, 地板图案, 地刺_0202/0301, 回廊, 毒液池 | ~16 / 2 200 | hazards-decorations scope, turn-flow TURN-021/060 |
| `bp-props-1` | Ability/道具 使用格挡闪避, 修改玩家属性, 天赋卷轴, 恢复生命和强固, 活脑, 灌注, 移除持续伤害, 稚嫩心脏, 空, 药剂包, 触发器, 魂珠 | 12 / 1 330 | effects-props-affix scope |
| `bp-props-2` | 效果/道具 (9), 效果/过期 reachable (百宝箱, 秘银鳞片, 锁链, 闪电跳跃, 魔力药剂), 效果 空, 玩家不可交互, Ability 天罚 (only if A2 marks it reachable) | 17 / 1 800 | effects-props-affix scope |
| `bp-rewards` | Ability/奖励 修改英雄和物品属性, 复合奖励_新手关, 恢复生命, 感知精核经验, 给自身加被动 (奖励), 获取感知, 获得奥义, 解锁任务, 随机增精, 随机生命, 额外经验, 创建物品到侧栏; generic 给自身加被动_特殊描述 | 13 / 1 450 | loot-rewards, progression-economy scopes |
| `sys-shop-events` | 蓝图_商店, 蓝图_货架, merchant, 商品 rows, prices, 加折扣, 兑换物品; 抉择_01…07 and 终结抉择 rows; statues (神像, 破损的神像, 祝福奖励); rest 地铺; anvil 铁砧; 血之雕像; shop and anvil pages | vertical, ~2 000 | shop-events scope |
| `sys-enchant` | stones, slots by size, apply / replace / extract (萃取附魔), random enchant 0.25, the 31 附魔 rows with 附魔修改自身属性, 附魔修改英雄属性, 附魔悬停物品; enchant-replace page | vertical | enchantments scope |
| `sys-craft` | materials, recipes, craft, combine (quality up), dismantle yields, forge hammers (锻造锤_品质/标签, 升级物品, 升级所有物品); craft page | vertical | crafting scope |
| `sys-curses` | Ability/诅咒 (9), abyss levels in hero select, 诅咒之骨 interplay, score bonus | 9 / 627 + vertical | curses-advanced scope |
| `sys-camp` | camp menu, buildings, portals and chapter select, Eternal Statue stash, exploration level and unlocks, run score | vertical | camp-statue-quests, progression-economy scopes |

### 13.3 Round B2 — ~30 cards (after B1 merges)

| Card(s) | Scope |
|---|---|
| `verify-items-1…5` | the 200 items in 5 groups of 40 (by table and row order, as units.json items-01…08): per item and quality, the tooltip renders the Demo text with the right numbers, its skills attach, its conditions and positions select the right cards, one behaviour vector per item. Each group owns the item effect modules of the B1 batches whose classes its items use first (generated mapping); cross-group fixes go to `needs` |
| `verify-talents-1…3` | 新新通用 (29), 专属 (73: knight 28, hunter 26, the other 16 per the scope audit), boss专属 (45): levels up to 天赋上限, offers and exclusions, skill-granting talents, boss talent sections per chapter |
| `bp-mental` | the 13 data-complete mental states (no grant paths, SCM-080) |
| `sys-tutorial` | 序幕: 新手关01…07 fixed floors, tips (数据表_词条_新手提示, UI_新手提示), tutorial flags |
| `sys-save` | full save/load: every EMS field, actor SaveGame data, mid-room quit and reload, reset room, continue |
| `sys-settings` | settings page, zh/en switch, warning dialogs complete |
| `sys-potential` | potential page (UI_潜能页_幽冥骑士), points, application at run start |
| `sys-codex` | encyclopedia and item codex pages (data 合成数据表_百科) |
| `sys-death` | death settlement (soul balls) and run-end stats complete |
| `parity-stats` | statistical parity tests from bot runs: drop and elite rates, growth at floors 1/6/12, gauge distribution, rating distribution, EXP curve |
| `coverage-1…4` | close the coverage report: every reachable class hit by forced bot runs, stubs removed, unported facade calls zero |
| `ui-layout-1…3` | layout parity of every page against `widgets.ts` (numbers, not art) |
| `bp-fix-*` | the framework holes reported under `needs` in B1, one card per facade module that collected them |

Wave C (v4) then does the 1000-run balance and consistency comparison, the full-content coverage proof, the producer's
fix round, and G3.

### 13.4 How a content card is tested

1. Unit vectors per module (§7.5); the spec or draft vectors for enemies and bosses.
2. Registry test (§7.3) passes with the batch's classes.
3. `npm run bot -- --runs 200 --policy mix --force-<items|talents|enemies> <the rows using the batch>` → 0 crashes, 0
   softlocks, and every class of the batch hit at least once (coverage report).
4. Review: one code reviewer reads each module side by side with its pseudo file; at most 2 fix rounds; style and naming
   issues go to the backlog.

### 13.5 Rules that keep 30 agents out of each other's way

- Every reachable class has exactly one owner card (generated by `tools/bp/batches.mjs` into
  `D:/TAPTAPGAME_studio/tmp/bp-owners.json` before the round; the orchestrator pastes the card's list into its prompt).
- A card edits only its modules, its batch file and `tests/<card>/`. Parent classes are always owned by an earlier card
  or the same card (the generator orders by parent depth and folders, then code points).
- Missing framework functions are never patched locally: `needs` → the `bp-fix-*` cards.
- No card edits `src/content/bp/index.ts`, `src/core/bp/**` or another system's folder.

---

## 14. Risks and open questions

| # | Item | Proposal / owner |
|---|---|---|
| Q1 | **Run structure.** Which chapters a Demo run contains: 入口 (12 floors, branches 遗迹/墓地) → 遗迹 (守门人) …; 墓地 and 深渊 have no boss data; the map shows "凝视深渊 通过第0/60层"; R57 says the Demo completes after one boss; `EMS_基础存档.已解锁关卡` lists 营地, 遗迹, 矿洞, 实验室, 龙穴, 武器库. | step-0 scope audit; A3/A13 implement whatever it finds |
| Q2 | Is the prologue forced before the first run (`新手关过？`)? | scope audit |
| Q3 | Which exclusive items of 恶疫旅人/元素祭司 appear (`获取物品_其他角色` has weight 0 in 宝箱房 but 200 in 宝箱房_自动 / 宝箱房_0)? | scope audit; verify-items |
| Q4 | Demo quirks the drafts offer to "consciously fix" (stamina savings applied twice, the (p+1)/101 roll, asymmetric volley). | default **reproduce** (1:1); producer may decide otherwise later |
| Q5 | Chinese identifiers in TypeScript for everything Demo-shaped (D11). | proposal; the alternative (English aliases) doubles the translation work |
| Q6 | Physics deceleration of enemy launches is unknown (LAUNCH-083). | linear damping fitted to the Demo captures, SPEC-GAP |
| Q7 | Frame-exact timing (TURN-GAP-05): we use a 60 Hz canonical frame for "next tick" and per-frame countdowns. | documented closest behaviour |
| Q8 | Wave A is 17 cards in 4 stages instead of 12 at once; the critical path is ~13 h. | accept; the alternative (systems coding against unmerged runtime) costs more in rework |
| Q9 | Budget: wave B is ~60 cards of ≤ 3 h. | run B1 and B2 on consecutive days within the daily cap; split a round if 429s start |
| R1 | The runtime (A1) is the single point of failure for stage 3. | strongest agent, the reviewer checks it rule by rule; stage-3 cards may start on its branch if its review is late |
| R2 | Facade signatures generated from pseudo may be wrong for a few functions (overloads, ref arrays). | A0 generator test against all pseudo files; fixes via `needs` to the integrator |
| R3 | No drafts for map/room/inventory/loot: those cards read raw pseudo-code. | SPEC-GAP freely, golden JSON outputs, revisit in B2 parity |

---

## Appendix A — Contracts (A0 commits these)

TypeScript, erasable syntax only, relative imports with `.ts`. Bodies marked `…` are implemented by the owning card.

### A.1 `src/core/math/sci.ts`

```ts
/**
 * 结构_科学数 at run time: 系数 × 10^指数, normalised to 1 ≤ |系数| < 10 by every operation (core-math §3).
 * A value: every operation returns a new one (a blueprint's MakeStruct becomes sciOf(…)).
 */
export interface 科学数 { readonly 系数: number; readonly 指数: number }
export const 科学数零: 科学数 = Object.freeze({ 系数: 0, 指数: 0 });
export function sciOf(系数: number, 指数 = 0): 科学数 { … }            // literal, normalised
export function sci(value: number): 科学数 { … }                        // from a plain double
export function 科学数标准化(a: 科学数): 科学数 { … }                    // CORE-M-010
export function 科学数加减(a: 科学数, b: 科学数, 减: boolean): 科学数 { … }   // CORE-M-011 (Demo: 科学数加减+-)
export function 科学数乘除(a: 科学数, b: 科学数, 除: boolean): 科学数 { … }   // CORE-M-012 (Demo: 科学数乘除*/)
export function 科学数Power(base: 科学数, exp: number): 科学数 { … }          // CORE-M-013
export function 科学数ABS(a: 科学数): 科学数 { … }                            // CORE-M-014
export function 科学数变普通(a: 科学数): number { … }                         // CORE-M-015
export function 比较科学数(a: 科学数, b: 科学数, 取小: boolean): { 结果: -1 | 0 | 1; 值: 科学数 } { … } // CORE-M-016
export function 科学数比较(a: 科学数, op: '<' | '<=' | '=' | '>=' | '>', b: 科学数): boolean { … }     // CORE-M-017 (QUIRK)
export function 比较科学数_纯正(a: 科学数, b: 科学数, 取小: boolean): 科学数 { … }                     // CORE-M-018
export function 限制科学数(x: 科学数, min: 科学数, max: 科学数): 科学数 { … }                          // CORE-M-019
export function fromData(x: { readonly 系数: number; readonly 指数: number }): 科学数 { … }           // table value
```

### A.2 `src/core/math/stats.ts`

```ts
import type { 科学数 } from './sci.ts';
import type { 结构_科学映射词条 } from '../../content/demo/types.ts';
export type 计算类型 = '加算' | '乘算';
export interface 科学映射词条 { 计算类型: 计算类型; 来源映射: Map<string, 科学数> }
export type 词条映射 = Map<string, 科学映射词条>;
export function 词条映射From(row: Readonly<Record<string, 结构_科学映射词条>>): 词条映射 { … }        // deep copy
export function 获取科学映射词条(m: 词条映射, 词条名: string): { 输出值: 科学数; found: boolean } { … } // CORE-M-051…053
export function 添加科学映射值(m: 词条映射, 词条名: string, 来源: string, 值: 科学数, 累加: boolean): void { … } // CORE-M-054
export function 移除科学映射值(m: 词条映射, 词条名: string, 来源: string): boolean { … }                  // CORE-M-055 (QUIRK)
export function 科学映射原始值(m: 词条映射, 词条名: string, 补充永久: boolean): 科学数 { … }              // CORE-M-056
```

### A.3 `src/core/rng/ue.ts`, `src/core/rng/domains.ts`

```ts
/** FRandomStream (CORE-M-121). */
export interface UeStream { InitialSeed: number; Seed: number }
export function MakeRandomStream(seed: number): UeStream { … }
export function RandomIntegerInRangeFromStream(s: UeStream, a: number, b: number): number { … }
export function RandomIntegerFromStream(s: UeStream, max: number): number { … }
export function RandomFloatInRangeFromStream(s: UeStream, a: number, b: number): number { … }
export function Array_RandomFromStream<T>(s: UeStream, arr: readonly T[]): number { … }   // index, −1 if empty
export function Array_ShuffleFromStream<T>(s: UeStream, arr: T[]): void { … }
/** CRT-style 15-bit generator replacing rand() (CORE-M-123) and the unseeded engine primitives on it (CORE-M-120). */
export interface Rand15 { state: number }
export function FRand(g: Rand15): number { … }
export function RandomFloatInRange(g: Rand15, a: number, b: number): number { … }
export function RandomIntegerInRange(g: Rand15, a: number, b: number): number { … }
export function RandomInteger(g: Rand15, max: number): number { … }
export function RandomBool(g: Rand15): boolean { … }
export function RandomBoolWithWeight(g: Rand15, w: number): boolean { … }
export function Array_Random<T>(g: Rand15, arr: readonly T[]): number { … }               // index, −1 if empty (no draw)
export function Array_Shuffle<T>(g: Rand15, arr: T[]): void { … }

// domains.ts (CORE-M-124)
export type RngDomain = 'meta' | 'level' | 'combat' | 'loot';
export interface RngDomains {
  readonly runSeed: number;
  readonly 全局种子: UeStream;
  readonly meta: Rand15; readonly level: Rand15; readonly combat: Rand15; readonly loot: Rand15;
  enterFloor(floorIndex: number): void;     // reseeds level
  enterCombat(combatIndex: number): void;   // reseeds combat and loot
  save(): RngSave; load(s: RngSave): void;
}
export interface RngSave { runSeed: number; 全局种子: UeStream; meta: number; level: number; combat: number; loot: number; floorIndex: number; combatIndex: number }
export function createRngDomains(runSeed: number): RngDomains { … }
```

### A.4 `src/core/sim/types.ts`

```ts
import type { AssetPath, RichCurve } from '../../content/demo/types.ts';
import type { World } from './world.ts';          // no inline import types: the purity test rejects the dynamic-import pattern
export type { AssetPath };
export type Tag = string;
/** World position in uu: x east, y south (the src/core/launch frame), z up. */
export interface Vec3 { x: number; y: number; z: number }
export type ClassKind = 'ability' | 'effect' | 'projectile' | 'actor' | 'card' | 'pickup' | 'decoration' | 'settlement' | 'other';
/** One entry of src/content/demo/classes.ts (A2). */
export interface ClassDef {
  readonly path: AssetPath;
  readonly name: string;
  readonly parent: AssetPath | null;
  readonly kind: ClassKind;
  readonly tags: readonly Tag[];                                   // CDO OwnedGameplayTags, inherited, redirected
  readonly vars: Readonly<Record<string, unknown>>;                // own variables: CDO defaults, mangled names
  readonly timelines: Readonly<Record<string, { readonly length: number; readonly tracks: Readonly<Record<string, RichCurve>> }>>;
  readonly components: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly rows: readonly string[];                                // live 'table:row' references
  readonly reachable: boolean;
}
export type BpCtor<T = unknown> = (abstract new (world: World, def: ClassDef) => T) & { readonly path: AssetPath };
export interface ContentRegistry { get(path: AssetPath): BpCtor | undefined; readonly size: number; paths(): AssetPath[] }
export interface HitResult { actor: unknown; impactPoint: Vec3; impactNormal: Vec3; location: Vec3; normal: Vec3; blockingHit: boolean }
```

### A.5 `src/core/sim/{world,clock,object}.ts` (signatures; A1 implements)

```ts
export interface SimClock {
  readonly now: number;                                     // game seconds
  readonly frame: number;                                   // canonical 60 Hz frame index
  at(time: number, fn: () => void, owner?: BpObject): number;
  after(seconds: number, fn: () => void, owner?: BpObject): number;
  nextFrame(fn: () => void, owner?: BpObject): number;
  cancel(entry: number): void;
  cancelOwner(owner: BpObject): void;
  addProcess(p: { step(dt: number): void; active(): boolean }): void;   // sub-stepped at 1/120 s while active
  advance(dt: number): void;
  runUntil(stop: () => boolean, maxSeconds: number): 'stopped' | 'idle' | 'timeout';
}

export interface World {
  readonly clock: SimClock;
  readonly rng: RngDomains;
  readonly data: DemoData;                                  // tables + classes + anims + tags manifests
  readonly mode: 蓝图_动作游戏模式;                          // the game mode (variables + facade)
  readonly cult: 修炼系统;                                   // 修炼系统 (variables + facade)
  readonly sys: Systems;                                    // Appendix B modules
  readonly bus: PresentBus;
  readonly coverage: Coverage;
  readonly strict: boolean;
  spawn<T extends BpObject>(cls: AssetPath | BpCtor<T>, init?: (o: T) => void, at?: Vec3): T;
  destroy(o: BpObject): void;
  isValid(o: unknown): o is BpObject;
  unported(what: string): void;
  isPorted(path: AssetPath): boolean;
  readonly trace: { sphere(from: Vec3, to: Vec3, radius: number, channel: string, ignore?: readonly BpObject[]): HitResult[];
                    line(from: Vec3, to: Vec3, channel: string, ignore?: readonly BpObject[]): HitResult | null };
}

export abstract class BpObject {
  declare static readonly path: AssetPath;                  // set by every concrete class

  readonly id: number;
  readonly world: World;
  readonly def: ClassDef;
  valid = true;
  location: Vec3 = { x: 0, y: 0, z: 0 };
  attachParent: BpObject | null = null;
  readonly OwnedGameplayTags: TagSet;                       // from def.tags
  readonly fx: Fx;
  constructor(world: World, def: ClassDef) { … }
  ReceiveBeginPlay(): void {}
  ReceiveTick(_dt: number): void {}
  setTickEnabled(on: boolean): void { … }
  K2_GetActorLocation(): Vec3 { … }                         // follows attachParent
  K2_SetActorLocation(p: Vec3): void { … }
  K2_AttachToActor(parent: BpObject): void { … }
  K2_DetachFromActor(): void { … }
  K2_DestroyActor(): void { … }
  HasMatchingGameplayTag(t: Tag): boolean { … }
  delay(node: string, seconds: number, then: () => void): void { … }
  retriggerableDelay(node: string, seconds: number, then: () => void): void { … }
  nextTick(node: string, then: () => void): void { … }
  setTimer(handle: string, rate: number, looping: boolean, fn: () => void, initialStartDelay = 0): void { … }
  clearTimer(handle: string): void { … }
  timeline(name: string, mode: 'PlayFromStart' | 'Play' | 'Reverse' | 'ReverseFromEnd' | 'Stop',
           cb?: { update?(t: number, tracks: Readonly<Record<string, number>>): void; finished?(): void }): void { … }
  playAnim(on: BP_ManeActor, sequence: string, cb?: { completed?(): void; cancelled?(): void; notify?(name: string): void }): void { … }
}

export class TagSet {
  has(query: Tag): boolean { … }                            // owned == query or a child of query (HasMatchingGameplayTag)
  hasExact(t: Tag): boolean { … }
  hasAny(q: readonly Tag[]): boolean { … }
  hasAll(q: readonly Tag[]): boolean { … }
  add(t: Tag): void { … }
  remove(t: Tag): void { … }
  toArray(): Tag[] { … }
}

export interface Fx {
  vfx(asset: AssetPath | null, at: Vec3 | BpObject, opts?: { attach?: boolean; scale?: number }): void;
  sound(asset: AssetPath | null, at?: Vec3, opts?: { volume?: number; pitch?: number }): void;
  shake(asset: string, at?: Vec3): void;
  flipbook(on: BpObject, asset: AssetPath, opts?: { loop?: boolean }): void;
  flash(on: BpObject, seconds: number): void;
  headUp(on: BpObject, text: TextRef): void;
  popup(p: PopupPayload): void;
  log(line: LogLine): void;
  ui(op: UiOp): void;
  bgm(state: '无' | '主界面' | '探索' | '战斗'): void;
}
export interface TextRef { ns: string; key: string; args?: Readonly<Record<string, string | number>> }
```

### A.6 Effects, abilities, dispatch (`src/core/ability`, signatures)

```ts
export abstract class 蓝图_效果 extends BpObject {
  效果名字 = ''; 拥有者!: BP_ManeActor; 释放者: BP_ManeActor | null = null; 来自技能: 蓝图_能力 | null = null;
  持续时长 = 0; 触发间隔 = 1.0; 剩余时长 = 0; 持续回合 = -1; 叠加层数 = 1; 剩余回合 = -1; 触发次数 = 1;
  触发时机: Tag = ''; 销毁延迟 = 0; 临时 = false; 已销毁 = false; 连击计数 = 0; 无延迟连击 = false;
  伤害数据: 伤害 = make伤害(); 治疗数据: 治疗 = make治疗(); 实际治疗值: 科学数 = 科学数零;
  命中数据: HitResult | null = null; 词条数值: 科学数 = 科学数零; 当前附加效果: 蓝图_效果 | null = null;
  // base behaviour (do not override): ABILIT-042, 045, 047, 053
  激活效果(debug = ''): void { … }
  持续效果(): void { … }
  销毁效果(): void { … }
  更新时间(新: 效果配置): void { … }
  // hooks
  激活后触发(_debug: string): void {}
  持续中触发(_时机: Tag): void {}
  装上时触发(): void { … }                                   // ABILIT-057 default
  卸下时触发(): void { … }                                   // ABILIT-058 default
  销毁前触发(): void {}
  销毁后触发(): void {}
  额外子触发(_结算数值: number | 科学数, _触发次数: number): void {}
  连击处理(结算数值: number | 科学数): void { … }               // ABILIT-049
}

export abstract class 蓝图_能力 extends BpObject {
  唯一ID = '0'; 能力名 = ''; 技能配置!: 结构_技能; 等级 = 1; 品质 = 1; 上一次等级 = 0; 种子 = 0; 拥有者!: BP_ManeActor;
  参数: 结构_参数[] = []; 效果配置: 效果配置[] = []; 子效果配置: 效果配置[] = []; 发射物: 结构_发射物[] = [];
  类型 = new TagSet(); 条件: 结构_条件 | null = null; 副条件: 结构_条件[] = [];
  子条件通过 = true; 解锁了 = true; 强制释放 = false; 本技能激活中 = false; 本技能可释放 = false; 是天赋 = false;
  未生效 = false; 无吟唱 = false; 冷却效果: 蓝图_效果 | null = null; 吟唱效果: 蓝图_效果 | null = null; 当前消耗 = 0;
  前置技能 = '无'; 对应技能格: number | null = null; 原始描述 = ''; 描述 = ''; 额外原始描述: string[] = []; 额外描述: string[] = [];
  // base (final): ABILIT-004, 011…019, 025…038
  初始化(): void { … }
  检查条件(): void { … }
  消耗处理(): void { … }
  释放开始(): void { … }
  释放预处理(): void { … }
  释放结束(是打断: boolean): void { … }
  创建冷却效果(冷却秒: number, 冷却回合: number): void { … }
  更新技能描述(预览下N级: boolean, N: number): void { … }
  // virtual
  子初始化(): void {}
  检查子条件(): void {}
  被选中(): void {}
  执行技能(_是读档: boolean): void {}
  预览目标(): void {}
  特殊结算(_p: 蓝图_发射物): void {}
}

export function fireLive(list: 蓝图_效果[], tag: Tag, set?: (e: 蓝图_效果) => void, opts?: { skip?: Set<蓝图_效果>; record?: Set<蓝图_效果> }): void;
export function fireCopy(list: readonly 蓝图_效果[], tag: Tag, set?: (e: 蓝图_效果) => void, opts?: { skip?: Set<蓝图_效果>; record?: Set<蓝图_效果> }): void;
export function tickCopy(list: readonly 蓝图_效果[], tag: Tag, opts?: { skip?: Set<蓝图_效果>; record?: Set<蓝图_效果> }): void;
export function forLive<T>(arr: T[], fn: (x: T, i: number) => void): void;     // UE live index loop for content
```

### A.7 Runtime structs (`src/core/bp/structs.ts`)

```ts
export interface 伤害 {            // 结构_伤害
  伤害来源: 枚举_伤害来源; 伤害类型: 枚举_伤害类型; 不变速: boolean; 是暴击: boolean; 是弱点: boolean;
  伤害数值: 科学数; 所需回合: number; 触发次数: number; 击中点位置: Vec3; 击中点法线: Vec3; 断开骨骼名: string;
  来自技能: 蓝图_能力 | null; 来自角色: BP_ManeActor | null; 来自发射物: 蓝图_发射物 | null; 目标角色: BP_ManeActor | null;
}
export interface 治疗 {            // 结构_治疗
  是暴击: boolean; 生命护甲: boolean; 治疗整数: 科学数; 治疗百分比: 科学数; 触发次数: number; 特效位置: Vec3;
  来自技能: 蓝图_能力 | null; 释放者: BP_ManeActor | null;
}
export interface 效果配置 {        // 结构_效果
  效果类: AssetPath | null; 持续时间: number; 触发间隔: number; 持续回合: number; 叠加层数: number;
  唯一: boolean; 检查效果名: boolean; 叠加上限: number;
}
export function make伤害(p?: Partial<伤害>): 伤害;      // defaults: demoStructs.结构_伤害.defaults
export function make治疗(p?: Partial<治疗>): 治疗;
export function 效果配置From(row: 结构_效果): 效果配置;
```

### A.8 Game API (`src/core/api`)

```ts
export interface GameOptions {
  seed: number;
  content: ContentRegistry;
  save?: SaveBlob;
  strict?: boolean;
  filter?: 'ported' | 'all';
  debug?: { floors?: number; chapter?: string; hero?: string; forceItems?: string[]; forceTalents?: string[]; forceEnemies?: string[] };
}
export function createGame(o: GameOptions): Game;

export interface Game {
  readonly view: GameView;
  legal(): readonly CommandSpec[];
  send(cmd: Command): CommandResult;
  advance(dt: number): void;
  runUntilInput(maxSeconds?: number): 'input' | 'idle' | 'ended' | 'timeout';
  preview(aim: { x: number; y: number }): LaunchPreview | null;
  drainEvents(): PresentEvent[];
  save(): SaveBlob;
  digest(): string;
  readonly coverage: CoverageReport;
}

export type ItemPlace = { grid: 'equip' | 'backpack' | 'stash'; row: number; col: number };
export type Command =
  | { type: 'title.prologue' } | { type: 'title.newRun' } | { type: 'title.continue' } | { type: 'title.quit' }
  | { type: 'hero.pick'; hero: string } | { type: 'hero.abyss'; level: number } | { type: 'hero.start' } | { type: 'hero.back' }
  | { type: 'map.enter'; cell: string } | { type: 'map.backpack'; open: boolean }
  | { type: 'aim.release'; aim: { x: number; y: number } }
  | { type: 'skill.press'; slot: 0 | 1 | 2 | 3 } | { type: 'skill.target'; at: { x: number; y: number } } | { type: 'skill.cancel' }
  | { type: 'interact'; actor: number }
  | { type: 'item.move'; item: number; to: ItemPlace } | { type: 'item.use'; item: number } | { type: 'item.dismantle'; item: number }
  | { type: 'item.combine'; item: number; with: number } | { type: 'item.enchant'; stone: number; target: number; replace?: number }
  | { type: 'item.craft'; recipe: string; count: number } | { type: 'item.extract'; item: number }
  | { type: 'modal.pick'; option: number } | { type: 'modal.reroll' } | { type: 'modal.skip' }
  | { type: 'loot.take'; item: number; to?: ItemPlace } | { type: 'loot.takeAll' } | { type: 'loot.close' }
  | { type: 'panel.continue' } | { type: 'panel.retry' }
  | { type: 'menu.open' } | { type: 'menu.resetRoom' } | { type: 'menu.abandon' } | { type: 'menu.saveQuit' } | { type: 'menu.close' }
  | { type: 'runEnd.continue' }
  | { type: 'camp.newRun' } | { type: 'camp.prologue' };
export type CommandSpec = { type: Command['type']; params?: Readonly<Record<string, readonly (string | number)[]>> };
export interface CommandResult { ok: boolean; reason?: string }

export interface GameView {
  readonly screen: 'title' | 'heroSelect' | 'map' | 'room' | 'death' | 'runEnd' | 'camp';
  readonly phase: 枚举_环节;
  readonly inputOpen: boolean;                          // 玩家可与环境交互？
  readonly modal: ModalView | null;
  readonly run: RunView | null;                         // chapter, floor, quest line, turn counters, 金币/精矿, 当前腐化/最大腐化, 英雄等级/经验, abyss level
  readonly hero: HeroView | null;                       // id, row, position, HP/armor/stamina/DoT, statuses, skills (slots, cooldowns), stats for tooltips
  readonly field: readonly ActorView[];                 // 场上所有 order: id, row, table, kind, position, radius, height, hidden, hp, armor, intent, statuses, elite, boss
  readonly pickups: readonly { id: number; row: string; position: Vec3 }[];
  readonly terrain: readonly { id: number; cls: AssetPath; cells: readonly [number, number][] }[];
  readonly projectiles: readonly { id: number; cls: AssetPath; position: Vec3 }[];
  readonly room: RoomView | null;                       // floor cells (64 uu), solids, decorations, fog, background, junction
  readonly map: MapView | null;                         // cells, links, current, explored, reward icons, stars, boss next
  readonly inventory: InventoryView;                    // equip column, backpack, locked rows, side bar, materials, cards (row, quality, charge, durability, enchants, tooltip lines)
  readonly launch: { playback: LaunchPlayback; startedAt: number } | null;
  readonly log: readonly { t: number; rich: string }[];
  readonly time: number;
}
export type ModalView =
  | { kind: 'multiChoice'; source: 'levelUp' | 'talentRoom' | 'scroll' | 'boss' | 'event' | 'ultimateChoice'; title: string; options: readonly ChoiceOptionView[]; reroll: { cost: number; currency: string } | null; canSkip: boolean }
  | { kind: 'loot'; title: string; cells: readonly LootCellView[]; exp: number | null; canTakeAll: boolean }
  | { kind: 'panel'; result: 'victory' | 'failure'; lines: readonly { label: string; value: string }[]; canRetry: boolean }
  | { kind: 'runEnd'; lines: readonly { label: string; value: string }[]; score: number }
  | { kind: 'warning'; type: '退出游戏' | '无尽模式' | '继续冒险'; buttons: readonly string[] }
  | { kind: 'enchantReplace'; current: readonly string[]; incoming: string }
  | { kind: 'death'; seconds: number };
```

### A.9 Presentation events (`src/core/api/events.ts`)

```ts
export type PresentEvent = { readonly t: number } & (
  | { kind: 'actor.spawn'; id: number; row: string; table: string; cls: AssetPath; actorKind: 'hero' | 'enemy' | 'boss' | 'neutral' | 'card' | 'pickup' | 'terrain' | 'projectile' | 'decoration'; at: Vec3; radius: number; height: number; elite: boolean; hidden: boolean }
  | { kind: 'actor.despawn'; id: number } | { kind: 'actor.reveal'; id: number } | { kind: 'actor.hide'; id: number; hidden: boolean }
  | { kind: 'actor.anim'; id: number; sequence: string; seconds: number; loop: boolean }
  | { kind: 'actor.flash'; id: number; seconds: number } | { kind: 'actor.squash'; id: number; speed: number; normal: Vec3 }
  | { kind: 'actor.hit'; id: number; from: number | null; crit: boolean; weak: boolean } | { kind: 'actor.die'; id: number }
  | { kind: 'launch.start'; hero: number } | { kind: 'launch.contact'; index: number; contact: 'enemy' | 'wall' | 'gravity'; actor: number | null } | { kind: 'launch.end'; hero: number }
  | { kind: 'popup'; popup: 'damage' | 'heal' | 'charge' | 'infuse' | 'stamina' | 'corruption' | 'exp' | 'gold' | 'text'; value: number | string; target: number | null; at: Vec3 | null; crit?: boolean; weak?: boolean; damageType?: string; stack?: number }
  | { kind: 'vfx'; asset: AssetPath | null; at: Vec3 | null; attach: number | null }
  | { kind: 'sound'; asset: AssetPath | null; at: Vec3 | null; volume: number; pitch: number }
  | { kind: 'shake'; asset: string; at: Vec3 | null }
  | { kind: 'time.dilation'; curve: 'hitStop' | 'death' | 'none'; from: number }
  | { kind: 'headUp'; id: number; text: string }
  | { kind: 'log'; rich: string }
  | { kind: 'bgm'; state: '无' | '主界面' | '探索' | '战斗' }
  | { kind: 'ui'; op: 'open' | 'close' | 'update'; widget: string; data?: unknown }
);
```

---

## Appendix B — Demo function → system module (the facade owner map)

The generator (A0) assigns each function of these 19 pseudo files to one module; the card that owns the module
implements it. Functions marked "present" become `fx` calls or no-ops; "dead" are unreachable (no caller, debug,
过期) and stay unported. Counts are of distinct functions.

**kernel (A1)** — BP_ManeActor: 初始化, 激活角色, 更新角色数据, 属性被修改后, 标签被修改后, 修正词条数值, 更新最大生命魔力,
开启碰撞, 关闭碰撞, 特殊处理, ReceiveTick; BP_Actor_Player: 激活角色, 更新最大生命魔力, 后更新; BP_Actor_Other: 激活角色,
ReceiveDestroyed; BP_Actor_Card: 激活角色, 开启碰撞, 关闭碰撞, ReceiveTick; 蓝图_动作游戏模式: 开始动画结算,
清理动画结算, 获取场景中物体, ReceiveBeginPlay, ReceiveTick; 蓝图_动画结算: 激活结算, 激活子结算, 结束结算,
结算结束判断, 判断当前游戏环节; 函数库_工具: 修改目标词条（加减）, 吸附到网格, 向量吸附角度, 范围选取点, 计算除余数,
计算除余数（科学）, 排序整数, 是敌人？, 检查阵营, 获取操控角色, 获取英雄标签, 销毁目标和子物体, 隐藏目标和子物体;
函数库_技能: 叠加映射属性; 函数库_科学数: all 20 (A0 implements them in `core/math`); prob functions (PRD概率判断_批量,
PRD概率判断, CfromP, PfromC, 传统概率判断, 权重选取, 权重创建数组, 拆分权重数据表, 权重强化数值, 递减强化属性, 随机化) are
implemented by **A3** in `core/math/prob.ts` and exposed by the kernel facade.

**ability (A1; projectiles A11)** — BP_ManeActor: 添加技能, 打断技能, 附加效果前, 附加效果后, 效果来自自身？, 创建发射物,
创建发射物组; 函数库_工具: 附加效果前处理, 存在同名效果？, 存在同类效果？, 存在相同主动？, 存在相同被动？, 有对应标签效果？,
对应类型效果数量, 对应标签效果数量, 排序效果, 清理已销毁效果, 获取释放的角色, 选择角色作为目标, 使目标执行自身技能,
使目标执行指定技能; 函数库_技能: 获取技能参数 (A0), 获取效果名, 技能减少冷却, 目标减少随机技能冷却, 判断原始标签并修改,
技能条件筛选物品, 发射物数判断, 添加发射物数, 移除发射物数; 蓝图_能力: all 17; 蓝图_效果: all 15; 蓝图_发射物: all 14
(A11); 蓝图_主角色控制器: 尝试执行指定技能.

**turn (A7)** — BP_ManeActor: 结束行动, 加入行动结束, 打断当前动画, 被揭示, 新一天时, 回合开始前, 结束层时, AI行动前,
玩家交互, 被复活/重置, 判断行动力, 添加行动力 (enemy gauge); BP_Actor_Card: 结束行动, 判断行动力, 玩家交互;
蓝图_动作游戏模式: 新一层, 重建房间, 清理房间, 房间完毕触发时机,
新一层触发时机, 新回合前, 新回合触发时机, 新回合后, 加入回合开始, 退出回合开始, 增长行动度, 执行AI行动, 等待玩家操作,
进入战斗状态, 退出战斗状态, 判断场上内容, 有角色死亡时, 物品挑战成功时, 结束当前层, 结束层时机, 英雄退战重置属性, 创建任务,
激活任务, 创建角色, 生成角色, 添加到牌库, 从牌库抽出, 添加到战场, 从场上移出（碰撞）, 添加到墓地, 添加到延迟销毁,
抽取卡牌到场上（碰撞）, 抽取特定类型卡牌到场上（碰撞）, 添加道具到牌库, 重置牌库和墓地, 根据数组长度延迟;
函数库_技能: 召唤角色到场上; 蓝图_主角色控制器: 交互角色,
进行交互, 交互到商人, 交互到敌人/友军, 交互到有敌人角色, 交互到不可拾取物品, 根据操作执行技能; 蓝图_通用路口: 新一天时,
回合开始前, 结束层时, AI行动前, 玩家交互, 被复活/重置 (junction as a field actor).

**stamina (A8)** — BP_ManeActor: 改变体力, 疲劳结算; BP_Actor_Player: 精神系统, 获得精神状态; 蓝图_动作游戏模式: 增加腐化;
函数库_工具: 修改体力点.

**damage (A9)** — BP_ManeActor: 造成即时伤害, 受到即时伤害, 失去生命/护甲, 伤害加成, 计算基础伤害倍率, 会心判断, 会心触发,
免疫处理, 闪避处理, 格挡处理, 造成持续伤害, 受到持续伤害, 结算持续伤害, 持续伤害生效, 更新剩余持续伤害, 移除剩余持续伤害,
移除减益效果, 获得治疗, 可死亡检查, 检查死亡, 角色死亡, 终结目标, 杀死敌人时, 输出受伤日志; BP_Actor_Player: 角色死亡,
计算持续伤害详情; BP_Actor_Other: 角色死亡, 生成弱点; BP_Actor_Card: 造成即时伤害, 造成持续伤害, 检查死亡; 函数库_工具:
计算暴击伤害; 函数库_技能: 对周围敌人造成伤害, 查询持续伤害, 判断目标可合并持续伤害; 蓝图_能力: 通过地形造成伤害;
函数库_战斗日志: all 3.

**launch / charge / rating (A10)** — BP_ManeActor: 发动攻击, 近战捕获攻击目标, 远程捕获攻击目标, 进入攻击状态,
退出攻击状态, 碰撞前处理, 碰撞检测, 手动触发碰撞, 弹性处理, 避免循环反弹, 切换穿透状态, 更新朝向, 更新攻速, 更新运动数据,
移动位置更新, 额外运动更新, 计算移动所需时间, 结束移动判断, 移到目标地点, 实时检测, 归位角色位置; BP_Actor_Player: 实时检测,
添加待拾取物, 清除待拾取物, 更新不再拾取物; BP_Actor_Card: 实时检测, 结束移动判断; 函数库_工具: 判断目标可反弹,
计算反弹角度, 插值移动到目标位置, 更新目标和自身运动数据; 函数库_技能: 给装备的物品充能, 武器充能回合计数, 武器充能耐久计数;
蓝图_动画结算: 移到目标地点, 移动位置更新, 计算移动所需时间; BP_Actor_Card: 添加行动力 (charge; the card variant).
Rating (`sys/rating`): BP_Actor_Player: 结算评分; BP_ManeActor: 更新角色战斗统计; 蓝图_动作游戏模式: 重复惩罚,
更新回合战斗统计, 更新轮回战斗统计 (rating-shot-stats owns them).

**ai / physics (A11)** — BP_ManeActor: 选择技能, 检查技能条件, 跳过本回合, 递进预制技能顺序, 乘数强化属性, 物理判断,
更新角色质量; BP_Actor_Other: 成长属性, 实时检测, 物理终止检测; 蓝图_动作游戏模式: 预测AI行动, 精英化敌人,
获取当前层成长率, 写入怪物自定义属性, 查询怪物自定义属性; 函数库_工具: 乘数强化属性, 以目标为中心释放冲击,
以目标为中心施加持续力, 以目标为中心追踪, 冲击目标, 获取碰撞体包含的敌人; 函数库_技能: 给有物理添加冲量, 根据体重添加冲击,
获取目标范围空地, 角色检查目标位置空间; 蓝图_主角色控制器: 移动到, 跟随 (out-of-combat movement).

**inventory (A4)** — BP_ManeActor: 被抓起, 被放下; BP_Actor_Player: 移除物品; BP_Actor_Card: 生成-side and card rules:
处理词条, 成长词条, 升级此牌, 精英化装备, 获取相邻牌, 物品交换判断, 自身可合成判断, 自身是附魔卷轴判断, 获取附魔能力,
添加附魔, 移除附魔, 储存附魔, 更新价格, 更新起始格序号, 交互此牌, 临时牌处理, 被抓起, 被放下; 蓝图_动作游戏模式: 装备目标,
卸载目标, 获取装备并装上, 更新生命药剂数量, 背包重置解锁; 修炼系统: 生成卡牌, 获取牌, 装备牌, 卸下牌, 使用牌, 使用牌后处理,
移除物品, 分解牌, 合成牌, 制造牌, 检查可合成牌, 判断是否可置入, 创建锁定格, 获取后触发, 切换修炼背包, 激活修炼系统,
清空侧栏, 销毁待销毁牌, 解锁配方判断; 修炼物品格子组: all 7 rules functions (整理并寻找可摆位置, 向上/下检查并偏移,
检查上下偏向, 检查空间, 检查指定格子, 整理物品排列, 放入物品到指定格); 函数库_工具: 筛选修炼物品, 统计装备相同物品, 套装判断,
判断装备能否放下, 判断装备能否替换, 查找物品大小的格子, 排序装备, 排序格子, 修改材料数量, 材料需求判断, 尝试合成材料,
判断生产状态, 获取附魔标签; 函数库_技能: 恢复生命药剂; 蓝图_主角色控制器: 判断修炼牌交互, 交互到未拾取物品,
交互到已拾取/不在范围物品. Text (core/text, A4): 根据参数生成文本, 生成能力描述参数, 词条说明参数, 数字缩写, 提示简化处理,
科学数字缩写.

**rewards (A12)** — BP_ManeActor: 掉落货币, 触发掉落, 盒子关闭后, 刷新盒子, 奖励配置; 蓝图_动作游戏模式: 创建奖励,
增加金币/收入, 生成随机装备, 非酋保护机制, 近期X次掉落是否有X, 近期X次是否出现X奖励, 移除指定掉落物, 添加装备掉落,
添加材料掉落, 清理所有掉落物, 筛选可掉落装备, 添加锻造格; 修炼系统: 切换物品盒子, 筛选物品生成, 刷新生成牌, 全拿未拾取牌,
清除未拾取牌, 创建牌到侧栏; 函数库_工具: 合并权重掉落池, 获取层数品质; 蓝图_主角色控制器: 打开掉落盒, 交互到商品;
蓝图_通用路口: 盒子关闭后, 刷新盒子, 奖励配置.

**talents (A13)** — BP_ManeActor: 添加天赋, 天赋关闭后; BP_Actor_Player: 升级玩家, 移除天赋; 蓝图_动作游戏模式: 增加经验,
尝试提升等级; 蓝图_通用路口: 天赋关闭后. UI logic ported to core here: UI_主界面 (筛选天赋, 开启/关闭/刷新多选一),
UI_天赋选项 (更新描述 level gain).

**map / room (A3; full room generator in wave B `core-room`)** — BP_ManeActor: 迷雾处理, 迷雾展开; 蓝图_动作游戏模式:
筛选关卡, 筛选地图格池, 选取地图格层标签, 更新地图格层标签队列, 判断接下来是否是首领层, 获取动态网格点, 创建地块, 摆放玩家,
创建路口, 增加回廊长度; 蓝图_房间: all 11; 蓝图_房间格子: all 23 rules functions; 蓝图_通用路口: 激活路口, 交互路口;
函数库_工具: 选择合法地形, 寻找移动创建点, 映射坐标, 一维数组索引换算二维; 函数库_技能: 查找地形格 and the 7
选取范围地形格（…） shapes. UI logic ported to core: UI_关卡地图页面, UI_地图格 (tile generation, rewards, quality).

**meta / save (A13)** — BP_ManeActor: 判断解锁, 读档处理, ActorSaved/ActorPreSave/ActorPreLoad/ActorLoaded,
ComponentsToSave; BP_Actor_Player: 保存英雄信息, 保存主动技能, 保存天赋, 保存精神状态, 保存持续伤害, 读取天赋存档,
读取能力效果存档, ActorPreSave; BP_Actor_Card: 从仓库中移除, ActorLoaded, ActorPreSave; 蓝图_动作游戏模式: 新的轮回,
英雄死亡后初始化, 返回营地, 继续冒险, 进入死亡结算, 进入新手关, 初始化天赋解锁, 恢复轮回任务, 重置轮回任务, 默认游戏设置,
创建玩家角色并控制, 打开指定场景, 选择/进行/退出建筑状态, save hooks; 修炼系统: 仓库牌, 读档物品; 函数库_工具: 获取基础存档数据,
保存基础存档, 加载/创建存档; 蓝图_通用路口: 读档处理.

**present (fx, game layer)** — hover, highlight, appearance (更新外观数据 and friends), UI page switching (切换*页),
widget plumbing, camera, timelines that only animate (死亡变色, 全局时间变速 and 后期处理 as dilation/post events), sound
selection (选择声音播放), lightning visuals (创建闪电链特效), screen-space helpers.

**dead (not ported)** — 失去生命/护甲_bak, 生成战斗敌人, 执行状态树, 使用/抽取技能牌, 洗回墓地牌, 战术撤退, 增加奥义,
测试函数(2), 创建路口_old, 更新友方/敌方站位, the (格子) and 手牌 variants, 多选一牌 trio, 激活弹珠/敌人生成, 触发弹珠/敌人出生点,
抽新场牌, 激活行动累计, 等待AI揭示/交互, 投掷骰子, 减速时间, 正常时间, 读档重置, 结束解放, the legacy equipment helpers
(判断装备和格子是否同部位, 查找对应部位装备格, 判断部位空间（不可用）, 创建装备, 更新部位信息), gesture and skill-wheel functions,
DBUG计算角度, 计算映射属性求和/平均值, 计算映射属性百分比, 乘法叠加概率 (turn-flow §4.12, heroes-skills HEROES-100…115,
core-math CORE-M-064). Input events (`InpActEvt_*`) are the shell's input mapping (A15), not core functions.

Variables: BP_ManeActor (≈190), BP_Actor_Player (≈80), BP_Actor_Other (≈10), BP_Actor_Card (≈45), 蓝图_动作游戏模式
(≈260), 修炼系统 (≈80) — A0 generates declarations with CDO defaults from the pseudo `var` lines; widget, component and
`K2Node`/`Temp_` entries are excluded.

---

## Appendix C — How the numbers in this document were produced

Scripts in `D:/TAPTAPGAME_studio/tmp/step0/scripts/` (Python, read-only on the dump):

- `content_stats.py`: reachability of the 590 skill blueprints (live table rows + live non-skill blueprints, closure over
  code references and parents) → 495 reachable, 73 588 pseudo-lines; `skill_classes.json`.
- `api_surface.py`: callee names in reachable content and their owning classes → 429 distinct, ≈170 Demo functions.
- `classify.py`, `classify2.py`: the function → module map of Appendix B (hand-checked overrides).
- `batches.py` / `batches2.py`: wave-A claims (final scope: 81 classes, 14 448 lines) and the wave-B splits of
  效果/物品 (8) and 效果/天赋 (5).

A2's `tools/bp/batches.mjs` recomputes the reachable set and the batch lists authoritatively; small differences from
these counts are expected and must be explained in its result.
