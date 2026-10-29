# Launch feel — the Demo's launch from release to rest (verified spec)

Unit `launch-feel`, task `spec-feel`, 2026-10-23. Status: **verified** against the Demo dump and the 60 fps captures of
the real Demo, except where a rule says `SPEC-GAP`. Machine-checkable vectors: `spec/launch-feel.vectors.json`
(validated by `tests/spec-feel/vectors.test.ts`).

This spec is the source of truth for ART_BIBLE rule 9 ("the launch feel is a 1:1 copy of the Demo"). It replaces
`D:/TAPTAPGAME_studio/tmp/feel/demo-juice.md` as the reference; that note stays the long-form research log. The launch
**motion** (path, speeds, curves, contacts) is already verified 1:1 (`tmp/feel/motion-verify.md`) and implemented in
`src/core/launch`; it is restated here only as reference (§3.2). Do not change it.

Contents: §1 conventions · §2 conflicts resolved · §3 rules FEEL-001…FEEL-114 · §4 reference event timeline ·
§5 event-log contract (what the vectors check) · §6 reskin table · §7 SPEC-GAPs · §8 measurement appendix.

---

## 1. Conventions

### 1.1 Units and scale

| Unit | Meaning |
|---|---|
| uu | Unreal unit. 1 tile = 64 uu. Hero capsule radius 56 uu. |
| internal px | our 960×540 grid: **0.375 px/uu** (24 px per tile). |
| px@1080p | 0.75 px/uu (the Demo: OrthoWidth 2560 over 1920 px; ours: ×2 upscale). Widget values in the dump are authored at 1920×1080. |
| cap px | a pixel of the 2560×1440 Demo captures: **1 cap px = 1 uu** (motion-verify's track fit; the floor-tile autocorrelation peaks at 64 cap px in x and y in both captures). Widget values appear ×4/3 there. |

### 1.2 Clocks

- **game**: world time, slowed by the global time dilation (hit-stop, FEEL-040). Hero motion, actor timelines,
  flipbooks, particles, camera shakes and latent `Delay`s run on it.
- **real**: undilated. The HUD/UMG (damage numbers, rating panel, popups) and audio run on it.
- **frame**: 60 fps reference frames for our build (16.667 ms). The Demo captures run at ≈ 57 fps (§2 C1).
- `τ` = game seconds since the event that started the effect (usually the contact).

### 1.3 Evidence tags and sources

Tags: **[D]** read in the dump by me (file + label/line); **[C]** measured by me on the 60 fps captures (frame numbers
are capture frames `fNNNN`); **[T]** the Demo's 30 fps tutorial video, `tmp/feel/demo-tutorial-measure.md`;
**[M]** `tmp/feel/motion-verify.md` (verified 1:1); **[E]** UE 5 engine semantics (not in the dump); **[I]** inference.

Dump paths are under `D:/TAPTAPGAME_ref/dump/`. Aliases (as in demo-juice):

| Alias | Path |
|---|---|
| CK | `blueprints-pseudo/CatapultHero/BP/Skill/效果/蓝图_效果_可控弹射.txt` |
| JH | `…/BP/Skill/效果/蓝图_效果_可控反弹时交互.txt` |
| FZ | `…/BP/Skill/效果/蓝图_效果_反弹中.txt` |
| SB | `…/BP/Skill/效果/蓝图_效果_时间变速.txt`, `curves/CatapultHero/BP/Skill/效果/蓝图_效果_时间变速.json`, `raw/Game/CatapultHero/BP/Skill/效果/蓝图_效果_时间变速.json` |
| DH | `…/BP/Skill/效果/蓝图_效果_可控反弹动画.txt`, `curves/…/蓝图_效果_可控反弹动画.json`, raw template |
| SS | `…/BP/Skill/效果/蓝图_效果_受伤.txt` |
| SH | `…/BP/Skill/效果/蓝图_效果_闪烁.txt` |
| MA / OT / PL | `…/BP/Actor/BP_ManeActor.txt` / `BP_Actor_Other.txt` / `BP_Actor_Player.txt` (+ `raw/…/BP/Actor/*.json`) |
| CTL | `…/BP/Actor/蓝图_主角色控制器.txt` + `raw/…/BP/Actor/蓝图_主角色控制器.json` |
| ABL | `…/BP/Skill/蓝图_能力.txt` |
| CAM | `…/BP/交互/摄像机.txt`, `BP_PixelCamManager.txt`, `BP_PixelPerfectModifier.txt` |
| SHK | `raw/Game/CatapultHero/BP/摄像机晃动_零点六.json`, `摄像机晃动_零点二.json` |
| ANI | `raw/Game/CatapultHero/精灵片/AnimSequences/*.json`, flipbooks `raw/…/精灵片/角色/<id>/**` |
| SND | `raw/Game/CatapultHero/声音/*.json` (MetaSound graphs) |
| VFX | `raw/Game/CatapultHero/粒子/*.json` (cooked Niagara) |
| DMG | `…/BP/UI/UI_伤害提示.txt` + `widgets/CatapultHero/BP/UI/UI_伤害提示.json` |
| HUD | `widgets/CatapultHero/BP/UI/UI_主界面.json`, `UI_回合统计词条.json`, `UI_充能提示.json`, `…/BP/UI/UI_头顶状态条.txt` |
| DT | `datatables/CatapultHero/数据表/角色/数据表_玩家.json` (row 幽冥骑士), `数据表_敌人_普通.json`, `数据表/技能/数据表_技能_默认.json` |
| CV | `curves/CatapultHero/BP/曲线表.json` |
| MAT | `raw/Game/CatapultHero/渲染/Mat_SpritBase.json` (CachedExpressionData) |
| INI | `config/CatapultHero/Config/DefaultEngine.ini`, `DefaultGameUserSettings.ini` |

Captures (`D:/TAPTAPGAME_studio/tmp/feel/`, never re-recorded: the producer forbids running the Demo):

| Capture | What | Crop of the 2560×1440 screen | Key frames |
|---|---|---|---|
| `demo-rec-01-frames` | walls-only 4-bounce launch (knight), chest room, no hostile enemy | y300:1100, x950:2350 | last aim f167, first motion f168, contacts f180/f190/f194/f199, rest f205, next aim f207 |
| `demo-rec-02-frames` | 1 leg into an enemy (眼球虫 M02, survives), then a 500-uu terminal glide | y60:1350, x600:2440 | last aim f167, first motion f168, contact f173, slash f174–f199, still from f220, rest + facing flip f223 |

`ts.npy` holds the frame times (ms). Scripts and outputs of my measurements: `D:/TAPTAPGAME_studio/tmp/feel/spec-feel/`
(§8).

---

## 2. Conflicts between the sources, resolved

| # | Conflict | Resolution | Evidence |
|---|---|---|---|
| C1 | Frame cadence: INI `bSmoothFrameRate=True, SmoothedFrameRateRange=[22,40)` suggests a 40 fps cap; demo-juice models 40 fps. | **The Demo ran at the display rate.** Every capture frame is a new game frame: frame times 15–24 ms (one 38-ms frame in rec-02; median 17.6 ms ≈ 57 fps), per-frame hero steps all non-zero and on the motion model. The 40 fps cap is not in effect (probably overridden by VSync/`FrameRateLimit 60`). The Demo's motion is time-based (curve of elapsed time), so the cadence only changes sampling. **Our reference is 60 fps**, continuous-time. | [D INI ln 228–231, GameUserSettings `FrameRateLimit=60`, `bUseVSync=True`] [C `ts.npy` both captures; rec-01 steps f168–f205] [M track fit] |
| C2 | Bounce/damage shake amplitude: dump-derived 9.6 uu / 22.7 uu vs the tutorial's single measured 17 uu lobe; demo-juice also claims a 4-uu pixel snap. | The dump values are the **Perlin noise amplitude A per screen axis**, not a realised peak. The realised lobe is A·\|g0−g1\|/2 (random per play, ≤ A). Captures: bounce shake per-axis peak 10 uu (rec-01, ≈ A), damage-shake x lobe 7 uu (rec-02, 0.3 A); tutorial 17 uu (0.75 A): all consistent. The lobe *timing* matches the model exactly (zero at the start, damage lobe peak at τ≈0.12, zero at τ 0.25). The view moves in **whole uu**, not 4-uu steps (BP_PixelPerfectModifier's snap does not reach the shake offset). Vectors check A, frequency, duration and the envelope, not a realised peak. | [D SHK; FZ L5330; SS L1391; CAM SpringArm 500] [C `shake1.json`, `shake2.json`] [T §3.4] [E Perlin pattern] |
| C3 | Trail lifetime: unknown in the dump (lifetime is computed in Niagara VM bytecode); tutorial: gone ≈ 1.0–1.1 s after the hero passed; audit: "visible ≥ 0.5 s". | **A ribbon point lives ≈ 0.9 s game** (measured 0.86–1.10 s, median 0.92 s, to a 10 % residual), dissolving by dither from the old end; the bright core lasts ≈ 0.1–0.3 s behind the hero. After rest (Deactivate) the remaining ribbon is gone ≈ 0.9 s later. Still `SPEC-GAP` for the exact curve. | [D CK L7039, L5358; VFX 粒子_轨迹 literals] [C rec-01 `trail_life2.py`] [T §3.7] |
| C4 | Hit-stop visibility: the tutorial (30 fps, 5 fps candles) saw no clock lag and concluded the hit-stop is invisible or real-time; the dump says global dilation in dilated time. | **The hit-stop is real and global.** rec-02: 7 slow frames (f174–f180, hero ≈ 5–8 uu/frame instead of ≈ 27), then 3 fast frames; afterwards the room brazier (10 fps flipbook, 12 flips) and the hero's attack flipbook (4 switches) run **68 ± 9 ms late** = the dump's net loss 0.0687 s. The tutorial's 30 fps/5 fps clock could not resolve 2 video frames. | [D SB L260/L30, CurveFloat_0_1] [C `clocks.py`, `hero_eyes.py`, attack switches f183/f189/f194/f199] |
| C5 | Hit flash timing: demo-juice "flash 0.3 s" (implied: from the hit); tutorial: white on the contact frame. | The 0.3 s is the **gate** (`闪烁开关`); inside it the material **blinks** (`闪烁速度 4`). Whether the first frames are white depends on the blink phase: rec-02 white only on f182–f188 (τ≈0.08–0.21), tutorial white at 0–67 ms and 167–267 ms. Spec: 4 Hz, 50 % duty, phase from the game clock (`SPEC-GAP` waveform). | [D SH L132/L76; MAT ScalarValues `闪烁速度 4.0`, VectorValues `#ECEEE7`] [C rec-02] [T §3.5] |
| C6 | Recoil mass factor: demo-juice "MapRangeClamped(初始质量 = 0 → 1.0)". | The node is `MapRangeClamped(初始质量, 50, 800, 1.0, 0.2)`; `初始质量` is never written by any Blueprint (default 0) → factor **1.0** for every actor. Recoil = **48 uu** for hitter speeds ≤ 3000 uu/s (all knight legs). | [D DH ln 62; grep `初始质量` in `blueprints-pseudo/**`: only the declaration MA ln 182 and reads] |
| C7 | Dust spacing: dump SpawnPerUnit 0.01 (1 per 100 uu) vs tutorial "a puff every 15–20 px (35–47 uu)". | **1 puff per 100 uu.** The tutorial counted the fragments a puff breaks into. rec-01: fresh puffs ≈ 100 uu apart. | [D VFX 粒子_Dust_01 SystemUpdate literal 0.01] [C rec-01 f172–f178] |
| C8 | Damage-number clock: real (UMG) or game. | **Real time.** The measured scale keys sit at real 0.2/0.3/0.5 s after the contact frame, not stretched by the hit-stop. Its removal `Delay(2.0)` is game time but the opacity is already 0 at real 2.0 s. | [D DMG L272, L288; widget 弹出V2] [C `number_track.py`] |
| C9 | Hit-SFX concurrency: asset `音效_基础_砍中肉` has `音效并发_零点一间隔`; demo-juice uses it. | The call passes `SoundConcurrency'音效并发_默认'`, which overrides the asset's set [E]. Use 默认 (6 voices). | [D SS ln 128; SND 音效_基础_砍中肉 ConcurrencySet] |
| C10 | Dump squash 反弹动画 on the hero (audit) vs none. | **No squash on the hero.** Only BP_Actor_Other plays 反弹动画2 (the touched actor's squash). Capture: the knight's sprite keeps its size through 4 wall contacts. | [D DH L933 (cast to BP_Actor_Other); raw BP_Actor_Player 反弹动画 empty] [C rec-01 f177–f204] |

---

## 3. Rules

Format: **ID — title.** Value. *Dump:* source. *Capture:* measurement. Rules marked *(reference)* are already
implemented and verified; they are listed so the timeline and vectors are complete.

### 3.1 Input

**FEEL-001 — Fire on release.** The launch fires when the left button is **released** (`输入_点击` *Completed*);
the press (*Started*) only records the button and the click position. *Dump:* raw CTL `EnhancedInputActionDelegateBinding`
(`ETriggerEvent::Completed` → `InpActEvt_输入_点击_…_7` → L8457 → L8104 → L4635 → L4939 → `根据操作执行技能`;
`Started` → L7888 → L6488). *Capture:* both recordings: the last frame showing the aim preview is f167, the hero has
already moved in f168.

**FEEL-002 — No charge, no hold, no cancel.** Leg length is the stat 弹射距离 = 500 uu, independent of the cursor
distance; nothing after release can cancel the launch. *Dump:* DT 幽冥骑士 `弹射距离 5.0e2`; LM LAUNCH-012.

**FEEL-003 — Zero wind-up: the release frame already moves.** 可控挥击 `吟唱 0.0` → `释放开始` executes the skill
in the frame that processes the release, and the path follower advances leg 0 in that same frame. The first frame
rendered after the release shows the hero displaced by `C(dt/T)·L` (60 fps, L = 500: **46.8 uu**); no rendered frame
shows the hero standing still without the preview. *Dump:* DT 数据表_技能_默认 row 可控挥击 `吟唱 0.0`; ABL `释放开始`
L13382 → L13434; CK L7672 → L1882. *Capture:* rec-01 f168 46.5 uu after an 18-ms frame (model 49.5); rec-02 f168
≈ 45 uu (eye midpoint (917.5,649.5) → (870.5,666.5)). [T] 0–1 frame.

**FEEL-004 — What changes on the release frame.** The aim preview (chevrons, rings, markers) and the hover outline
of the aimed enemy (`描边开关`, white `#ECEEE7`) disappear in the release frame; the mouse cursor stays. The hero
sprite flips to face the travel direction (FEEL-021). *Capture:* rec-01/rec-02 f167 → f168.

**FEEL-005 — Release feedback is sound only.** The launch whoosh (FEEL-090). No camera shake, no VFX burst, no time
dilation, no hero pose at release. *Dump:* ABL L13434 `选择声音播放(音效, 1)`; CK. *Capture:* camera offset exactly 0
from f160 to f180 in rec-01 and to f173 in rec-02.

### 3.2 Motion (reference — verified 1:1, implemented in `src/core/launch`)

**FEEL-010 — Main legs** *(reference)*. Speed `min(2000 + 300·疲劳, 6000)` uu/s (knight 2000/2300/2600/2900),
duration `max(L/v, 0.01)` s game, distance = `C(t/T)·L` with 可控反弹曲线 (starts at 1.418 × average, ends at 0;
reaches 1 at t/T = 0.9986). *Dump:* CK L1882, CV; [M] Q1–Q3. *Capture:* rec-01 legs end on f180, f190, f194, f199 [M].

**FEEL-011 — Terminal glide** *(reference)*. Speed 0.3 × the last main speed, 可控终末确定曲线 (starts 2.626 ×
average), length = the next leg (≤ 500 uu) after a counted bounce, else ≤ 96 uu; no contact at its end.
*Dump:* CK L1196; 碰撞预览圈 ln 184–192. *Capture:* rec-02 glides 500 uu after the enemy at 0.3 × 2000 = 600 uu/s,
T = 0.833 s game: the glide ends when its curve reaches 1 (0.829 s game) = 0.897 s real after the contact frame
(+ 0.069 s hit-stop); the rest frame (facing flip) is f223, 0.915 s after f173.

**FEEL-012 — Contacts are instant** *(reference)*. A leg ends in the first frame whose curve reaches 1; the contact
is processed in that frame; the next leg starts in the same Blueprint execution and moves from the next frame (no
idle frame, no Delay, no latent animation). The only slowdown is the hit-stop (FEEL-040). *Dump:* CK ln 70–96;
[M] Q5, track fit (no idle frame). *Capture:* rec-02 f172 → f173 the hero creeps 5.6 uu into the contact (≈ 0
speed), f174 is already the first glide frame.

**FEEL-013 — Frame cadence.** The Demo renders a new game frame at the display rate (≈ 57–60 fps in the captures);
our build steps time continuously at 60 fps. See C1. *Capture:* `ts.npy` median 17.6 ms, every frame a new hero
position.

**FEEL-014 — Hero physics.** Kinematic teleport along the stored path (no sweep), `ComponentHit` ignored while
`状态.可控弹射`; touched actors receive no impulse. *Dump:* native-trajectory NATIVE-086 [M]; MA L4636; JH L4261.

### 3.3 Hero

**FEEL-020 — No pose, rotation or squash in flight.** During the legs the hero plays its Idle flipbook (8 frames at
10 fps game, loop); the sprite is never rotated and never squashed/stretched at contacts. *Dump:* ABP states
Idle/BaseAttack/Die/Stun; DT 动画 `Actor_C01_SQ_Idle` (8 f, 10 fps); DH L933 (squash only for BP_Actor_Other);
raw BP_Actor_Player 反弹动画 track without keys. *Capture:* rec-01 f177–f204: the sprite keeps its size and shape
through the contacts f180/f190/f194/f199 (`r1_hero_contacts.png`). Reskin: §6 (the ball).

**FEEL-021 — Facing only at start and rest.** `更新朝向` sets the sprite's X scale to ±1 by the sign of the
movement direction's screen x, only at launch start (CK L6029) and at rest (CK L5448). It does not turn on later
legs. *Capture:* rec-02 flips at f168 (aim left) and back at f223 (the glide went right); rec-01 keeps facing right on
the leftward leg 2 (f191–f194).

**FEEL-022 — Whirlwind slash (回旋斩) on every enemy contact.** `进入攻击状态` → PaperZD `AttackState`: flipbook
`Actor_C01_SQ_Attack02`, **4 frames at 10 fps game = 0.4 s game**, restarted by each enemy contact; `动画攻击检测`
lasts 0.4 s, then `退出攻击状态` → Idle. Damage is applied at the contact, not at a notify. *Dump:* MA 进入攻击状态
L758; ANI `Actor_C01_SQ_Attack02` (FramesPerSecond 10, 4 frames); NTF 动画攻击检测. *Capture:* rec-02: the slash
appears f174 (first frame after the contact frame), its flipbook frames switch at f183/f189/f194/f199 = τ 0.1/0.2/
0.3/0.4 on the dilated clock, Idle from f200 (0.47 s real); the white slash disc spans **176–180 uu** (2.8 tiles) in
frame 1 (`whirl.py`).

**FEEL-023 — Hero recoil off a surviving enemy.** After the attack, the touched enemy gets a mirrored contact
(`手动触发碰撞` with both normals reversed); its `反弹中` applies 可控反弹动画 (FEEL-050) to the hero: the hero's
sprite root `额外动画根` is pushed away from the enemy by `track(τ) × 48 uu` (peak at τ 0.07). None if the enemy
died (`BP_ManeActor` L4774 requires `!死掉了？`). *Dump:* JH L5427 (mirrored hit), MA L4774, FZ L9926 → DH L25.
*Capture:* not separable from the glide and the slash in rec-02 → `SPEC-GAP` G3.

**FEEL-024 — Hero light.** A point light (6.5 cd, radius 500 uu, 6000 K, +100 Z, no shadows) moves with the hero
and lights the floor around it. *Dump:* PL SCS. *Capture:* the lit pool travels with the hero in both recordings.

### 3.4 Camera shakes

**FEEL-030 — Shake model.** Every Demo shake is a `PerlinNoiseCameraShakePattern` played with
`PlayWorldCameraShake(class, 摄像机中心, inner 0, outer R, falloff 1)`. The camera sits 500 uu above `摄像机中心`
(SpringArm length 500, pitch −90), so the radial scale is `s = 1 − 500/R` and the amplitude **A = 250·s uu on each of
the two screen axes** (X amplitude 0; rotation and FOV not visible). Noise: per axis `A·PerlinNoise1D(n0 + f·τ)` with
`n0` a random integer (so the offset starts at 0 and crosses 0 every 1/f s), times a linear blend weight (0.1 s in,
0.1 s out). `bSingleInstance`: a new trigger of the same class restarts the running instance (duration counted from
the last trigger, noise not re-randomised). Shakes tick on the **game clock** (slowed by the hit-stop). Translation
only: no roll, zoom or FOV. *Dump:* SHK (`LocationAmplitudeMultiplier 250`, `X {0,0}`, `FOV.Frequency 0`,
`bSingleInstance true`); CAM SCS `TargetArmLength 500, Pitch −90`; [E] FPerlinNoiseShaker defaults (amplitude 1,
frequency 1), `CalcRadialShakeScale`, `FMath::PerlinNoise1D`. *Capture:* three static patches agree to 0.1 uu (no
roll); during the rec-02 slow frames f174–f180 the offset is frozen at (0, +1) uu.

**FEEL-031 — Bounce shake 摄像机晃动_零点六.** On every player bounce (wall, enemy, gravity): R 520 → **A = 9.62 uu**,
f = 8, **duration 0.5 s game**, blend 0.1/0.1. *Dump:* FZ L5330; SHK 零点六 (`LocationFrequencyMultiplier 8`,
`Duration 0.5`). *Capture:* rec-01: no offset during leg 0; ≤ 2 uu per axis after contact 1, ≤ 1 after contact 2,
≤ 5 after contact 3, up to (−7, +10) uu after contact 4; back to 0 at f228 = 0.51 s after the last contact.

**FEEL-032 — Damage shake 摄像机晃动_零点二.** Per damage instance whose source is 攻击 (0) or 投射物 (5), one per
victim: R 550 → **A = 22.7 uu**; crit R 750 → **A = 83.3 uu**; f = 4, **duration 0.3 s game**, blend 0.1/0.1. Its
noise has a single lobe in the first 0.25 s game (peak near τ 0.125). *Dump:* SS L1391 (`750/550`, `是暴击？`); SHK
零点二 (`LocationFrequencyMultiplier 4`, `Duration 0.3`). *Capture:* rec-02: x lobe −2, −5, −7, −7, −6, −5, −3, −1,
0 uu on f181–f189 (peak at τ ≈ 0.11–0.12, zero at τ ≈ 0.25 game), combined shake over at f205 (0.50 s game + 0.069 s
hit-stop after the contact); [T] lobe 17 uu, 233 ms.

**FEEL-033 — No other shakes in a launch.** None at release, at rest, on kills (only the killing hit's own damage
shake), on wall-only effects. Shakes with R ≤ 500 (enemy attack notifies 400/500, 蓝图_效果_爆炸 500) have scale 0.
*Dump:* FZ, SS, NTF 精灵摄像机震动, 蓝图_效果_爆炸. *Capture:* rec-01 f160–f180 and after f228 exactly 0.

**FEEL-034 — Shake resolution.** The Demo's view offset moves in whole uu (1 cap px; 0.75 px@1080p), not in the 4-uu
steps of `BP_PixelPerfectModifier`. Our renderer decides how the uu offset maps to its pixel grid (one internal px
= 2.67 uu) — see G8. *Capture:* `shake1.json`/`shake2.json` offsets take every integer from 1 to 10 uu, not only
multiples of 4.

### 3.5 Time dilation

**FEEL-040 — Hit-stop on hostile contacts.** `反弹中` spawns 蓝图_效果_时间变速, which plays timeline 普通时间扭曲
(0.25 s) only if the touched actor has `可交互.角色.AI.仇恨`. Track 变速 (constant keys) sets the **global** time
dilation: **0.2 for τ ∈ [0, 0.022), 1.5 for [0.022, 0.08), 1.0 after** (τ = timeline time = game time); the value is
set in the contact frame and applies from the next frame; each hostile contact restarts it from 0; the effect is
destroyed at τ 0.25. Real durations: 0.110 s at 0.2×, 0.0387 s at 1.5×; **net world-time loss 0.0687 s per hostile
contact**. At 60 fps: **7 frames at 0.2×, 3 frames at 1.5×**. Walls, decorations and gravity bounces: no hit-stop.
*Dump:* SB L260 → L236 → L55 (PlayFromStart), L30 (SetGlobalTimeDilation), L25 → L10 (destroy); curves
`CurveFloat_0_1` (0.2 @0, 1.5 @0.022, 1.0 @0.08, RCIM_Constant); raw `普通时间扭曲_Template` TimelineLength 0.25,
no bIgnoreTimeDilation. Already in `src/core/launch/settings.ts` `HIT_STOP`. *Capture:* rec-02 contact frame f173;
slow f174–f180 (7 frames, hero 5–8 uu/frame), fast f181–f183, normal from f184; afterwards the world runs 68 ± 9 ms
late (C4).

**FEEL-041 — What the hit-stop slows.** Everything on the game clock: hero motion, enemy reactions (recoil, squash,
flash gate), character and prop flipbooks, particles, camera shakes, actor timelines and Delays. **Not** slowed: the
HUD/UMG (damage numbers, rating panel, popups) and audio. *Dump/[E]:* UE global dilation; UMG on Slate time.
*Capture:* brazier flipbook and the attack flipbook lag 68 ms (slowed); damage-number keys on real time (FEEL-100);
shake frozen during the slow frames.

**FEEL-042 — No other time effects in a launch.** No kill or last-enemy slow-motion, no freeze frames, no impact
frames. 暴击时间扭曲 (SB) and both 受伤 timelines are never played; GM 减速时间/正常时间 have no callers (both 1.0).
*Dump:* SB (no PlayFromStart for 暴击时间扭曲); SS; GM L27303, L27331. *Capture:* rec-02 no frozen frame.

**FEEL-043 — Clock implementation tolerance.** Our continuous clock (`src/game/hit-stop.ts`, sub-frame exact) and
the Demo's frame model differ by ≤ 1 frame per hostile contact; both are acceptable. *Source:* [M] U2.

### 3.6 Enemy hit reaction (the touched enemy)

**FEEL-050 — Recoil 可控反弹动画.** Applied by the hero's `反弹中` to the touched actor (also when it died): its sprite
root `额外动画根` gets the 2-D offset `Normal2D(ImpactNormal) × track(τ) × MapRangeClamped(hitter 移动当前速度,
3000→6000, −48→−96) × MapRangeClamped(初始质量, 50→800, 1.0→0.2)` = **away from the hitter, 48 uu × track** for the
knight (C6). Track (cubic, user tangents, game time): **0.30 @0 (slope 17.418/s) → 1.00 @0.07 → 0.87 @0.18 (slope
−2.02) → −0.20 @0.36 → 0 @0.56**; timeline 1.0 s, then offset reset and effect destroyed. Samples (uu): 14.4 @0,
30.9 @0.022, **48.0 @0.07**, 41.8 @0.18, 22.0 @0.25, 2.4 @0.30, −9.6 @0.36, −2.1 @0.50, 0 @0.56. The actor itself
never moves (FEEL-053). *Dump:* DH L25 (UpdateFunc), L896 (PlayFromStart), L1135 (reset); raw template
TimelineLength 1.0; curves `CurveFloat_0`. *Capture:* rec-02: displaced from the first dilated frame f174; during the
slow frames the displacement grows by +15 uu (f174 → f180), the dilated track predicts +14.9 uu (17.2 → 32.1); f181
adds +11.9 uu (track +13.0); the sprite is pushed partly behind the room wall on f181–f188; back at rest on f206
(τ 0.53). [T] peak 51 ± 7 uu.

**FEEL-051 — Squash 反弹动画2.** Played with the recoil on the touched actor's flipbook (BP_Actor_Other only),
`RelativeScale3D` over **0.5 s game**: X (width) **1.0 → 0.90 @0.098 → 1.20 @0.201 → 0.95 @0.331 → 1.00 @0.497**;
Z (height) **1.0 → 1.20 → 0.90 → 1.10 → 1.00** at the same times; Y 1.0; first segment linear, then cubic with flat
(0) tangents at every key (ease in-out between keys);
restarted per contact; `ForceRestoreState`. *Dump:* DH L933 (StopSequence/PlaySequence); raw BP_Actor_Other exports
46/48 (`MovieSceneDoubleVectorTrack_1` on `PaperFlipbook.RelativeScale3D`, TickResolution 24000, range 12000).
*Capture:* rec-02 f189–f195 (τ 0.22–0.33) the eyeball is visibly wide and flat.

**FEEL-052 — Hit flash.** Per damaged victim (not while the victim is `攻击中？`): `蓝图_效果_闪烁` sets the sprite
material's `闪烁开关 = 1`, `Delay(0.3)` game, then 0. While the gate is on, the material blinks with `闪烁速度 = 4`:
the whole sprite draws in the flash colour **#ECEEE7** (the material's 描边颜色; saturated pixels keep a faint tint).
Spec for our build: white while `frac(gameClock × 4) < 0.5` (4 Hz, 50 % duty, phase from the game clock) —
`SPEC-GAP` G2. *Dump:* SH L132 (`闪烁开关 1`), L76 (`Delay 0.3`), L38 (`0`); MA 受到即时伤害 L2738 → L6238; MAT
ScalarValues (… 闪烁开关 0, …, 闪烁速度 4.0), VectorValues `#ECEEE7`. *Capture:* rec-02 white on f182–f188 (7 frames,
τ ≈ 0.08–0.21), measured colour (232–237, 235–240, 225–231), the pupil light pink (≈ 85 % toward the flash colour);
not white on f174–f181 nor from f189. [T] white f026–f027 and f031–f033.

**FEEL-053 — No knockback.** The touched actor is never moved or impulsed by the launch; only its sprite offset
(FEEL-050) and scale (FEEL-051) change. *Dump:* MA/FZ/JH contain no AddImpulse for the victim. *Capture:* rec-02 the
eye returns to (658.6, 750.0) cap px exactly; the head bar does not move.

**FEEL-054 — Hurt state.** `受伤` effect 0.2 s (sets `受伤中？`); no hurt flipbook exists. *Dump:* MA L2766; ABP.

### 3.7 Damage and AoE

**FEEL-060 — Melee AoE at the contact.** On an enemy contact (knight: `碰撞墙壁触发？ false`) `发动攻击` sphere-traces
**r = 攻击距离 110 uu** around the hero (Z −100…+100); every enemy inside takes the hit (the touched one always):
damage, flash, hit VFX, number, damage shake, flesh SFX. Only the touched enemy gets recoil and squash. Damage is
applied in the contact frame. *Dump:* JH L5427 (`发动攻击`); MA 近战捕获攻击目标 ln 1103–1115 (`攻击距离`, ±100 Z);
DT 幽冥骑士 `攻击距离 1.1e2`. *Capture:* rec-02: the HP bar drops on the first image after the contact frame (f174).

**FEEL-061 — Knight hit damage.** 基础伤害 30 (crit chance 0 base). *Dump:* DT 幽冥骑士 `基础伤害 3.0e1`,
`暴击率% 0`. *Capture:* rec-02 shows "30".

**FEEL-062 — One number per victim and skill.** One `UI_伤害提示` per (victim, source skill) per launch
(`提示简化处理`); further hits add to it (count-up timer, `数值更新` scale 1.5 → 1.0 in 0.1 s on the text box); the
maps are cleared at `进入战斗状态`. Numbers on one victim are staggered by `Delay(frac(0.15·序号))`. *Dump:* SS L2236;
DMG L3118, L3353, L4907; widget `数值更新_INST`.

**FEEL-063 — Number style.** `像素字体` 18 pt (27 pt crit or weak point, 22.5 pt DoT and labels) at 1920×1080,
outline 3 `#1E2428`; colours normal `#D6D9CA`, weak `#D2A35E`, DoT `#C8765E`, damage to the hero `#BF285B`; crit icon
`会心图标`. *Dump:* DMG 更新文本内容, L2016. *Capture:* rec-02 "30" at scale 1.0: glyph height **33 cap px = 25 px@1080p
(12.5 internal px)**, with outline 59 × 45 cap px; colours (207,212,197)/(28,32,37).

**FEEL-064 — Per damage instance cues.** Each damage instance on a victim: damage shake (FEEL-032), flash (FEEL-052),
hit VFX (FEEL-083), flesh SFX (FEEL-093), number (FEEL-062/100). *Dump:* SS L1391, L1848, L2236; MA 受击特效处理.

### 3.8 Death

**FEEL-070 — The killing hit has no extra juice.** Order in the same frame: `检查死亡` → `角色死亡` → PaperZD Die,
drops; no freeze, slow-motion, impact frame or extra shake; the hit's own cues (FEEL-064, recoil, squash) still play.
No mirrored contact (no hero recoil). *Dump:* MA L3013 → L3046 → L3772, L4774; DH (applied even if dead).

**FEEL-071 — Die animation and its notifies.** Die flipbook at 10 fps game (眼球 M02: 10 frames = **1.0 s**; other
enemies 0.6–1.8 s). M02 notifies: **粒子_Blood_02 at 0.50 s** (offset +10, 0, +20), **音效_基础_血浆01 at 0.503 s**,
**精灵死亡变色 at 0.903 s**. Variants (M03, M04, M06, M08, M09, M10, M01) in demo-juice §7.3. *Dump:* ANI
`Actor_M02_Die.json` (精灵播放粒子 Time 0.5, 精灵声音播放 Time 0.5029874, 精灵死亡变色 Time 0.9029873); flipbook
`Actor_M02_SQ_Die` (10 fps, 10 frames). *Capture:* no kill in the captures → G4.

**FEEL-072 — Darkening corpse.** `精灵死亡变色` → `死亡后外观更新` → timeline 死亡变色 (2.0 s, curve 0 → 1 cubic over
**1.2 s**): material `明度 = lerp(1.0, 0.5, a)`, `饱和度 = lerp(0, 0.35, a)`. The corpse stays on the floor (after a
0.2 s physics check: collision and tick off, sort priority −5); no dissolve, no ragdoll. *Dump:* OT L13559 (Play),
L13721 (明度), L13889 (饱和度), L13504 (Delay 0.2); raw `死亡变色_Template` TimelineLength 2.0; curves BP_Actor_Other
`CurveFloat_0` (0,0)→(1.2,1).

**FEEL-073 — Kill bookkeeping (not juice).** Coins, EXP, rating 击杀敌人; see demo-juice §7.3 and rating-shot-stats.

### 3.9 VFX

**FEEL-080 — Trail ribbon 粒子_轨迹.** Spawned at launch start, attached to the hero capsule at Z −(高度 − 3) = floor
level; width `高度 − 10` = **46 uu**; one ribbon point per 8 uu (SpawnPerUnit 0.125); world space; masked dither
material, tint `#708672`; `Deactivate()` at rest (no new points, old points expire). A point lives **≈ 0.9 s game**
and dissolves by dither from the old end (C3); the bright cream core is only the newest ≈ 0.1–0.3 s.
*Dump:* CK L7039 (spawn, `轨迹宽度 = 高度 − 10`), L5358 (Deactivate); VFX 粒子_轨迹 SystemUpdate literals
(0.125, 20000). *Capture:* rec-01 bright-core FWHM **34–36 uu** (`trail_width.py`), point lifetime 0.86–1.10 s
(`trail_life2.py`); [T] ≈ 46 uu wide, gone ≈ 1.0–1.1 s after passage. Exact lifetime: G1.

**FEEL-081 — Dust 粒子_Dust_01.** On every moving ManeActor, at the feet: **1 puff per 100 uu** travelled
(SpawnPerUnit 0.01), 4×1 SubUV sprite `Mat_FX_Dust01` (quad 75 uu), world space, plays the footstep SFX (FEEL-095).
*Dump:* MA SCS (`粒子_灰尘`); VFX 粒子_Dust_01 literals. *Capture:* rec-01: a puff is ≈ 40–50 uu when it appears,
breaks into 8–12-uu specks by ≈ 0.2 s, gone ≈ 0.45 s (first puff f170 → f196); spacing ≈ 100 uu (f178).

**FEEL-082 — Walls and decorations: no particles.** A wall bounce spawns no VFX (only bump SFX and the bounce
shake). *Dump:* FZ/JH/DH/SB/MA 弹性处理. *Capture:* rec-01 contacts.

**FEEL-083 — Hit VFX per victim.** `被击特效A` = the victim's `粒子[0]` (enemies: 粒子_Blood_01, chests:
粒子_HitWithMetal_01), attached to the victim's sprite at the hit point +30 Z, rotated along Normal2D(hit normal);
`被击特效B` = 粒子_Hit_01 in world space at the hit point +30 Z (one 6-frame SubUV burst, `#D6D9CA` × 3). The knight's
physical hit adds no type VFX. *Dump:* MA 受击特效处理; DT 粒子. *Capture:* rec-02: a red spurt toward the hero on
f174–f175, the main spray along the hero's path from ≈ +0.15 s to ≈ +0.6 s real (red area peaks ≈ 4500 cap px² at
f190, +0.3 s), a ≈ 40-uu white spark at ≈ +0.3–0.4 s; all gone by f210 (+0.67 s).

