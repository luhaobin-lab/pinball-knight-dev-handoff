# Source caltrop component

`reference/dump/raw/Game/CatapultHero/BP/Skill/效果/可拾取物/蓝图_可拾取物_尖刺.json` Box_GEN_VARIABLE:
BoxExtent(8,8,16), mass override0.5, QueryAndPhysics, CCD, locked Z translation/all rotations, object Vehicle;
Pawn/Destructible/物品 overlap, Camera/PhysicsBody/Vehicle/Visibility ignore, other responses inherit Block.
The source default physical material is restitution1/friction.4.

The source does not override damping. The same installed executable's PrimitiveComponent constructor initializes
BodyInstance at +0x388; the BodyInstance ctor writes float32(.01) to LinearDamping at +0xa8. Executable hash and
disassembly are in `studio/logs/parity-enemy-crystal-brain/body-native/{manifest.json,bodyinstance-ctor.asm}`.

The pickup stays a GameplayTagActor rather than a ManeActor. L35 chooses one of two sprites and enables its gameplay
overlap after .3s. An actual BeginOverlap with Player or 死亡区 subtracts exactly1 stamina and destroys it. Arming
while already overlapping does not synthesize a second BeginOverlap. Actual player move segments and moving boxes
share this entry/exit state. Query projection is square; walls and circular pillars use square Minkowski geometry.
An electric effect sphere sees the pickup's Vehicle type, preserving its source overlap response.

The source scatter macro re-evaluates RandomIntegerInRange(0,max) both before entering and on each loop condition.
Each spawn consumes its sprite RandomBool before random rotation. This binary's RandomRotator(false) consumes yaw
then pitch, using float32(k * float32(360/32767)); no roll draw. Native proof is `body-native/random-rotator.json`.

Boundaries explicitly retained: the planar solver uses the existing restitution/friction and bounded floor-friction
approximation. Exact Chaos floor contact/sleep/constraint order remains unmeasured. The source Box template's local
Z16 versus SpawnActor's root-transform override has no original runtime measurement; current object position is
treated as component centre consistently with the existing source body adapters. This is not exact 3D/Chaos parity.
Death-zone actor geometry is a pending environment dependency; the source handler is present, but this card only
claims real player segment entry. Caltrop save/read restoration remains in the full save-system lane.
