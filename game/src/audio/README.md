# src/audio — the launch's sounds, procedural

- **Owner**: the `audio` lane (task `audio-sfx`).
- **Purpose**: the Demo's launch SFX (art bible §9: the feel is a 1:1 copy, only the skin changes): the same cues,
  triggers, timing, layers, concurrency and mix as the Demo's MetaSounds, played on stand-in waves synthesized at
  runtime with WebAudio. No audio files.
- **Sources**: `D:/TAPTAPGAME_studio/tmp/feel/demo-juice.md` §9 and the dump it cites: the MetaSound graphs
  `dump/raw/Game/CatapultHero/声音/*.json` (decoded with `tmp/feel/scripts/metasound3.py`), the wave assets'
  metadata in `声音/原素材/`, the concurrency and attenuation assets, and the call sites that play them.

## API

```ts
import { createAudio } from '../audio/index.ts';

const audio = createAudio({ seed, now: () => undilatedSeconds });
canvas.addEventListener('pointerdown', () => void audio.unlock());
audio.loop('wind', true);              // room start
audio.setListener(hero.x, hero.z);     // every frame (tiles)
audio.play('launch');                  // release
audio.play('bump', hero);              // every contact that reacts (walls and enemies), at the hero
audio.play('swing', hero);             // enemy contact (the attack notify at t = 0)
audio.play('hit', victim);             // each damage instance, at the victim (the splatter follows 0.1 s later)
audio.play('death', victim);           // the death animation's splat, 0.5 s in (Mob.die onSplat)
audio.play('step', dustPuff);          // every dust puff; the cue itself lets one through per 0.2 s
audio.play('charge');                  // an item becomes fully charged
```

| Member | |
|---|---|
| `createAudio({ seed, now?, context?, prewarm? })` | `seed` drives every random choice (one derived stream per cue). Additive options: `now` is the audio clock in seconds for event times, concurrency and retrigger (default `performance.now() / 1000`); audio is not slowed by the hit-stop, so pass an undilated clock, a deterministic one in stepped (`?t=`) runs. `context` builds the context on the first `unlock()` (default `new AudioContext()`; tests pass a mock, the offline renderer an `OfflineAudioContext`). `prewarm: false` skips the idle pre-rendering. |
| `unlock(): Promise<void>` | Creates the context on the first call and resumes it; call it from user gestures. Idempotent (each call retries `resume()`), never rejects. WebKit may not count `pointerdown` as an activation for audio: calling it on `pointerup`/`click` too is harmless. |
| `play(cue, { x?, z? })` | Never throws. While locked (no running context) the sound is dropped and logged. World cues default to the listener's position. |
| `loop('wind', on)` | The ambience loop; asked for while locked, it starts on unlock. |
| `setListener(x, z)` | The hero (the Demo's listener is the hero sprite). Playing world voices glide to their new pan and attenuation. |
| `setVolume(bus, v)` | `master`, `sfx`, `ambience`; 0..1. |
| `events` | The last 1024 plays and loop changes: `{ t, cue, params }`; `params` has `x, z, group, distance, gain, pan`, `layers` (`wave`, `pitch` = total semitones, `baked`, `resample`, `rate`, `gain`, `delay`), `admitted` (concurrency), `played` (audible), `reason` (`locked`, `retrigger`, `voices`, `unknown`, `error`), `voice`, `evicted`. |
| `state`, `context`, `dispose()` | Additive: `'locked' | 'running' | 'unavailable'`, the context once unlocked, and teardown. |

Coordinates are floor tiles (x east, z south), as in `src/game`.

## How a cue plays

Every layer is one instance of the Demo's shared patch **音效_基础**: a Wave Player at a random ±5 semitones (a
resample, rolled per play and per layer), a Delay Pitch Shift that compensates 播放速度 (tempo) and adds 音高, a one-pole
high-pass (Cutoff Frequency), × 音量, × an AD envelope (attack 0.01 s, linear decay over 最长时间, after which the wave
stops). Here: the pure pitch and the tempo are baked into the rendered wave (`render(rate, pitch, time)`), the
resample is the source's `playbackRate`, and the rest are WebAudio nodes (`engine.ts`). Extra random pure pitch
(砍中肉) and the footstep roll are rendered on a 1-semitone / 0.5-roll grid and cached.