**FEEL-084 — Floor stains.** Each particle-data export of 粒子_Blood_01 to the victim passes a **50 %** gate
(`传统概率判断(0.5)`); if it passes, one `BP_Decal` per reported particle at its position, size 2.0 × U(0.9, 1.3) per
axis, oriented by the particle velocity, pixelated, fade-in 0.01 s, **stays 10 s, then fades 4 s** (game time).
*Dump:* MA ReceiveParticleData L7685 → L323; MA vars `DecalScale 2.0`, `Start Delay 10.0`, `Fade Duration 4.0`;
`Blood_VFX_Pack/Blueprints/BP_Decal.txt` ln 22–27. *Capture:* rec-02 left no stain (gate failed or no export) → G10.

**FEEL-085 — Other VFX events.** Kill: 粒子_Blood_02 at the Die notify (FEEL-071). Crit: no extra VFX. Release and
rest: none (the trail just deactivates).

### 3.10 SFX (audio clock, never dilated)

Shared patch 音效_基础 (inside every one-shot): random ±5 semitones per play, tempo with pitch compensation, HPF,
AD envelope. Attenuation 音效衰减_默认; the listener is the hero sprite. *Dump:* SND 音效_基础; PL L16447.

**FEEL-090 — Launch.** 音效_基础_启动弹射 at the release frame, attached to the hero: random of mWooshLarge1/2/3
(equal weights). *Dump:* ABL L13434; DT 可控挥击 音效[1]; SND.

