# Gatekeeper recovery

Source base: copied Ricochet Abyss Demo dump under `D:/TAPTAPGAME_codex/reference/dump`; implementation starts at `ef84d32`.
Target: `spec-drafts/boss-gatekeeper.md`, WAVE_B `bp-boss-gatekeeper`, nine original blueprint classes and their real shared dependencies.
No number balancing, injected natural-run victories, G2 whitelist expansion, external assets or altered art direction.

## Slice 1

- `函数库/函数库_技能.txt:1059`: diamond rings iterate n=0..radius, x sign -/+, then y sign -/+; legal lookup before AddUnique. Zero range is one cell.
- `BP/Actor/BP_ManeActor.txt` L11698/L6922/L6966 and `BP/交互/技能指示.txt` creation L88–8708: fixed-terrain indication creates a manager and real terrain. Preview blocks are extra presentation. It must not call manager activation (that would duplicate creation). Type 6 close L3460/L3776 exits visual preview then immediately destroys the indicator; 1 s fade belongs only to type 2. Real cells are attached to the caster, independently of the indicator.
- `Skill/Ability/敌人/蓝图_能力_守门人_重锤.txt` L617/L963/L31: animation, .8 s, origin (-64,-32), diamond rings 0..6 from the imported row. Execution forwards active and closes indication; lava does not respond to active. Base ability interruption clears real terrain, whereas merely closing the indicator does not.
- `Skill/效果/敌人/蓝图_效果_岩浆地板.txt` L1812: 2 combat RNG draws retained even though they set light fields; ring*.1 warning delay, destruction delay ring*.1+1. L15 runs expiry branch before parent clears active. Expired cells L4055 wait ring*.1, deal single BoxTrace32 damage of P0×caster stat (source type4 = 爆炸), hold round barrier through .6 s FG. The raw spawn flipbook is 4/10 s, FG finish is 6/10 s. Active/NewDay handler itself does not damage.
- `Skill/效果/敌人/蓝图_效果_首领_守门人.txt` L2178: first death interrupts ability, phase2 tag, restores max HP, applies source immunity, resets AP/stamina. L1201 next NewDay increments its separate counter, begins 4 s imported Reborn animation, grants combo+1. Only completion removes barrier/immunity; source cancellation is empty. Second death passes through.

Validation: six source-boundary tests with actual composed systems, real table abilities, damage/death/terrain lifecycle; no system doubles. This is not natural complete-boss or visual parity evidence. Existing terrain, AI and generated facade tests also checked.

Remaining in slice 2: 熔岩道, 连环重锤 ability and dead legacy effect, 撕咬搜寻, 飞跃重击, 目视; shared public mover is a separately reviewed dependency. Full-seven-skill natural stage routing and runtime warning/area visuals must be integrated and compared before claiming full boss parity.

## Slice 2

- `熔岩道` L5562/L6213: choose player, motion/facing update, .8 s in phase1 or .3 s in phase2. L104 builds inclusive i=0..trunc(3D distance/192)+1 origins using planar normalized direction; centres 192 apart and first centre 64 ahead of (-64,-28) actor offset. L4332 creates filled squares radius1/2 with two-turn lava. Execute itself ends immediately.
- `连环重锤` ability L8624 chooses a real free point among six; L8153 adds immunity and the source collision-damage effect, activated twice, with turns0 overriding its 2 s duration. Three iterations: original mover speed2000/height0, wait its exact duration, .3 s to create independently managed rings0..random3–5, then .3 s to the next iteration. Random shape selection still draws on a single-element list; cell light draws remain ordered before next-target draws. Ability never instantiates the similarly named legacy effect.
- The legacy `连环重锤` effect's entire Ubergraph is identical to `肉弹战车` after class-name normalization except for its latent UUID. The implementation reuses it and adds the separately declared, uncalled rectangle-terrain helper. This does not change the manifest's actual parent or runtime reachability.
- `撕咬搜寻` L3715/L95: phase2 only, source target acquisition and fixed-area radius P1, unique leap effect. Uncalled InterpToMovement experiment is not substituted for the reachable implementation.
- `飞跃重击` L2795/L1783: parent jump mover speed1500/height300/curve 飞跃重击, source sphere radius height*1.4, landing impulse50000/radiusP1, P0×base-stat physical damage. Landing uses the actual live target state; motion updates may follow an eye/player displacement. No hardcoded boss damage/HP or altered friction.
- Its raw inherited Sphere component is QueryOnly, Pawn=Overlap, other listed channels ignored. The narrow physics adapter sweeps actual movement segments against the player's upright capsule, records begin/exit state on the effect for digest, dispatches once per entry, and ignores disabled/PhysicsOnly player capsules. SetSphereRadius(updateOverlaps=true) dispatches initial overlap. Source impulse10000 is multiplied by the existing weight helper's 初始冲量. BP mover, native hero follower, and physics solver each supply actual segments; no preview queries call this adapter.
- `目视` L3923 builds five unsnapped midpoint positions rotated −40,−20,0,20,40 degrees and checks terrain legality with avoid-actors/radius16. Requires >=3 positions, phase2, unfinished mission, raw enemy-array count<=2. L2110 summons one real eye at each point, selects its first skill without chanting, and queues action. Boss execution ends on its imported animation completion; cancel is empty in source.
- Phase-change followup restores the actual three animation sequence fields (Idle02/Die/Attack02), so subsequent attacks use the new source sequence, not just a UI event.

Dependencies: mover `03f1c5b` is staged here byte-identically as `b460cd3`; pure query-profile utility from `7c112df` is staged as `1431f84`. The mover overlap-call hunk is byte-identical to pipeline `332f8db` and must be merged once.

Acceptance includes full-source seven-fixed-skill actor initialization, eligible pools in both phases and imported cooldown durations; source rectangle timing; real three-dash movement; gaze summons/action queue; landing damage; destroyed-callback cancellation; swept overlap/exit-reentry/profile flags; full simulation digest equality under frame/uneven/event advancement. These are source-boundary scenes. The ordinary G2 whitelist remains untouched, so a full natural stage with all boss skills is still a required integration gate.

Open proof: source runtime video comparison of every tell/area and exact Chaos contact response during the barrage's unswept BP movement; presentation renderer mappings for newly emitted lava/indicator cues; original engine RNG/physics parity. The existence of the source collision-damage effect alone does not prove the barrage's capsule collision events are reproduced. The unused legacy helper and unused InterpToMovement path are not claimed as normal Demo routes.
