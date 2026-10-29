# Native PRD sequence recovery

Target: original `CatapultHeroPrdLibrary::RollPRDBatch` numeric implementation, executable SHA256
`ccd1db79c2eb3668242c4c10d271234963bc9dc1efa3ec0afddace444d1afcab`.
Root owner: `src/core/math/prd-native.ts`, this test directory, `tools/reverse/prd-native-oracle.py`.
No gameplay integration or global RNG rerouting is included in this checkpoint. Independent review is required.

The original wrapper at1445b1c30 converts P with1445ac2e0 for positive Attempts, then calls1445a65e0 with the
1445b3680 random callback. Contiguous extraction is preserved in studio/reference-session-20261027/native-prd-final;
the older dump's46-byte `.pdata` fragment alone does not include the algorithm.

The original batch uses ceil(1/sqrt(C)) blocks, quantized upper probability at the block end, geometric failure
skipping with floor(log(U)/log1p(-q)), then rejection using another U when p<q. A success resets the counter to1.
The open-interval callback combines three CRT draws: ((r1&32767)<<16)|((r2&32767)<<1)|(r3&1), divided by2^31
and shifted by2^-32. Zero and one are excluded. Negative counters consume guaranteed failures without draws.
C<=0 and Attempts<=0 are separate early exits; C>1 succeeds directly. Counters saturate int32 at return.

The oracle executes only copied numeric batch, quantizer, and open-interval bytes in isolated process memory.
Relative addresses and source constants remain intact; imports are verified by PE name: log1p/log/rand.
rand's deterministic callback is supplied by the harness; math uses local UCRT. The source installation is never
loaded as a process, altered, or given inputs. Private memory starts RW, is switched RX before execution, then freed.
The first oracle attempt stopped safely on an out-of-range constant before executing; its imports report remains.
The successful immutable evidence is studio/reference-session-20261027/native-prd-oracle-0516/vectors.json.

960 independent original-native calls cover8 C values,6 counters (negative/zero/near-int32),5 attempt counts and4 seeds.
16 extra extreme raw-bit cases cover geometric/rejection endpoints;5 uniform cases and36 native quantizer cases
are also captured. The checked-in compressed fixture derives directly from that native result, including candidates,
raw draw consumption and final state. The tests compare exact results, not frequency tolerances.

Remaining limits: CfromP is the existing separately analyzed conversion, not executed by this isolated oracle;
global CRT RNG initialization/stream interleaving differs from the current separated game domains; JS and native
log/log1p may disagree at rare floating boundaries outside these vectors. No full original-game parity claim.
Historical oracle checkpoint left production on its distribution-only implementation. The integration card now
routes both RollPRDBatch wrappers through the reviewed native algorithm. The old algorithm exists only in
tests/core-math/legacy-prd.ts as explicit historical comparison. Coefficient/quantizer exports are unchanged and
live in prd-coefficient.ts to prevent a circular import. Full integration acceptance is recorded separately.

Follow-up native-prd-oracle-0522 also calls the local UCRT srand/rand in this isolated process for6seeds×256draws.
All1536raw values match the existing MSVC LCG formula. This verifies the primitive on this machine, not original
global seed initialization or cross-system call order. The other1017numeric oracle outputs repeat exactly.