**FEEL-091 — Bump.** 音效_基础_普通撞 at every hero contact with a wall (`蓝图_动态网格`) or an actor tagged
`环境.房间.有弹性` / `可交互.角色.AI.仇恨` / `可交互.角色.AI.物品` (not for the mirrored enemy contact — the hero has none
of these tags —, not while the bouncer is `状态.反弹中` or an item, not in phase 8), at the hero: layer 1 IMPACT_Punch_01_mono (+2.24 st),
layer 2 击中盔甲4 from 0.2 s into the wave (vol 0.8, pitch MapRange(Speed 0→1 ⇒ −5→+5 st)), mix × Speed;
`Speed = NormalizeToRange(max(物理速度, MapRangeClamped(移动当前速度, 3000→6000, 2000→3000)), 0, 2000)` = **1.0 for
every knight leg** (no escalation). *Dump:* MA 弹性处理 ln 3888–3914; SND 音效_基础_普通撞.

**FEEL-092 — Swing.** 音效_基础_挥剑 at the attack flipbook's t = 0 notify (the enemy contact), at the hero: 挥剑 wave,
tempo 0.8, +3 st, HPF 500 Hz, vol 4.0. *Dump:* raw Actor_C01_Attack (精灵声音播放); SND.

**FEEL-093 — Flesh hit with splatter.** 音效_基础_砍中肉 per damage instance at the victim: layer A 剑击中肉体 starting
0.35 s into the wave (vol 0.7, pitch U(−5, 5) st); layer B 水爆炸 **0.1 s later** (Trigger Delay; tempo 1.51, vol 1.0,
its own pitch U(−5, 5) st). *Dump:* SS L1848 (来自技能.音效[0], SpawnSoundAtLocation at the victim, 音效并发_默认);
SND 音效_基础_砍中肉 (`Trigger Delay` 0.1, `Start Time` 0.35).

