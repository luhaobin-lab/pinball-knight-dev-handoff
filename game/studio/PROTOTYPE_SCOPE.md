<!-- Step 0 output (2026-10-23), committed by the orchestrator. Planner scripts and data: D:/TAPTAPGAME_studio/tmp/step0/ (scripts/, owners.json, reach.txt). -->
# PROTOTYPE_SCOPE: what a player can do and see in the Ricochet Abyss Demo

Scope auditor, step 0 of `方案-v4-原型优先.md`. Date 2026-10-23. This is a read-only audit of `D:/TAPTAPGAME_ref/dump`
(Demo build `0_83_0`, GM ln 173). The Demo was not run, and no file in the repo was edited.

## Target card

- **Demo part**: everything a player can reach in the Demo build: the front end, the prologue, the normal run, the meta
  progression, saves and resume. The rows of every data table are sorted into "reachable" and "not reachable".
  The sources are listed in §1.
- **Acceptance**: every in-scope item below has a source (file plus row, line or label). Every count can be
  reproduced with the helper scripts in `D:/TAPTAPGAME_studio/tmp/step0/scripts/` (`dt.py`, `rooms.py`, `items.py`,
  `reach.py`, `talents.py`, `chestrw.py`). Their raw outputs (`rooms.txt`, `rewards.txt`, `items.txt`, `reach.txt`,
  `talents_hero.txt`, `props_skills.txt`, `player.txt`) are in the same folder.
- **Forbidden**: inventing content; counting test rows, dead code or full-game-only data as Demo content.

---

## 0. The answer in one page

The Demo is one short loop:

1. **Main menu** (camp scene). On first launch only **序幕** (Prologue), Settings, Quit and two community links are
   shown. **新的冒险** (New Adventure) appears once the prologue is done. **继续冒险** (Continue) is always hidden.
2. **Prologue**: 7 fixed single-tile floors (新手关01–07) with 3 small fights. The Demo has 13 live tutorial tips;
   most fire here, the rest on first use (craft page, Eternal Statue, defeat).
3. **Normal run**: hero select (2 heroes) → one chapter only, **遗迹 "守门人"** (Ruins, "Gatekeeper") → **12 floors**
   with 3 map tiles per floor → boss **守门人** on floor 12.
4. **After the boss** the only exit is the camp portal. The run-end score page shows "太棒了！你完成了Demo版本的挑战。
   更多内容将在正式版展现。欢迎加入愿望单！" and the game returns to the menu. There is no second chapter, no endless mode,
   no Abyss Level and no camp building.
5. **Meta progression**: run score → exploration level (level n → n+1 costs 500·(n+1) points). Level 4 unlocks the
   2nd hero. Recipes are learned for good. The Eternal Statue (persistent stash) unlocks after the first boss kill.

| Content | Reachable in the Demo | Rows in the data | Main source |
|---|---|---|---|
| Heroes | **2** (幽冥骑士 free, 灵魂猎手 at exploration level 4) | 9 rows / 4 heroes | DT 数据表_玩家 `标签`, `解锁` |
| Chapters | **1** (遗迹) + the prologue (新手关) | 19 quest-bar rows, 8 chapters | DT 数据表_任务条_默认; MAP L11924; 传送阵 L96 |
| Floors per run | **12** (prologue 7) | 最大层数 12 / 7 | DT 数据表_任务条_默认[遗迹/新手关] |
| Map-tile types | **14 normal + 7 prologue** | 40 rows | DT 数据表_地图格; GM 地图格池 (ln 53) |
| Room layouts (固定地点) | **18** rows (24 layer variants) | 26 rows | DT 数据表_关卡_固定地点 |
| Enemy rows | **14** (13 in runs + 1 prologue-only); 1 boss | 42 | DT 数据表_敌人_普通; room pools; spawning skills |
| Distinct enemy skills | **31** (27 fixed + 4 extra elite affixes) | — | `固定技能`/`随机精英技能` of the 14 rows |
| Items | **172** (85 general + 87 hero-exclusive) | 202 (114 + 88) | §8, `reach.txt` |
| Talents | **93** in total; 72 per Knight run, 74 per Hunter run | 147 (29 + 73 + 45) | §9 |
| Choice events 抉择_01–07 | **7** (only through 祝福之灵) | 7 | §10.1 |
| Curses / blessings | **0** | 18 | GM ln 2391–2393 (最高进阶级别 −1) |
| Mental states | **4** (饥饿, 饱腹, 疼痛, 幸运) | 17 | SCM §1 |
| Tutorial tips | **13** | 14 rows / 15 enum values | §10.9 |
| Score categories | **13** | 13 | END ln 40 |

**Conflicts with plan v4** (the producer must decide; details in §14):

1. "诅咒与祝福" is listed as prototype content, but the Demo cannot reach it.
2. "商店" as a room type does not exist in the Demo. The shops are the merchant inside the **抉择房** tile.
3. "一局 ≥ 30 分钟，层数和节奏与 Demo 相同" is probably impossible: a full Demo run is about 10–25 min (estimate, §11).
   30 min is reached by prologue + run, or by 2 runs.
4. "营地（局外成长）" in the Demo is only the exploration level, the hero unlock, the learned recipes and the Eternal
   Statue. Camp buildings are dead code.

---

## 1. Sources, method and citation keys

Method: the `blueprints-pseudo` control flow was read for every system that decides what spawns or gets offered,
the data tables were joined against it, and every row was classified. A row is **reachable** if a live code path from
the main menu can spawn, offer or apply it in the Demo build (`是DEMO？ = true`, `Demo关卡数 = 1`, `测试模式？ = false`,
GM ln 48–50). It is **conditional** if that path exists but needs a rare state.

| Key | File (under `D:/TAPTAPGAME_ref/dump/blueprints-pseudo/CatapultHero/` unless stated) |
|---|---|
| GM | `BP/Actor/蓝图_动作游戏模式.txt` |
| MAP | `BP/UI/UI_关卡地图页面.txt` |
| TILE | `BP/UI/UI_地图格.txt` |
| CS | `BP/环境/修炼/修炼系统.txt` |
| MAIN | `BP/UI/UI_主界面.txt` |
| LIB | `函数库/函数库_工具.txt` |
| END | `BP/UI/UI_冒险结束统计页.txt` |
| MENU / SEL / AVA | `BP/UI/UI_营地主菜单.txt` / `BP/UI/UI_英雄选择页.txt` / `BP/UI/UI_英雄头像.txt` |
| WARN | `BP/UI/UI_警告提示.txt` |
| PORTAL | `BP/UI/UI_传送阵.txt` |
| JCT | `BP/环境/蓝图_通用路口.txt` |
| R-GI / R-CR | `BP/Skill/Ability/奖励/蓝图_奖励_获取物品.txt` / `蓝图_奖励_复合奖励.txt` |
| SHOP / SHELF | `BP/环境/商店/蓝图_商店.txt` / `蓝图_货架.txt` |
| DT x[row] | `dump/datatables/CatapultHero/数据表/<folder>/x.json`, row `row` |
| TF / SCM | verified specs `D:/TAPTAPGAME_ref/spec/turn-flow.md` / `stamina-corruption-mental.md` |
| unit `id` | spec draft `D:/TAPTAPGAME_ref/spec-drafts/<id>.md` or the unit in `_plan/units.json` |

"ln N" is a line of the pseudo file. "Lnnnn" is a bytecode label inside it. Weights are relative.

---

## 2. Front end, saves, resume and settings

**Main menu** (camp scene, phase 14 `进入营地`, GM L3507). Widget `UI_营地主菜单`:

| Element | Visible | Source |
|---|---|---|
| 序幕 (Prologue) | always. It sets `新手关中？ = true` and clears `已触发新手提示`. | MENU L2799 |
| 新的冒险 (New Adventure) | only if save `新手关过？` | MENU 更新主菜单信息 L2178 |
| 继续冒险 (Continue) | never (collapsed in the widget and by code) | widget `按钮_继续冒险` Collapsed; MENU L2178 |
| 退出, 设置, Discord, KOOK | always | widget; MENU L2089, L2545 |
| 4 × camp quest bar (`UI_营地任务条`) | shows 序幕 while `新手关中？`, otherwise 凝视深渊 | `UI_营地任务格组` 读取任务进度 |
| 深渊级别 (Abyss Level) row | collapsed | widget `TextBlock_121` Collapsed |