| Cue | Demo MetaSound | Layers (Demo values) | Concurrency | Where |
|---|---|---|---|---|
| `launch` | 音效_基础_启动弹射 | random of mWooshLarge1/2/3 (equal weights, never the same twice in a row), 最长时间 3, no HPF | 大量 (24, 0.01 s) | attached to the hero |
| `bump` | 音效_基础_普通撞 | IMPACT_Punch_01 +2.24 st, 最长时间 1 · 击中盔甲4 from 0.2 s in, +5 st (MapRange(Speed = 1)), vol 0.8; mix × Speed = 1 for every knight leg | 默认 (6) | at the bouncer |
| `swing` | 音效_基础_挥剑 | 挥剑 tempo 0.8, +3 st, HPF 500, vol 4, 最长时间 3 | 大量 (call site) | at the hero |
| `hit` | 音效_基础_砍中肉 | 剑击中肉体 from 0.35 s in, vol 0.7, ±5 st extra, 最长时间 1 · 水爆炸 0.1 s later, tempo 1.51, ±5 st extra, HPF 500 (patch default), 最长时间 3; OnFinished from layer 1 (1.01 s) | 默认 (call site) | at the victim |
| `death` | 音效_基础_血浆01 | 流血, vol 0.7, 最长时间 1 | 大量 (call site) | at the dying actor |
| `step` | 音效_基础_脚步 | 踩树叶2; one roll u ∈ [1, 3]: vol 0.352·u, pitch 1.04·u st | 脚步 (8, 0.2 s; Niagara player) | at the puff |
| `charge` | 音效_基础_充能完毕 | Spell_PA_Judgement_Revamp_Cast_01 tempo 1.04, 最长时间 2 | 大量 | 2D |
| `wind` (loop) | 音效_风循环 | stormloop at 15 × Speed + U(−5, 5) st (resample), one-pole LPF 1000 Hz, gain 0.4 × Speed² with Speed = 0.63 at rest and on every knight leg (constant) | — | attached to the hero |

**Concurrency** (`concurrency.ts`) follows UE: one group per SoundConcurrency asset, RetriggerTime rejects a start
within it of the group's last start, and a full group stops its farthest voice (the oldest on a tie) if it is at
least as far as the new one, else rejects the new one (StopFarthestThenOldest). A voice holds its slot until
OnFinished (attack + 最长时间 of its finishing layer). A stolen voice fades out (time constant 3 ms) and its sources
stop 24 ms later, at −70 dB; it is marked stolen until they end, so listener moves no longer glide its gains (a glide
back to its distance gain would undo the fade and end it in a cut). The wind loop is outside the groups (a stolen
ambience would be a bug, not feel).

