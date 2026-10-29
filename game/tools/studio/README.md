# Codex studio task ledger

This is the local control plane for the authorized takeover in `studio/CODEX_WORKFLOW.md`. It records work and
enforces promotion gates. It does not spawn agents, execute shell commands, merge Git branches, run a heartbeat,
approve producer gates, or turn a passing old `tools/train.mjs` report into independent approval.

Only Node builtins are used. The default control directory is `D:/TAPTAPGAME_codex/studio/control`, outside Git.
`--control <absolute directory>` selects an isolated test ledger. Writes to the old project/reference/studio and
the Steam Demo roots are rejected. Source files belong to `tools/studio/**`, `tests/studio/**`, `studio/schemas/**`.

## Interface

```powershell
node tools/studio/cli.mjs init --actor coordinator
node tools/studio/cli.mjs task add --actor coordinator --input D:/TAPTAPGAME_codex/studio/control/cards/example.json
node tools/studio/cli.mjs status
node tools/studio/cli.mjs claim --actor coordinator --input D:/TAPTAPGAME_codex/studio/control/requests/claim.json
node --test tests/studio/ledger.node.mjs
```

All mutating commands require `--actor <stable identity>` (native subagent id or coordinator session id). Input is
JSON via `--input file.json` or `--input -` for stdin; UTF-8 BOM is accepted. Output is JSON with `ok`, the replayed
`state`, and a changed `task` or newly issued `token` where applicable. Errors go to stderr and exit 1. `status`
works without an actor and never creates a directory. For embedding: `execute(controlDir, command, input, {actor,
requestId})` and `readLedger(controlDir)` are exported from `ledger.mjs`. Injected `now` is for tests only.

`--request-id <unique-operation-id>` makes a retry idempotent; reusing it for different actor/input fails.
Lease tokens are returned only once and only their SHA-256 hashes are stored. Keep the initial response privately.
An idempotent claim retry does **not** return the raw token again; if that response was lost, reconcile the execution
session before recovering the expired lease. Stable actor identities are operator attestations, not authentication;
the coordinator must bind them to actual different agents. This local CLI is not a security boundary against a
person who can edit files or invent agent identities.

## Task card

```json
{
  "id": "core-example",
  "source": ["spec/turn-flow.md:TURN-029", "studio/CODEX_WORKFLOW.md"],
  "target": {
    "description": "Reproduce the documented turn transition",
    "acceptance": ["Source vector passes in the composed core", "Independent reviewer compares the source"],
    "forbidden": ["Do not invent mechanics", "Do not write outside owner paths"],
    "golden": null
  },
  "ownerPaths": ["src/core/sys/example/**", "tests/core-example/**"],
  "dependencies": [{"id": "core-foundation", "stage": "verified"}],
  "inputCommit": "4c0a57a",
  "blocking": []
}
```

Dependencies must already exist, which prevents cycles. A string dependency means `stage: verified`; `integrated`
also accepts an already verified dependency. Owner paths support exact files and terminal `/**` only, with no dot
segments, absolute paths or backslashes. Ownership remains reserved while another task is implementing, in review,
or ready; overlapping development claims are rejected. Git ownership checks still need to be run externally.

The status sequence is `queued → implementing → review → ready → integrated → verified`, with `rework` and `blocked`.
Every task mutation requires `{id, revision}` with the current **task** revision, not the ledger revision. A command
which fails validation appends no event. There are at most three worker leases total, including review, integration
and verification. Expired leases still occupy slots until explicitly reconciled. A worker cannot own two leases.

## Worker lifecycle

Common evidence input:

```json
[{"path":"D:/TAPTAPGAME_codex/studio/reports/core-example/check.json","summary":"tsc and source vectors passed","commit":"abcdef1"}]
```

Evidence must name existing absolute file paths, include a summary and cite the exact applicable commit. The ledger
records each file's SHA-256. It does not infer test success from file contents: the independent reviewer checks those
contents. Use immutable report paths per run. Promotion checks that development/review evidence still matches its
recorded hashes. These artifacts are not copied into the ledger, so preserve them with the project backup.

| Command | JSON input beyond `id`, `revision` | Effect |
|---|---|---|
| `claim` | `role` (`develop` default, `review`, `integrate`, `verify`), `worker` (defaults to actor), `session`, optional `ttlSeconds` (30..86400, default 1800), optional `controllerToken` | Acquire role lease. Develop checks dependencies/owners; review rejects every prior contributor. Returns token. |
| `renew` | `token`, optional `ttlSeconds` | Extend an unexpired lease belonging to actor. Keep the original token; task revision advances. |
| `complete` | `token`, `outputCommit`, `summary`, `blocking` array, `evidence` | Developer checkpoints a submission and releases its lease to review. Clears previous review/integration/verification. Explicit remaining blockers are required. |
| `review` | `token`, `commit`, `decision` (`pass`/`reject`), `summary`, `blocking`, `evidence`, optional `failureFingerprint` | Only a review lease holder can approve that submission. Pass requires both submitted and reviewer blockers empty. Rejection goes to rework; the same failure twice goes to blocked. |
| `integrate` | `token`, `sourceCommit`, `integrationCommit`, `evidence` | Records an externally completed integration. Requires ready, passed independent review of the exact source commit, unchanged evidence and no blockers. |
| `verify` | `token`, `commit`, `summary`, `evidence` | Records externally completed QA of the exact integrated commit. Only from integrated. |
| `fail` | `token`, `commit`, `summary`, nonempty `blocking`, `evidence`, optional `failureFingerprint` | Any worker records a failed attempt and frees its lease. Rework after first failure; blocked after the second identical fingerprint. Failed commits/evidence remain recorded. |
| `replan` | `strategy`, `evidence`, optional `controllerToken` | Coordinator records a different strategy for a blocked unleased task. Resets retry counters, returns to rework; existing blockers remain until addressed in a new submission. |