**Run start.** `UI_传送阵.DEMO出发` (PORTAL L96) picks the chapter: `新手关` if `新手关中？`, otherwise `遗迹`, because
`是DEMO？` (the random chapter pick is never used). It also clears the side bar and creates the 3 locked
inventory cells (CS 创建锁定格 ln 527). `英雄死亡后初始化` (GM ln 2608) reseeds the global RNG (ln 2615) and sets
精核 8, 感知 (收入) 5, hero level 1, EXP 0/150, 当前腐化 0 / 最大腐化 100 and 通过关卡数 0 (ln 2625–2651).

**Saves.** EMS custom save `EMS_基础存档` (`BP/存档/EMS_基础存档.txt`):
- **Meta fields**: `探索等级进度`, `已解锁配方`, `已解锁机制`, `已解锁天赋`, `主线任务`, `新手关过？`, `已触发新手提示`,
  `被选择头像序号`.
- **Run fields**: map rows `地图格存档数组`, `当前关卡选项`, `关卡地图切换`, `新手关中？`, `重置房间？`.
- The map page saves every tile (`保存地图格`) plus SaveCustom/AsyncSaveActors (MAP L197–L618) and rebuilds the map
  from `地图格存档数组` on load (MAP L1486–L2006, "读取地图").

**Resume.** When a save is loaded in the middle of an uncleared room (the saved phase is neither 14 nor 9) and
`重置房间？` is false, the game shows warning type 2 (GM L29825; WARN L1312):
- text: "上一次的记忆还未丢失，是否回忆？";
- buttons **回忆** (resume) and **遗忘** (forget). 遗忘 sets `重置房间？ = true` and reloads with the loading text
  "遗忘痛苦的回忆···" (WARN L806).

**Pause dialog.** The HUD button `UI_背包栏_3d.Button_27` opens warning type 0 when the hero is alive and the phase is
not 3 / 19 / 11 (UI_背包栏_3d L1056):
- text: "结束本次探险？";
- button 1: **重置房间（+10腐化）**. It reads **保存并退出** in phases 9 (map) and 18 (item box) and in the prologue;
- button 2: **放弃探险** (WARN L1312).
- A room reset costs 10 Corruption (SCM §1). Abandoning scores 自我放弃 −100 (END ln 40).

**Endless warning.** Warning type 1 ("前方的敌人会异常强大…（进入无尽模式）") is raised only by a non-camp portal
(`BP/环境/营地/蓝图_传送门.txt` ln 326). The Demo never offers such a portal (§5.5), so this warning is unreachable.

**Settings.** `默认游戏设置` (GM ln 2380–2400): scalability 3, VSync, 60 fps cap, and the language picked from the OS
(zh-Hans / en). Pages and bindings are owned by unit `save-settings`.

---

## 3. Heroes

| Row (DT 数据表_玩家) | In hero select? | Unlock | Kit | Key stats |
|---|---|---|---|---|
| 幽冥骑士 Spectral Knight | yes | free (`积分等级 0`) | 可控挥击, 玩家被动 | 基础伤害 30, 生命 150, 魔力 (Stamina) 100, 最大疲劳 4 |
| 灵魂猎手 Soul Hunter | yes | exploration level **4** (`积分等级 4`) | 可控反蹬箭, 玩家被动 | 基础伤害 20, 生命 60, 魔力 100, 最大疲劳 5 |
| 恶疫旅人, 元素祭司 | no (`忽略`) | — | 挥击, 玩家被动 | 生命 150 |
| 默认, 商人, 灵魂, 神像, 测试 | no (`忽略`) | — | — | non-heroes (merchant NPC, statue, test) |

- The hero list skips `忽略` rows (SEL L1475). 出发 is disabled while 默认 is selected (SEL L4083).
- A locked portrait shows "探索等级提升至<天赋>{0}</>后解锁。". It compares `解锁.积分等级` with
  `探索等级进度['总值'].当前解锁等级` (AVA L2641).
- Both heroes share the attack-range, bounce and status-cap stats (`弹射距离 500`, `攻击距离 110`, 格挡/闪避/心流
  caps 10/3/15, `player.txt`).
- Each hero has 5 active-skill talents (§9).
- Not in scope: the Ultimate (奥义). It is dead: its only source, the reward `获取钥匙`, is referenced nowhere
  (heroes-skills HEROES-111, §5.9).
- Not in scope: the Potential page (潜能). The hero-select tab exists, but the tip `解锁潜能` (enum value 7) has no
  trigger site (§10.9). Unit `talents-hero-potential` should confirm the page is dead.

---

## 4. Prologue (序幕 / chapter 新手关)

- Chapter row DT 数据表_任务条_默认[新手关]: `最大层数 7`, branch `[营地]`, tag `环境.类型.遗迹`.
- The map has row 0 = [空, 营地, 空] (the start tile), then one fixed row per floor `[空, 新手关0N, 空]`
  (MAP L2157–L2943: switch on `地图格层数` while `新手关中？`).
- Run quest: **序幕 "通过第{0}层", 7** (DT 数据表_技能_任务[序幕], goal `蓝图_任务目标_新手关通关`).

| Floor | Map tile → room (DT 数据表_地图格 → 数据表_关卡_固定地点) | Content | Reward |
|---|---|---|---|
| 1 | 新手关01 → 新手关01 | 任务宝箱 (chest prop), hand-made room 手动房间图01 | 获取物品_新手关: free offer of 2 (`解锁材料 {旧剑:0}` puts 1 × 旧剑 in the box first, R-GI L15–L217), take 1 |
| 2 | 新手关02 → 新手关02 | 1 × 眼球 | 复合奖励_新手关 (1 drop) + fixed drop 生命药剂_新手关 |
| 3 | 新手关03 → 新手关01 | chest prop | 获取经验_新手关: 150 EXP (level 1 → 2 needs 150, so this gives the first level-up and its talent pick) |
| 4 | 新手关04 → 新手关04 | 2 × 眼球 | 复合奖励_新手关 + fixed drop 伤害附魔A |
| 5 | 新手关05 → 新手关05 | empty hand-made room | 获取锻造_新手关: merchant, 1 shelf 锻造锤_品质青铜, price 4 |
| 6 | 新手关06 → 新手关01 | chest prop | 获取物品_新手关2: free offer of 3 (2 × 旧盾 first), take up to 3, min quality 1 |
| 7 | 新手关07 → 新手关07 | 新手关眼球包2 + 2 × 眼球, background 新手关02背景 | 复合奖励 (1 drop) + fixed drop 灼热眼珠 |

- Reward parameters: DT 数据表_技能_奖励 rows of the same names (`rewards.txt`).
- Completing floor 7 completes the 序幕 quest:
  - score `接受指引` +500 (`BP/Skill/效果/任务/蓝图_任务目标_新手关通关.txt` ln 55);
  - the run reward 获取物品_轮回奖励 (free offer of 3, take 1, `蓝图_效果_获取轮回宝藏`, GM L8376).
- The only exit is the camp portal (MAP L11924: `新手关中？` → `['营地']`) → 完成探险 +1000 → run-end page.
- `UI_新手提示` then calls `UI_英雄选择页.正常冒险` (ln 184): `新手关中？ = false`, `新手关过？ = true` (SEL L6504).
- 13 tips fire during the prologue and the first runs (§10.9).

---

## 5. Normal run (chapter 遗迹)

### 5.1 Chapter

- Row DT 数据表_任务条_默认[遗迹]: name "守门人", `最大层数 12`, `地图格队列 = 数据表_标签队列[中型]`, tags `环境.类型.遗迹`,
  `环境.类型.随机`.
- It is the only chapter: MAP L11924 offers `['遗迹']` when `通过关卡数 == 0`, and `['营地']` when
  `通过关卡数 == Demo关卡数 (1)`.
- The branches `[None, 矿洞, 实验室]` are never offered.
- Run quest: **凝视深渊 "通过第{0}层", 60** (DT 数据表_技能_任务[凝视深渊]; chosen by GM 恢复轮回任务 ln 1373, since not
  `新手关中？`). The HUD shows it as "0/60", but a Demo run is only 12 floors, so it never completes and its reward
  never fires.

