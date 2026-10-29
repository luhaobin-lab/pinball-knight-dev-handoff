<!-- Step 0 output (2026-10-23), committed by the orchestrator. Planner scripts and data: D:/TAPTAPGAME_studio/tmp/step0/ (scripts/, owners.json, reach.txt). -->
# WAVE B: content port (final batches)

2026-10-23, the planner, step 0 of `方案-v4-原型优先.md`. Inputs: `PROTOTYPE_SCOPE.md` (what is in scope), `ARCHITECTURE.md`
§7 and §13 (conventions, the draft batches), `WAVE_A.md` (what wave A already owns). This document replaces
ARCHITECTURE §13. The repo was not edited; the Demo was not run.

---

## 0. Summary

- **Precondition**: G2 approved by the producer and wave A merged (tag `g2`). From the first B1 merge on, the default
  content filter is `'all'`: every in-scope row is offered and unported classes hit counted stubs.
- **Size**: the in-scope skill blueprints left after wave A are **251 classes / 37 031 pseudo-lines**, plus about **5.4 K
  lines** of live environment blueprints (rooms 2.25 K, decorations 1.6 K, 地铺 + 铁砧 0.5 K, camp 0.8 K plus the Demo path
  of 蓝图_传送门, shop 0.23 K) and the systems that have no draft (shop and events, crafting, enchanting, camp and statue,
  tutorial, full save). Every class has exactly one owner card (`D:/TAPTAPGAME_studio/tmp/step0/scripts/owners.json`,
  reproduced by content-bpkit's `batches.mjs` into `D:/TAPTAPGAME_studio/tmp/bp-owners.json`).
- **Round B1: 24 cards in parallel** (ports of content blueprints with their rows, plus the vertical systems).
  **Round B2: 11 cards + `bp-fix-*`** (full save, verification of all 172 items and 93 talents, parity statistics,
  coverage closure, layout parity, framework fixes).
- **Removed from the architect's wave B** (out of scope, PROTOTYPE_SCOPE §13): `boss-knight-larva`, `boss-puppet-dragon`
  (except 齐刘海), `sys-curses`, `sys-potential`, `sys-death` (soul balls), `bp-mental` (13 unreachable states), the
  boss-talent verification of 37 out-of-scope rows, 西瓜猪, 大肠血卵_坏卵, 大肠喷射, 火球精, 石墙, 回廊, 解密柱子, 触发能力机关
  (+ 充电塔), 路口机关, 弹力法阵, the orphan enemy skills 肉弹旋风 / 气刃地震 / 大眼地震(UP), abyss levels, camp buildings,
  endless mode. In numbers: **146 classes / 20 033 lines** of the architect's 495 / 73 588 are reachable only from
  out-of-scope rows and are not ported.

**From the architect's §13 to the final cards**

| ARCHITECTURE §13 | Final | Change |
|---|---|---|
| bp-items-1…8 | bp-items-1…6 | recomputed on the scoped set (37 item effect classes are only used by out-of-scope rows) |
| bp-talents-1…5 | bp-talents-1…3 | recomputed (25 talent effect classes only serve out-of-scope talents) |
| bp-hero-knight, bp-hero-hunter | same ids | 冲锋斩, 投掷_圆形区域, 解放判断 (Ultimate) dropped; 抓钩 and 瞄准射击 (钩锁 is a live Knight active) added |
| enemy-eyeball, enemy-intestine, enemy-crystal | enemy-eyeball-ghost, enemy-crystal-brain | 西瓜猪, 大肠血卵_坏卵, 大肠喷射, 受伤毒气, 死期将至, 脑波 dropped; 齐刘海 moved in from boss-puppet-dragon; 大肠团 joins crystal-brain |
| enemy-elites | same id | orphan skills 肉弹旋风, 气刃地震, 大眼地震(UP) and the 石墙 decoration dropped |
| boss-gatekeeper | same id | — |
| boss-knight-larva, boss-puppet-dragon | removed | other chapters' bosses |
| bp-pickups, bp-decor | env-hazards | 弹力法阵, 解密柱子, 触发能力机关 (+ 充电塔), 路口机关, 回廊, 毒液池 dropped |
| bp-props-1, bp-props-2, bp-rewards | dissolved | live classes moved to their systems (wave A, sys-shop-events, sys-craft, sys-camp-meta, sys-tutorial, items) |
| core-room, sys-shop-events, sys-enchant, sys-craft | same ids | — |
| sys-curses | removed | abyss levels are disabled (最高进阶级别 −1) |
| sys-camp | sys-camp-meta | camp buildings dropped |
| B2 sys-tutorial | B1 sys-tutorial | independent enough to run in B1 |
| B2 verify-items-1…5, verify-talents-1…3 | verify-items-1…4, verify-talents-1…2 | 172 items, 93 talents |
| B2 bp-mental, sys-potential, sys-death | removed | dead in the Demo |
| B2 sys-settings, sys-codex | B1 ui-pages-b, ui-codex | UI only |
| B2 coverage-1…4, ui-layout-1…3 | coverage-1…2, ui-layout | smaller scope |

| Round | Cards | Pseudo-lines | Parallel | Estimated time |
|---|---|---|---|---|
| B1 | 24 | ≈ 37 K skill + 5.4 K environment | 24 (or 12 + 12, §7) | one working day |
| B2 | 11 + `bp-fix-*` | verification and closure | 11–16 | half to one day |

---

## 1. Rules for every wave-B card

1. Everything in WAVE_A.md §1 applies (target card, worktree from `main`, ownership, 3-hour box, SPEC-GAP, one review
   with at most 2 fix rounds, the result schema).
2. **Your class list is closed.** Port exactly the classes of your card (§3) as one module each under
   `src/content/bp/<dump path minus CatapultHero/BP/>.ts` with `node tools/bp/skeleton.mjs <asset> --batch <card-id>`,
   registered in `src/content/bp/batches/<card-id>.ts` (pre-created). Parents are in wave A or in your card.
3. **Translation conventions**: ARCHITECTURE §7.4 (structure, fields, labels, pure nodes evaluated per use, latent
   helpers keyed by node label, loop kind, RNG domain per CORE-M-129, `make*` structs, `this.fx` for presentation,
   `// QUIRK (Lnnnn)`, `// SPEC-GAP`, loc keys for text).
4. **No framework patches.** A missing or wrong facade function, runtime behaviour or system rule goes under `needs`
   (file, function, exact change, the test that shows it); the `bp-fix-*` cards of B2 own those fixes. Never edit
   `src/core/bp/**`, `src/core/sim/**`, `src/core/ability/**`, `src/content/bp/index.ts` or another card's folder.
5. **Cross-card spawns** (a class you call that another B1 card owns, listed per card below) go through the registry:
   your tests use the counted stub or a test double; the train's forced bot runs prove the join after both merge.
6. **UI and game layer**: vertical cards add their pages as new folders `src/ui/pages/<page>/` with a binding file
   `src/game/bind/pages/<page>.ts` (auto-discovered, WAVE_A A09). Any other change under `src/game/**` or `src/ui/hud/**`
   goes under `needs` (exception: `core-room` owns `src/game/room/**` in wave B).
7. **Inputs common to all porting cards**: the class manifest (`src/content/demo/classes.ts`: CDO tags, vars, rows that
   reference the class), the pseudo file of every class (`D:/TAPTAPGAME_ref/dump/blueprints-pseudo/CatapultHero/…`),
   its bytecode mirror under `D:/TAPTAPGAME_ref/dump/blueprints/` when the pseudo is unclear, the rows that use it, and
   the unit scope in `D:/TAPTAPGAME_ref/spec-drafts/_plan/units.json` named in the card.

## 2. How each card is tested

1. **Vectors**: every module has at least one "state before → trigger → state after" vector and one more per
   non-trivial branch, written with `combatFixture` / `withSystems` (`tests/fixtures/`), citing the labels they cover.
   Draft vectors (ECB-TV, ENEMIE-TV, BOSS-G-TV, HEROES-TV …) become tests in the card that owns the draft.
2. **Registry test** (`tests/content-bpkit/registry.test.ts`) passes with the card's classes.
3. **Forced bot runs**: `npm run bot -- --runs 200 --policy mix --force-<items|talents|enemies> <rows that use the card's
   classes>` → 0 crashes, 0 softlocks, and every class of the card hit at least once in the coverage report.
4. **Review**: one code reviewer reads each module side by side with its pseudo file; at most 2 fix rounds; naming and
   style go to the backlog.

---

## 3. Round B1 (24 cards, in parallel)

Class names are short (`蓝图_效果_` dropped; `A:` = ability `蓝图_能力_`, `R:` = reward `蓝图_奖励_`, `P:` = projectile
`蓝图_发射物_`, `pickup:` = `蓝图_可拾取物_`). Lines are pseudo-lines. Item and talent batches are contiguous code-point
ranges of their folder with the listed extras; `owners.json` is authoritative.

### 3.1 Item effects (6 cards)

Inputs for all six: units.json `effects-item-1…4` ([ITEM] / [EFFECT] rules) and `items-01…08` for the rows; the parents
蓄能攻击时XX / 蓄能碰撞XX时XX (core-launch-sys) and 精神状态 (core-stamina); PROTOTYPE_SCOPE §8 (which items are in scope).
Forced runs use `--force-items` with the rows of `classes.ts` that reference the batch.

| Card | Classes | Lines | Classes |
|---|---|---|---|
| `bp-items-1` | 24 | 2 432 | A:给自身加被动_特殊描述, XX等于玩家精矿, 下一场属性, 临时弹性, 会心时灌注自己, 伤害等于总护甲, 伤害等于英雄基础伤害, 充能修改物品词条, 克隆触手, 分解修改所有物品, 分解修改物品属性, 分解修改玩家属性, 分解后复制, 分解得额外精核, 分解移除腐化, 分身弓, 利齿骨鞭, 反弹灌注, 反弹灌注物品, 吸血, 嗜血本能, 回合开始恢复, 回合开始格挡闪避, 回旋大剑 |
| `bp-items-2` | 20 | 2 379 | P:旋风01, 天赋给敌人附加效果, 如果唯一, 寂静法杖, 寄生尖刺, 尖角头盔, 底力面具加成, 延时护符, 延时护符加成, 投手之握, 抵抗致死, 振金护腕, 新回合灌注, 旋风杖, 有XX物品会心修改自身属性, 有充能完成修改英雄属性, 有其他分解修改自身属性, 有完成充能修改相邻属性, 有完成充能修改自身属性, 朝敌人投射（碰撞） |
| `bp-items-3` | 15 | 2 272 | 格挡强固, 格档修改自身属性, 死灵布A, 死灵布B, 活脑, 流血击杀修改自身属性, 淬毒利刃, 溢出治疗变为生命上限, 烈焰短剑, 焚天兜帽, 物品给敌人附加效果, 物品给物品附加效果, 物品给英雄附加效果, 特定层修改自身属性, 璀璨结晶 |
| `bp-items-4` | 21 | 2 503 | P:剑气, P:毒气, P:灼热射线, 电击球, 疫病虫巢, 瘟疫花, 眼球杖, 碰撞XX敌人时灌注, 碰撞XX附加效果, 碰撞投射气刃, 碰撞造成即时伤害, 碰撞造成持续伤害, 秘银鳞片 (物品) and its 过期 helper 秘银鳞片, 粘稠体液, 纳气石锤, 结束层创建材料, 结束层创建物品, 结束层后复制, 聚气果, 腥臭尖牙 |
| `bp-items-5` | 20 | 2 393 | A:移除持续伤害, 自身会心修改自身属性, 花冠, 花冠加成, 英雄受治疗修改物品词条, 英雄失去生命修改自身属性, 英雄失去生命灌注物品, 获取物品修改自身属性, 获得灌注修改自身属性, 蓄能自伤, 蕴育石像, 蛛后毒囊, 蛛后毒囊加成, 血契战盾, 血舞斗篷, 装卸修改英雄属性, 记忆珠, 贪婪手套, 超载十字架, 超载神经 |
| `bp-items-6` | 18 | 2 366 | A:魂珠, 速效药剂加成, 造成伤害恢复, 闪避修改自身属性, 雷云精灵, 雷神匕首, 额外持续加成, 风火场, 高温眼珠, 魂珠A, 魂珠_炼尸, 魔力头冠, 魔力皮靴, 黄金头盔, 黑洞, 黑洞法杖A, 黑洞法杖B加成, 物品类型数修改自身属性 |

Cross-card spawns: talent effects 恶臭长裤 (bp-talents-2) and 铠甲大师 (bp-talents-3) fire P:毒气 and P:剑气 (bp-items-4);
the enchant classes 附魔修改自身属性 / 附魔修改英雄属性 / 附魔悬停物品 belong to `sys-enchant`.

### 3.2 Talent effects (3 cards)

Inputs: units.json `effects-talent-1…3`, `talents-general-levelup`, `talents-hero-potential` (exclusive talents only; the
Potential page is dead), `talents-boss` (the 8 遗迹 rows only); PROTOTYPE_SCOPE §9; `step0/talents_hero.txt`.
Forced runs use `--force-talents`.

| Card | Classes | Lines | Classes |
|---|---|---|---|
| `bp-talents-1` | 18 | 2 530 | 临时词条属性（不预算）, 临阵磨枪, 充能获得光阴, 光环修改标签, 创口切割, 利钢萃血, 医疗格挡, 反弹治愈, 回流, 固甲石, 大地之心, 大型装甲 (boss), 天赋修改英雄属性, 天赋给物品附加效果, 完美主义, 屠戮收割, 幻影之握, 弱点洞察 |
| `bp-talents-2` | 16 | 2 429 | 快速愈合, 怒火精炼, 恶臭长裤, 损失护甲获得精矿, 敏锐直觉, 新生之力 (boss), 有XX物品会心增加减伤, 有XX物品会心恢复生命, 有XX物品会心灌注相邻, 根据持续修改敌人属性, 活力, 浴血奋战, 溢疗充能, 燃烧效能, 特定层获得精核, 狂暴 |
| `bp-talents-3` | 18 | 2 474 | A:穿透投射, 癫狂 (boss), 百磨之刃, 短兵相接, 稳固射击, 筛选新回合灌注, 绝地反击, 药剂师, 蓄势待发, 蓄势战甲, 血铸壁垒, 评分获得效果, 连锁反应, 连锁打击, 追风, 重伤, 重力冲刺, 铠甲大师 |

### 3.3 Heroes (2 cards)

| Card | Classes (lines) | Content and inputs | Acceptance |
|---|---|---|---|
| `bp-hero-knight` | 12 (2 230): A:举盾, A:幻影斩, A:野蛮冲撞, A:血祭之力, A:瞄准射击 (钩锁), A:给英雄和物品附加效果 (蓄力击), A:给自身加主动 (talent → skill, both heroes), P:抓钩; 举盾, 幻影斩, 野蛮冲撞, 临时属性_预算（结束层销毁） | the Knight's 5 active talents (野蛮冲撞, 幻影斩, 血祭之力, 举盾, 钩锁) and the boss active 蓄力击; skill rows in 数据表_技能_默认; draft heroes-skills (Knight sections, HEROES-TV); the `skill.*` slot handlers on the turn gate; cross-card: 残影 (core-launch-sys) | HEROES-TV (Knight); each active castable with its cost and cooldown; forced talents run |
| `bp-hero-hunter` | 9 (2 366): P:箭矢 (the Hunter's 可控反蹬箭 and the item projectiles 射出箭矢 / 飞刀 / 分身弓), P:弹跳箭, A:弹跳连射, A:腾跃, A:投掷_地形区域 (自然之力), A:给物品附加效果 (打磨, 专注); 腾跃, 必定会心, 临时属性_不预算（结束层销毁） | the Hunter's 5 actives (弹跳连射, 腾跃, 打磨, 专注, 自然之力); draft heroes-skills (Hunter), ability-framework §4.K; cross-card: 筑墙地形 (enemy-elites), 临时弹性 (bp-items-1) | HEROES-TV (Hunter); a full Hunter run `npm run bot -- --hero 灵魂猎手 --runs 200` without crash or softlock |

### 3.4 Enemies and the boss (4 cards)

| Card | Classes (lines) | Rows and inputs | Acceptance |
|---|---|---|---|
| `enemy-eyeball-ghost` | 10 (1 705): A:融合弹射, A:投射, A:闪现, P:齐刘海飞弹; 反弹时融合, 眼球抛出, 眼球包打开, 黏菌逃跑, 幽魂池, 死亡创建地形 | 眼球_融合, 眼球包 (困难 [0]), 新手关眼球包2 (prologue floor 7), 盗宝黏菌 (传奇房 × 3, flees), 齐刘海 (简单 / 普通 [4]: 射击, 闪现, 死亡); drafts enemies-eyeball-slime, boss-puppet-dragon §齐刘海 only | the drafts' vectors; forced enemies; 传奇房 completes; the 齐刘海 variants run |
| `enemy-crystal-brain` | 9 (1 384): A:八面散射, A:电场, A:召唤, A:给自身附加效果, P:晶刺; 反击状态, 反弹创建地形, 死亡创建尖刺, 电网 | 结晶, 结晶簇, 水母脑, 章鱼脑 (召唤水母脑), 大肠团 (反弹酸液); drafts enemies-crystal-brain (ECB-TV ×38), enemies-intestine (大肠团; ENEMIE-TV); cross-card: 力场 → 偏转力场 (enemy-elites) | ECB-TV ×38; ENEMIE-TV for 大肠团; forced enemies |
| `enemy-elites` | 6 (1 221): 偏转力场, 吸血, 地裂, 地裂伤害, 筑墙, 筑墙地形 | the 5 elite affixes 力场, 吸血, 地裂, 筑墙, 强韧 (强韧 uses 蓝图_能力_基于当前参数加算属性, ported by core-talents); the 精英战斗 tile and the 4 战斗房_困难 variants; draft enemy-ai-intents §elites and growth; PROTOTYPE_SCOPE §5.4 | EAI-TV elite and growth vectors end to end; no elites on floors ≤ 3; caps 1 / 2; growth at floors 1 / 6 / 12 for all 14 rows |
| `boss-gatekeeper` | 9 (2 385): A:守门人_重锤, _连环重锤, _熔岩道, _撕咬搜寻, _目视; 连环重锤, 飞跃重击, 首领_守门人 (phase 2), 岩浆地板 | 守门人 (战斗房_首领 [0], floor 12) with 肉弹战车 (core-ai), the rotation, phase 2 (二阶 skills), 目视 spawning 眼球; the boss room background (env-hazards owns the BP); draft boss-gatekeeper (BOSS-G-TV ×30) | BOSS-G-TV ×30; forced boss runs; the boss bar shows both phases |

### 3.5 Environment and rooms (2 cards)

| Card | Classes and blueprints (lines) | Content and inputs | Acceptance |
|---|---|---|---|
| `env-hazards` | 4 skill classes (1 131): pickup:可拾取物 (base), pickup:保护罩, pickup:加速点, pickup:尖刺; 17 decoration blueprints (1 616): 蓝图_装饰品 (base), 地刺 + 组件_地刺 + 地刺_0202 / 0301, 保护罩生成器 and 保护罩生成器+, 火盆, 罐子, 棺材A / B, 蜡烛堆, 地板图案0202 / 0301 / 0302, 首领背景A, 新手关02背景 | units.json `hazards-decorations`; spec turn-flow TURN-021 / 060 (decorations in the turn passes); `step0/rooms.txt` (which rooms place what) | spike damage and shield-generator vectors; rooms with 地刺 and the 齐刘海 variants with 保护罩生成器 run; every decoration placed by the room plan shows its placeholder kind |
| `core-room` | 效果_探索 (147) + 蓝图_房间 (916), 蓝图_房间格子 (945), 蓝图_动态网格 (155), 蓝图_出生点 (199), 空气墙, 死亡区 | the real room generator replacing RoomPlan v0: room cells, 计算房间长宽, auto-tiling (`获取拼接编号`, 数据表_瓷砖配置_矩形 18 pieces), 手动房间图 rooms, decoration placement (摆放装饰品, 创建装饰品池, 判断装饰品占位), spawn points, fog (迷雾处理 / 迷雾展开, 探索房's task); owns `src/core/sys/room/**` and `src/game/room/**`; units.json `room-generation` | golden JSON for the 18 live layouts / 24 variants × 3 seeds; fog in 探索房; invariants (5 × 7, valid spawns, decorations never block spawns) |

### 3.6 Systems without a draft (5 vertical cards)

| Card | Classes and blueprints (lines) | Content | Inputs | Acceptance |
|---|---|---|---|---|
| `sys-shop-events` | 10 (969): R:修改英雄和物品属性, R:感知精核经验, R:随机增精, R:随机生命, R:额外经验, A:事件抉择, A:升级所有物品, A:给英雄附加效果, A:修改玩家属性, A:祝福奖励; + 蓝图_商店 (116), 蓝图_货架 (112), 蓝图_装饰品_地铺 (275) | the 抉择房 merchant (商人 row; one shelf per reward parameter; shelf level = index + 1, price = parameter; one purchase ends the task) with 获取兽肉 / 获取锻造 / 获取兑换 / 获取标签 and the prologue shop 获取锻造_新手关; module `shop` (交互到商人, 交互到商品); the price tag page (UI_商品价格); 祝福之灵 → 抉择_01–07 and their sub-rewards; the 终结抉择 options (trigger in core-stamina); the rest point 地铺 (恢复点 tile) | units.json `shop-events`; PROTOTYPE_SCOPE §5.3, §7.5, §10.1, §10.2; pseudo GM L2424, SHOP L15, SHELF L73 / L155 / L799, 地铺 ln 174–267; `step0/rewards.txt`; cross-card: hammers and vouchers (sys-craft) | prices, one buy, task end; each event option applies its reward; 终结抉择 at the first full Corruption; 地铺 restores HP and Stamina and removes negative mental states; 抉择房 and 恢复点 playable |
| `sys-craft` | 3 (607): A:锻造锤_品质, A:锻造锤_标签 (options 锻造锤_武器 / 工具 / 饰品 via 事件抉择), A:兑换物品; + 蓝图_装饰品_铁砧 (244) | module `craft` (WAVE_A W2): materials (矿石, 灌草, 灵魂宝珠, 奇异之尘), 161 recipes (8 `不需解锁`, incl. 晶核剑, 晶核盾, 贪婪手套), recipes learned on first obtain ("习得配方：…"), the craft page (UI_制造页 logic → core) and materials page (UI_材料库, 材料格, 制作需求条, 制造列表格, 合成点, 合成进度), merge (quality up at 2 / 4 / 8 / 16, creates 祝福之灵), dismantle (奇异之尘, score +5), hammers and vouchers, the anvil and the 锻造房 condition (≥ 1 craftable recipe, 精核 > 4) | units.json `crafting`, `ui-craft-page`; `screens/layout/{craft_page,craft_quantity}.json`; PROTOTYPE_SCOPE §8, §10.4; pseudo 修炼系统 合成牌 ln 1063–1140, 分解牌 ln 1161, 解锁配方判断 ln 274, UI_制造页 L610, L1894–L2970 | recipe vectors (materials only, with an item); merge thresholds and 祝福之灵; dismantle yields; hammer and voucher effects; 锻造房 offered when its condition holds; page shots |
| `sys-enchant` | 3 (332): 附魔修改自身属性, 附魔修改英雄属性, 附魔悬停物品 | module `enchant`: 11 stones + 6 legendary, slots by item size, apply (drag a stone; score +5), replace (UI_附魔替换页 / 附魔替换按钮 = the `enchantReplace` modal), the offer enchant chance (获取物品 parameter 6: 0.25; 初始奖励B: 1.0), the 31 rows of 数据表_技能_附魔 at every quality | units.json `enchantments`, `ui-enchant-replace` | apply / replace vectors per slot count; each of the 31 rows' text and effect; 初始奖励B always enchanted |
| `sys-camp-meta` | 2 (210): A:破损的神像, A:神像; + 蓝图_永恒之盒 (317), 蓝图_营地格 (350), 蓝图_装饰品_关卡选择 (134), 蓝图_装饰品_主界面 (17), 蓝图_传送门 (Demo path only) | module `camp`: the camp menu scene (a camp cell starts the run via 传送阵.DEMO出发), the chapter hub with the Eternal Statue (破损的神像 → 已解锁机制; the stash = 仓库页 / 仓库格, page type 4; items persist across runs), the camp quest bar (序幕 while 新手关中, else 凝视深渊 "通过第{0}/60层"), persistence of 已解锁配方 / 已解锁机制 | units.json `camp-statue-quests`, `ui-statue-stash`, `ui-camp-menus`; `screens/layout/{statue_room,statue_stash}.json`; PROTOTYPE_SCOPE §10.3, §10.7, §10.8 | statue unlocked after the first boss kill; a stashed item survives two runs; quest bar texts |
| `sys-tutorial` | 3 (566): R:复合奖励_新手关, R:解锁任务 (获取物品_轮回奖励), 获取轮回宝藏 | module `tutorial`: the prologue end to end (rows from core-map, rooms 新手关01 / 02 / 04 / 05 / 07, the fixed rewards and drops, 150 EXP → the first level-up, the prologue shop, floor 7 新手关眼球包2, 序幕 complete → 接受指引 +500 and 获取物品_轮回奖励, 营地 → 完成探险 +1000 → run end → 正常冒险 → 新的冒险 visible); the 13 tips (数据表_词条_新手提示, UI_新手提示, the 13 trigger sites, 已触发新手提示; the tip videos become placeholder stills, no media shipped) | units.json `tutorial-flow`; PROTOTYPE_SCOPE §4, §10.9; `D:/TAPTAPGAME_ref/screens/frames/tut*`; cross-card: 新手关眼球包2 (enemy-eyeball-ghost), prologue shop (sys-shop-events), 手动房间图 (core-room) | the bot plays the prologue (`--chapter 新手关`) to the end and unlocks 新的冒险; each tip fires once at its site |

### 3.7 UI (2 cards)

| Card | Pages | Inputs | Acceptance |
|---|---|---|---|
| `ui-pages-b` | settings (UI_设置页面, UI_语言按钮: scalability, VSync, 60 fps cap, zh-Hans / en from the OS, `默认游戏设置`), combat log (UI_战斗日志, UI_日志词条), talent page (UI_天赋页, UI_天赋池条目, UI_查看天赋格; progress stages 2 / 6 / 11 / 16 / 23 / 33), mental-state views (UI_查看精神格, UI_精神池条目), cast bar (UI_被交互条), intent and weak-point tips (UI_意图提示, UI_弱点提示) | units.json `ui-settings`, `ui-talent-pick`, `ui-combat-hud`; `screens/layout/intent_tooltip.json` | layout tests, shots looked at |
| `ui-codex` | codex (UI_图鉴页, UI_物品图鉴, page type 5, lock states from 已解锁配方), encyclopedia (UI_百科页, UI_百科列表格, data 合成数据表_百科), opened from the backpack bar | units.json `codex-achievements` (achievements: confirm dead, report) | pages render real data; lock states follow the meta save |

---

## 4. Round B2 (after B1 merges)

| Card | Scope | Acceptance |
|---|---|---|
| `sys-save` | the full save: every `EMS_基础存档` field; actor SaveGame data (`保存英雄信息` at phases 8 / 9, `保存主动技能`, `保存天赋`, `保存精神状态`, `保存持续伤害`, `读取天赋存档`, `读取能力效果存档`); cards (`结构_存档_仓库物品`), map tiles, RNG states; quit and reload inside a room with the resume prompt (回忆; 遗忘 → `重置房间？` = true and "遗忘痛苦的回忆···"); reset room; save and quit; browser storage (a new `src/game/storage.ts`, delegated to this card) | save → load at every phase of 100 bot runs gives identical digests; the resume prompt flows; SCM-010 / 036 snapshot semantics |
| `verify-items-1` | 通用 in-scope rows 1–43 (table order) | per item and quality (Bronze…): tooltip = the Demo string with the right numbers; skills attach; conditions and positions pick the right cards; one behaviour vector; forced runs |
| `verify-items-2` | 通用 rows 44–85 | as above |
| `verify-items-3` | 专属_幽冥骑士 26 + 专属_灵魂猎手 27 | as above |
| `verify-items-4` | 专属_恶疫旅人 17 + 专属_元素祭司 17 (offered to both heroes by the all-hero flag) | as above |
| `verify-talents-1` | 新新通用 29 + the 8 遗迹 boss talents; the offer rules (level-up 3 / 1 reroll, 唯一 timing, 初始奖励C, boss pick, 抉择_06, 无字书); 天赋上限; ≤ 5 actives; the prerequisite and `Tests` quirks | every row at each level up to 天赋上限: text, effect, offers |
| `verify-talents-2` | 专属 56: Knight 19 (5 actives, 4 唯一), Hunter 21 (5 actives, 4 唯一), untagged 16 | as above |
| `parity-stats` | bot distributions against the Demo-derived expectations: tile frequencies per floor (core-map's histogram), fights per run, **session length** (sim time + modelled think time) for prologue + run and for a run alone (the evidence for decision D2's 30-minute question), drop-pool rates, elite rates and caps, growth at floors 1 / 6 / 12, gauge and rating distributions, EXP and levels per run, score and exploration level per run (Hunter after ≈ prologue + 2 won runs), the 精核 economy | a report with every metric, its Demo expectation and the deviation; alarms over 15 % filed |
| `coverage-1` | items and enchantments: forced runs until every in-scope item class is hit | stubs hit = 0 for its classes |
| `coverage-2` | talents, enemies, the boss, props, rewards, environment | stubs hit = 0; unported facade calls = 0 (the rest goes to `bp-fix-*`) |
| `ui-layout` | every page's numbers against `widgets.ts` (rects, fonts, alignment, order), not art | a parity table per page |
| `bp-fix-<module>` | one card per facade module that collected `needs` in B1, B2 and G2's unported-call list (≤ 3 h each, the module's own paths) | the reporting cards' tests pass |

The B2 item and talent verification cards own, after B1 merges, the effect modules their rows use first (mapping from
`classes.ts` rows); cross-group fixes go under `needs`.

**Wave C** (plan v4) then reruns parity-stats on 1000 runs for the consistency comparison, uses the coverage cards' final
report as the full-content proof, runs the producer's fix round and presents G3.

---

## 5. Coverage matrix: every in-scope system of PROTOTYPE_SCOPE §12

| System (§12) | Wave A | Wave B |
|---|---|---|
| Front end: menu, hero select, quest bar, loading texts, run-end page with the Demo text | core-run, ui-pages, game-shell | sys-camp-meta (quest bar), sys-tutorial (序幕 gating), ui-pages-b (settings) |
| Save / resume: tile save, resume prompt, pause dialog | core-map (tile rows), core-run (save v0, prompts), core-turn (room reset), ui-pages (warning dialog) | sys-save |
| Heroes: 2, Hunter at exploration level 4, 10 active talents | core-launch-sys (可控挥击, melee and ranged contacts, 挥击), core-stamina (玩家被动), core-run (select, unlock) | bp-hero-knight, bp-hero-hunter |
| Chapters: 新手关, 遗迹 | core-map | sys-tutorial |
| Map tiles: 14 + 7 | core-map (all rules), core-rewards (tile rewards) | sys-shop-events (抉择房, 恢复点), sys-craft (锻造房), enemy-eyeball-ghost (传奇房), enemy-elites (精英战斗), core-room (探索房 fog) |
| Room layouts: 18 rows / 24 variants | core-map (RoomPlan v0) | core-room |
| Room tasks (6) and run quests | core-turn (BP_Mission + 5 goals) | sys-tutorial (序幕), sys-camp-meta (quest bar) |
| Enemies: 14 rows, 31 skills, 5 affixes, the boss | core-ai (眼球, 大肠, 大肠血卵, 肉弹战车, AI, growth, elite rolls), core-physics | enemy-eyeball-ghost, enemy-crystal-brain, enemy-elites, boss-gatekeeper |
| Combat: launch, turn flow, damage, statuses, rating, charge / infuse / echo | core-launch-sys, core-turn, core-damage, core-status-rating, core-stamina, core-ability (echo settlements) | verify-* |
| Map rewards (≈ 35 rows) | core-rewards (初始奖励A / B, 复合奖励, chest and attribute offers, 获取精矿, 探索房 boxes, 精核矿), core-talents (初始奖励C) | sys-shop-events (shop offers, 地铺), sys-craft (铁砧), sys-tutorial (prologue rewards) |
| Events: 抉择_01–07, 终结抉择 | core-stamina (终级抉择 trigger) | sys-shop-events |
| Props (13) | core-rewards (任务宝箱, 任务祭坛, 交互宝箱_附魔 / 废品, 精核矿) | sys-shop-events (商人, 远古兽肉), sys-craft (锻造锤 × 3, 兑换卷 × 3) |
| Decorations (15) | core-map (listed in the plan), game-shell (placeholder kinds) | env-hazards, sys-shop-events (地铺), sys-craft (铁砧), core-room (placement) |
| Items (172) | core-launch-sys, core-inventory (the G2 items) | bp-items-1…6, sys-enchant, verify-items-1…4 |
| Loot: pools, item box, quality, price, sell value, reroll | core-rewards, core-inventory (price) | parity-stats |
| Talents (93) | core-talents (offers, level-up, 唯一, boss pick, 16 general talents) | bp-talents-1…3, bp-hero-*, verify-talents-1…2 |
| Economy: 精核, 感知, EXP, levels, locked cells, materials | core-rewards, core-talents, core-inventory | sys-craft (materials use), parity-stats |
| Inventory | core-inventory | — |
| Crafting: 161 recipes, merge, dismantle, forge, vouchers | (stubs) | sys-craft |
| Stamina / Corruption / mental (4 + Flowstate) | core-stamina | — |
| Meta: score, exploration level, Hunter unlock, recipes, Eternal Statue | core-run | sys-camp-meta, sys-save |
| Tutorial: 7 floors, 13 tips | core-map (prologue rows) | sys-tutorial |
| Codex: 图鉴, 百科, talent page | — | ui-codex, ui-pages-b |
| Presentation: popups, shakes, hit-stop, flashes, cues | game-shell (cue table, `fx` events), core-sim (bus) | every porting card emits `this.fx`; the parked feel branches plug into the cue table after G3 |

---

## 6. Dependencies inside B1

All parents are in wave A or in the same card, so every B1 card can start together. The only joins between B1 cards are
runtime spawns through the registry, tested with stubs and proven by the train's forced runs:

| Caller (card) | Callee (card) |
|---|---|
| 章鱼脑 力场 (enemy-crystal-brain) | 偏转力场 (enemy-elites) |
| 自然之力 (bp-hero-hunter) | 筑墙地形 (enemy-elites), 临时弹性 (bp-items-1) |
| 恶臭长裤 (bp-talents-2), 铠甲大师 (bp-talents-3) | P:毒气, P:剑气 (bp-items-4) |
| shop shelves (sys-shop-events) | 锻造锤_品质, 锻造锤_标签, 兑换物品 (sys-craft) |
| merge creating 祝福之灵 (sys-craft) | 祝福奖励 → events (sys-shop-events) |
| prologue (sys-tutorial) | 新手关眼球包2 (enemy-eyeball-ghost), prologue shop (sys-shop-events), 手动房间图 (core-room) |
| 幻影斩 (bp-hero-knight) | 残影 (core-launch-sys, wave A) |

## 7. Scheduling and budget

- B1 launches all 24 cards at once after the G2 approval. At about 0.4 M tokens per agent-hour, B1 is about 30 M tokens
  plus reviews; if the daily cap (≈ $1500) is near, split it: **B1a** (bp-items-1…6, bp-talents-1…3, bp-hero-knight,
  bp-hero-hunter, boss-gatekeeper) and **B1b** (the 3 enemy cards, env-hazards, core-room, the 5 system cards, ui-pages-b,
  ui-codex) on consecutive UTC days.
- Merge trains every 2–3 hours as cards pass review; B1 cards merge in any order. The merge and train gates are
  WAVE_A.md §6, with `--filter all` and the coverage report compared train to train (a drop is an alarm).
- B2 starts when B1 is merged; `bp-fix-*` cards are created from the collected `needs` and run alongside.
- The daily build (plan v4 §5) is published after each B train; the bot GIF uses `?scene=game-loop&bot=scripted`.

## 8. Numbers and how they were produced

- In scope: 349 classes / 53 555 lines (`step0/scripts/plan_scope.py` → `scoped_classes.json`); wave A 98 / 16 524; wave B
  251 / 37 031 (`plan_owners.py` → `owners.json`, which asserts one owner per class).
- Item and talent batches: contiguous code-point ranges of `效果/物品` (109 classes after the wave-A claims and the three
  enchant classes) and `效果/天赋` (51), balanced by pseudo-lines into 6 and 3 cards (2.27–2.53 K lines each), then the
  extras whose only users are in that range.
- Environment line counts: `wc -l` of the live pseudo files under `BP/环境/` and `BP/蓝图_出生点.txt`.