**FEEL-094 — Death splat.** 音效_基础_血浆01 (流血, vol 0.7) at the Die notify (M02 0.503 s game). *Dump:* ANI.

**FEEL-095 — Footsteps and wind.** Footsteps 音效_基础_脚步 (踩树叶2, vol 0.352 × U(1, 3), +1.04 st) from the dust
system, at most one per 0.2 s (音效并发_脚步); wind loop 音效_风循环 constant during a knight launch (Speed stays 0.63).
*Dump:* SND; VFX 粒子_Dust_01 PlayAudio; PL L16938.

**FEEL-096 — Silence where the Demo is silent.** No sound at rest/landing, no extra sound for crits or kills beyond
FEEL-093/094. Audio is never slowed by the hit-stop (the +0.1 s splatter is real time). *Dump:* CK; [E].

### 3.11 UI motion (real time)

**FEEL-100 — Damage number pop (弹出V2).** Played at creation (the damage frame), UMG real time: opacity
**0 → 1 (0.05 s) → 1 (1.6 s) → 0 (2.0 s)**; uniform scale **1.797 → 1.227 (0.2 s) → 1.290 (0.3 s) → 1.000 (0.5 s) →
1.000 (1.5 s) → 0.974 (2.0 s)**; local Y **−0.75 → +15 (0.05) → −8.68 (0.167) → −34.19 (0.5) → −36.93 (1.5) → −30.85
(2.0)** canvas px (1080p); cubic keys, tangents as stored in the widget JSON. Removed by `Delay(2.0)`. Fatigue damage
(`断开骨骼名 == 疲劳`) plays 弹出V3 instead.
*Dump:* DMG L272, L288; widget `弹出V2_INST`. *Capture:* rec-02 scale 1.55 (+36 ms; model 1.56), 1.30 (+104; 1.31),
1.25 (+139; 1.25), 1.225 (+157…+229), 1.25–1.30 (+251…+323), 1.0 (+491) — the keys on the real clock from the
contact frame f173; visible from f175; gone at f277 (+1.96 s).

