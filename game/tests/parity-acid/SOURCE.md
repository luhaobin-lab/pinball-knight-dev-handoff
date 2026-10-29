# Acid runtime recovery target

Base `7ec86ea`; source is the copied Demo, not the original installation. No rule/number changes, no external art, no RoomStage ownership overlap.

Source files:

- `dump/blueprints-pseudo/CatapultHero/BP/Skill/效果/敌人/蓝图_效果_酸液池.txt`, L1651, L2116/L3041, L861/L626/L15, L1758 and L3530/L3258.
- Its raw `PaperSprite_GEN_VARIABLE` uses `T_White_sRGB_Sprite`: QueryOnly, Pawn=Overlap, every other listed channel ignored, CCD true, local position Z8, scale(.5,1,.5), Roll90.
- `dump/raw/Game/CatapultHero/精灵片/_UI/T_White_sRGB_Sprite.json`: BodySetup box full size128×10×128. After transform: world half-extents32×32×5 at cell+Z8. This is distinct from the original radius20 initial-damage sphere query.
- `FX_地形07_SQ_Swpn`: four frames at10fps; `FX_地形07_SQ_Die`: six visible frames plus a final null frame at10fps. Original actor destruction delay is1s.
- `BP_Actor_Player.txt` L16870→L1591 (text949): activation sets 初始化完毕 after initial preview setup. The port had lost that flag while replacing the preview component; acid entry correctly retains its original initialization gate.

Implementation:

- All already-connected actual native follower, BP curve mover and physics solver segments reach `moveEffectOverlaps`; it now also evaluates acid PaperSprite overlaps. The helper splits each swept capsule/rounded-box test at the box planes and solves the active quadratic intervals, so a fast outside→outside crossing is not skipped. The vertical capsule core and source Z offset are included.
- Initial inactive overlaps are recorded at source effect activation and remain recorded when the damage gate opens. The source initial radius20 damage trace still executes once; simply remaining in a cell does not manufacture another BeginOverlap. Exit/reentry triggers again, subject to the existing entire-manager .5s damage gate.
- The handler itself still checks active state, source caster validity, enemy relation and initialized actor. No direct damage is duplicated in the geometry adapter.
- NoCollision/PhysicsOnly capsules are excluded from entry events; ordinary capsule geometry and instance identity remain authoritative. The core retains ideal query geometry rather than claiming exact Chaos tolerances.
- The initial radius20 world query also requires the separately reviewed NoCollision filter (`bf7b717`, local cherry-pick `d3817c1`). Its direct acid regression proves a disabled player is not hit at activation, then takes DoT on an enabled real reentry. The player readiness prerequisite is isolated in `e082a2f`.
- Source callbacks set `ug_visual` state/time only: hidden→spawning after .35+.1×group index, active after .4, closing on destruction. Read-only projection neither advances callbacks nor draws randomness. The existing toon material and fungal ramps render the same source cell centres, with six visible death frames before the null frame.

Acceptance:

- Real table skill/group/effect modules: spawning, initial hit, entry/stay/exit/reentry, shared rate limit across cells, disabled/profile/team gates, rounded box corners, height separation, outside→outside sweep.
- Actual BP mover, native launch follower and regular physics motion cause real DoT. Repeated view/preview is pure; full digest agrees across frame and uneven advancement.
- Natural ordinary-browser intestine route captures actual source spawn/active/closing states. These screenshots are separate from the exact-geometry controlled boundary tests.

Remaining boundaries: original-engine Chaos contact epsilon and Paper2D query precision need reference-runtime measurement; an asset's appearance is a procedural reskin, not a decoded sprite. Electric-orb effect bodies are a separate owner/card. No claim of complete Demo parity follows from this card.
