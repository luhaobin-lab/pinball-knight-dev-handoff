# Source event and blessing slice

Root card control/parity-shop-events-root-card.json. Ten Blueprint classes are restored in the existing sys-shop-events
batch; merchant/shelves/rest point and natural shop admission remain separate work. Ordinary item/talent pool is not
expanded here. Existing procedural multi-choice/loot UI is used; no shipped reference assets.

Sources under reference/dump/blueprints-pseudo/CatapultHero/BP/Skill/Ability:

- 奖励/事件抉择 L725/L877: ordinary wait1.2s, final choice or phase12(进入商店) immediate. Collect nonempty unique
  parameter strings into the persistent pool, open event choice (3,count1,level-1) then finish. UI has its own .2s delay.
- 道具/祝福奖励 L1890/L751/L1449/L491: crafting checks actual acquisition of loose cards; otherwise no enemies and
  box closed. Execution closes box/page, source reward-table enumeration with 抉择事件 tag, one meta Array_Random,
  collect chosen group's option strings, finish then offer all event options at owner quality-1 with0refresh. Persistent
  arrays and unused 已触发 field retained. Page return value ignored as source; active craft closes via reviewed module.
- 随机增精: truncate p0/p1 then inclusive meta integer draw; 普通随机生命 scales hero configuration stat (not modified
  current max) by one meta float draw, writes permanent additive value and refreshes actor. RNG domain mapping is
  existing CORE-M-129 rows45/46/61; global originalstream interleaving remains a separate gap.
- 感知精核经验 L36: p1 coins/truncate then p2 EXP, owner context. 额外经验 L10 stores global经验修正% from p0,
  while L286's description picks p[level-1] from0/1/2. This source discrepancy is preserved.
- 修改英雄和物品属性 L15/L518/L1450: hero raw stat*p0 additive, optional filtered-card p1 additive/update/finish,
  then positive truncated p2 coins. Empty p1key skips the finish branch, not silently corrected.
- 升级所有物品 L15/672: space0 is equipped cards only, quality<=2 becomes3, upgrade(false,true). No eligible cards
  gives source head-up; execution still finishes, while 检查子条件 itself is empty.
- 道具/修改玩家属性 L31 uses p0 permanent addition and 更新最大生命魔力 specifically, selected owner target.
- 玩家/给英雄附加效果 L2756: original poseindex5, apply every configured effect with heroowner/originalreleaser and
  original item/talent tags, activation then fixed.5finish independent of animation completion. Existing exact helper
  preserves unique-effect refresh branch and descriptor initialization's empty-name argument.

Tests use composed real game and every explicit option of all7 source 抉择_01–07 groups; each actual modal pick invokes
its implemented reward. Item rewards proceed into real loot with actual card acquisition. Additional cases verify final
and shop immediate timing, actual祝福之灵 item.use, source random counts/base stats, equipment-only upgrade, source
EXP text/effect mismatch, and empty item-key flow branch. This is component/real-core evidence; ordinary mouse visual
proof and natural blessing route are not implied by the test count. First failed test incorrectly expected all event
outcomes to close every modal; source item rewards legitimately open loot, now asserted and actually collected.