**FEEL-101 — Damage number travel.** The 400×200 canvas slot starts at the projected hit point and moves to
`target = start + Rotate2D((0, 高度 − 48·(序号 % 12)), CalculateDirection(−Normal2D(hit normal)) + pick{−30, −20, −10,
0, 10, 20, 30}°)` (pick from a stream seeded by the hitter's 种子), clamped to x 485–1792, y 128–952 (1080p canvas);
position = lerp(start, target, 伤害提示曲线(t)) with t += real dt each Tick; 伤害提示曲线: 0 → 0.914 @0.42 → 1 @1.0.
(眼球 高度 = 40.) Already in `src/game/popups.ts`. *Dump:* DMG L2016, L4027, L4621, L238; CV 伤害提示曲线; DT 眼球
`高度 40`. *Capture:* rec-02 the number rises 104 cap px to its top at ≈ +0.9–1.1 s, then sinks 12 cap px by +1.9 s
(the 弹出V2 Y tail) and does not follow the camera shake.

**FEEL-102 — Rating panel 回合统计.** First scored event of the launch: **回合统计出现** (opacity 0 → 1 in 0.1 s; scale
1 → 1.1 @0.1 → 1.0 @0.25 s). Every later event: **评级更新** (letter and rank image: scale 1.2 → 1.0 and Y −12 → 0 px
in 0.2 s; frame images 1.1 → 1.0 in 0.2 s). A line's new value: **更新闪烁** (flash bar scale X 0 → 1 in 0.1 s, alpha
0 → 1 @0.1 → 1 @0.31 → 0 @1.0; row scale Y 1 → 1.1 @0.1 → 1.0 @0.3). Round end: **回合统计结束** (hold 1 s, fade to 0
by 3 s). Content and points: rating-shot-stats. *Dump:* HUD UI_主界面 `回合统计出现_INST`, `评级更新_INST`,
`回合统计结束_INST`; UI_回合统计词条 `更新闪烁_INST`. *Capture:* the panel lies outside the crops → G5.

