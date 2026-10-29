# Codex takeover — authorized 2026-10-26

## Producer correction — 2026-10-27, takes precedence

The producer rejected the G2 experience and authorized autonomous overnight rework toward the complete reskin,
including opening the original Demo for comparison and further unpacking. See the exact session decision recorded at
`D:/TAPTAPGAME_codex/studio/control/USER-REVISION-20261027.md`. The old no-launch and awaiting-G2 pause are superseded.
This is rejection/rework, not approval of G2. Restore the prior OPUS roll/ricochet/effects/environment in the real game,
compare against original runtime/source, and continue content/AI/room/combat/launch investigation and implementation.
Keep original repository and installation files intact; snapshot saves before reference play. User-facing progress must
lead with observed gameplay/visual differences, not test counts. Do not defer existing approved effects as placeholders.
Complete parity is unproven until source/runtime comparisons cover the entire reachable Demo; no overnight guarantee.

The producer approved the independent-copy plan and instructed: "OK，复制一份备份后，自动去做吧。"
Proceed autonomously within this plan. Do not ask again for normal development, reviews, repairs, worktree creation,
local integration or validation. Stop at the approved G2 and G3 producer gates with a concrete playable review pack.

## Scope and authority

- Continue plan v4, PROTOTYPE_SCOPE, WAVE_A and WAVE_B. Core rules and counts match the reachable Ricochet Abyss Demo.
- Preserve ART_BIBLE and golden frames. No new gameplay, art direction, dependencies or external shipped assets.
- G2 is the real 12-floor Knight loop with ported content and the prologue skipped. It is NOT final parity.
- G3 includes all reachable content, prologue, save/resume and full prototype validation; polish follows.
- Original Demo must not be launched or modified. Use the copied dump, source evidence and existing captures.
- Historical statements about Opus-only agents, old run IDs and budgets describe the previous executor. Use current
  Codex agents with inherited model settings, one coordinator and at most three concurrent workers.

## Paths and provenance

- Independent repository: `D:/TAPTAPGAME_codex/project`.
- Worktrees: `project/.codex/worktrees/<task>` on `codex/<task>`; use `studio/bin/wt.sh` with Git Bash.
- Independent reference data (read only): `D:/TAPTAPGAME_codex/reference`.
- New outputs and control state: `D:/TAPTAPGAME_codex/studio`.
- Old studio evidence: `D:/TAPTAPGAME_codex/studio/legacy`; original repository/worktrees: `archive`.
- Backup manifests and copy verification: `D:/TAPTAPGAME_codex/migration`.
- Never write to original `D:/TAPTAPGAME_design`, `D:/TAPTAPGAME_ref`, `D:/TAPTAPGAME_studio` or `D:/steam`.
- Old absolute paths in comments, plans and reports are historical source locators. Map them to the copied reference
  or legacy evidence before use. Never run a historical script until its operational paths have been reviewed.

## Ownership and task lifecycle

Start with a target card: source, owner paths, dependencies, acceptance, expected evidence and forbidden actions.
Use independent worktrees. A developer cannot approve their own work. Only the integrator updates main.
Candidate assembly branches may contain failures under diagnosis; they must never be reported as accepted integration.
Blocking review findings, crashes, softlocks, determinism failures or missing claimed behaviour prevent promotion.
An exhausted review budget does not grant approval. After two identical failed fixes, split the card or change the
diagnosis. Stage-authorized placeholders are explicit gaps, not silent success.

Task states are queued / implementing / review / ready / integrated / verified, with rework, blocked and paused.
Record input/output commits, owner, active lease, commands, results, evidence paths, gaps and next action on disk.
Do not re-dispatch an expired lease until the process/session and worktree have been checked. Do not overwrite dirty
work or use destructive reset/clean to repair a candidate. Preserve failed evidence and recoverable commits.

## Gates

1. Data import equality, TypeScript checks, meaningful unit tests, ownership and layer purity.
2. Real composed-core behaviour and recorded seed/commands; fake-game tests only validate the harness/UI fixture.
3. Browser input and all G2 screens, including real combat, rewards, boss and run-end; screenshots and interaction.
4. G2: 1000 real mix-policy runs, no crash/softlock/timeout, 20 determinism seeds, explained normal deaths and content
   coverage. Same-seed self-consistency is not proof of Demo RNG parity; retain source comparison requirements.
5. Review pack and playable build bound to the same commit. Desktop performance, mobile emulation, physical devices
   and visual/audio producer acceptance are separate evidence categories.

The coordinator maintains `D:/TAPTAPGAME_codex/studio/control/CONTINUE-HERE.md` and the machine-readable task ledger.
The authorized heartbeat continues pending work only when no writer owns the controller lease; it stays quiet on
unchanged state. Notify on a meaningful milestone, failure requiring the producer, or a ready G2/G3 review.
On an explicit user stop: prevent new dispatch, reconcile active workers, save checkpoints, pause the heartbeat and
wait for an explicit resume. Do not interpret elapsed time as approval of a gate.

## Immediate programme

Migration baseline -> tooling/ledger -> T2 candidate (all ten late systems) -> targeted integration repairs -> real
game loop -> G2 proof/review. Seven rejected original cards remain recoverable; no need to reimplement them wholesale.
Original baseline main is 0119590; original T2 e840397 contains damage, stamina and physics only.
