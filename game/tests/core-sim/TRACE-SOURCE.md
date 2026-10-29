# Source query boundary repair

The enemy electric-net Blueprint uses `SphereTraceMultiByProfile` with Start equal to End and the Pawn profile,
then `LineTraceSingle` from the owner's capsule edge toward a conductor. Source:
`reference/dump/blueprints-pseudo/CatapultHero/BP/Skill/效果/敌人/蓝图_效果_电网.txt` (`新一天时` / `ReceiveTick`).

Epic's API contract includes all initial overlaps, including blocking initial overlaps. Consequently an initial wall
overlap cannot discard the other components in a stationary radius query. Only the zero-length enumeration changes;
the existing moving query still stops at a static blocker. Hit flags and deterministic solver ordering remain intact.

- https://dev.epicgames.com/documentation/unreal-engine/API/Runtime/Engine/Kismet/UKismetSystemLibrary/SphereTraceMultiByProfile?application_version=5.5
- https://dev.epicgames.com/documentation/unreal-engine/API/Runtime/Engine/Engine/UWorld/SweepMultiByChannel?application_version=5.5

A line is now a zero-width ray. The old minimum sphere radius 0.01 falsely penetrated the owner's surface even when
the source started exactly at its radius. Exact touching starts moving away are ignored; entering starts and genuine
penetration remain hits. Touch-only profiles are still excluded from SingleLine's blocking result.

`trace-boundary.test.ts` verifies generic tagged BpObject conductors, block/touch flags, deterministic pure queries,
walls blocking moving sphere/line, outgoing versus entering exact boundaries, true penetration, and a sub-.01 gap.
This is a source-boundary fixture, not a claim of natural-level coverage or full Chaos equivalence. The existing
planar approximation, 64-result cap, equal-time initial-overlap ordering and actor-channel simplification remain gaps.