**FEEL-103 — Charge popups.** Each bounce charges each equipped chargeable item (phase 3, 疲劳 ≤ 最大疲劳):
`UI_充能提示` "+N" plays 向上弹出/向下弹出 (Y ∓80 px over 1.0 s; scale 0.726 → 1.08 @0.16 → 1.163 @0.24 → 1.033 @0.4 →
0.873 @0.8 → 0.846 @1.0; opacity 0 → 1 @0.08 → 1 @0.877 → 0 @0.997), removed after 2.0 s. *Dump:* FZ L4871; HUD
UI_充能提示 anims; `UI_充能提示.txt` L132, L160.

**FEEL-104 — Enemy head bars.** The bar's opacity follows `血条显示曲线(counter)` (an S-curve), the counter moving
±4/s (0.25 s each way) on show/hide; no hit animation, the HP drop is instant. *Dump:* `UI_头顶状态条.txt` ln 122–151;
CV 血条显示曲线. *Capture:* rec-02: the touched enemy's bar drops on f174, is hidden by f177 and returns on
f224–f228 after rest (the hide/show triggers: G7).

**FEEL-105 — HUD never pauses.** No UI element freezes during the hit-stop or a kill. *Source:* FEEL-041, FEEL-042.

### 3.12 End of launch

**FEEL-110 — Rest is quiet.** The terminal glide eases to 0 and stops (against a wall without bouncing); no landing
pose, no dust burst, no sound, no shake. *Dump:* CK L1196, ln 150–153. *Capture:* rec-01 f205, rec-02 f223: no
event at rest.

**FEEL-111 — Same-frame end sequence.** At rest: 乱舞 (Movement Range) scored — usually the biggest score of the
launch, so the rank letter jumps (FEEL-102) — trail `Deactivate`, `更新运动数据`, `更新朝向` (FEEL-021), `释放结束`,
`结束行动` (移动中？ false; player passive: stamina −5), then the enemies' turn (`执行AI行动`, cast delay
`index × U(0.1, 0.25)` s). *Dump:* CK L7728 → L4827 → L5358 → L3244; 蓝图_效果_玩家被动 L4345 → L1533 → L1437; GM
L12847. *Capture:* rec-02 rest frame f223 shows the facing flip.

**FEEL-112 — Control returns at once when no enemy acts.** With no enemy turn, the next aim preview is shown **2
frames after rest** (rec-01: rest f205, preview f207, 35 ms). With enemies, control returns after their actions
(G6). Nothing blocks the next aim: no settle pause, no pop animation that waits. *Capture:* rec-01 f203–f214.

**FEEL-113 — Typical totals.** The reference launch of §4 (4 bounces of 500 uu, enemy at contact 2) rests at
**1.517 s real (frame 90 at 60 fps)**, 1.448 s game. Main legs take 0.17–0.25 s each; the terminal glide is ≈ 40 %
of the launch.

**FEEL-114 — No Demo-absent wrapper.** Nothing the Demo does not have may be added around the launch: no curl or
anticipation before the first motion, no settle or pop after rest that delays control, no kill freeze, no impact
frame, no screen flash, no zoom punch or camera roll, no afterimages (蓝图_效果_残影 is only used by 幻影斩).
*Source:* FEEL-003, FEEL-033, FEEL-042, FEEL-112; ART_BIBLE forbidden list.

---

## 4. Reference event timeline

Launch: knight (幽冥骑士 stats), aim straight into a chain of 4 counted bounces, every leg 500 uu, contact 1 wall,
**contact 2 an enemy (eyeball M02) that survives**, contacts 3–4 walls, terminal glide 500 uu. 60 fps frame model
(FEEL-012/040): frame `n` processes `(n/60, (n+1)/60]`; "real" is the end of the frame (when its image shows); the
release is processed in frame 0. Computed by `tmp/feel/spec-feel/timeline2.py`.

