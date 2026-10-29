# Consumed card returned to its old slot: source dispatch repair

Natural browser seed5 on `e543f13` used 粘稠体液 id687 at command46. By command57 the public view excluded it as dead,
but equipment cell6 and the equipment list still referenced it; moving id808 into the visually free cell failed.
The original command/time prefix is preserved verbatim in fixtures/seed5-used-card.json with source path/SHA.

The cooked raw Blueprint resolves the ambiguous readable pseudocode:
`reference/dump/raw/Game/CatapultHero/BP/Actor/BP_Actor_Card.json`, ExecuteUbergraph:

- 36882 marks dead, 36893 virtual 关闭碰撞,36907 **EX_LocalVirtualFunction 被抓起**: the child grab disables its
  PaperSprite query at L31495, dispatches unequip, then updates the grid.
- Source removes equipment/backpack/offer list entries, queues delayed destruction.
- 37266 is **EX_LocalFinalFunction Function'BP_ManeActor_C:被放下'**. The parent only resets 被抓起 and
  游戏模式.当前抓住卡牌=None (`BP_ManeActor.txt:4938`). It does not invoke the child's placement/equipment path.
- The old port called `self.被放下(true)` virtually, dispatching the child Card path L8294, which enables query and
  re-equips the dead item. It also represented sprite query state only by 被抓起, so simply restoring the parent
  call still allowed a later grid refresh to see the pending-destruction card.

Fix: explicit parent facade call; retain source PaperSprite query state from grab(false)/actual child placeBack(true)
in `ug_cardQueryEnabled`; grid traces honor that state. Parent drop does not enable it. No broad invalid/dead filtering,
no bot retry, no change to player swaps/rearrangement, no early destruction or deleted death effects.
Tests prove actual item use frees the cell while delayed destruction remains queued, and the exact captured58-command
prefix now accepts command57. Old source lifecycle and inventory/damage regressions remain enabled.
