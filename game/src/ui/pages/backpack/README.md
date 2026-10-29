# G2 source backpack projection

Target: WAVE_A 457–463, the existing equipment and backpack columns, with real `item.move` and `item.use` commands.
Style: existing Ink & Bone card/grid/tooltip/menu renderers and OFL pixel font. Combat remains the approved HUD.
No new rules, item counts, invented buttons, external assets, modal, dependency or animation curve.

Source, relative to the copied `reference/dump`:

- `blueprints/CatapultHero/BP/环境/修炼/修炼系统.json` SCS: equipment root Y −822, equipment grid Y 22;
  backpack root Y −1104, backpack grid Y 8. Both grid X coordinates are −94.
- `raw/Game/CatapultHero/BP/环境/修炼/修炼系统.json` ActorSequence `打开动画` / `关闭动画`:
  equipment root endpoints −1118 / −822; backpack root endpoints −1408 / −1104.
- Existing HUD projection: 0.375 design pixels per world unit. Open backpack centre (−1096) equals closed equipment
  centre (−1096); open equipment is 296 units / 111 pixels right. The side widget is attached to the equipment root.
- `blueprints-pseudo/CatapultHero/BP/环境/修炼/修炼系统.txt` `切换修炼背包`, L13914 and L11422:
  the source flag owns the presentation. Its inverse is exposed as optional `InventoryView.canRearrange`.
- `blueprints-pseudo/CatapultHero/BP/Actor/蓝图_动作游戏模式.txt` L1348 closes for combat;
  L2424/L3432 and other noncombat branches open it. The shell reads this flag, including empty grids.
- `UI_关卡地图页面.txt` Button_63 L13337 is retreat. It is not repurposed as an inventory toggle.
  The existing public `map.backpack` command has a shell-only override reset at the next source phase.

Both columns have ten addressed slots. The two painted half-cells in each row belong to one card-width slot.
Cards win hit tests above slots. A held card owns its release even over a map tile; invalid drops settle through
the core or cancel without leaving an input hold. Source compaction/swap rules remain authoritative: an occupied
cell can accept a swap, while a full target requiring a larger blocker than the source gap rejects and restores.

Validation:

- `npx vitest run tests/game-g2/backpack-ui.test.ts tests/game-g2/browser-policy.test.ts tests/game-shell tests/ui-hud`
- `npx tsc --noEmit` and `npx tsc --noEmit -p src/core`
- `node tools/game-g2/backpack-browser.mjs` builds this checkout, runs Chrome, captures screenshots/JSON to
  `studio/shots/g2-backpack-ui` outside the project, and closes its browser/server.

The browser proof uses real first-room loot for mouse equip → backpack → equip, locked refusal, right-click and
Escape, combat-only use feedback without spending resources, and map entry. A separately labelled capacity fixture
uses real card/grid actors for an impossible occupied swap. A fresh shared-policy seed 6 run reaches natural combat
and verifies automatic collapse plus absence of `item.move`. This is desktop functional evidence, not physical mobile
or final animation/visual parity acceptance. The new projection uses source endpoints; the original ActorSequence
opening/closing motion remains a polish gap rather than being replaced with an invented tween.

Proposals: none. Needs: independent review and integration; final G2 producer acceptance remains separate.
