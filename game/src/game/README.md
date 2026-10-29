# src/game — game shell

- **Owner**: the `game` lane (`studio/OWNERSHIP.md`).
- **Purpose**: glue between `src/core` (rules) and `src/render`, `src/procgen`, `src/vfx`, `src/ui`,
  `src/audio`: scene flow (camp, map, combat, results), input, turning simulation events into presentation. It
  holds no rules of its own; where a rule is not ported to `src/core` yet, the stand-in is marked `SPEC-GAP`.
- **Public API**: `startGame(canvas, options)` (`app.ts`); `src/main.ts` routes a page without `?scene=` to it (a
  need of the game-shell card, applied by the integrator).

## The browser game (wave A, card game-shell)

`?scene=game-loop&bot=<scripted|random>&seed=&speed=&stop=<screen|modal>[:n]&then=<command>&floors=<n>&fake=1&cues=1`
runs the shell on the real core (`compose.ts`: `createGame` with the content registry, filter `'ported'`, the prologue
skipped) or, with `fake=1`, on the fake game of `tests/game-shell/fake-view.ts` (every screen and modal, no rules).
`window.__shell.stats` reports the screen, the modal, the page, commands sent and rejected and the unknown cues.

| Module | What |
|---|---|
| `api.ts` | the one seam onto `src/core/api` (types, `createGame`, `samplePlayback`) |
| `app.ts`, `compose.ts` | `startGame`: renderer, shell, own frame loop; the composed game |
| `loop.ts` | `Shell`: per frame input → `send`, real dt → game dt → `advance`, `drainEvents` → handlers, the screen controller, the page stack, the HUD; the pointer and keys; the bot |
| `clock.ts` | real → game time: hit-stop (`time.dilation` hitStop through `hit-stop.ts`), the death dilation (SPEC-GAP curve), the pause while a modal is open, `speed` |
| `input.ts` | pure pointer/keys → Commands: aim while phase 交互场牌, `aim.release` on the **release** (TURN-042), 1–4 → `skill.press`, Escape → `menu.open`, drag and drop after the 0.35 s hold → `item.move`, right-click → item menu |
| `screens/*.ts` | one controller per screen (title, hero, map, room, run-end); `room.ts` owns the `RoomStage` |
| `room/build.ts`, `room/stage.ts`, `room/aim.ts` | `RoomPlan` → `RoomSpec` → `buildRoom`; actor views from `view.field` and the events, the hero on the launch playback; the preview of `game.preview` |
| `views/actors.ts`, `views/kinds.ts` | the factory (knight, `roster.ts` stand-ins, placeholder figures and props); row → view as data with fallbacks |
| `bind/hud.ts` | `GameView` → the combat HUD's state |
| `bind/pages/*.ts` | page bindings, discovered by `import.meta.glob`: screen or modal → `PageModel` with a Command per button (SPEC-GAP: generic pages until the ui-kit / ui-pages pages merge) |
| `pages/shell-page.ts` | a `PageModel` as a ui-kit `Page` in the `PageStack` |
| `cues.ts`, `cues/*.ts` | Demo asset path → placeholder shake / sound / spark, discovered; unknown paths counted |
| `autoplay.ts` | `?bot=` policies (local until `src/bot` merges) and the `?stop=` target |

## The reference combat room (gate G1)

`?scene=play` (`src/debug/scenes/play.ts`) wires these modules together: the core launch
(`src/core/launch`), the Ink & Bone HUD (`src/ui`), the Demo data (`src/content/demo`) and the launch feel
(`spec/launch-feel.md`): the camera shakes (`src/render` `fx.cameraShake`, `fx.shakeTime`), the effects (`src/vfx`),
the creatures' reactions (`src/procgen/creatures`), the sounds (`src/audio`) and the HUD's motion (`src/ui`).