### 5.2 Floor generation (3 tiles per floor)

- **Layer tags.** The queue 中型 = 11 × `随机事件` then 1 × `复合奖励.首领` (DT 数据表_标签队列[中型];
  GM 选取地图格层标签 ln 1165).
- **Map rows.** Row 0 = [空, 营地, 空]. Then floors 1–12 (MAP L2157). The first 4 rows are built at once, the others
  as you advance (MAP L5746).
- **Boss row.** Layer tag `复合奖励.首领` gives [空, 首领战斗 (if `当前总层数 > 6`, else 精英战斗), 空]
  (GM 筛选地图格池 ln 1958, first branch). In the Demo this is floor 12.
- **Other floors.** Every row of the 14-row pool `地图格池` (GM ln 53) whose `解锁层数` contains the floor index
  (`地图格数量累计/3`) and whose tags contain the layer tag (or are empty) is a candidate.
  - Plain candidates are drawn by weight without replacement.
  - Special candidates are forced (up to 3).
  - The 3 chosen tiles are shuffled (GM ln 1958–2330).
  - "History" is `地图格历史`: every offered tile, 3 per floor (MAP L944; GM 近期X次是否出现X奖励 ln 2688).

| Tile (DT 数据表_地图格) | Weight | Floors | Rule | Room |
|---|---|---|---|---|
| 第一层 | 100 | 0–1 | floor 1 only, so floor 1 = 3 × 第一层 (filled from `条件筛选后[0]`) | 第一层 |
| 宝箱房 | 130 | 2+ | plain | 宝箱房 |
| 属性房 | 100 | 2+ | plain | 属性房 |
| 探索房 | 60 | 2+ | plain | 探索房 |
| 抉择房 | 60 | 3+ | plain | 天赋房 room, replaced by the merchant (shop rewards) |
| 简单战斗 | 25 | 2+ | excluded if it is in the last 5 offered tiles; forced if the history has ≥ 9 tiles and none of the last 9 is one | 战斗房_简单 |
| 普通战斗 | 15 | 2+ | same with 7 / 11 | 战斗房_普通 |
| 精英战斗 | 5 | 6+ | same with 10 / 14 | 战斗房_困难 |
| 传奇房 | (special) | 3–12 | at most once (skipped once 传奇房 is in `地图格历史`); PRD 5 % (`传奇房触发计数`) | 传奇房 |
| 恢复点 | (special) | 3+ | not in the last 8, and (≥ 2 negative mental effects, or HP ≤ 50 % and Stamina ≤ 50 %) | 恢复点 |
| 锻造房 | (special) | 1+ | not in the last 24, at least 1 recipe craftable with the current materials, and 精核 > 4 | 锻造房 |
| 空 | (special) | 0+ | probability (12 − 当前关卡层数)/12, from map row 2 on; blank slot | — |
| 首领战斗 | — | — | only through the boss row | 战斗房_首领 |
| 营地 | — | 0 | start tile of row 0 | 营地 |
| 天赋房 (120), 测试 (400) | — | — | in the pool, but their tags (`获取天赋`, `Tests`) never match `随机事件` → **never offered** | — |

