# Production PRD integration

Base `bfdf87e`. The independently reviewed numeric oracle commits7467efc/43b4c9e are dependencies. Both production
`RollPRDBatch` and `RollPRDBatchWith` now call the reviewed skip/rejection algorithm; probability facades, actor critical
hits and map rare-room rolls consume that same algorithm. `prd-coefficient.ts` preserves existing coefficient and
quantizer functions byte-for-byte in behavior and prob.ts re-exports their names. No circular import remains.

Historical one-draw-per-attempt algorithm is retained only in `tests/core-math/legacy-prd.ts`; old vector042 now
explicitly tests that historical implementation. Current runtime tests check native sequence and state, along with
all immutable original-native vectors. The old distribution check remains as a statistical cross-check, not parity
evidence. Real 会心判断 and generated kernel facade tests prove native calls reach ordinary modules/domains.

One existing map-unit golden changed: its1000seeds include all tile types through the fake map environment, so the
传奇房 .05 PRD consumes a different meta sequence even when both algorithms initially return failure. Example
isolated seed1 meta-state2180927321: olddraw30026 ends4115289272; native draws30026,23792,19791 end3444525298.
The old histogram stays untouched. The new `histogram-1000-native-prd.json` retains3000offers per floor and identical
initial/camp/first/final-boss rows. All map invariants and exact first12 seeded map vectors remain checked.
Detailed deltas/source trace: `studio/logs/parity-native-prd-integration/histogram-provenance.json`.

These1000histogramseeds are map-unit samples, not1000complete real game runs. Full production validation reports
separate bounded bot runs and browser flow. Original global CRT initialization/interleaving and rare JS/native libm
differences remain explicit gaps. CfromP remains the existing separately analyzed conversion, not re-certified by
this oracle. No whole-game original RNG parity claim follows from the isolated numeric agreement.
