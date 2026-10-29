# Ordinary-route OPUS presentation recovery

Target: restore the approved `task/feel-merge` / `task/art-p` presentation in the real `src/main.ts` game route.
Source: `spec/launch-feel.md` FEEL003/020–023/040/050/070/080–097, copied `legacy/tmp/feel/demo-juice.md`,
`legacy/tmp/feel/demo-rec-01-frames` and `demo-rec-02-frames`; the current original-game comparison at
`studio/reference-session-20261027/original-hit-spin.jpg` confirms the slash/trail/splat triggers but is not timing evidence.
The beetle ball is the already-approved reskin exception in Art Bible rule9. No source trajectories, damage, RNG,
curves, new art direction, dependencies or installation files are changed.

Root causes:

1. The real native follower never emitted `launch.start/contact/end`. The shell and stage depended on those events,
   while the old `play` debug composition called knight/VFX functions directly. Hence real movement without curl,
   ribbon or slash. Successful player leg0, actual completed main-leg contact and owned cancellation now emit them.
   Failed release/hover emits no lifecycle; enemy followers cannot drive the hero/HUD lifecycle.
2. `BP_ManeActor.受击特效处理` was an empty generated presentation facade. Its source ln5460 now emits the actual
   actor A/B assets at hit+Z30 with the source normal and nested validity gates. No popup-derived invented hit.
3. Only the generic cue regex table existed. Exact source assets now route to the old spark/spores/splat and
   procedural audio patches. Ordinary impact/charge names previously fell through silently.
4. Removed enemies were disposed before the already-emitted `ui:actor.corpse` reached presentation. The room now
   starts the existing death sequence before retiring missing actors, retaining the corpse and using its existing
   .5-game-second splat callback. No new delay or early disappearance is introduced.
5. Stage recoil read normal.z instead of the source planar normal.y. Normals now use the room-frame transform,
   including a future source-axis room projection. The player flash adapter was also empty and now uses the existing
   .3s/4Hz reaction gate; no hero squash is added.
6. Real-route audio used dilated simulation time and never followed the listener or wind loop. It now follows real
   frame time, source hero listener and the same wind implementation. Dust/step uses existing100uu SpawnPerUnit.

Source cue ownership: launch lifecycle owns one release cue; the source whoosh mapping is a no-op to avoid doubling.
Contact owns the hero swing because current core AttackState has no PaperZD swing-notify emission. Actual natural
proof has three enemy contacts and three swings. Two corpses produce two .5s splats; the existing audio concurrency
admits one simultaneous death cue and rejects the other (no duplicated enhanced cue). Source `Blood_02` on bleeding
damage is retained as a separate *visual-only* source branch, not a second death sound.

Validation: `tests/parity-feel` covers real release/hover/contacts, natural hurt/corpse signals, actual knight sphere
visibility and rotation, .5s corpse lifetime, recoil axes and exact cue routing. Existing launch/reaction/VFX tests
and both TypeScript checks pass. `node tools/parity/feel-browser.mjs --out <fresh absolute dir>` builds this checkout,
uses the ordinary route with real mouse release plus natural shared-policy combat, records60fps frames, proves actual
ball visibility/rest, effects and unlocked audio admission, compares the original `play` composition, encodes two short
MP4 clips and records commit/status/diffSHA. It cleans its browser/server/context before encoding. No state/HP/RNG writes.

Remaining measured work: the shell consumes events at frame boundaries, while old play splits simulation visuals at
each contact. New VFX begin at age0 on the delivery frame; there can be up to one frame of remaining-age discrepancy.
An independent event-time presentation card must close that gap without changing core clock/scheduling. The generated
actor facade has a manually restored presentation method; future facade regeneration must preserve/port that body.
Unknown non-launch cues, full original audio waveform fidelity, enemy attack animation notifies and source-death
differences beyond the existing approved Mob model remain separate parity work. This restores visible functionality;
it is not a complete original-game/parity acceptance claim.

Proposals: none. Needs: independent code/ordinary-route visual review and integration; preserve the explicit timing gap.