**Spatial**: 音效衰减_默认: full level within 100 uu, linear to silence over the next 1800 uu; a small pan by the screen-x
offset (±0.5 at 1280 uu, half the Demo's view).

**Room and master**: every Demo SFX plays through 子混音_声效混响 (预设_声效混响: DryLevel 0.75, Gain 0.45) and sends 0.8 to
the level's AudioVolume reverb (默认混响: decay 1.49 s, HF ratio 0.83); here one convolution (`room.ts`: early taps at
7 ms, a two-band tail from 18 ms) at 0.19 beside the dry 0.75. Then the master limiter (DynamicsCompressor, threshold
−2 dB, ratio 20, attack 0, release 0.12 s; only pile-ups reach it), a trim to a −3 dBFS ceiling and a soft clip
(transparent below −3 dBFS, never above −1 dBFS, 4× oversampled) for the transients Chromium's compressor lets
through. The chain delays the output by 10 ms (measured at 48 kHz: the compressor's 6-ms lookahead and the
oversampling filters' 4 ms), under a frame.

## The stand-in waves (`waves.ts`)

Each keeps its Demo file's length, rate class and job; the skin is the beetle knight in a corrupted fungal crypt.

| Demo wave | Ours |
|---|---|
| mWooshLarge1/2/3 (0.45 / 0.36 / 0.24 s) | large air pass-bys: a body band, an air band and a narrow resonance following the swell; a light flutter of the sapphire scarf |
| IMPACT_Punch_01 | the chitin knock: falling thump, a hollow shell's short modes, slap and mid smack |
| 击中盔甲4 from 0.2 s | the carapace clank's tail: the pearl plates' inharmonic ring with beating pairs and a buzzing rattle |
| 挥剑 | the whirlwind slash: two narrow swishes (the spin passes twice) over a wider body, an air edge, a faint blade ring |
| 剑击中肉体 from 0.35 s | the blade into fungal flesh: edge, mid thwack, a thick thunk, a wet resonant squelch, torn fibres, bubbles |
| 水爆炸 | the ichor splatter: a wet slap sweeping down, spray drops and ticks, a puff of spores |
| 流血 | the spore burst: a fleshy pop, a wet plop and squelch, the airy spore "pfff", bubbles |
| 踩树叶2 | the fungal crunch: dense crackle of dry gills, a soft squish of moss, a short rustle |
| Spell_PA_Judgement_Revamp_Cast_01 | the spore-light chime: a rising cast swish, an arpeggiated bright chime, glints, a glow |
| stormloop (4.31 s) | the crypt draught: pink-noise body and a whistling howl under slow swells, seamless |

Waves are peak-normalized like library files; `trimDb` stands for each Demo file's unknown loudness and was set by
measured RMS (the Demo's own volumes stay as they are in the cue table: e.g. the swing's stand-in sits at −10.6 dB, so
the Demo's ×4.0 lands it among the loudest cues, as the Demo's designer meant).

**Balance** (nominal plays, full chain, listener at the source; `rmsMax50` = loudest 50-ms RMS, dBFS): hit −11.8,
swing −13.0, death −12.9, launch −16.0, charge −16.0, bump −17.0, step −27.0 (u = 2; −33 to −23.5 over the roll),
wind −37.0 RMS. Peaks of single cues −4.9 to −10.5 dBFS; a full launch peaks at −2.7 dBFS.

## QA

- Debug scene `?scene=audio-sfx`: a button per cue, "launch sequence" (`qa/sequence.ts`: one Demo launch on its
  60-fps timeline, over the wind), "ping-pong launch" (`qa/sequence.ts`: four contacts between an enemy and a pair
  inside the AoE, on the Demo's frame model with the hit-stop; 音效并发_默认 overflows on the last two and steals four
  voices) and the wind toggle; the overlay draws the event log (a row per cue, filled = played, ring = dropped).
  `window.__audio` exposes the scene's audio.
- `?render=1` renders every cue at its nominal plan, the wind and both launches offline (`qa/offline.ts`, the same
  engine on an `OfflineAudioContext`; solo renders start 0.25 s into the context, because Chromium's compressor starts
  in a strongly reducing state) and publishes WAV, JSON (`qa/analysis.ts`: length, peak, RMS, max 50-ms RMS, spectral
  centroid, onset; the onset includes the chain's 10 ms) and a spectrogram PNG per render on `window.__audioSfx`
  (marks: × = the play stole a voice). Timeline renders reproduce to ±1 LSB (16-bit) from run to run; solo renders
  exactly.
- The steal check (`renderSteal`, render `steal`): a hit stolen 0.133 s in with nothing else playing, the listener
  moving every frame and updated right after the steal; `steal` in its JSON gives the output level before the steal,
  2 ms before and after the sources stop, `residualDb` (what is left of the voice at the stop: the room's tail when it
  faded) and `stepDb` (a drop at the stop is a cut; about 0 when faded).
- `node tests/audio-sfx/render.mjs [--out dir] [--seed n] [--nobuild]` writes them to
  `D:/TAPTAPGAME_studio/shots/audio-sfx/` with `summary.json` and a page shot (builds, serves and closes its own
  Chrome through `tools/lib/harness.mjs`).
- Tests: `tests/audio-sfx/` (cue table against the dump, seeded choices, concurrency, locked play with a mock
  context, voice stealing with a moving listener, waves, dry balance, the safety clip).

## Performance

`play()` costs about 0.1 ms. Chromium builds an `IIRFilterNode` in ~12 ms (it measures the filter tail by brute
force), so the one-pole filters are shared nodes placed after each voice's gains (linear filters, slow gains: the same
sound); the room's convolver takes ~8 ms once. After `unlock()` the room, the shared high-pass and every wave variant
(35 buffers, 1–10 ms each, about 5 MB with the room) render one per macrotask; a play that arrives first renders its wave on the
spot.

## SPEC-GAPs

- UE pans by azimuth around a listener oriented by the hero's flipbook; we pan by screen x (small, ±0.5).
- UE's plate-reverb gain staging (submix WetLevel, Gain 0.45, the 0.8 send into the AudioVolume reverb) is engine code:
  the room's wet level 0.19 is ours.
- The wave files are not in the dump, so their loudness is unknown: `trimDb` is set by measured RMS (above).
- The hit's concurrency: the asset lists 音效并发_零点一间隔 (one per 0.1 s), but 蓝图_效果_受伤 L1848 spawns it with
  音效并发_默认, which overrides an asset's concurrency in UE (GameplayStatics: "Override concurrency settings package to
  play sound with"), so an AoE hit on several victims sounds once per victim. To follow the asset instead, add
  音效并发_零点一间隔 (8 voices, RetriggerTime 0.1) to `GROUPS` and give it to `hit`.
