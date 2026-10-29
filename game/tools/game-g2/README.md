# Reproducible G2 acceptance

Run in the clean, reviewed candidate worktree. Only outputs under the independent studio are admitted:

```powershell
node tools/game-g2/acceptance.mjs --expect-commit <full-sha> --out D:/TAPTAPGAME_codex/studio/review/g2-<version>
```

`--dry-run` prints the exact sequence without running checks or creating evidence. A real run requires a new
directory and the expected clean Git commit. It serializes TypeScript, tests, data equality, ledger recovery tests,
ownership, build,1000 real mixed runs,20 event/frame replay seeds, ordinary mouse input, natural victory/death/restart,
backpack and paid loot mouse operations, actual mouse camp/result/title/restart, all four natural combat variants,
native GPU combat measurement, golden style comparison, media and package.
Each step writes its command, log hash and result. A semantic report mismatch is a failure even when a tool exits0.
Only golden style differences are warning-only; a broken render is a failure. No automatic Git promotion occurs.

Every step verifies the commit and clean tree before and after execution. GPU measurements run without competing
browser tests. Browser outputs are isolated under the run's `browser` folder. Child timeouts or interruption stop
the owned process tree and retain a failed/interrupted receipt. Logged cleanup errors block acceptance. The older
inventory capture tools record their gameplay receipt before final cleanup; the runner therefore also checks their
process exit and cleanup log rather than asserting cleanup from the receipt alone.

`acceptance.json` is the machine-readable result. An automated pass means **awaiting independent review**. It does
not approve G2 for the producer, authorize WaveB, prove original RNG parity or establish mobile-device performance.
The reviewer must inspect the full-flow and inventory screenshots, the actual GIF/MP4, source gaps, stress coverage
and exact playable HTML. The60fps budget covers sustained combat; entry/all-frame distributions are retained to
expose launch or transition stalls. MP4 is60fps; GIF frame rate is chosen by the encoder's size budget.

On failure, keep the directory intact. Diagnose the first failed step, use the studio task ledger to review the
repair, then run a new evidence directory at the new clean commit. Live recovery instructions, leases, actor ownership
and the producer-authorized heartbeat are in `D:/TAPTAPGAME_codex/studio/control`. Read `studio/CODEX_WORKFLOW.md`.