How a launch plays there (each lane's README has the details):

| When | What |
|---|---|
| left press | only recorded (FEEL-001); the first press anywhere unlocks the sound |
| release | `knight.launchStart()`, the whoosh, `vfx.trailBegin`; 进入战斗状态: `hud.beginLaunch()`, the preview goes, the head bars fade (`hidden`), the intents go; the frame that processes the release already moves the hero |
| every frame | the launch clock (`hit-stop.ts`) gives the game dt: `fx.shakeTime(gameDt / dt)`, `vfx.update`, the knight's and the mobs' `update` (never the HUD or the sound); the trail point; a dust puff and `step` every 100 uu (`SpawnPerUnit`); `audio.setListener` at the hero. A frame is split at its contacts, so each reaction starts at its own game time |
| every contact that reacts | `bump`, `cameraShake('bounce')`, the item charge (`chargeBounce`, `charge` on a full one), 反弹 scores; the touched enemy's `hitReact(normal, speed)` |
| enemy contact (melee) | `knight.slash()`, `swing`, `vfx.whirlwind`; every victim of the AoE (`melee.ts`: centre within 攻击距离 + its 宽度): `flash()`, `hitSpark`, `spores`, `hit`, one merged number per victim (`owner`, `skill`), `cameraShake('damage' / 'crit')`; `knight.recoil` off a survivor |
| kill | `die({ onSplat })` (the splat and `death` at 0.5 s), the corpse stays (out of the next launch world), 击杀敌人 scores, "+N经验" around the hero (`popups.ts`); no freeze, impact frame or extra shake |
| rest | `vfx.trailEnd`, 乱舞 scores, `knight.launchEnd()`, Stamina, `hud.endTurnStats()`, and the control is back at once (preview, bars and intents) |

| Module | What |
|---|---|
| `overlay.ts` | the pixel overlay (whole pixels at the internal resolution) in the HUD's Ink & Bone palette: `Strokes`, a two-pass batch (every ink outline before any bone core) with the 16 fixed chevron stamps (golden 02's 1-px arrowheads, 7 px across, symmetric about their heading), 1-px dashes and arcs, discs, numbered dots (an ink digit knocked out of a bone dot) and 5×7 digits; `PixelCanvas` for single glyphs and debug drawings |
| `launch-preview.ts` | draws the core's preview chain: chevrons every 11.25 px (30 uu at zoom 1) along each leg and the terminal leg, scrolling forward; the Demo's leg-end marks in bone, lit #FFF6E3 by the pulse (enemy = dashed ring + dot, wall = dot + arc, none = dot) at the Demo's sizes; every bounce numbered on its dot; crowded dots move off (a small dot stays at the true end), chevrons keep off rings, arcs, dots and each other, a leg running back along an earlier one takes its own lane, and nothing is drawn in the hero's sprite box |
| `preview-pulse.ts` | the travelling highlight of the chain and the marker flashes (弹射预览路径) |
| `cursor.ts` | the Demo's cursor (UI_光标, 23×23 px: head along the top and the left, a 3-px diagonal shaft) on top of the HUD and the game, snapped to the HUD's pixel grid |
| `turn-score.ts` | `SPEC-GAP`: the turn rating behind 回合统计 (score, decay by repetition, letter, lines) until the core ports it |
| `reference-room.ts` | the room's cast as data: enemies, the hero's start and his sprite's box, the round solids and the launch world |
| `roster.ts` | which Demo enemy row each small fry stands in for until G3 (its 宽度 / 高度) |
| `hero.ts` | the hero's run-start numbers (数据表_玩家.幽冥骑士), the Stamina paid per action, the first quest line |
| `loadout.ts` | the starting cards from 数据表_修炼物品_通用 and the charge per bounce (给装备的物品充能) |
| `popups.ts` | what each HUD popup needs from the game: the damage popup's 旋转; a kill's EXP and where it starts (扩散命中中心 around the hero) |
| `melee.ts` | 可控挥击's melee AoE: the victims of a swing and where each takes the hit |
| `hit-stop.ts` | the launch clock under the hit-stop of enemy contacts, exact across frames |
| `auto-aim.ts` | the scripted shot of `?t=` / `?auto=1`: the best whole-degree aim, the cursor's sweep onto it and where it rests |
| `placeholder-combat.ts` | `SPEC-GAP`: the art-p damage stand-in until the damage formula is ported |
| `pointer.ts` | client pixels → internal pixels → the floor point under the pointer |

Tests: `tests/game-g1/`, `tests/feel-merge/`, `tests/game-shell/`.