A developer cannot approve any task to which they contributed, even after a different developer takes over. A ready
task must acquire an `integrate` lease and an integrated task a `verify` lease. `claim --actor coordinator` with
`worker: <agent-id>` lets the coordinator dispatch; subsequent worker commands use `--actor <agent-id>` and its token.
The API records source and integration commits; actual Git ancestry, ownership, command execution and agreement
between the artifact contents and asserted result are reviewer/integrator responsibilities.

## Historical verified cards

`add` may include `historical` only when a prior verified result really has review, integration and QA evidence.
This is intended for verified migration/tooling receipts, not for converting rejected old work into success:

```json
{
  "historical": {
    "status": "verified",
    "developer": "original-developer-id",
    "reviewer": "different-reviewer-id",
    "integrator": "integrator-id",
    "verifier": "qa-id",
    "outputCommit": "abcdef1",
    "integrationCommit": "abcdef2",
    "provenance": "Receipt path and scope of the imported acceptance",
    "developmentEvidence": [{"path":"D:/absolute/dev.json","summary":"Development checks","commit":"abcdef1"}],
    "reviewEvidence": [{"path":"D:/absolute/review.json","summary":"Independent review","commit":"abcdef1"}],
    "integrationEvidence": [{"path":"D:/absolute/integration.json","summary":"Merged candidate checks","commit":"abcdef2"}],
    "verificationEvidence": [{"path":"D:/absolute/qa.json","summary":"QA receipt","commit":"abcdef2"}]
  }
}
```

The normal card fields are still required. Dependencies must satisfy their gates, and blockers must be empty.
The author of the import, provenance, distinct developer/reviewer identities and every evidence hash are recorded.

## Coordinator, pause and recovery

- `controller-claim`: `{session, ttlSeconds?}` returns a controller token. While present, task claims, pause/resume
  and replan require the controller's `--actor` and `controllerToken` in input. Workers can finish their existing
  assignments independently. `controller-renew` uses `{token, ttlSeconds?}`; `controller-release` uses `{token}`.
  A still-running coordinator may renew its own expired-but-unreclaimed lease with the same actor/token. The writer
  lock makes that atomic; a different actor, a replaced token, or a worker lease cannot use this exception. This does
  not clear pause or claim work and must not be used by a second coordinator to impersonate an active session.
- `pause`: `{reason, controllerToken?}` stops **new** worker dispatch and integration. Existing workers may renew,
  record failures or complete checkpoints; this does not kill processes. The coordinator must stop/reconcile agents
  and separately pause the heartbeat on an explicit user stop. `resume` also requires `{reason, controllerToken?}`.
- `recover`: `{}` rebuilds a stale/missing snapshot from events. It does not release leases or resume anything.
  To release an expired worker lease include `tasks: [{id, revision, inspection}]`. To recover an expired controller
  include `controller: {inspection}`. Every inspection must have `sessionStopped: true`, `worktreeChecked: true`,
  `summary`, and nonempty evidence with existing absolute files (commit is not required for inspection).
  Development returns to rework; other roles retain review/ready/integrated so another worker can finish the gate.
  The ledger records inspections, never checks processes or worktrees on the operator's behalf.
- An expired controller or worker is **never** automatically reclaimed. Native subagent state and actual worktree
  state must be checked first. Time passing is neither evidence of shutdown nor approval of G2/G3.

All mutations take `writer.lock` with exclusive creation and record PID, hostname and a random token. There is no
age-based removal. `recover-lock` takes `{lockToken, inspection}`; it refuses live/uncheckable PIDs, foreign hosts,
or a changed lock token. An already terminated writer on this host can be removed after explicit reconciliation.
Save that command's JSON receipt, then run `recover` to rebuild the snapshot. Malformed locks require manual
investigation; the CLI will not guess. Read-only status does not need the writer lock.

## Persistence and limits

`events/000000000001.json` etc. are immutable, append-only events with the command, actor, timestamp, optional request
id, resulting state, previous event hash and their own SHA-256. Files are fsynced to unique temporaries and published
by exclusive hard link; existing events cannot be overwritten. `snapshot.json` is then atomically replaced. If a
process stops after event publication but before the cache rename, replay still returns the committed event. Temporary
files are ignored. Missing sequence numbers, changed hashes and broken chains fail closed instead of hiding history.
Replay always reads events; the snapshot is a human-readable cache. This favors recovery clarity over high-volume
database efficiency and assumes a local filesystem supporting hard links/atomic rename, as on this Windows NTFS drive.
It is not a claim of power-loss durability across all filesystems or tamper resistance against the workspace owner.

Schema references are in `studio/schemas/`; the builtin runtime checks additionally enforce transitions, tokens,
ownership, independent review, evidence existence/hashes and retry limits. `node --test tests/studio/ledger.node.mjs`
uses isolated temporary directories and never initializes the production control directory. The `.node.mjs` suffix
keeps Node's test harness separate from the project's Vitest suite.

G2, G3 and final polish acceptance remain producer decisions with review packs bound to a build. `verified` means
this card's declared acceptance has evidence and is recorded; it does not imply full Demo parity or producer approval.