| Frame | Real s | Game s | Event | Rules |
|---|---|---|---|---|
| 0 | 0.000 | 0.000 | LMB release processed: launch starts, preview and hover outline hidden, launch whoosh, trail spawned, facing set | 001, 003, 004, 080, 090, 021 |
| 0 | 0.017 | 0.017 | first image after release: hero 46.8 uu along leg 0 (2000 uu/s, 0.25 s) | 003, 010 |
| 0–14 | | | dust puff every 100 uu (5 on this leg), footsteps ≤ 1/0.2 s | 081, 095 |
| 14 | 0.250 | 0.250 | **contact 1 (wall)**: bump SFX; bounce shake starts (9.6 uu, 0.5 s); rating event 反弹, panel appears (0.1 s fade, 1.1× pop); charge popups; no hit-stop, no particles. Leg 1 (2300 uu/s) moves from frame 15 | 031, 091, 102, 103, 012 |
| 28 | 0.483 | 0.483 | **contact 2 (enemy)**: bump SFX; bounce shake restarted; hit-stop starts (0.2× from frame 29); recoil + squash on the enemy; attack: whirlwind (0.4 s game) + swing SFX; AoE 110 uu damage 30; per victim: flash gate on (0.3 s game), Blood_01 + Hit_01, flesh SFX, damage number (anim t = 0), damage shake (22.7 uu, 0.3 s); rating events 反弹 + 所有伤害 (rank update); mirrored contact → hero recoil. Leg 2 (2600 uu/s) moves from frame 29 | 040, 050, 051, 022, 092, 060, 052, 083, 093, 100, 032, 023 |
| 29–35 | 0.500–0.600 | 0.487–0.507 | **0.2× slow frames** (7): hero ≈ 12 uu/frame, enemy recoil 17 → 32 uu, shakes nearly frozen | 040, 041 |
| 31 | 0.533 | 0.493 | damage number fully opaque (real 0.05 s) | 100 |
| 34 | 0.583 | 0.503 | splatter layer of the flesh hit (real +0.1 s) | 093 |
| 36–38 | 0.617–0.650 | 0.532–0.582 | **1.5× fast frames** (3) | 040 |
| 37 | 0.633 | 0.557 | enemy recoil peak 48 uu (τ 0.07) | 050 |
| 38 | 0.650 | 0.582 | squash key X 0.90 / Z 1.20 (τ 0.098) | 051 |
| 39 | 0.667 | 0.598 | dilation 1.0 again; whirlwind flipbook frame 2 (τ 0.1) | 040, 022 |
| 40 | 0.683 | 0.615 | number scale 1.227 (real +0.2 s) | 100 |
| 44 | 0.750 | 0.682 | **contact 3 (wall)**: bump SFX, bounce shake restarted, rating event 反弹; leg 3 (2900 uu/s) | 031, 091 |
| 45 | 0.767 | 0.698 | squash key X 1.20 / Z 0.90 (τ 0.2); whirlwind frame 3 | 051, 022 |
| 46 | 0.783 | 0.715 | number scale 1.29 (real +0.3 s) | 100 |
| 48 | 0.817 | 0.748 | hit-stop timeline ends (τ 0.25), effect destroyed | 040 |
| 51 | 0.867 | 0.798 | flash gate off (τ 0.3); damage shake over (0.3 s); whirlwind frame 4 | 052, 032, 022 |
| 52 | 0.883 | 0.815 | squash key X 0.95 / Z 1.10 (τ 0.331) | 051 |
| 54 | 0.917 | 0.848 | enemy recoil overshoot −9.6 uu toward the hero (τ 0.36) | 050 |
| 55 | 0.933 | 0.865 | **contact 4 (wall)**: bump SFX, bounce shake restarted (runs to frame 85), rating event 反弹; terminal glide (870 uu/s avg, 0.575 s) from frame 56 | 031, 011 |
| 57 | 0.967 | 0.898 | attack ends (τ 0.4) → Idle | 022 |
| 58 | 0.983 | 0.915 | number scale 1.00 (real +0.5 s) | 100 |
| 62 | 1.050 | 0.982 | squash done (τ 0.497) | 051 |
| 66 | 1.117 | 1.048 | enemy recoil settled at 0 (τ 0.56) | 050 |
| 85 | 1.433 | 1.365 | bounce shake over (0.5 s after contact 4) | 031 |
| **90** | **1.517** | **1.448** | **rest**: 乱舞 scored (rank jumps), trail deactivated, facing update, 结束行动 (stamina −5); enemy turn starts — or, with no enemy, the next aim preview at frame 92 (1.550 s) | 110, 111, 112 |
| 93 | 1.567 | 1.498 | recoil timeline ends (τ 1.0), sprite offset reset | 050 |
| ≈ 144 | ≈ 2.42 | ≈ 2.35 | last trail points gone (≈ 0.9 s after rest) | 080 |
| 124–148 | 2.083–2.483 | | damage number fades (real 1.6 → 2.0 s) and is removed | 100 |
| — | +10 s | | floor stains (if spawned) start fading, gone at +14 s game | 084 |

**Kill variant** (the enemy dies at contact 2): no mirrored contact (no hero recoil); the Die flipbook (1.0 s) starts
at frame 28; recoil and squash still play; **spore splat (Blood_02) and 血浆01 at frame 63 (1.067 s real, τ 0.5)**;
Die ends at frame 93; darkening starts at frame 87 (τ 0.903) and completes at frame 159 (2.667 s, +1.2 s); the corpse
stays. No extra freeze, shake or flash. Rules 070–072, 085, 094.

---

## 5. Event-log contract (what the vectors check)

