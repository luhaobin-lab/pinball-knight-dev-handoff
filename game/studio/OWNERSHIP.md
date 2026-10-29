# File ownership (v3)

A task edits only the paths its lane owns, plus its own tests and debug scenes. Task ids are `<lane>-<what>`
(e.g. `ui-hud`, `core-launch`). For anything else, describe the change under `needs` in the task result; the
integrator applies changes to shared files. Reviewers check `git diff --name-only main...task/<id>` against this
table.

| Lane | Paths |
|---|---|
| `core` | `src/core/**` (deterministic rules: launch and collision, turn flow, damage, statuses, AI, generation) |
| `content` | `src/content/**` (the imported Demo data, our names and text, loaders) and `tools/data/**` (the importers) |
| `game` | `src/game/**` (the controllers that drive core and present it: combat, run, input, pixel overlay) |
| `ui` | `src/ui/**` (Ink & Bone pixel UI framework and every screen) |
| `render` | `src/render/**` except the contract files `api.ts`, `constants.ts` and `density.ts` |
| `architecture` | `src/procgen/architecture/**`, `src/procgen/props/**` |
| `creatures` | `src/procgen/creatures/**`, `src/anim/**` |
| `vfx` | `src/vfx/**` |
| `items` | `src/procgen/items/**`, `src/procgen/icons/**` |
| `audio` | `src/audio/**` |
| `spec` | `spec/**` (verified specs and their test vectors) |
| integrator | the shared files:<br>• `package.json`, `package-lock.json`, `tsconfig.json`, `src/core/tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.ts`<br>• the debug router (`src/debug/router.ts`, `src/debug/types.ts`, `src/debug/README.md`)<br>• the render contract (`src/render/api.ts`, `src/render/constants.ts`, `src/render/density.ts`)<br>• `tools/**` except `tools/data/**`<br>• `.gitignore`, `README.md` |
| orchestrator | `studio/**`, `CLAUDE.md`, `AGENTS.md`, the plans (`方案-*.md`) |

Every lane may also add, without asking:

- debug scenes `src/debug/scenes/<lane>-<what>.ts` (the file name is the scene name);
- tests under `tests/<lane>-<what>/`.

## Requesting changes (`needs`)

Name the file, the exact change and why. For example: "src/render/api.ts: add `PointLightOptions.giOnly` so the
resolve skips lights GI already handles". New npm dependencies are also requested there.

## Wave A (plan v4) overrides

For wave A the card paths in `studio/WAVE_A.md` §5 and Appendix W2 (the module set under `src/core/sys/<module>/`, one
owner each) take precedence over the table above. Delegated for this wave:

- `tools/gen/**` → core-contracts;
- `tools/bp/**` → content-bpkit;
- `tools/bot*`, `tools/train.mjs`, `src/bot/**` and the bot section of `tools/README.md` → tools-bot;
- `src/content/bp/batches/<card-id>.ts` → that card (pre-created empty by core-contracts).

## After train T1 (2026-10-23): new lanes and the core module folders

Applied by the T1 integrator (WAVE_A §6.7). These rows extend the lane table above; for wave A they name the card that
owns each path (a later wave reassigns them by card, never two owners for one file).

| Lane | Paths |
|---|---|
| `tools` (bot) | `tools/bot.mjs`, `tools/bot/**`, `tools/train.mjs`, `src/bot/**` (pure policies and metrics, imports only `src/core/api` types), the *Headless bot* and *Merge train* sections of `tools/README.md` (wave A: tools-bot) |
| `bp` (content modules) | `src/content/bp/**`: one module per ported Demo blueprint at its Demo path (ARCHITECTURE §7). Each class module belongs to the card that owns the class in `D:/TAPTAPGAME_studio/tmp/bp-owners.json` (`node tools/bp/batches.mjs`); `src/content/bp/batches/<card>.ts` belongs to that card; `src/content/bp/index.ts` to core-contracts. `tools/bp/**` (the porting kit) belongs to content-bpkit |

Core foundations (`src/core`, lane `core`):

| Paths | Owner (wave A card) |
|---|---|
| `src/core/api/{types,commands,view,events,compose}.ts`, the generated declarations `src/core/sim/{types,world,object,tags,actor,player,other,card,mode,cult,cult-grid,controller,junction,room,room-cell,settlement}.ts`, `src/core/ability/{effect,ability,projectile}.ts`, `src/core/bp/**`, `src/core/sys/index.ts`, `src/core/README.md`, `tools/gen/**`, `tests/fixtures/stub-world.ts` | core-contracts |
| `src/core/math/{sci,stats,kismet,prob}.ts`, `src/core/rng/{ue,domains}.ts`, `src/core/ability/params.ts` | core-math |
| `src/core/api/game.ts`, every other file of `src/core/sim/` (`clock`, `latent`, `registry`, `runtime`, `modal`, `engine`, `fx`, `bus`, `coverage`, `digest` …) | core-sim |
| `src/core/ability/dispatch.ts`, `tests/fixtures/**` except `stub-world.ts` | core-ability |
| `src/content/demo/{classes,anims,tags,widgets,reachable}.ts`, `src/content/text/strings.ts`, `tools/data/**` | content-bpkit (content lane) |

Module folders `src/core/sys/<module>/**` (WAVE_A Appendix W2; the module's `index.ts` included). Wave-B modules are
stubs that return neutral values until their card lands.

| Module | Owner | Module | Owner |
|---|---|---|---|
| `sim` | core-sim | `inventory`, `text` | core-inventory |
| `kernel`, `ability` | core-ability | `rewards` | core-rewards |
| `projectile`, `physics` | core-physics | `talents` | core-talents |
| `ai` | core-ai | `map` | core-map |
| `turn` | core-turn | `room` | core-map (wave A, v0), core-room (wave B) |
| `stamina` | core-stamina | `run`, `meta`, `save` | core-run |
| `damage` | core-damage | `craft` | sys-craft (wave B) |
| `rating` | core-status-rating | `enchant` | sys-enchant (wave B) |
| `launch`, `charge` | core-launch-sys | `shop` | sys-shop-events (wave B) |
| `camp` | sys-camp-meta (wave B) | `tutorial` | sys-tutorial (wave B) |

UI and game (wave A): `src/ui/kit/**` and `src/ui/pages/{map,loot,tooltip,item-menu,panel}/**` → ui-kit;
`src/ui/pages/{multi-choice,hero-select,title,run-end,warning,boss-bar}/**` → ui-pages; `src/game/**` → game-shell
(page bindings in `src/game/bind/pages/*.ts` and cue handlers in `src/game/cues/*.ts` are discovered, so a wave-B card
adds its own file there instead of editing a shared index).