- **Reachability.** The next floor's tiles with dx ∈ {−1, 0, 1} can be entered (TILE L18632).
- **Tile reward.** Each tile filters its `奖励类型` by the hero (other heroes' tags are removed). It then draws up to 3
  distinct rewards with a stream seeded by the row and the global seed, and takes entry `min(n−1, column)`
  (TILE L6058–L7789; LIB 权重创建数组 ln 916, without replacement). So the three 第一层 tiles show 初始奖励A, B and C,
  one each.
- **Room variant.** Each tile picks one `层类型` of its room, filtered by the chapter tags and drawn by weight
  (TILE L3387, L4625).
- **Reward level.** Non-combat rewards use level `获取层数品质(floor, 24) = floor/24 + 1 = 1` on every Demo floor
  (TILE after L7789; LIB ln 847). Combat tiles use their `奖励等级` instead: 1 / 2 / 3 / 4 = 0–3 stars (TILE L11249).

### 5.3 Room contents

- Every room is 5 × 7 tiles (`最小尺寸 = 最大尺寸 = [5, 7]` in all 26 rows of DT 数据表_关卡_固定地点).
- Wall and corner tiles come from DT 数据表_瓷砖配置_矩形 (18 rows).
- Pool entries with `数量 0` never spawn (TF TURN-006). This covers every `灌草` (herb) entry, so herbs never spawn in
  the Demo.

| Room | Variants (weight) | Spawns | Task | Reward |
|---|---|---|---|---|
| 第一层 | 1 | 任务宝箱 | 完成交互 | 初始奖励A "生命药剂 + 体力药剂 + 12 精核"; 初始奖励B "1 silver-quality item with an enchant"; 初始奖励C "学习一个等级至少为{0}的天赋" with `额外等级 4` (general talents only: it excludes all 4 hero tags, `唯一` and boss) |
| 战斗房_简单 | 5 (100 each) | 2 眼球 / 大肠 + 2 大肠血卵 / 2 结晶 / 2 水母脑 / 2 齐刘海 (+ 保护罩生成器) | 消灭所有敌人 | 复合奖励 lv 1 → 1 drop |
| 战斗房_普通 | 5 | 3 眼球 / 2 大肠 + 2 血卵 / 3 结晶 / 3 水母脑 / 3 齐刘海 (+ 保护罩生成器) | kill all | lv 2 → 1 drop |
| 战斗房_困难 (elite) | 4 | 2 眼球 + 眼球包 / 2 大肠 + 2 血卵 + 大肠团 / 3 结晶 + 结晶簇 / 3 水母脑 + 章鱼脑 | kill all | lv 3 → 2 drops |
| 战斗房_首领 | layer 0 (`环境.类型.遗迹`) | 守门人 | kill all | lv 4 → 2 drops (+ 破损的神像 until 永恒神像 is unlocked), then the boss talent pick |
| 宝箱房 | 1 | 任务祭坛 | 完成交互 | one chest offer (§7.4) |
| 属性房 | 1 | 任务宝箱 | 完成交互 | 获取精矿 50 (2 精矿) / 获取经验 100 (100–200 EXP) / 获取物品_全随机 200 / 随机小型武器 200 / 随机小型非武器 200 (others weight 0) |
| 探索房 | [0] 50, [3] 200, [4] 100 ([1], [2] weight 0) | 1 + 0–2 交互宝箱_附魔 / 1 + 0–2 交互宝箱_废品 / 1 + 0–3 精核矿 (2–4 精核 each) | 探索房间 | 无奖励 |
| 抉择房 (room 天赋房) | 1 | merchant + 1 shelf per reward parameter; buy 1 | 完成交互 | 获取兽肉 100 / 获取锻造 100 / 获取兑换 75 / 获取标签 20 (§7.5) |
| 传奇房 | 1 | 3 × 盗宝黏菌 (they flee) | kill all | 获取物品_传奇: 1 item of quality ≥ 4 out of 9 legendaries |
| 恢复点 | 1 | 地铺 "恢复生命和体力，移除负面精神状态。" | 完成交互 | 地铺 (rest) |
| 锻造房 | 1 | 铁砧, tooltip "转化台 / 制作物品。" → craft page | junction only (TF table) | 铁砧 |

Sources:
- rooms: `rooms.txt` (DT 数据表_关卡_固定地点);
- rewards: DT 数据表_技能_奖励;
- prop skills: DT 数据表_技能_道具 (`props_skills.txt`);
- shop spawn for rewards tagged `是商店`: GM L2424;
- 复合奖励 drop count `ceil(参数2 = 0.5·lv)`: R-CR ln 159;
- 破损的神像 rule: R-CR L666;
- 地铺 / 铁砧: `BP/环境/装饰品/蓝图_装饰品_地铺.txt` ln 174–267 and `蓝图_装饰品_铁砧.txt` ln 217–222.

**Decorations in live rooms** (`随机装饰品` / `固定装饰品`):
- 火盆, 蜡烛堆, 地板图案 ×3, 罐子, 棺材A/B;
- 地刺_0301 / 地刺_0202 (spike hazards, 0–1 each per combat room);
- 保护罩生成器 (fixed in the 齐刘海 variants of 简单/普通);
- 首领背景A, 地铺, 铁砧, 新手关02背景.
- 弹力法阵 has range 0–0 everywhere, so it never spawns. 石墙 is only in 回廊 (unreachable).
- Behaviour: unit `hazards-decorations`.

### 5.4 Combat

- Turn flow, launch, damage and statuses are owned by the verified spec TF and the drafts listed in §12.
- Scope facts:
  - at most 5 enemies on the field in combat rooms (`场上最多敌人`);
  - elite chance per spawned enemy = 0.05 + accumulator + `额外精英几率%`;
  - the accumulator grows on every failed roll in a kill-all room and resets on success;
  - elite cap 1 (简单, 普通) or 2 (困难); **no elites while `当前总层数 ≤ 3`** (GM 精英化敌人 ln 2227).
- An elite gets one random affix from 力场, 吸血, 地裂, 筑墙, 强韧 (`随机精英技能` of the rows in §6).

### 5.5 Junction, chapter end, Demo completion and death

- **Junction.** After the room task, the junction "楼梯 / 离开。" opens the map. On the last floor it adds 1 to
  `通过关卡数` and rebuilds the chapter page (JCT L3618–L4282). That page offers only `营地`.
- **Camp portal.** Leads to the run-end page (`BP/UI/UI_关卡选项.txt` ln 123: 激活冒险统计页面(true) when the option is
  `营地`, ln 164).
- **Run-end page** (END L5641): shows the Demo-complete text above when `是DEMO？ ∧ 通过关卡数 == Demo关卡数 ∧
  ¬新手关中？`. The 无尽模式 checkbox exists but is collapsed.
- **Death.** Combat end page `UI_战斗结束统计页` (挑战成功 / 失败, 击败首领) → run end with 探险失败 −100.
  - Unit `rating-shot-stats`: "战斗失败时，如果角色没有死亡，点击继续不会结束冒险" (tip 失败说明).
  - The death-settlement scene (soul balls, `BP/环境/死亡结算/`) is dead: `进入死亡结算` (GM ln 3138) is empty and
    has no caller.
- **Retreat** (`战术撤退`): no caller (TF TURN-112, SCM-037).

---

## 6. Enemies

**Reachable rows (14 of 42)** (DT 数据表_敌人_普通; skills from `固定技能`):

| Row (display) | Where | Skills |
|---|---|---|
| 眼球 (眼球虫) | 简单 [0], 普通 [0], 困难 [0]; prologue 02/04/07; spawned by 眼球包打开 and 守门人目视 | 眼球弹射, 自愈 |
| 大肠 (血蛆) | 简单 [1], 普通 [1], 困难 [1]; hatched by 血卵孵化 | 大肠弹射, 大肠酸液 |
| 大肠血卵 (血卵) | 简单 [1], 普通 [1], 困难 [1] | 大肠孵化 |
| 结晶 (活体结晶) | 简单 [2], 普通 [2], 困难 [2] | 眼球弹射, 反击（主动）, 结晶死亡 |
| 水母脑 (浮游脑) | 简单 [3], 普通 [3], 困难 [3]; summoned by 章鱼脑 | 眼球弹射, 电网, 电场 |
| 齐刘海 (幽魂) | 简单 [4], 普通 [4] | 齐刘海射击, 齐刘海闪现, 齐刘海死亡 |
| 眼球包 (眼球虫团), elite room | 困难 [0] | 肉弹战车, 眼球抛出, 眼球包打开 |
| 眼球_融合 | thrown by 眼球抛出 | 融合弹射, 眼球弹射, 自愈 |
| 大肠团 (血蛆结节) | 困难 [1] | 肉弹战车, 反弹酸液 |
| 结晶簇 (活体结晶簇) | 困难 [2] | 眼球弹射, 反击（主动）, 发射8个晶刺, 结晶死亡 |
| 章鱼脑 (活脑母体) | 困难 [3] | 电场, 力场, 召唤水母脑 |
| 盗宝黏菌 | 传奇房 × 3 | 黏菌逃跑 |
| **守门人** (boss) | 战斗房_首领 [0], floor 12 | 肉弹战车, 首领_守门人_重锤, _连环重锤, _熔岩道, 二阶_撕咬搜寻, 二阶_目视, 首领_守门人 (phase 2) |
| 新手关眼球包2 | prologue floor 7 only | 肉弹战车, 眼球包打开 |

- Spawn sources: room pools in `rooms.txt`.
- Enemies spawned by skills (scan of the pseudo code for `数据表_敌人_普通` row names):
  - 大肠 ← `蓝图_效果_血卵孵化`;
  - 眼球 ← `蓝图_效果_眼球包打开` and `蓝图_能力_守门人_目视`;
  - 眼球_融合 ← `蓝图_效果_眼球抛出`.
- Elite affixes (5): 力场, 吸血, 地裂, 筑墙, 强韧. They apply to 眼球, 大肠, 结晶, 水母脑, 齐刘海, 盗宝黏菌 and 眼球_融合.
- Kill rewards:
  - EXP = row `经验` × U(0.8, 1.2): 50 for normals, 100 for the boss (`BP/Actor/BP_Actor_Other.txt` L8845);
  - 精核 = RandomInt(0, ⌊价格 × 0.6⌋) (`BP/Actor/BP_ManeActor.txt` 触发掉落 ln 4924);
  - materials from `材料掉落` (§7.6).
- Stat growth per floor: unit `enemy-ai-intents` ENEMY--073/075 (curve 敌人属性成长, divisor 60).

**Not reachable (28)**:
- Bosses of other chapters: 弑神幼虫, 结晶骑士, 重生傀儡, 幽焰龙 (`战斗房_首领` layers 1–4 need chapter tags the Demo
  never has).
- Their spawns: 大肠血卵_坏卵 (larva boss only), 火球精 (boss-puppet-dragon ln 46).
- 石墙: only from decoration `蓝图_装饰品_石墙`, which only 回廊 uses (unit `enemy-ai-intents` ENEMY--088).
- 新手关眼球包: 回廊 only, with `数量 0`.
- 西瓜猪: only the uncalled spawner `激活敌人生成` (ENEMY--072).
- 宝箱, 新手关宝箱: no reference anywhere.
- 测试, NewRow, NewRow_0, 眼球包_0, and the 13 rows ending in `_测试` / `测试`.

---

## 7. Loot and economy

### 7.1 Currencies and counters

| Counter | Start of a run | Change | Source |
|---|---|---|---|
| 精核 (`金币`, Essencite) | 8 | kills, 精核矿 (2–4), chest and shop purchases, 初始奖励A +12, events; clamp 0–999 | GM ln 2643, 增加金币/收入 ln 511 |
| 感知 (`收入`, Perception) | 5 | clamp 0–99; every 6 floors you gain 精核 = 感知 (text R55; the payout code was not located, only the HUD dots by `当前总层数 % 6`) | GM ln 2644; text R55; UI_背包栏_3d 更新收入点UI |
| EXP / hero level | 0 / 150, level 1, cap 60 | level L → L+1 needs 150 + 75·L (curve 经验值所需曲线 linear 0→1) | GM 尝试提升等级 ln 3166, 增加经验 ln 941 |
| Corruption | 0 / 100 | room reset +10; full once → 终级抉择; full again → death | SCM §1 |
| Stamina (`魔力`) | 100 | launches and skills | SCM |

- Level-ups at levels 4, 7 and 10 (`等级 % 3 == 1`) each remove one 锁定格 (locked inventory cell). There are 3 at the
  start (GM ln 3175; CS ln 527).
- Every level-up gives a talent pick (§9).

### 7.2 Drops after a fight (复合奖励)

- The drop list is the room's `指定数据筛选` merged with its `通用数据筛选` pools (R-CR ln 154).
- Number of drops: `ceil(0.5 × 奖励等级)` = 1 / 1 / 2 / 2 for 简单 / 普通 / 精英 / 首领.
- Drop pools (DT 数据表_掉落池, weights > 0 only):
  - 常见杂物 = 鲜血 25, 精矿 10, 空附魔石 75, 空瓶 25 (old gear all 0);
  - 消耗品 = 无字书 25 (all other entries 0);
  - 附魔 = 11 enchant stones × 15;
  - 无 = empty.
- Pools per room:
  - 简单 and 普通: 常见杂物 + 消耗品 + 无, plus 4 monster parts per variant (50 each);
  - 精英: 消耗品 only, plus 5 parts per variant (100 each; the 5th is the rare part 眼球杖 / 异变种子 / 女王石 / 克隆触手);
  - 首领: 消耗品 + 附魔, plus 黄金头盔 75 and 纳气石锤 75.
- The first boss kill also gives **破损的神像**, until 永恒神像 is unlocked (R-CR L666).

### 7.3 Item offers (the item box)

- Every item reward opens an item box (`切换物品盒子`). The parameters are listed in
  `rewards.txt` (R-GI L420–L2704):
  - 0 = count;
  - 1 = paid (1) or free (0);
  - 2 = refreshes;
  - 3 = how many can be taken (−1 = no limit);
  - 4 = whether it can be abandoned;
  - 5 = minimum quality;
  - 6 = chance that each item comes with an enchant;
  - 7 = fixed quality;
  - 8 = all heroes.
- **All-hero items.** The `全职业？` argument of `刷新生成牌` is the literal `true` in R-GI ln 266 (CS 刷新生成牌 ln 1633;
  checked in the bytecode mirror). So **the exclusive items of all 4 heroes are offered to both playable heroes**.
- **Item price** (`BP/Actor/BP_Actor_Card.txt` 更新价格 ln 547):
  - buy = ⌊尺寸 × 价格 × 等级 × (1 − 购买折扣)⌋ + 溢价;
  - outside the offer box (or inside the warehouse) the price is halved. This is probably the value paid back when
    an item is sold (CS ln 1192–1197 pays `当前价格`); unit `progression-economy` should confirm.
- **Rerolls**: the parameter 2 counts. The reroll cost lives in `修炼系统` (unit `progression-economy`).

### 7.4 Chest room offers (宝箱房)

Weights after the hero filter (DT 数据表_地图格[宝箱房] `奖励类型`; row parameters via `chestrw.py`). Every offer is
paid, has 1 refresh (废料: 0), no take limit, and a 25 % enchant chance per item.

| Offer | Weight | Items | Hero |
|---|---|---|---|
| 获取物品_废料 | 150 | a "full box" of scrap (`数量 −1` = random sizes filling 4 slots, CS L3765) | both |
| 获取物品_小型 | 120 | 3 | both |
| 获取物品_中型 | 120 | 2 | both |
| 获取物品_大型 | 120 | 1 | both |
| 获取物品_武器 | 75 | 2 | both |
| 获取物品_非武器 | 75 | 2 | both |
| 获取物品_护甲 / 格挡 | 50 / 50 | 2 | Knight |
| 获取物品_闪避 / 流血 | 50 / 50 | 2 | Hunter |
| 其他角色, 饰品, 工具, 附魔, 灌注 | 0 | — | never |
| 剧毒, 治愈, 气地, 火电 | 50 each | — | filtered out (plague and elemental tags) |

The `等级层数范围` minimums on these reward rows (12, 24, 36) are never read for rewards. Only talents read them
(MAIN 筛选天赋 ln 304).

### 7.5 Shops (the merchant in 抉择房, plus floor 5 of the prologue)

- A reward tagged `是商店` spawns `蓝图_商店`: the 商人 NPC plus one shelf per reward parameter (GM L2424; SHOP L15).
- Each shelf sells the 数据表_道具_通用 prop named in the parameter note. Its level is the shelf index + 1 and its
  price is the parameter value (SHELF L799).
- **You can buy 1 item** (`可购买数量 = 1`). Buying ends the room task (SHELF L155 / L73).

| Reward | Shelves (prop: price) |
|---|---|
| 获取兽肉 | 远古兽肉 (levels 1–4): 0 / 5 / 10 / 20 |
| 获取锻造 | 锻造锤_品质白银: 12; 锻造锤_品质青铜: 0 |
| 获取兑换 | 兑换卷_武器 / 饰品 / 工具: 0 / 0 / 0 |
| 获取标签 | 锻造锤_标签 ("给最上方物品添加额外物品类型"): 18 |
| 获取锻造_新手关 | 锻造锤_品质青铜: 4 |

- The standalone 商店 tile (DT 数据表_地图格[商店]) is not in `地图格池`, so it never appears.

### 7.6 Materials (DT 数据表_材料, 8 rows)

- **矿石 (铁矿) and 灌草** come from normal kills: rolls of [铁矿, 灌草] at 20 %. 3 rolls for normals, 10 for elite
  units, 20 for the boss; 盗宝黏菌 10 at 100 %.
- **灵魂宝珠**: 1 per boss kill.
- **奇异之尘**: from dismantling (分解).
- **夜薯, 岩菇, 顽石**: no source.
- **骨晶 (骨盐)**: only from the unreachable 西瓜猪 and 眼球包_0.
- Sources: DT 数据表_敌人_普通 `材料掉落`; GM 添加材料掉落 ln 2523.

### 7.7 Meta progression (score → exploration level)

- **Score per run** (END ln 40, `轮回得分统计`):

  | Event | Points |
  |---|---|
  | 反弹 (bounce) | 1 |
  | 获得SSS | 20 |
  | 获取物品 | 5 |
  | 分解物品 | 5 |
  | 英雄升级 | 30 |
  | 获取天赋 | 10 |
  | 进行附魔 | 5 |
  | 挑战成功 | 50 |
  | 击败首领 | 50 |
  | 探险失败 | −100 |
  | 完成探险 | 1000 |
  | 接受指引 | 500 |
  | 自我放弃 | −100 |

- **Exploration level**: going from level n to n+1 needs 500·(n+1) points. Leftover points carry over; the cap is 35.
  The value is saved as `探索等级进度['总值']` (END L2016–L4638).
- So level 4 (灵魂猎手) needs 5000 cumulative points. **Estimate**: prologue ≈ 1.6–1.9 k, a won run ≈ 1.5–2 k, so the
  Hunter unlocks after the prologue plus about 2 won runs.
- The "1582/2000" bar is level 3 with 1582 of the 2000 points needed for level 4.
- Legacy equipment drops (`装备掉落`, DT 数据表_装备 28 rows) are dead: `添加装备掉落(旧/新)` (GM ln 4637 / 4691) and
  `添加锻造格` (ln 3531) have no caller.

---

## 8. Items (202 rows: 114 general + 27 Knight + 27 Hunter + 17 Plague + 17 Elemental)

The classification is in `reach.txt` (`reach.py`).

**Generators.** An item is offerable if it passes one of the live generators: CS 筛选物品生成 ln 829 with tag parent
matching, not `忽略`, and not excluded.
- G1: 初始奖励B;
- G2–G11: chest offers (§7.4);
- G13–G15: 属性房;
- G16: 传奇房;
- G17/G18: 探索房 chests (`点击交互_附魔` / `点击交互_废品`);
- G19a–f: 抉择 sub-rewards (随机附魔 / 武器 / 饰品 / 工具 / 中型 / 废料);
- G20: the enchant attached to offered items.

**Drops** come from §7.2. **Other paths** were resolved by hand.

| Table | Reachable | Not reachable |
|---|---|---|
| 通用 (114) | **85** = 44 generated + 27 dropped + 14 other paths | 29 = 19 `忽略` + 10 other-boss or no-source rows |
| 专属_幽冥骑士 (27) | 26 | 1 (钩锁, `忽略`) |
| 专属_灵魂猎手 (27) | 27 | 0 |
| 专属_恶疫旅人 (17) | 17 (all-hero offers) | 0 |
| 专属_元素祭司 (17) | 17 (all-hero offers) | 0 |
| **Total 202** | **172** | **30** |

**General, generated (44)**:
- 11 enchant stones: 伤害, 治愈, 护甲 and 充能附魔 A/B; 英雄附魔 A/B/C;
- 6 legendary enchants 传奇附魔A–F and 3 legendary items 巨神兵大剑, 不可撼动之甲, 万里追风靴 (传奇房 only);
- consumables: 空附魔石, 空瓶, 无字书, 生命药剂, 体力药剂, 魔力药剂, 绷带, 旧绷带, 精矿, 未知种子;
- 11 old-gear scrap items: 旧匕首, 旧项链, 旧剑, 旧盾, 旧皮衣, 旧长袍, 旧鞋, 旧手套, 旧盔甲, 旧弓, 旧法杖;
- 魔力石, 淬炼宝石, 活脑.

**General, dropped (27)**:
- 鲜血 (常见杂物);
- 生命药剂_新手关 (prologue only);
- 21 monster parts from the combat rooms. The 4 rare ones (眼球杖, 异变种子, 女王石, 克隆触手) come from elite rooms
  only. 魂珠, 亡者之息, 寂静法杖 and 死灵布 come from the 齐刘海 variant of 普通 only.
- 黄金头盔 and 纳气石锤 from 守门人.

**General, other paths (14)**:
- 破损的神像: first boss kill;
- 祝福之灵: a merge that raises quality (CS 合成牌 ln 1140);
- 远古兽肉: shop prop 远古兽肉 → skill 获取兽肉;
- by-products of `蓝图_效果_结束层创建物品` on exclusive items that are offered: 骨刺 (利齿骨鞭), 优质兽皮 (活体软甲),
  5 药丸 (药丸蜗牛), 蕨叶 (月光蕨);
- 晶核剑, 晶核盾, 贪婪手套: crafted from 旧剑 / 旧盾 / 旧手套 + 精矿; tagged `不需解锁`, so they can be crafted from
  the first run (UI_制造页 L1894).

**Not reachable**:
- **19 `忽略` general rows**:
  - 测试附魔, 测试人偶, 诅咒之骨, 普通附魔, 萃取卷轴, 解毒剂, 魔力雕像, 滋养粉尘, 多宝黏菌块;
  - 毒云炸弹, 机动弩, 抓钩, 镜像石, 黑檀树种, 腐蚀池;
  - 灼热眼珠_拾取, 黑洞法杖_拾取, 节肢_拾取;
  - 锁定格. It is never loot, but it is shown as the locked-cell placeholder, so it is in scope as a system object.
- **10 general rows with no source**:
  - 锻造锤 (pool weight 0, no creator);
  - other bosses' loot: 弑神虫卵, 弑神枝条, 结晶重盾, 结晶大剑, 重生傀儡之颅, 重生傀儡之臂, 幽焰龙头, 幽焰龙爪, 幽焰龙尾.
- **钩锁** (Knight exclusive, `忽略`).

**Crafting.**
- 161 items have a recipe: 55 need materials only, the rest need an item (`制造需求`).
- The craft page lists a recipe if it is in `已解锁配方` or tagged `不需解锁` (8 items) (UI_制造页 L1894–L2970).
- A recipe is learned for good the first time its item is obtained ("习得配方：…", CS 解锁配方判断 ln 274).
- Monster-part recipes need 灵魂宝珠, which only the floor-12 boss drops. They are practically unusable in a Demo run.

---

## 9. Talents (147 rows)

- Pool: a hero's `天赋表` = 新新通用 (29) + 专属 (73) + boss专属 (45) (DT 数据表_玩家; BP_ManeActor L4345).
- Offer filter (MAIN 筛选天赋 ln 269) keeps a row when all of these hold:
  - not `忽略`;
  - not tagged for another hero;
  - `主条件.等级层数范围` contains the hero level;
  - `已获取天赋数 ≥ 前置点数`;
  - its exclusion tags do not match the hero's talent tags;
  - not in `排除天赋池`;
  - for actives, fewer than 5 active abilities owned;
  - if already owned, below `天赋上限`.

| Offer | Options / refreshes | Pool | Source |
|---|---|---|---|
| Level-up (each level) | 3 / 1; excludes `唯一` and boss rows | Knight 60, Hunter 62 (29 general + 16 untagged + 19 / 21 hero rows − 4 唯一) | `蓝图_效果_升级获取天赋` L3525 |
| Level-up when 英雄等级 − 升级点 == 10 | 3 / 0; only `天赋.唯一` (if none owned yet) | 4 per hero | same |
| 初始奖励C | 3, `额外等级 4`; excludes all hero tags, `唯一` and boss rows | 45 (29 + 16) | DT 数据表_技能_奖励[初始奖励C] |
| Boss kill (floor 12) | 3, free, 0 refreshes; target = the boss room tags `环境.类型.遗迹` | 8: 大型装甲, 真视, 新生之力, 癫狂, 爆裂火星, 蓄力击, 掠夺, 暴食 | `蓝图_效果_首领天赋获取` ln 188 |
| 抉择_06 → 获取天赋_通用 | 3 | general pool | DT 数据表_技能_奖励 |

| Table | Knight run | Hunter run | Never reachable |
|---|---|---|---|
| 新新通用 29 | 29 | 29 | 0 |
| 专属 73 | 35 (19 Knight incl. 5 actives and 4 唯一, + 16 untagged) | 37 (21 Hunter incl. 5 actives and 4 唯一, + 16) | 17 = 9 `忽略` (搜刮者, 智慧, 钩锁剑术, 强化钩锁, 反蹬箭, 4 separators) + 4 Plague + 4 Elemental `唯一` |
| boss专属 45 | 8 | 8 | 37 = 5 `忽略` boss headers + 32 rows of the other 4 bosses |
| **Total** | **72** | **74** | **54** (93 reachable in total) |

Caveats (the talent-spec owners must confirm):
- **Prerequisites not checked.** `主条件.解锁材料` (for example 影分箭 needs 反蹬箭, 铠甲强化 needs 防御姿态) is not
  checked by `筛选天赋`. It only drives the codex unlock list (GM 初始化天赋解锁 ln 2782). So, by the code, such talents
  are offered without their prerequisite.
- **Test-tagged rows.** 溢疗充能, 锋芒毕露 (general) and 血铸壁垒, 连锁打击 (Hunter) carry `Tests` but no `忽略`, so they
  are offered.
- **生生不息** needs `前置点数 30`. That is probably out of reach in 12 floors, but the row is reachable by code.
- **Talent progress bar.** The talent page shows `已获取天赋数` against the stages [2, 6, 11, 16, 23, 33]
  (MAIN 计算天赋解锁进度 ln 196; GM ln 189). It is a display only, because `筛选天赋` does not read it.

---

## 10. Other systems

### 10.1 Choice events (抉择_01–07) and 祝福之灵

- The 抉择 map tiles (抉择房_0, 抉择房_1, 抉择测试备份_0) are not in `地图格池`.
- The 7 event rows are reached only through the item **祝福之灵**: using it calls `蓝图_能力_祝福奖励`, which offers
  rewards tagged `抉择事件`.
- 祝福之灵 is created by a merge of two identical items that raises the quality (CS 合成牌 ln 1140: quality thresholds
  [2, 4, 8, 16] on the summed levels; the new 祝福之灵 has the old quality).

| Event | Options |
|---|---|
| 抉择_01 | 附魔石 / +精核 |
| 抉择_02 | 生命上限 / random item |
| 抉择_03 | scrap / +基础伤害 |
| 抉择_04 | random weapon / accessory / tool |
| 抉择_05 | 生命上限 / extra EXP |
| 抉择_06 | random 中型 item / talent |
| 抉择_07 | random 精核 / 生命 / EXP |

Event rows: DT 数据表_技能_奖励.

### 10.2 First full Corruption → 终结抉择

- The first time Corruption reaches 100, the hero gains +30 Stamina and the 3-way reward **终结抉择**: 升级物品品质 /
  获得精核和经验 / 获取传奇附魔石.
- Any later fill kills the hero (SCM-034, SCM §1).
- Sources of Corruption in the Demo: unit `stamina-corruption-mental`.

### 10.3 Eternal Statue (永恒神像 / 永恒之盒)

- It sits in the chapter-select hub (`蓝图_装饰品_关卡选择` child `永恒之盒`).
- Using 破损的神像 unlocks it (`蓝图_能力_破损的神像` ln 51 → 更新解锁状态; save `已解锁机制`).
- Items placed in it persist across runs (tip 永恒之盒 "放入永恒神像内的物品将会永久存在。").
- The stash UI is the warehouse page (仓库页, page type 4, MAP ln 715).

### 10.4 Merge, dismantle, enchant and forge

- **Merge** (进行合成): identical items merge; levels add up; quality rises at 2 / 4 / 8 / 16 (CS ln 1063).
- **Dismantle** (分解牌, CS ln 1161) gives 奇异之尘.
- **Enchant** (进行附魔): drag an enchant stone onto an item (tip). Enchant sources: §8. Replacement and extraction:
  unit `enchantments`.
- **Forge**: 锻造锤_品质青铜 / 白银 raise the quality of the top equipped item; 锻造锤_标签 adds a type (武器 / 工具 /
  饰品 hammers); 兑换卷 exchanges the top item for one of the same size and quality (DT 数据表_技能_道具).
- **Craft**: §8. Craft page: page type 1; materials page: page type 2.

### 10.5 Curses, blessings and Abyss Levels: not reachable

- `最高进阶级别 = 是DEMO？ ? −1 : 10` (GM ln 2391–2393). The 深渊级别 UI is collapsed, so no 进阶级别 can be chosen.
- All 18 rows of DT 数据表_技能_诅咒祝福 are unreachable. Most of them are also `忽略` or empty stubs
  (SCM §2, 诅咒_4).

### 10.6 Mental states, Stamina and Corruption

- Reachable mental states: 4 of 17 (饥饿 Fatigue, 饱腹 Energized, 疼痛, 幸运). The morale meter `精神系统` is a stub
  (SCM §1, SCM-079/080).
- Stamina, Corruption, Fatigue/Energized and Flowstate are fully specified in SCM. All of them are in scope.

### 10.7 Camp and buildings

- In the Demo the camp is the main-menu scene plus the hub with the portal and the Eternal Statue.
- Clicking a camp cell starts the run directly (`BP/环境/营地/蓝图_营地格.txt` ln 193: `是DEMO？` → `传送阵.DEMO出发`).
- The building system is not used: `蓝图_营地系统`, DT 数据表_营地格, the build and building-detail pages.

### 10.8 Quests

- 5 main-line quest names exist (save `主线任务`).
- Only **序幕** ("通过第7层", it completes) and **凝视深渊** ("通过第{0}/60层", it never completes) are ever created
  (GM 恢复轮回任务 ln 1373).
- 开启大门 (12), 荣耀与寄生 (36) and 往日回忆 (72), plus the side quests 钩深索隐, 坚壁清野 and 集腋成裘, are never
  created.

### 10.9 Tutorial tips (13 reachable)

- Trigger sites (`激活新手提示(n)`):

  | n | Tip | Site |
  |---|---|---|
  | 0 | 拾取物品 | CS ln 1987 |
  | 1 | 启动弹射 | GM ln 5893 |
  | 2 | 充能说明 | GM ln 5890 |
  | 3 | 进行附魔 | CS ln 1988 |
  | 5 | 进行合成 | GM ln 5887, CS ln 1990 |
  | 6 | 英雄升级 | BP_Actor_Player ln 643 |
  | 8 | 前进地图 | PORTAL ln 116, SEL ln 206 |
  | 9 | 敌人攻击 | GM ln 5884 |
  | 10 | 使用物品 | CS ln 1989 |
  | 11 | 进行制作 | CS ln 798 |
  | 12 | 永恒之盒 | `蓝图_永恒之盒` ln 258 |
  | 13 | 高品合成 | UI_制造页 ln 610 |
  | 14 | 失败说明 | UI_战斗结束统计页 ln 246 |

- Never triggered: 4 腐化增加 (it has a row but no media) and 7 解锁潜能 (no row).
- Sources: DT 数据表_词条_新手提示 (14 rows); 枚举_新手提示类型 (15 values).
- Each tip shows its video `Content/Movies/新手NN.mp4` (`D:/TAPTAPGAME_ref/screens/frames/tut*`).

### 10.10 Codex, encyclopedia and pages

- Codex (图鉴页, page type 5): opened from the backpack bar (UI_背包栏_3d ln 850).
- Encyclopedia (百科页): reachable.
- Talent page (天赋查看按钮): reachable.
- Lock state of entries: `已解锁天赋`, `已解锁配方`. Layout and contents: unit `codex-achievements`.

---

## 11. Length of a typical Demo run (estimate)

The Demo was not run and there is no telemetry, so these numbers are derived and flagged as estimates.

**Structure (exact):**
- prologue: 7 floors = 3 fights (1, 2 and 3 enemies) + 4 rooms without combat;
- run: 12 floors = floor 1 (start reward) + 10 chosen tiles + the boss on floor 12.

**Fights per run (estimate, from §5.2):**
- The plain weights favour rooms without combat: 宝箱 130 + 属性 100 + 探索 60 + 抉择 60 = 350 against 45 for combat.
- The history rules force 简单战斗 into roughly every 3rd floor and 普通战斗 into every 4th, and 精英战斗 appears
  about every 5th floor from floor 6.
- The player picks one of the 2–3 reachable tiles, so a run has about **3–6 fights + the boss** and about 5–7 rooms
  without combat.

**Time per turn (estimate):**
- aim 2–6 s (not measured);
- launch resolution 0.3–2 s: measured release → rest ≈ 340 ms for one leg, with more for wall bounces
  (`D:/TAPTAPGAME_studio/tmp/feel/demo-tutorial-measure.md`);
- enemy phase 0.5–2 s: measured release → next aim 1.37 s with 2 enemies;
- total about 4–9 s per turn.

**Turns per fight (estimate):**
- 3–8 for normal fights (2–5 enemies with 20–80 base HP against 20–30 hero base damage, with floor growth);
- 8–15 for 守门人 (base HP 100, two phases).

| Part | Estimate |
|---|---|
| Prologue (first time, with 13 tips and videos) | 8–15 min |
| One fight, including the loot box | 0.5–1.5 min |
| Boss fight | 1–3 min |
| One room without combat (offers, shop, chests, crafting) | 0.3–1 min |
| Map choices, level-up picks, inventory | 2–4 min per run |
| **One full Demo run (12 floors)** | **about 10–25 min** (central guess about 15 min) |
| First session (prologue + one run) | about 20–40 min |

So **30 min is not one Demo run**. It is the first session (prologue plus one run) or two runs. A proposal to measure
this is under "Proposals" below.

---

## 12. Prototype content list (in scope, by system, with counts)

| System | In scope | Count | Data / spec owner |
|---|---|---|---|
| Front end | main menu (序幕, 新的冒险, settings, quit, links), hero select, quest bar, loading texts, run-end page with the Demo-complete text | 1 menu, 1 hero select, 1 run-end page | `ui-camp-menus`, `ui-hero-select`, `ui-run-end-stats` |
| Save / resume | per-tile map save, resume prompt (回忆 / 遗忘), pause dialog (重置房间 +10 Corruption / 保存并退出 / 放弃探险) | 3 warning types (0, 2 live; 1 dead) | `save-settings` |
| Heroes | 幽冥骑士, 灵魂猎手 (unlock at exploration level 4) | 2 heroes, 2 controllable basic skills, 10 active talents | `heroes-skills` |
| Chapters | 新手关 (7 fixed floors), 遗迹 (12 floors) | 2 | `map-generation`, `tutorial-flow` |
| Map tiles | 第一层, 简单战斗, 普通战斗, 精英战斗, 首领战斗, 宝箱房, 探索房, 属性房, 抉择房, 传奇房, 恢复点, 锻造房, 空, 营地 + 新手关01–07 | 14 + 7 rows | DT 数据表_地图格 |
| Room layouts | 第一层, 战斗房_简单 (5), 普通 (5), 困难 (4), 首领 [0], 宝箱房, 属性房, 探索房 [0, 3, 4], 天赋房 (shop shell), 传奇房, 恢复点, 锻造房, 营地, 新手关01, 02, 04, 05, 07 | 18 rows / 24 variants | `room-generation`, `hazards-decorations` |
| Room tasks | 消灭所有敌人, 完成交互, 探索房间, 无任务 + run quests 序幕, 凝视深渊 | 6 of 15 | DT 数据表_技能_任务 |
| Enemies | the 14 rows of §6, 5 elite affixes, the boss 守门人 (2 phases) | 14 rows, 31 skills | `enemies-*`, `boss-gatekeeper`, `enemy-ai-intents` |
| Combat | launch / bounce / preview, turn flow, damage, statuses, rating, charge / infuse / echo | as specified | TF, `launch-movement`, `native-trajectory`, `trajectory-preview`, `damage-crit-weakspot`, `combat-statuses`, `rating-shot-stats`, `charge-infuse-echocast` |
| Map rewards | 初始奖励A, B, C; 复合奖励 (+ prologue version); 10 chest offers; 5 attribute offers; 4 shop offers + the prologue shop; 获取物品_传奇; 无奖励; 地铺; 铁砧; 3 prologue item and EXP rewards; 获取物品_轮回奖励 (prologue end) | about 35 reward rows | DT 数据表_技能_奖励, `loot-rewards`, `shop-events` |
| Events | 抉择_01–07 + their sub-rewards; 终结抉择 | 7 + 1 | `shop-events` |
| Props | 任务宝箱, 任务祭坛, 交互宝箱_附魔 / 废品, 精核矿, the shop props (远古兽肉, 锻造锤 ×3, 兑换卷 ×3), the 商人 NPC | 13 | DT 数据表_道具_通用 |
| Decorations | 火盆, 蜡烛堆, 地板图案 ×3, 罐子, 棺材A/B, 地刺 ×2, 保护罩生成器, 地铺, 铁砧, 首领背景A, 新手关02背景 | 15 | `hazards-decorations` |
| Items | general 85, Knight 26, Hunter 27, Plague 17, Elemental 17 | **172** | items-01…08, effects-item-1…4, `enchantments` |
| Loot | 3 drop pools (常见杂物, 消耗品, 附魔), the monster-part drop lists, item-box rules, quality, price, sell value, reroll | — | `loot-rewards`, `progression-economy` |
| Talents | 29 general, 35 Knight-run + 37 Hunter-run exclusive (16 shared), 8 遗迹 boss talents; level-up, 唯一, start-reward and boss picks | **93** (72 / 74 per hero) | `talents-general-levelup`, `talents-hero-potential`, `talents-boss` |
| Economy | 精核, 感知 (every 6 floors), EXP curve, hero level (cap 60; locked cells open at 4, 7, 10), materials 矿石, 灌草, 灵魂宝珠, 奇异之尘 | 4 materials | `progression-economy`, `inventory-equipment` |
| Inventory | equipped column, backpack, item sizes, 3 locked cells, side bar | — | `inventory-equipment` |
| Crafting | craft page, 161 recipes (8 without unlock), learned recipes, merge, dismantle, forge hammers, exchange vouchers | 161 recipes | `crafting` |
| Stamina / Corruption / mental | Stamina, Corruption (reset +10, 终结抉择, death), 4 mental states, Fatigue / Energized, Flowstate | 4 of 17 states | SCM |
| Meta | run score (13 categories), exploration level (500·n), Hunter unlock, 已解锁配方, Eternal Statue | — | `progression-economy`, `camp-statue-quests` |
| Tutorial | 7 prologue floors, 13 tips with videos | 13 | `tutorial-flow` |
| Codex | 图鉴, 百科, talent page views | — | `codex-achievements` |

---

## 13. Out of scope (with counts)

**Full-game-only content (present in the data, locked by `是DEMO？` or by the single chapter):**
- **Chapters**: 7 of 8 (入口, 墓地, 矿洞, 实验室, 龙穴, 武器库, 深渊), plus endless mode (`无尽模式？`) and the other
  branches.
- **Bosses**: 4 (弑神幼虫, 结晶骑士, 重生傀儡, 幽焰龙) with their rooms (`战斗房_首领` layers 1–4), their spawns
  (大肠血卵_坏卵, 火球精), 9 loot items and 32 boss talents.
- **Heroes**: 2 (恶疫旅人, 元素祭司). Their 34 exclusive items **stay in scope** (all-hero offers), but their 8 `唯一`
  talents are out.
- **Abyss Levels and curses / blessings**: 18 rows (`最高进阶级别 −1`).
- **Quests**: 开启大门, 荣耀与寄生, 往日回忆 (and 凝视深渊's completion), 钩深索隐, 坚壁清野, 集腋成裘.
- **Camp building system**: 蓝图_营地系统, 数据表_营地格, the build and building-detail pages.
- **Map tiles**: 天赋房, 附魔房, 兽肉房, 商店, 回廊 (tags or pool keep them out).

**Test rows:**
- 数据表_地图格: 3 note rows, 测试, 4 测试备份 rows;
- 数据表_关卡_固定地点: 测试, 测试存地形;
- 数据表_标签队列: 测试 (and the 8 unused queues);
- 数据表_敌人_普通: 测试, NewRow, NewRow_0, 眼球包_0 and 13 `*_测试` rows;
- 数据表_玩家: 默认, 测试;
- items: 测试附魔, 测试人偶.

**Dead data and dead code:**
- **Map tiles**: 6 variant tiles (抉择房_0, 抉择房_1, 宝箱房_自动, 宝箱房_手动, 属性房_0, 宝箱房_0).
- **Rooms**: 灵魂境, 宝箱房_0; 探索房 layers 1–2 (weight 0).
- **Enemies**: 西瓜猪 (uncalled spawner), 宝箱, 新手关宝箱, 石墙, 新手关眼球包.
- **Items**: 17 `忽略` rows (the 19 general `忽略` rows minus the 2 test items above and 锁定格, plus 钩锁), and 锻造锤.
- **Talents**: 9 `忽略` exclusive rows and 5 `忽略` boss headers.
- **Hero systems**: the Ultimate (奥义, 获取钥匙), the Potential page and its points.
- **Systems**: the death-settlement scene; legacy equipment (DT 数据表_装备 28 rows, 装备掉落); 战术撤退; the 13
  unreachable mental states; the `精神系统` meter.
- **Tips**: 腐化增加, 解锁潜能.
- **Materials**: 夜薯, 岩菇, 顽石, 骨盐.
- **Not spawned**: 弹力法阵 (count 0), herbs 灌草 (pool count 0).
- **Rewards**: the shop props 天赋卷轴, 药剂包, 愤怒茄子, 活脑 / 稚嫩心脏 / 秘银鳞片 (as shop props), and every reward row
  not listed in §12.

---

## 14. Conflicts with plan v4, open questions, proposals and needs

**Conflicts** (plan v4 §1 against the Demo):
1. Content: "诅咒与祝福". The Demo cannot reach them (§10.5). Recommendation: leave them out of G3 or mark them
   full-game only.
2. "商店". The Demo has no shop room. Its shops are the 抉择房 merchant (§7.5); the standalone 商店 tile is unused.
3. "一局 ≥ 30 分钟，层数和节奏与 Demo 相同". One Demo run is about 10–25 min (§11). Either define the 30 min as the first
   session (prologue + run), or accept a shorter run.
4. "营地（局外成长）". Only the exploration level, the hero unlock, the recipes and the Eternal Statue exist (§10.7).

**Open questions** (also in the result):
- Talent prerequisites (`解锁材料`) are not checked when offering (§9). Is this a Demo bug that should be copied 1:1?
- `Tests`-tagged talents are offerable (4 rows). Copy that?
- Combat drops show all-hero exclusive items, because `全职业` is forced true (§7.3). Confirmed by code; copy 1:1?
- Run length: the timing of a real Demo run has not been measured (the Demo may not be run).
- 恢复点 and 锻造房 are conditional specials. How often they really appear is not estimated.
- Map history counts offered tiles, not chosen ones. This is confirmed by code (MAP L944), and the map-generation
  owner should keep it.
- Potential page: dead by the tip audit, but the hero-select tab exists. The UI owner should confirm before cutting it.

**Proposals** (not done):
- A headless bot run of the prototype's map generator (1000 seeds) could replace the run-length and fight-count
  estimates with distributions.
- Ask the producer whether a recorded Demo session (from the producer, not by running it here) can be used to time a
  real run.

**Needs**: none for this audit. The counts in §0 should be adopted as the G3 content checklist after the producer
decides the conflicts in §14.