The vectors are written against an event log of our build (one entry per event, emitted by the controllers under the
debug router's deterministic clock). Each entry carries `frame` (60 fps step index since load), `real` and `game`
seconds, `type` and a payload. Names (a lane may add fields, not rename):

| Type | Payload | Emitted |
|---|---|---|
| `input.press`, `input.release` | `button` | pointer down/up in aim |
| `launch.start` | — | the frame that starts the launch |
| `hero.step` | `d` (uu moved this frame), `x`, `y` | every frame of the launch |
| `leg.end` | `index`, `kind` (`main`/`terminal`) | the frame a leg ends |
| `contact` | `index`, `target` (`wall`/`enemy`/`prop`/`gravity`), `hostile`, `victim?` | the frame of a contact |
| `dilation` | `value` | whenever the global dilation changes (the frame it starts applying) |
| `shake.start` | `class` (`bounce`/`damage`/`damage-crit`), `amplitude` (uu), `frequency`, `duration`, `blendIn`, `blendOut`, `restart` | trigger |
| `camera.offset` | `x`, `y` (uu) | every frame |
| `hero.anim` | `state` (`idle`/`attack`), `frame` | flipbook state/frame change |
| `hero.facing` | `sign` | facing change |
| `sprite.offset` | `actor`, `x`, `y` (uu, the 额外动画根 offset) | every frame it is non-zero |
| `sprite.scale` | `actor`, `sx`, `sz` | every frame of a squash |
| `flash` | `actor`, `on` (gate), `white` (drawn white this frame) | gate change and blink change |
| `damage` | `victim`, `value`, `crit`, `source` | damage instance |
| `number.spawn` / `number.update` / `number.remove` | `victim`, `value`, `scale`, `opacity` | creation, count-up, removal |
| `number.frame` | `victim`, `scale`, `opacity`, `y` | every frame (real clock) |
| `vfx.spawn` | `system` (`trail`/`dust`/`hit-spores`/`hit-spark`/`death-spores`/`stain`), `x`, `y`, `size?` | spawn |
| `trail.deactivate`, `trail.gone` | — | at rest / when the last ribbon point expires |
| `sfx.play` | `sound` (`launch`/`bump`/`swing`/`flesh`/`splatter`/`death`/`footstep`/`wind`) | the frame the sound starts |
| `death.start`, `death.splat`, `corpse.darken` | `actor` | Die start, splat notify, darkening start |
| `ui.stats` | `anim` (`appear`/`rank`/`line`/`end`) | widget animation start |
| `headbar` | `actor`, `visible` | show/hide trigger |
| `launch.rest` | — | the frame the terminal ends |
| `aim.ready` | — | the next aim preview is drawn and input accepted |
| `aim.hidden` | — | the first image without the aim preview and the hover outline |
| `frame` | `dt` (real s) | every router step (the log's own clock) |

A vector's `event` names the type it measures (`A→B` = from the first `A` to the first `B` after it); `expected` is a
number, a `{"min", "max"}` range (null = open), a list of per-index numbers, a list of `[t, value]` keys, a string
or a boolean; `clock` says which clock `t` uses; `tolerance` is absolute in `unit` (for key lists:
`{ "t": …, "v": … }`).

---

## 6. Reskin table (the only two allowed changes)

| Demo | Ours | Must stay identical |
|---|---|---|
| 粒子_Blood_01 (red burst, velocity-aligned drops, splashes, `#8D2A21`) on every damaged victim | **red corruption spores and ichor** (the corruption red of ART_BIBLE rule 2; no gore) | attachment (victim sprite, hit point +30 Z), direction (along the hit normal), timing (spurt on the first two frames; main spray +0.15 → +0.6 s real, peak ≈ +0.3 s), amount (same screen area, ≈ 4500 uu² at peak), lifetime (gone ≈ +0.67 s); the 50 % export gate |
| BP_Decal blood stains (MI_BloodDecal) | **ichor stains** | spawn rule (FEEL-084), size 2 × U(0.9, 1.3), pixelated, fade-in 0.01 s, **10 s + 4 s fade** |
| 粒子_Blood_02 kill burst | **spore burst** | at the Die notify (M02 0.5 s), same size and duration |
| 血浆01 / 水爆炸 / 剑击中肉体 sounds | wet spore/ichor sounds (procedural, src/audio) | trigger times, the +0.1 s splatter layer, ±5 st randomisation, volumes |
| Hero Idle flipbook in flight; Attack02 whirlwind at enemy contacts | **the beetle knight's pearl ball**: curls in flight; slashes at enemy contacts; pops back at rest | first motion in the release frame (FEEL-003: the curl may not delay it — the ball is already moving in frame 0), path and speed, no squash/stretch at contacts beyond the Demo (none, FEEL-020; rolling of the ball is visual only), the slash's 0.4 s game and ≈ 180-uu size (FEEL-022), the hero recoil (FEEL-023), the pop-back runs while the player can already aim (FEEL-112: `aim.ready` 2 frames after rest whatever the pop does) |

Everything else in §3 is copied with the Demo's numbers. Colours follow the art bible (the flash colour `#ECEEE7` is
already a bone white; the number colours are Ink & Bone bone and ink).

---

## 7. SPEC-GAPs

| # | Unknown | Current spec value | What would settle it (never by running the Demo) |
|---|---|---|---|
| G1 | Trail ribbon point lifetime and dissolve curve (Niagara VM bytecode) | 0.9 s, dither from the old end (capture) | VectorVM decode of 粒子_轨迹's spawn/update scripts, or a second capture already on disk |
| G2 | Hit-flash waveform, duty and phase (`闪烁速度 4`; material graph stripped) | 4 Hz square, 50 %, phase `frac(gameClock·4)` | the Mat_SpritBase expression graph (not in the cooked dump), or more hit captures |
| G3 | Hero recoil off a surviving enemy: visible size/direction (FEEL-023) | 48 uu × track, away from the enemy | a capture with the hero's sprite visible after a hit (no whirlwind overlap), or a re-trace of the enemy's 反弹中 spawn (MA 弹性处理 L1226) |
| G4 | Kill sequence in motion (Die, splat, darkening) | dump timings (FEEL-071/072) | a capture of a kill |
| G5 | Rating panel and charge popup timings in play | widget keys (FEEL-102/103) | a full-screen capture |
| G6 | Time from rest to control when enemies act | enemy cast delays index × U(0.1, 0.25) s + their actions | a capture of a full turn |
| G7 | Head bar hide/show triggers | hidden ≈ 3 frames after the hit, back ≈ 0.1 s after rest (rec-02) | the call sites of `切换可视` (UI spec) |
| G8 | UE Perlin internals (gradient table, permutation) and how our renderer maps uu offsets to pixels | FMath::PerlinNoise1D model; offsets in uu | UE 5.7 source check; render-lane decision on sub-pixel camera offsets |
| G9 | Hit_01 / Blood_01 / Dust particle counts and size curves | capture envelopes (FEEL-081/083) | VectorVM decode or higher-zoom captures |
| G10 | Stain look and count | dump rule (FEEL-084) | a capture where the 50 % gate passes |
| G11 | Crit cues in motion (83-uu shake, 27-pt number) | dump values | a crit capture |

---

## 8. Measurement appendix

All scripts read the frames read-only and run with `python -I`; outputs are next to them in
`D:/TAPTAPGAME_studio/tmp/feel/spec-feel/`.

| What | Script → output | Method |
|---|---|---|
| Cadence | inline (`ts.npy`) | frame-time percentiles; consecutive-frame differences |
| Camera shake | `shake.py 1`, `shake.py 2` → `shake1.json`, `shake2.json` | cv2.phaseCorrelate (Hanning) of high-passed static floor/wall patches vs f160, 3 patches per capture |
| Hero track (rec-02) | `hero_eyes.py` → `hero_eyes2.json` | yellow eye-slit components, shake-compensated; the attack flipbook frames identified by their component pattern |
| World clock | `clocks.py` | flipbook flips of the brazier (10 fps) and candles (5 fps), shake-compensated region differences |
| Enemy recoil | `eye_track.py`, `enemy_edges.py` | pupil centroid and sprite edges, shake-compensated |
| Damage number | `number_track.py` → `number_track.json` | multi-scale template match of the f200 "30" (scale 0.9–2.05, step 0.025) |
| Whirlwind | `whirl.py` | largest white component around the hero |
| Trail | `trail_width.py`, `trail_life2.py` | perpendicular brightness profiles; per-point high-pass residual vs a late reference (f290–f299) |
| Curves | `curves.py` | FRichCurve Hermite evaluation of the recoil track |
| Timeline | `timeline2.py` | the 60 fps frame model of FEEL-012/040 |
| Sheets | `sheet.py` → `r1_*.png`, `r2_*.png`, `candles.png` | contact sheets of the crops |

## Open findings (backlog for the polish phase)

- FEEL-060 AoE hit test: 2-D centre distance <= 110 + the target's 宽度, not <= 110; the touched enemy always included.
- FEEL-051 squash replaces the flipbook scale (absolute positive keys), so a mirrored enemy un-mirrors for 0.5 s; pivot x-centred, 92 uu above the frame bottom.
- FEEL-050 recoil tail (-9.6 uu @0.36, 0 @0.56) is dump-only, not seen in the capture.
- FEEL-084 stain footprint: 64 uu x 2.0 x U(0.9,1.3) per axis x U(0.7,1.0) (81-166 uu), random in-plane rotation.
- FEEL-101 number travel offset: the first draw of a stream seeded by the hitter's seed (always -20 deg for the knight); 伤害提示曲线 tangents 3.129 @0, 0.675 @0.4197, auto @1.0 (overshoot ~1.006 near 0.7 s).
- FEEL-012 contact visuals appear on the frame after the leg-end frame.
- FEEL-083 spores on the game clock: spray τ 0.08→0.53, peak 0.23, gone 0.60.
- FEEL-100 popup t0 = damage time + frac(0.15·序号); removal at t0 + 2.0 s game.
- FEEL-072 darkening curve: ease-out (0,0, tangent 1.329/s) → (1.2,1, flat).
- FEEL-052 the flash is not extended by a second hit within 0.3 s (the earliest copy switches it off).
- Hit VFX skipped for rows with an empty 粒子.
- Trail anchored at the capsule centre (0,0,-53), 38 uu up-screen of the sprite's feet; blood particles inherit the recoil, squash and mirror.
- FEEL-005 release frame also prints a battle-log line and starts the 0.25 s smoothstep hide of every head bar; bars return when the phase goes back to aiming (~0.17 s after rest).
- FEEL-030 a single-instance shake restart re-ramps the blend-in from 0 over 0.1 s while the noise phase continues (visible 1-3 frame dip per contact).
- The Demo runs at 60 fps (VSync); the captures drop ~5 % of frames.
- Missing in the spec: battle log lines (UI_战斗日志), hover outline during the launch, the attack flipbook loop wrap (one full-disc frame before Idle), the next aim preview fading in over ~0.6 s, a one-frame white impact ring at the hit point on the contact+1 frame, the hovered enemy's info panel staying on screen.
