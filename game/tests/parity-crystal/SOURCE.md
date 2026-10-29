# enemy-crystal-brain source acceptance

Target: WAVE_B enemy-crystal-brain's exact nine classes plus source-required caltrop Box, circle-ring terrain query,
and readable electric links/caltrops. Blueprint authority is
`D:/TAPTAPGAME_codex/reference/dump/blueprints-pseudo/CatapultHero/`; the draft
`spec-drafts/enemies-crystal-brain.md` is a search index, not authority when its prose conflicts with raw/source.
No whitelist expansion, invented rule values, injected damage, source installation edits, or new assets/dependencies.
Visual standard remains ART_BIBLE and golden combat/aim frames.

| Exact class | Source branch and preserved behavior | Evidence |
|---|---|---|
| Ability/敌人/八面散射 | L2469 six directions despite name; .2s windup, .3s combo, direct base damage rather than misleading P0 multiplier | source-runtime volley/AI |
| Ability/敌人/电场 | selected fixed source circle384; actual player-only electric hit P0×base | source-runtime blast/AI |
| Ability/召唤 | L964 persistent candidate array; circle5+7,8 rays each; source raw enemy-count<=3; 2 no-reward brains | source-runtime summon/AI |
| Ability/给自身附加效果 | P3 selection auto-cast; attach real effects and end action; effect owns release | source-runtime counter/AI |
| 效果/敌人/反击状态 | first-turn1.5arm, actual collision tag/opponent gate, expiry/death release; .8 slot playback with raw .4 timer return | source-runtime counter; ANIMATION-SOURCE |
| 效果/敌人/死亡创建尖刺 | death trigger; source repeated random loop bounds and real pickup bodies | shared BOX-SOURCE; browser controlled death |
| 效果/敌人/电网 | .05 source tick; turn2+ Pawn profile all initial overlaps; <=3 tagged conductors; actual line damage, .5 cooldown,2 budget | source-runtime net; trace-boundary |
| 效果/敌人/反弹创建地形 | source bounce creates a real source terrain manager and acid cells | source-runtime intestine |
| 发射物/晶刺 | source immediate bleed-labelled attack, not DoT; stop creates max1 caltrop with repeated RNG draw bounds | source-runtime projectile/volley |

Net quirks remain: cooldown is decremented and then another dt is used for the strict-negative gate; the per-link
loop does not re-check cooldown or budget after a hit; explicit empty 销毁效果 is preserved. Links and damage use
the real object positions and actual source profile query, including non-ManeActor tagged query bodies. The future
charged-tower environmental component must supply its real query shape; this card does not invent one.

Circle ring follows 函数库_技能 `选取范围地形格_圆形环` line972: truncated degree step, radius*64, legal-cell query with
radius16, source clipping/avoid gate before AddUnique. No replacement room geometry or arbitrary spawn coordinates.

Five actual enemy rows initialize all fixed classes without a stub. For each, the real `预测AI行动`→`执行AI行动` queue
casts an ability and reaches a subsequent player decision. This is a controlled source boundary; natural map variant
admission still waits for the remaining environment dependencies. Body/native, snapshot and visual limits are kept
in BOX-SOURCE and the evidence report, rather than presenting component coverage as full-game parity.
