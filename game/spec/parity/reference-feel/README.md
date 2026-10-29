# Original reference session and two missing audio cues

Target: `parity-reference-feel`, candidate base61c0b0f. The approved fungal reskin stays intact. This is a bounded source/runtime comparison and missing-sound repair, not full Demo parity acceptance.

## Fresh original evidence

Session directory: `D:/TAPTAPGAME_codex/studio/reference-feel-20261027-0648/`.

Before launching, all8files/101234bytes of the current `%LOCALAPPDATA%/CatapultHero/Saved` were copied and SHA256-verified. The manifest records actual UTC creation time2026-10-26T22:52:54.4352318Z. The directory's0648suffix is a label, not the timestamp. Original installation/repository files were not edited; no saved progress was reset or restored over the user save.

The installed Shipping executable was launched through documented `@oai/sky`. Its existing save resumed Knight floor3/turn5, HP150/150, stamina100/100, two活体结晶 with21counter. Normal clicks hit and killed them, collected the actual无字书 reward and reached the map. The application was closed with Alt+F4 and absence of its returned window was verified. Input/capture intervals and original2560×1440images are preserved in `capture-log.json` and numberedPNG files.

The first actual contact showed HP150→129, white回旋斩, trail, damage30 and反击21. Seven captures of the next attack preserve white slash → rest → next-round/bleed feedback. Capture calls take144–314ms in that sequence (one earlier capture528ms); they are **not60Hz measurements**. The capture may happen anywhere between the recorded request start/end. Input release is also bounded by its call, not timestamped by the game. No millisecond/frame-exact agreement is claimed from this series.

The original closed-side-panel right edge is approximately468±8px at2560wide (18.28%±0.31%); candidate combat edge is355±2px at1920wide (18.49%±0.10%). The proportional placement is consistent at this coarse scale. Source `src/ui/hud/layout.ts` retains precise widget coordinates. Different room shapes, saves, items and enemy rows prevent path/damage/total-turn-duration comparisons between these screenshots.

## Proven missing sound routes

Before this change, `Cues` had no matching handler for `音效_基础_格挡` or `音效_基础_飞箭`; sound fallback is empty. Actual source core events therefore produced no sound. Existing launch/hit/charge routes remain unchanged.

Read-only source evidence is decoded by `tools/parity/reference-feel/metasound-evidence.py` (adapted from the already-reviewed legacy generic decoder; no embedded absolute reference paths). Source assets are under `reference/dump/raw/Game/CatapultHero/声音/`.

| Cue | Connected source graph and callsite | Port |
|---|---|---|
|格挡|Two shared音效_基础patches start simultaneously. MetalShieldBlock3:tempo1,max2,volume0.8;盾牌:tempo2,max3,volume2. Each external RandomFloat[-5,5] overrides the literal pitch2/5. A0.1sTriggerDelay receives OnPlay but its output has no connection.|Two generated carapace-ring layers, same graph parameters. No invented0.1sdelay. Sharedpatch keeps its existing separate presentation-only random±5resample.|
|飞箭|One sharedpatch:tempo1,pitch0,HPF500,max3,start0,volume4. Arrow sourceL24851 plays at location with volume1.3/pitch1.|Generated air-swish wave with source duration0.41902494s and callsitegain1.3.|

Both callsites explicitly override `音效并发_零点一间隔`:MaxCount8,RetriggerTime0.1. They share that group; simultaneous arrows are deliberately suppressed by the original rule. The block event can use a bare asset name, so its exact handler accepts either bare name or full qualified path.

Original wave metadata: MetalShieldBlock3=0.5761451s at22050Hz;盾牌=1.2026985s at44100Hz;飞箭=0.41902494s at44100Hz. Generated wave windows preserve these lengths/rates. These are procedural timbres using the approved existing ring/air synthesis, **not original PCM**. Their spectra and audible decay have not been matched against a recording of the original cues.

OnFinished comes from the盾牌patch for block and the solepatch for arrow:0.01attack+3.0max=3.01s voice/concurrency lifetime. This differs from the much shorter source-wave duration and from the measured output tail after mixing/reverb.

## Validation

- Real core blocked damage emits the block event; actual acquired分身短弓 charge/contact emits arrows. Both exact handlers reach `Audio.play`; audio presentation RNG leaves simulation RNG unchanged.
- Source shared0.1sconcurrency, connectedpitch/delayvalues, sourcewavewindow, finite/nonzeroPCM and original7cue contracts are checked. The locked-audio test advances0.1s between cues so it continues testing the locked context rather than newly shared concurrent rejection.
- `tools/parity/reference-feel/candidate.mjs` captures ordinary real mouse wall launch and naturally reached hostile launch using an explicitly declared QA skipPrologue flag, then a separately labeled source acquisition/block boundary. It never substitutes the old `scene=play` as ordinary proof. The optional video is a60Hz stepped simulation render, not wall-clockGPU or original-game sampling evidence.
- Browser source event logs show block/arrow `played:true` with a running AudioContext. The same WebAudio graph is rendered to WAV and measured. This proves a non-silent implementation, not physical-speaker listening or original-waveform equivalence. The available model tool explicitly reports audio input unsupported; no listening review is falsely asserted.

## Remaining gaps

1. The current original saved Knight has no acquired parry/arrow active path. Original live parry/Hunter and original PCM recordings are not present in this session. Source graphs/callsite evidence and candidate actual-source-event proofs are separate categories.
2. Block source uses SpawnSoundAttached; the existing presentation sound event exposes only a point. The restored short sound currently starts at that world point rather than following a moving victim. Precise attachment-following requires an explicit event identity contract; it is not claimed exact here.
3. Core sound event volume/pitch routing is not a universal new mixer. Arrow's single current caller1.3gain is preserved; future callers with different overrides need deliberate support.
4. Full waveform listening, per-frame reference motion, all sounds/music, every UIcurve and allVFX remain outside this bounded repair. Existing source-only waveform/Chaos/scene gaps remain visible; no full1:1claim.

Proposals: none. Needs: independent root review and source/candidate artifacts; later original runtime/audio comparison for the unobserved paths.
