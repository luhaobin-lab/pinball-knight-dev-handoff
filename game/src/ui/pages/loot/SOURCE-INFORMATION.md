# G2 live loot information

Target: the reachable item box must show the source item size, cost, ability description and refresh control.
It retains the existing Ink & Bone renderer, box/button placements, 960×540 pixel frame and approved font.

Source (copied reference only):

- `BP/环境/修炼/修炼系统.txt`, 更新生成牌站位 L428/L1626/L2917 and generation L6882:
  card world centre X = 298 − 128 × (row + size/2), Y = 166 + 232 × column.
  Quantity −1 fills each column to four height units. Other quantities rotate visible columns, accumulating sizes
  per column. The source's intermediate fourth-column write is overwritten before its transform is applied.
- `修炼系统.json` SCS: 物品盒子 centre (X32,Y400), its 盒子UI local (X−1,Y1), draw size948×744.
  `UI_修炼牌` uses220×(108+104×(size−1)); existing widget projection is0.375 pixels per world unit.
- `BP/UI/UI_修炼牌.txt` 更新卡面信息 L3686: positive prices show the bottom-left 价格牌; zero prices hide it.
  The existing currency chip draws the amount. Ability descriptions are read from the already generated card
  abilities, matching the inventory view; no private inventory function is called.
- `BP/UI/UI_物品盒子.txt` L1867: refresh is enabled iff count ≠0 and gold ≥cost. Disabled refresh remains visible
  and its amount is hidden. L3131 calls the source ability's refresh, decrements count and pays the existing cost.
  When source selects direct dismantle, its Wave B button remains outside G2 scope.

Generation stores presentation positions in a WeakMap. View reads only clone them; item takes preserve holes,
with no new RNG calls, prices, sizes, capacity or sorting rules. Optional public view fields retain old fixtures.
The live legal list gates take/refresh and participates in the binding key so state changes refresh button state.

Checks: `tests/game-g2/loot-information.test.ts` covers the natural seed6/index0 headless paid box and empty refresh,
read purity (digest/RNG), both ported/all source fixtures, source size/pitch/order and stable holes. Browser script
`node tools/game-g2/loot-information-browser.mjs` uses a natural shared-policy seed6 browser run, actual mouse purchase
and empty-box refresh, and records before/after currencies, counts, live models, screenshots and page errors. Browser
frame pacing can consume a different natural sequence than the zero-think headless run; each proof records its own
actual offers instead of claiming cross-timing command equality.

The script writes to `D:/TAPTAPGAME_codex/studio/shots/g2-loot-information` and cleans its browser/server. This is G2
functional/UI evidence, not final source animation parity or physical-mobile verification. Proposals: none.
