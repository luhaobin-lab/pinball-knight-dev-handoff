# src/ui — the Ink & Bone UI (lane `ui`)

Style A「墨与骨」(ART_BIBLE §7): near-black ink panels with at most a 1-px inner bevel, bone-white 1-px lines and
lettering, red only for enemies and danger, sapphire only for the hero's resources, no gold. Every pixel is placed
by code on the 960×540 grid; the only shipped asset is the OFL pixel font in `font/` (Fusion Pixel 12px, subsetted
by `font/subset_font.py`; the licences of the fonts it derives from are in `font/licenses/`).

Text: the browser draws each glyph once at 8 × 12 px and `text/raster.ts` samples every design pixel at its centre,
which reproduces the font's 1-px design (at 12 px Chrome on Windows smears coverage sideways, so a threshold doubles
the stems). `PixelFont.load` checks the dense 触 against its FreeType bitmap and logs a `console.error` on a mismatch,
which fails `npm run shots` for any scene that shows the HUD.

## Layers

| Layer | What | Shake |
|---|---|---|
| `core/screen-layer.ts` | a 2D canvas over the game canvas, `image-rendering: pixelated`, on the renderer's internal grid (same integer scale and centring) whenever that grid is at least 960×540 (1080p, 4K); on smaller grids (1440p picks 854×480 at ×3) it takes its own largest integer scale that still gives 960×540, so the Demo layout is never cut. The side panel, quest, statuses, turn summary, low-HP frame, popups | never |
| `core/world-layer.ts` | an overlay-stage pass (order 10, premultiplied over the overlay drawn before it); enemy head bars, intents, weak points, placed with the pass's `project` | with the world |

The Demo's widgets sit in a 960×540 design frame (`UI_主界面` is a ScaleBox around a 1920×1080 SizeBox), centred
vertically on taller layers; the panel column and the low-HP frame run the full height. The play area `区域判断`
always starts at the panel's right edge (178.5 px) and runs to the layer's right edge, so on layers wider than
960 px (1366×768 or 1920×969 at ×1) the quest list, the status row and the low-HP frame stay next to the panel.

Pointer: the HUD canvas takes no events; window capture listeners hit-test (`core/hit.ts`) and swallow clicks on
the panel and its targets before the game canvas sees them. Status cells take hover only and `回合统计` is
`HitTestInvisible`: clicks there reach the game (in the Demo the play area `区域判断` takes them).

## API (`index.ts`)

```ts
const hud = await createCombatHud({ renderer, state: { hero: { hp: 100, hpMax: 100, stamina: 98 }, items, quest }, onAction: t => … });
hud.setHero({ hp: 80, dotPending: 6 });                       // bars slide at the Demo's speed (浮点滑动 ×2.0)
hud.setCombat({ aiming: true, enemiesOnField: true });        // 当前环节 == 2 (交互场牌), 场上有敌人？
hud.setItems([{ id: 'sword', row: 0, size: 2, icon: 'sword', type: 'weapon', damage: 20, charge: 0.3 }]);
hud.updateItem('sword', { charge: 1 });                       // reaching 1 plays the charge flash
hud.setEnemies([{ id: 'a', at: { x, y: 0, z }, head: { x, y: 2.6, z }, hp, hpMax, intent: { kind: 'attack', value: 14 }, hidden: !aiming }]);
hud.beginLaunch();                                            // 进入战斗状态: 清理提示映射, the next scored event is the first
hud.popup({ kind: 'damage', value: 12, at: { world: hitPoint }, owner: enemy.id, skill: '可控挥击', angle, height: 55 }); // merges per (owner, skill)
hud.popup({ kind: 'crit', value: 36, at: { world: hitPoint }, owner: enemy.id, skill: '可控挥击', angle, height: 55 });
hud.popup({ kind: 'exp', value: 12, at: { world: aroundHero } }); // a kill's 增加经验: "+12经验", sapphire, at the HERO (see EXP)
hud.popup({ kind: 'heal', hero: false, value: 9, at: { world: healer }, owner: healer.id }); // an enemy's heal: red ("+9生命")
hud.popup({ kind: 'heal', hero: true, value: 15, at: { item: 'potion' } }); // a card heals the hero: sapphire
hud.popup({ kind: 'charge', value: 15, at: { item: 'sword' } });
hud.setTurnStats(score.view());                               // once per scored event (更新回合战斗统计): animates
hud.endTurnStats();                                           // 回合统计结束 at the round's end: hold 1 s, gone by 3 s
hud.update(dt);                                               // once per frame with the REAL frame time (never dilated)
```

