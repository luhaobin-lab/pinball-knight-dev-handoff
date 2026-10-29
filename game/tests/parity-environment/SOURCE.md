# Environment hazard source restoration

Target: WAVE_B env-hazards four pickups and seventeen environment classes. Existing pickup base/acceleration/caltrop
remain unchanged. The new shield and source decoration instances complete the missing room-array→turn-pass path.
Original reference files are read-only. ART_BIBLE/golden combat vocabulary remains the visual standard.

Sources under `reference/dump/blueprints-pseudo/CatapultHero/BP/`:

- 环境/装饰品/蓝图_装饰品: source ownership/occupancy only; exact subclass hierarchy retained.
- 蓝图_装饰品_地刺 L175/986/1191/2402 and 组件_地刺 L2664–2702: initial1s cooldown, overlap triggers,30%target
  maximum HP bleeding for3turns, .5s before sleep,3 new-round decoration passes before rearm. The computed growing
  `伤害` field is unused by the actual packet and remains unused. 精神系统(0,-3) is called but its source is empty.
- 0202 raw component BoxExtent64/64/64, offset0/0/64; base and0301 inherit32/96/64,offset32/32/64 and1x3 cells.
  The misleading0301 class does not override source1x3. Real capsule segments use rounded swept-box intersection;
  stationary presence does not synthesize new entry when cooldown expires or a spike rearms.
- 地刺 component cell offsets(-x*64,+y*64,x*.15)+(32,-32,1.2), outerX/innerY loops. Raw FX_地形03 flipbooks10fps:
  IdleA frame1; Swpn frame2×2 then3; Finish frame3×1,2×3,1×2,0×1. Rendering follows these phase boundaries.
- 保护罩生成器/生成器+ L4526: requested2/3, exact-effect-count<=0 gate, source 范围选取点(0,0,1000,201,count,true,200).
  Legal geometry can yield fewer than requested; no invented fallback positions. Created effects belong to hero,
  detach, move to selected point, attach to the generator and activate.
- 保护罩 L2281 is confirmed raw EX_LocalFinalFunction to the pickup parent's 激活后触发 (not recursion). It inherits
  pickup activation radius50; the separately enlarged ward Sphere160 Begin/End handlers are both empty. Pickup
  opens imported .5s growth timeline; positive incoming damage at2Ddistance<=160 adds immunity. Leaving does not
  remove the tag; source destruction does unless a separate 免疫状态 effect exists. Next-round .5s shrink exits the
  barrier, while inherited .75s destroy removes the actor. Do not fix this source quirk into a new area-state rule.
- Room-cell 摆放装饰品 L14979: source class, source placement, 来自房间, room attachment and 房间装饰品 AddUnique;
  existing `新回合触发时机` traverses this exact array. New instances preserve source fire-bowl/pot RNG draws.

Tests are explicit geometry/source boundaries plus a genuine title→newRun→hero→firstroom flow. They do not establish
all natural variants or exact Chaos/Niagara parity. The environment base and simple decorations have empty gameplay
graphs; their existing room-plan colliders and approved kit are reused, not replaced with invisible blockers.

Open scope: boss/tutorial authored child-airwall geometry and exact backdrop remain core-room work; class registration
alone does not close those. Main-menu camp decoration, charged tower, prologue, fog and full persistence belong to
their stated cards. The source shield bloom/mesh and exact visual/audio assets are procedural approximations.
