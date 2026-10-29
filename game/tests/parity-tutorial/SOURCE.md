# Tutorial source and evidence boundary

Target: WAVE_B sys-tutorial, the ordinary fresh Demo prologue and its tutorial widgets. Reference root is the readonly `D:/TAPTAPGAME_codex/reference/dump/`. Content, reward amounts and gates come from the original dump; ART_BIBLE governs generated art. No original file or asset is changed/shipped.

## Primary source

- `blueprints-pseudo/CatapultHero/BP/UI/UI_新手提示.txt`: 激活新手提示, L32/L949 and per-enum branches. Display records the tip immediately, replaces the existing tip, and does not pause simulation. Close-X removes the widget; 明白了 also clears widget input suppression.
- `widgets/CatapultHero/BP/UI/UI_新手提示.json` and raw blueprint: centered650×650window,600×400media slot. The UI uses half-size coordinates at960×540. Its demonstration images are generated static diagrams; original movies and their visual/timing equivalence are not restored or claimed.
- `blueprints-pseudo/CatapultHero/BP/UI/UI_传送阵.txt`: DEMO出发; the ordinary title sequence goes through this entry, not the legacy GM进入新手关 function.
- `blueprints-pseudo/CatapultHero/BP/Actor/蓝图_动作游戏模式.txt`: old room callback L14848/Delay0.55 and new-room cleanup; captured room generation prevents an old persistent-mode callback from replacing the newly selected prologue room. The duration is unchanged.
- `datatables/CatapultHero/数据表/地图/数据表_地图格.json` imported as `src/content/demo/data/数据表_地图格.ts`: seven map rows. Floors3/6 reuse fixed-location room新手关01; a repeated geometry key is not a skipped floor.
- `src/content/demo/data/数据表_技能_奖励.ts`: first150EXP; source floor5 bronze hammer4coins; floor6获取物品_新手关2 explicitly grants three旧盾; floor7灼热眼珠. Ordinary stage filtering permits only the three tutorial-specific item rows and 新手关眼球包2 while the actual source新手关中 flag is true.
- `blueprints-pseudo/CatapultHero/BP/Skill/Ability/奖励/蓝图_奖励_复合奖励_新手关.txt`: L898 Delay1→linkage70 copies all specified row names, opens a free box, uses its original random-quality flag, ends floor on close. L953–L2913 formats each description and calls 获取附魔标签 inside the source loop.
- `blueprints-pseudo/CatapultHero/BP/Skill/Ability/奖励/蓝图_奖励_解锁任务.txt`: L31 clears quest progress, marks current quest, SaveCustom, then releases. The save.persist presentation event reaches the existing Shell save callback immediately; it does not take a new live actor snapshot.
- `blueprints-pseudo/CatapultHero/BP/Skill/效果/玩家/蓝图_效果_获取轮回宝藏.txt`: L2007→L1261→L10 executes the reward immediately, re-enables interaction and destroys after1s. The unused timeline is not started by this live path.
- `blueprints-pseudo/CatapultHero/BP/Skill/效果/任务/蓝图_任务目标_新手关通关.txt`: actual completion records接受指引; source run-end records完成探险. Source score table gives500 and1000 respectively; real seven-floor regression checks each once before camp resets the active run statistics.

## Tip inventory and trigger evidence

The source enum contains15numeric entries, but the source table has13live rows. IDs4腐化增加 and7解锁潜能 have no live Demo row/caller, so no invented tutorial is added.

| ID | Source row | Actual trigger | Evidence |
|---|---|---|---|
|0|拾取物品|item box opens|ordinary seven-floor route|
|1|启动弹射|new round, floor2|ordinary route|
|2|充能说明|new round, floor2 round>1|ordinary route|
|3|进行附魔|item box, floor4|ordinary route|
|5|进行合成|new round/item box, floor6|ordinary route|
|6|英雄升级|actual hero level-up|ordinary first150EXP|
|8|前进地图|portal DE​MO出发 delay completion|ordinary title.prologue|
|9|敌人攻击|new round, floor2 round>2|ordinary route|
|10|使用物品|item box, floor2; source reduces HP above80%|ordinary route and boundary test|
|11|进行制作|actual empty-bottle acquisition|source acquisition boundary test; not guaranteed in seven floors|
|12|永恒之盒|actual camp stash-open|owned by separate camp component; its new hook must be integrated and checked with tutorial present|
|13|高品合成|normal manufacture page opens without from-item|actual page.open command boundary test|
|14|失败说明|actual Failure page with living hero|source panel boundary test; dead hero intentionally does not show it|

`entry.test.ts` uses actual createGame, unchanged source data, legal commands and normal simulation. Its seven-floor test buys the source hammer, takes rewards, reaches run-end and returns to a title with newRun unlocked. No HP/gold/RNG/room/content injection is used in that route. Separate `source-hooks.test.ts` cases explicitly construct acquisition/failure/unlock reward boundaries; they are not represented as natural random offers.

## Validation and known limits

`tools/parity/tutorial-browser.mjs` opens an ordinary fresh browser without skipPrologue or save injection. It uses actual mouse events for every gameplay command. A shared scripted policy is queried read-only for aim direction; the click is projected to an on-screen floor point. Fixed60Hz RAF is a repeatable test clock, not a performance result. The tool records all commands, failures, screenshots with hashes, commit/dirty state, build hash and owned-process cleanup. Failure receipts are retained.

The generic page stack still uses its existing0.15s fade rather than proof of every source widget curve. The video slot currently contains generated static diagrams. Detailed treasure presentation and unused overlap/timeline branches are not visually equivalent evidence. The final camp decoration is a separately reviewed dependency; pre-camp-integration coverage can show that class as a stub, which is explicitly allowed only at this component boundary, never called full Demo completion.

No new mechanics, numbers, assets or dependencies are proposed. Final independent root review and integrated camp/tip12 validation remain required; this component alone does not certify full original-game parity.