State in → pixels out: `hud/state.ts` (types), `hud/model.ts` (pure state, animation, drawing, hit regions; tested
in node), `hud/combat-hud.ts` (canvas layers, font, pointer).

Popups follow the widgets' 位移提示 (`hud/popups.ts`):

- **Damage** (`UI_伤害提示`): the target is 起始坐标 + GetRotated2D((0, 高度 − 48 × (序号 % 12)), 旋转). The caller
  passes 旋转 as `angle` and 目标角色.高度 as `height`; with `owner` the HUD numbers the popup itself (序号 = its index
  among the owner's live popups, `目标角色.伤害提示延迟`), otherwise the caller passes `stack`.
- **Heal** (`UI_治疗提示`): the same without 高度; 序号 comes from the healer's `治疗提示延迟`.
- **Clamp**: both clamp the target to `popupBounds`, the play area inset 64 px (X 485..1792, Y 128..952 units).
- **Timing**: both appear after Fraction(序号 × 0.15) s. The world point is projected at that moment. They then ease
  from 起始坐标 toward the target on 伤害提示曲线 (×1) or 恢复提示曲线 (×0.5), evaluated as UE cubic keys.
- **Charge** (`UI_充能提示`): drifts up to 50 units within ±45° of up (向上弹出) or down (向下弹出), unclamped and
  without a delay.
- **EXP** (`UI_拾取提示`, which 增加经验 creates with "+{0}经验" and 向上/向下 = true): drifts 20–100 units down within
  ±45°, unclamped, no delay, 向下弹出; the whole text in the pixel font with its ring and a 1-px shadow, sapphire.
  It starts at the HERO, not at the dead enemy: a kill calls 增加经验(死亡产生经验, 游戏模式.玩家角色) (BP_Actor_Other
  L8845), that 经验来源 becomes 创建拾取提示's 拥有者, and UI_拾取提示 (L2882; the hero is a BP_ManeActor, not a card)
  starts at 扩散命中中心(拥有者, 0, 0.65, 0): the hero's actor location (the capsule centre, 高度 up) plus
  (0.65 × 高度, 0, 0) turned by RandomFloatInRange(−180, 180) about the vertical, a point ON that circle (幽冥骑士:
  56 uu → 36.4 uu). The caller passes it as `at.world`, where the hero is at the kill: in tiles
  { x: hero.x + r sin θ, y: 高度, z: hero.z − r cos θ }, r = 0.65 × 高度, θ from a seeded stream (Demo X = −z, Y = x).
- **Cards**: a popup from a card starts at a random point of the card (扩散命中中心); a card heal fans straight up.
- **Colours**: damage bone, damage to the hero and damage over time danger red, a weak point `WEAK` (the copper weapon
  accent, not gold); a heal is the colour of the HP it adds: sapphire for the hero, red for an enemy.

Merging (提示简化处理, `添加数值`, `清理提示映射`): a popup with an `owner` goes into the owner's map, damage keyed by
`skill` (来自技能; one key without one), a heal by the healer (生命 and 强固 apart). A later popup with the same key
adds its value to the first one and restarts 数值更新 (scale 1.5 → 1.0 in 0.1 s, multiplied into 弹出's scale): one
number counts 6 → 14 → 21. The first popup keeps its face (a crit merged into a normal number stays normal), and
`beginLaunch()` clears the maps. As in the Demo the map outlives the widget: a merge into a number already removed
(2 s after it appeared) is not shown. Charges and EXP never merge.

Motion: every widget animation is the dump's keys verbatim (`hud/anims.ts`: tick, value, interp, tangents per tick,
weights of weighted keys, playback range), evaluated like UE's FMovieSceneFloatChannel by the launch core's FRichCurve
port (`core/motion.ts` `Curve`: Bézier control points value ± tangent × 60000 × Δt / 3, the weighted handles of
弹出V2's 0.167-s key, linear and constant segments, KeepState after the range). `tests/ui-feel/widget-keys.test.ts`
compares every key with `D:/TAPTAPGAME_ref/dump/widgets/…`, and `tests/ui-feel/demo_vectors.py` gives independent
values. 弹出V2: opacity 0 → 1 by 0.05 s, scale 1.797 → 1.227 (0.2 s) → 1.290 (0.3 s) → 1.0 (0.5 s), lift +15 px at
0.05 s, −34.19 at 0.5 s, −40.96 at 1 s (widget px, × 0.5 here), fade 1.6 → 2.0 s. Scaled art is drawn nearest
neighbour (`Surface.blitScaled`), like UMG scaling its pixel font.

Damage numbers are the Teen numerals (`text/teen.ts`): the Demo face's 3 × 5 cells on whole pixels, 18 pt = 13 px
(strokes 3, counters 2) and 27 pt = 18 px (crit, weak point; strokes 4, counters 3), with a 1-px ink ring: a "30" is
20 × 15 px, the Demo's 40 × 30.75 at 1080p (demo-rec-02 f200–f243). 会心图标 (DropGrid_Sprite8, 7 × 16 texels shown
at 21 × 48 widget px) is drawn on 2/1-px cells, 11 × 24 px.

回合统计 (`hud/turn-stats.ts`) moves like 蓝图_动作游戏模式.更新回合战斗统计 and UI_回合统计词条: `setTurnStats(stats)` is one
scored event; the first since `beginLaunch()` (or since the block was removed) clears the lines and plays
回合统计出现 (opacity 0 → 1 in 0.1 s, scale 1 → 1.1 → 1 over 0.25 s about the pivot 0.8, 0.1), every later one
评级更新 (the rank image 1.2 → 1 and −12 → 0 units in 0.2 s, the rule and its shadow 1.1 → 1 in X about 0.8 of their
width); each line the event touched (new, or a new value) plays 更新闪烁 (the bone bar Image_30, alpha ramping up from
its left end, wipes in from the right by 0.1 s, holds to 0.3 s, fades by 1.0 s; the line swells 1 → 1.1 → 1 in Y about
its bottom). `endTurnStats()` plays 回合统计结束 (full for 1 s, gone by 3 s). An event stops 回合统计结束 where it is
(UMG StopAnimation keeps state); the block's opacity is drawn in 1/32 steps. `setTurnStats(null)` removes the block at
once; the HUD's initial `state.turnStats` shows it without animation.

Head bars (`hud/marks.ts`, UI_头顶状态条.切换可视) fade in and out: 透明度计数 moves 4 per second and the bar's alpha is
曲线表.血条显示曲线 of it (0.25 s each way), the composited bar blended once. A new mark fades in; a mark with
`hidden: true` (BP_ManeActor.更新外观数据: outside 当前环节 2 and 8, dead, a boss) or left out of `setEnemies` fades
out. Intents and weak points do not fade: 蓝图_效果_意图 hides its widget at once (SetHiddenInGame on 进入战斗时), so
they show and hide with `hidden`. The intent bobs in 浮动's held 4-unit steps.

The HUD's clock is real time: UMG ignores the hit-stop's global time dilation, so the game passes the undilated frame
time to `update`. (The Demo's widget Delays do run on game time, but they only move a 序号 ≥ 1 number by the 0.069 s
a hit-stop costs; the HUD keeps them on real time too.)

## Layout (`hud/layout.ts`)

Every rect is the raw UE slot from `D:/TAPTAPGAME_ref/dump/widgets/CatapultHero/BP/UI/` run through a small
canvas-slot resolver. Two widget spaces:

- **SCREEN** `UI_主界面` and children: 1920×1080 design, ×0.5.
- **SIDE** `UI_背包栏_3d` is a 3D WidgetComponent (`修炼系统.侧栏UI`, DrawSize 496×1440, scale 1) under the
  orthographic camera (OrthoWidth 2560 → 1440 units over 1080 px): ×0.375, origin 8 units left of the screen. The
  item cards are 3D actors on the grid component `修炼物品格_已装备` (10 cells, 104 units apart), each carrying the
  220-unit `UI_修炼牌` widget. Checked against ss2.jpg within 1 px (HP frame, skill slots, tiles, grid rows).

| Demo widget | Component |
|---|---|
| `UI_背包栏_3d` (等级, 腐化度, 经验条, 生命值/持续伤害生命值/护甲值, 体力值_1, 技能栏, 图鉴, 角色, 撤退, 设置) | `hud/panel.ts` |
| `修炼物品格子组` + `BP_Actor_Card` + `UI_修炼牌` (物品图标, 充能进度, HorizontalBox_50 badges, 连击信息框, 耐久度, 附魔提示框, 冷却图) + `修炼页_锁定` | `hud/cards.ts`, `icons/items.ts` |
| `UI_耐久格` | the durability pips in `hud/cards.ts` |
| `UI_技能格` (技能图标, 冷却时长, 叠加数, 不可用图) | `drawColumn` in `hud/panel.ts` |
| `区域判断` (play area 1563 wide in combat; Overlay_1 low health, pulsing at MapRangeClamped(sin 5t, −1, 1, 0.2, 1) while 低生命值？ && !死掉了？ && 当前环节 == 2 && 场上有敌人？) | `playArea` in `hud/layout.ts`, `lowHealthOpacity` / `drawLowHealth` in `hud/model.ts` |
| `UI_任务列表` / `UI_任务条目` | `hud/quest.ts` |
| `区域判断.各种状态栏` + `UI_增减益格` | `hud/status.ts`, `icons/status.ts` |
| `回合统计` + `UI_回合统计词条` (评级图片切换 D…SSS; 回合统计出现, 评级更新, 更新闪烁, 回合统计结束) | `hud/turn-stats.ts`, `hud/anims.ts` |
| `UI_头顶状态条` (切换可视), `UI_意图提示` (浮动), `UI_弱点提示` | `hud/marks.ts` (world layer) |
| `UI_伤害提示`, `UI_治疗提示`, `UI_充能提示`, `UI_拾取提示` (弹出 animations and 数值更新, 位移提示 with 伤害提示曲线 / 恢复提示曲线, the 序号 delay, 添加数值) | `hud/popups.ts`, `hud/anims.ts`, `text/teen.ts`, `popupBounds` in `hud/layout.ts`, `cardPopup` in `hud/model.ts` |
| `函数库_科学数.科学数字缩写` | `text/abbrev.ts` |
| `函数库_工具.浮点滑动` | `core/motion.ts` |

Not part of the combat HUD: `UI_英雄头像` (hero select), `UI_体力点` (the collapsed 体力点框 of the side panel),
`UI_物品盒子` (the loot window), `UI_光标` (the aim cursor is drawn by `src/game/overlay.ts`).

## Debug scenes

- `?scene=ui-hud` (the reference room with the Demo's ss2 state); `&demo=marks,popups,status,rank,lowhp` adds samples.
- `?scene=ui-feel` (the reference room under one scripted launch on the HUD's clock, the world under the Demo's
  hit-stop): the bars fade at the release (1.0 s), three merged hits on the jelly (6, +8, +7 → 21), a crit of 24, a
  kill of 9 with "+12经验" at the knight, 回合统计 coming in, updating and flashing per event, 乱舞 at 2.6 s,
  回合统计结束 at 2.9 s, the bars back at 3.2 s. `&hit=30` replaces the hits with one "30" on the jelly at 1.2 s, to set
  beside demo-rec-02.
