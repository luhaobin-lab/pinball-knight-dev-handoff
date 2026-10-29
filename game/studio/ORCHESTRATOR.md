# Orchestrator runbook (v3)

For the main session, including after context compaction.

## Producer instructions (2026-10-22)

1. Restore the automated studio (fan-out subagents) and build the full 1:1 reskin of the Demo
   (`方案-v3-自动化工作室.md`).
2. **At every important milestone, send a playable link and a GIF and wait.** Continue only after the producer
   approves. The point is that someone corrects the direction if it drifts.
3. **Budget**: no budget limit. The account still has a hard daily cap of about $1500, resetting at 00:00 UTC
   (08:00 Beijing). If agents fail with 429, resume after the reset.
4. Opus 5.5 for every agent.
5. **World**: a corrupted fungal world; the beetle knight descends into the dungeon to explore it.
6. **UI**: style A「墨与骨」, never gold-dominated.

## Loop

1. Read `studio/STATE.json` and `studio/BOARD.md`.
2. While a workflow runs, wait for its notification. Never poll.
3. When a workflow completes:
   - Read its summary.
   - Spot-check the claims: build, run `npm run check`, look at the screenshots next to the golden frames.
   - Merge the passing branches into `main` in dependency order and run the full regression.
   - Update BOARD and STATE.
4. **Gate milestone** (G1–G5, or any other important node):
   - Build the review: `npm run package`, then publish to the private XD Sites review site.
   - Render a GIF of the key loop.
   - Send the producer the link, the GIF and 2–4 stills, with what changed and what to look at.
   - **Stop launching production waves until the producer approves.** Spec and data work that cannot change the
     direction may continue.
5. Between gates, launch the next wave from the phase graph. At most 2 workflows at once. Record every runId in
   STATE.
6. **On failure**: fix the script and resume with `resumeFromRunId`. A task that fails three times is re-planned with
   a different approach.
7. **No "insanity passes".** Art critics score fidelity to `studio/ART_BIBLE.md` and the golden frames. Proposals go
   to the producer.

## Phase graph

W0 (foundation and Ink & Bone HUD) ∥ P0 (data import, spec verification, 1:1 launch core) → **G1**
→ P2 vertical slice → **G2**
→ P3 roster design → **G3**
→ P4 combat complete
→ P5 build and run → **G4**
→ P6 meta and camp
→ P7 polish and acceptance → **G5**

## Per-task pipeline (inside a wave)

1. Target card.
2. Develop in a worktree.
3. Self-test (check, shots).
4. Code review against the spec.
5. Visual tasks only: 3 art critics against the golden frames and the art bible. A score below 8 sends the task back
   with a fix list; at most 3 rounds.
6. Integrate.
7. QA: bots, perf, layout parity, visual regression, completeness.

## Conventions

- Scripts are copied to `D:/TAPTAPGAME_studio/orchestrator/workflows/<wave>.js`.
- Branches are `task/<id>`. The integrator merges into `main` and tags gates (`g1`, `g2`, ...).
- The review site: one private XD Sites static site, updated at each gate; each gate's build is kept under
  `D:/TAPTAPGAME_studio/review/<gate>/`.
