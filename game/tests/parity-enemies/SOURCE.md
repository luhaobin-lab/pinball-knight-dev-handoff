# Eyeball / ghost source card

Target: WAVE_B141, `tools/bp/owners.mjs:153–164` ten classes; copied Demo pseudo/data/raw only. Base0127402. No numerical balance, expanded global all-content filter, changed skin, or empty registration counts as acceptance.

## Source behavior

- 融合弹射 L2420/L2496/L2097: targets summoner current ground position, requires not-dead summoner, row effect uses the summoner as 释放者. 反弹时融合 only handles 结束移动后: phase3, living mother and planar distance <=mother width. Heals .8×offspring currentHP, removes child from field, adds graveyard, disables collision/hides without killing. Otherwise restores collision.800/0 imported curve mover; original action-end and delayed destruction retained.
- 眼球抛出 L4259/L5063: charge default1, accumulates actual lost HP, strict `>P0*maxHP`, resets to0 and throws one source眼球_融合. Source ring sampler256..512/64/8/avoidtrue/r16 then ArrayRandom; child sourcejump800/200 and turn barrier; actual maxHP=.8*P0*mothermaxHP, AP0. Source effect is not tagged创建时; its stored override is not a replacement for table stats.
- 眼球包打开 L1378/L2175: P0=2 hidden/NoCollision eyes are created in source death-before path. At.7s choose0..200/90 ring positions, reveal withAP100 and radial impulse10000/radius200. Birth delegate intentionally reads shared last-spawned Blueprint local (source ENEMIE-102): both callbacks affect last child, giving AP[100,0] after1.3s. Cancel uses the same callback; no speculative modern closure rewrite.
- 投射 L2659/L15: .3 delay from execute, actual target/owner ground-height transform, imported row speed2500/interval.2/duration-1; P0×base-stat. 齐刘海飞弹 base radius20, only Player receives physical projectile damage. Base projectile stop waits.5s before 特殊结算 ends enemy action; not immediate on damage. Trail/stop source asset names preserved.
- 闪现 L1309/L1053: collision disabled already at selection; shuffles currentRoom.walkable array even though selection later uses ring7; two imported.5s timelines, first completion teleports and reenablescollision, second ends action. Missing legal ring uses source ArrayRandom zero vector. Dissolve emits source state; exact ghost material response still needs shell mapping/reference.
- 死亡创建地形 L3355: actual death-before picks one96..128 point, updates source ability terrain origins, creates real manager even for dying owner. 幽魂池 uses filleddiamond imported config, activates afterindex*.1, immediate physical/environmental P0×stat through group.5s limiter, source2s destruction. Dead caster stays a valid object, so its ground persists as source permits.
- 黏菌逃跑 L107/L6003/L4914: gated .075 source tick, fleeing only when close<300 andspeed<3; exact8 normalized ray order and strict largest distance, impulse1000×row冲击力 through original weight helper. Before-hit .75 chance adds dodge and launches ifnotmoving. Turn7 imported1.6s escape removes/hides withoutdeath/drops and sets missionfailure. Cancel source callback is empty (known source hold quirk).

## Shared ground implementation

Ghost raw PaperSprite sha420b0311ee23d9522de3ed7526d3ae1153d0b5c336b181397c451777bcc2d6f7; Acid sha39a91dd74d72061a3f4199832db9e551488482b1ef0bcd49708f4caf29c9b38f. SourceSprite, BodyInstance responses, locationZ8, Roll90 and scale(.5,1,.5) are identical. Existing64×64×10 query-box adapter is reused by exact class path. No radius20 substitution. Pure readonly terrain projection and kit violet shader show this actual ground;2s visual fade is explicitly an approximate reskin of source particle cessation, not decoded Niagara parity.

## Scheduler integration

The source flee gate may remain pending after physics stops before its next.075tick. An empty-step clock process keeps only that actual gate alive; it makes no timing/RNG/gameplay decisions. Original ReceiveTick closes the gate and is still the sole settlement path. Initial rest and destroyed effect exit; frame/event digest agrees. No permanent weak effect is promoted globally and no timing constant is changed.

## Validation scope and remaining needs

Real composed modules verify all ten registrations, real HP/DoT, AI intent state, source cooldown/action completion, source child spawning and death order, flash/shuffle timeline, flee escape and cancellation, continuous pool entry, and full digest. Forced source scenes prove these rules; natural stage variants must be admitted only after shared presentation/roomdependencies review.

Remaining: exact original RNG/Chaos tolerances, slime ray miss HitResult (source U18; zero-vector engine default retained), source slime cancelled escape hold (SG07 retained), Ghost dissolve material and exact Niagara fade/particles/sound. 齐刘海 projectile renderer mapping belongs to pipeline. Ghost room variant4 also requires real shield-generator environment content before natural stage admission; do not bypass by globally switching allcontent.
