# src/render — low-resolution deferred toon renderer

- **Owner**: `p1-render-core` (everything here except `gi/` and `atmos/`, which belong to `p1-gi-atmos`).
- **Public API**: `api.ts` (types + re-exports) and `constants.ts`. Both belong to the integrator: lanes build
  against them and request changes through `needs`. Everything else here is internal and may be rewritten
  freely as long as `api.ts` and this contract still hold.
- **Reference scenes**: `?scene=hello` (lit crypt) and `?scene=contract` (one custom pass per stage plus a
  forward-layer object; copy from it); `?scene=render-shake` (the Demo camera shakes, [below](#camera-shakes-rfxcamerashake-the-demos-11)).

```ts
import { createRenderer, createToonMaterial, LAYERS } from '../render/api';
const r = createRenderer(canvas);                 // 640×360 internal at 16:9
r.scene.add(new THREE.Mesh(geo, createToonMaterial({ ramp: ['#0a1215', '#2d3d3d', '#ad936d'], dither: true })));
r.addPointLight({ position: { x: 0, y: 0.5, z: 0 }, radius: 2.5, flicker: 0.3 });
r.camera.position.set(20, 16, 20); r.camera.lookAt(0, 0, 0);
r.render(dt);                                      // every frame
```

## Frame

```
render(dt)
  fx.update · scene.updateMatrixWorld · camera snapped to the pixel grid · lights: follow, flicker, cull, pack
  gbuffer   clear G-buffer → 'scene' (LAYERS.world) → your passes
  lighting  clear irradiance → passes with order < 0 (write irradiance) → 'resolve' (0) → passes ≥ 0 → 'forward' (1000)
  post      'outline' (0) → 'bloom' (100) → 'grade' (200) → 'fx' (300), ping-pong
  overlay   clear overlay → your passes
  present   ×scale nearest-neighbour upscale, sub-pixel camera compensation, screen shake → canvas (sRGB)
```

Built-in passes are ordinary registry entries: `r.getPass('bloom')!.enabled = false`.

## Resolution and camera

- Integer upscale `scale = round(min(outputW, outputH) / 360)`, internal size `ceil(output / scale)`:
  640×360 at 1280×720, 1920×1080, 2560×1440 and 3840×2160; other aspects keep square pixels and fill the screen.
- `r.viewHeight` = world units across the internal height (divided by `camera.zoom`). The renderer owns the
  orthographic frustum; move, rotate and zoom `r.camera` freely (keep it unparented).
- **Pixel snap**: each frame the camera is moved onto the internal pixel grid of its own view plane, so static
  geometry rasterizes identically while the camera pans. The remainder is applied when presenting (a sub-pixel
  shift at output resolution), so motion stays smooth. `ctx.pixelOrigin` is the snapped camera position in whole
  pixels: add it to `gl_FragCoord.xy` for world-locked screen-space patterns (the resolve does this for dithering).
- Projection: `ctx.project(world)` inside passes uses the snapped camera, so it matches the internal targets'
  grid (use it in overlay passes). Outside rendering, `r.project(world)` gives internal pixels and
  `r.projectToScreen(world)` CSS pixels on the canvas (for DOM elements), both where the point appears on screen.
- The renderer manages `camera.layers` (world, then forward); do not rely on custom camera layers.

## G-buffer

Multiple render targets at internal resolution, RGBA16F, nearest filtering; cleared to 0 (depth 1) every frame.

| Attachment | rgb | a |
|---|---|---|
| 0 `surface` | albedo tint, linear; multiplies the ramp colour (1 = the ramp colour itself) | ramp id, integer (0 = no surface) |
| 1 `normal` | world-space unit normal | ramp shift in bands, signed (−1 = one band darker) |
| 2 `emissive` | emissive radiance, linear HDR, added after lighting (bloom threshold 0.85 luminance) | `SURFACE_FLAGS` bits: `noOutline` 1, `unlit` 2 |
| depth | `DepthTexture`, 24-bit. Orthographic, so linear: view distance = near + d·(far − near) | |

- Write it with `createToonMaterial(...)`, or with your own `ShaderMaterial({ glslVersion: THREE.GLSL3 })` that
  includes `TOON_GBUFFER_GLSL`, calls `writeGBuffer(albedo, rampId, normalW, rampShift, emissive, flags)` once,
  gets its ramp id from `registerRamp(ramp, { dither, curve, overbright })` and sets
  `material.userData.gbuffer = true`.
- **Every mesh on `LAYERS.world` must write all three attachments.** `r.validate()` lists offenders (the
  debug router prints them as warnings). Points, lines, sprites and anything transparent or additive go on
  `LAYERS.forward`: they are drawn after lighting into `lit`, depth-tested against the opaque scene. They are not
  in the G-buffer, so they get no outlines and the outlines of surfaces behind them show through; that suits
  glows and particles, so keep opaque things on the world layer.

## Lighting contract (the resolve)

Per pixel, with `n` the world normal and `p` the position reconstructed from depth:

```
light = mix(ambientGround, ambientSky, n.y·0.5 + 0.5) · ambientIntensity
      + keyColor · keyIntensity · max(n·keyDirection, 0)
      + Σ lights: color · intensity · flicker · (1 − (dist/radius)²)² · clamp(n·l·0.6 + 0.4, 0, 1)
      + irradiance[px]                                   ← GI and other order < 0 lighting passes
L    = luminance(light);  hue = light / L
t    = (L · exposure) ^ curve
band = clamp(floor(t·(count − 1) + rampShift + 0.5 + (blueNoise − 0.5)·dither), 0, count − 1)
color = ramp[band] · albedo · mix(1, hue, tint) · (1 + max(t − 1, 0)·overbright) + emissive
unlit surfaces: albedo · ramp[count − 1] + emissive
```

- Units: a light of intensity 1 at its centre lifts a surface to roughly the top band. Irradiance uses the same
  units and colours (it changes both the band and the tint), so GI composes with the direct lights naturally.
- `r.lighting` holds the global terms (ambient sky/ground/intensity, key direction/colour/intensity, exposure,
  tint, background). The blue-noise texture (64×64 void-and-cluster) is world-locked through `pixelOrigin`.
- **Ramp atlas**: every distinct ramp + (dither, curve, overbright) gets one row (ids 1..255, shared by all
  materials with the same palette). Ramps run dark → light, 2 to 6 colours.
- No shadows yet: direct light ignores occluders. Soft shadows and bounce light are expected from the GI lane
  through `irradiance`; shadow maps would be a render-core change.

## Passes

```ts
interface RenderPass { name; order?; enabled?; inPlace?; setSize?(w, h); render(ctx); dispose?() }
const remove = r.addPass('lighting', { name: 'gi-cascades', order: -10, render(ctx) { ctx.fullscreen(material); } });
```

| Stage | `ctx.target` (bound) | `ctx.input` | Cleared | Use |
|---|---|---|---|---|
| `gbuffer` | G-buffer MRT with depth | null | before the stage | extra geometry (separate scenes, instancing) with G-buffer materials; it cannot sample the G-buffer it draws into |
| `lighting`, order < 0 | `irradiance` RGBA16F | null | before the stage | additive diffuse light (use `AdditiveBlending`) |
| `lighting`, order ≥ 0 | `lit` RGBA16F + copy of the G-buffer depth | null | the resolve overwrites it | blend on top of the lit image; depth-test geometry |
| `post` | next ping-pong target | current colour | no: write every pixel | full-screen effects |
| `post`, `inPlace: true` | the current colour target | null (it is the target) | no | blend on top without a copy |
| `overlay` | `overlay`, premultiplied alpha | null | yes, transparent | the clean top layer: trajectory markers, numbers, intents |

- `ctx` also provides `gbuffer`, `targets`, `camera` (snapped; current matrices), `width`/`height`, `time`/`dt`/
  `frame`, `lighting`, `fx` (state), `debugView`, `pixelOrigin`, `fullscreen(material, target?)` and
  `project(world)` → internal pixel coordinates (top-left origin) plus NDC depth.
- Build full-screen materials with `fullscreenMaterial(fragment, uniforms, defines)`; read targets with
  `texelFetch(t, ivec2(gl_FragCoord.xy), 0)` (all internal targets have the same size and nearest filtering).
- The overlay is composited after every colour effect (flash, chroma, impact frames never touch it) but moves
  with screen shake, so world-anchored markers stay on their targets. Screen-anchored HUD belongs to `src/ui`.
- Names are unique; `addPass` throws on duplicates and calls `setSize` immediately.
- A pass never samples the target it draws into (WebGL forbids the feedback loop): lighting passes read the
  G-buffer, post passes read `ctx.input`, and depth-aware decals belong in a lighting pass or in post.

## Lights

`r.addPointLight({ position, follow?, color, intensity, radius, flicker, seed })` returns a mutable handle
(`position`, `color`, `intensity`, `radius`, `flicker`, `follow`, `enabled`); `r.removeLight(handle)`.
Lights are data, not `THREE.Light`s. `follow` makes `position` a local offset on an object (the candle on the
hero's head). Flicker is a deterministic function of render time and seed (intensity, and radius by a third
as much). Budget per frame: 64 / 32 / 16 lights (quality high / medium / low); lights whose sphere misses the
view are culled, and over budget the smallest `intensity × radius` are dropped.

## Toon materials

`createToonMaterial({ ramp, emissive?, emissiveIntensity?, dither?, tint?, vertexColors?, map?, alphaTest?,
outline?, unlit?, curve?, overbright?, side?, hooks? })` → `ToonMaterial` (a `ShaderMaterial`). Supports
instancing, batching, skinning and morph targets. `material.flash = 0..1` is a per-instance white hit flash;
`clone()` gives an independent instance; `setRamp(ramp)` swaps the palette. `hooks` inject GLSL:
`vertex` may edit `vec3 transformed` (object space); `fragment` may edit `albedo`, `rampShift`, `emissive`,
`normalW`, `flags` and read `vToonWorld`, `vToonUv`, `uTime`. `TOON_TIME` is the shared clock uniform.

## FX hooks (`r.fx`)

| Hook | Baseline behaviour |
|---|---|
| `cameraShake(kind)` | **the Demo's camera shakes** (`'bounce' \| 'damage' \| 'crit'`), next section |
| `shakeTime(scale)` | shake-time scale of the Demo shakes: the game passes the hit-stop dilation every frame (default 1, kept until changed; 0, negative or NaN freeze them) |
| `shakeSeed(seed)` | reseeds the noise offsets drawn when a Demo shake starts fresh (default 1) |
| `shake(trauma, direction?)` | the prototype's shake, kept for other scenes: trauma accumulates (max 1) and decays 1.5/s in real time; offset = trauma² × 7 internal px of smooth noise plus a directional kick, roll up to 2.5°; applied when presenting, so it is sub-pixel smooth |
| `hitstop(ms)` | `fx.timeScale` is 0 until it runs out (longest request wins); the caller multiplies game dt by it |
| `impactFrame(kind, { frames = 2, focus? })` | `'invert'` (negative two-tone), `'silhouette'` (two-tone), `'white'`, each with radial ink speed lines from `focus` |
| `chroma(amount)` | radial RGB split of up to 3 px, decays 9/s |
| `flash(color, { intensity = 0.7, ms = 120 })` | full-screen fade-out flash |

`fx.settings.shake` / `fx.settings.flash` (0..1) are the accessibility scales (`settings.shake` scales both shakes);
`fx.state` is what passes read: `shakeX` / `shakeY` are the camera offset in internal pixels (x right, y up; the
image moves the other way), the Demo shakes' snapped sum plus the trauma shake; `roll` comes from the trauma shake
only; `cameraShakes` lists the running Demo shakes (class, kind, weight, offset in uu, elapsed).

## Camera shakes (`r.fx.cameraShake`): the Demo's, 1:1

The Demo's gameplay camera never follows, zooms or rolls: only two shake classes move it (demo-juice §5). Both are
`DefaultCameraShakeBase` with `bSingleInstance` and a `PerlinNoiseCameraShakePattern` root
(`D:/TAPTAPGAME_ref/dump/raw/Game/CatapultHero/BP/摄像机晃动_零点六.json`, `…/摄像机晃动_零点二.json`). Every call is
`PlayWorldCameraShake(class, 摄像机中心, inner 0, outer R, falloff 1)`, and the camera rides a 500-uu spring arm above
摄像机中心, so the outer radius alone sets the strength: scale = 1 − 500 / R.

| Kind | Class | Played by | R | Scale | Peak (uu) | Peak (internal px) | Noise | Duration, blends |
|---|---|---|---|---|---|---|---|---|
| `'bounce'` | 摄像机晃动_零点六 | every bounce, walls and enemies (蓝图_效果_反弹中 L5330) | 520 | 0.0385 | 9.6 | 3.6 | 8 cells/s | 0.5 s, in 0.1 / out 0.1 |
| `'damage'` | 摄像机晃动_零点二 | every damage instance from 攻击 or 投射物 (蓝图_效果_受伤 L1391) | 550 | 0.0909 | 22.7 | 8.5 | 4 cells/s | 0.3 s, in 0.1 / out 0.1 |
| `'crit'` | 摄像机晃动_零点二 | the same call when 是暴击？ | 750 | 0.333 | 83.3 | 31.3 | 4 cells/s | 0.3 s, in 0.1 / out 0.1 |

Implementation: `camera-shake.ts` (pure, no three.js) ports the engine code below; `Fx.update` advances it by
`dt × shakeTime`, converts uu to internal pixels with `PPT / 64` (0.375 at 960×540), sums the classes, applies
`settings.shake` and rounds the sum to whole internal pixels (half away from zero). Camera-local Y is screen x,
camera-local Z screen y. It adds no roll.

**How to drive it (the game):** `cameraShake('bounce')` on every bounce; `cameraShake(crit ? 'crit' : 'damage')`
for every damage instance from an attack or projectile; once per frame, before rendering, `shakeTime(d)` with the
frame's hit-stop dilation `d` = the launch clock's game dt over the frame's dt (1 outside launches);
`shakeSeed(runSeed)` once. In the Demo the contact frame's tick sets the dilation, but that frame's camera update
still uses the frame's undilated delta, so a shake started on a contact gets one frame at 1× before the hit-stop
slows it; the launch clock's ratio is the continuous-time equivalent (it blends the two rates inside the contact
frame). `?scene=render-shake` shows a scripted sequence with a readout; `?plot=1` plots it.

### Engine semantics (read in the UE 5.7 source installed at `C:/Program Files/Epic Games/UE_5.7/Engine`)

| What | Where | Behaviour |
|---|---|---|
| Noise per axis | `Plugins/Cameras/EngineCameras/…/PerlinNoiseCameraShakePattern.cpp` `FPerlinNoiseShaker::Update` | `offset += dt × Frequency × FrequencyMultiplier; out = Amplitude × AmplitudeMultiplier × FMath::PerlinNoise1D(offset)`; Y and Z keep the struct defaults Amplitude 1, Frequency 1 (header); the asset sets X to 0 |
| No rotation, no FOV | `UPerlinNoiseCameraShakePattern` constructor | `RotationAmplitudeMultiplier = 0`, `FOV.Amplitude = 0` ("default to only location shaking"); the assets do not override them |
| Start offsets | `StartShakePatternImpl` | a fresh start draws `FMath::RandHelper(255)` (integers 0..254, so every shake starts at a noise zero); a restart (`bIsRestarting`) keeps the running offsets |
| Update order | `UpdateShakePatternImpl` | the noise advances first, then `FCameraShakeState::Update` returns the blend weight; the result is scaled by the weight and by `ShakeScale` (`UCameraShakeBase::UpdateAndApplyCameraShake`, `GetTotalScale`); a finished pattern applies nothing |
| Blend state | `Runtime/Engine/Private/Camera/CameraShakeBase.cpp` `FCameraShakeState::Update` | elapsed, blend-in and blend-out timers advance by dt; elapsed ≥ Duration ends the shake (weight 0); blend-out starts when the remaining time drops below BlendOut (timer = BlendOut − remaining); weights are linear |
| Restart | `FCameraShakeState::Start` | a playing instance re-initialises (elapsed 0, blend-in from 0, so the weight drops to one step of the blend-in); if it was blending out, the blend-in starts at the equivalent weight |
| One instance per class | `Camera/CameraModifier_CameraShake.cpp` `AddCameraShake` | a single-instance shake looks for a running instance of the same **class** and restarts it with the new scale, so `'damage'` and `'crit'` share one instance (the last play sets the strength); finished shakes leave in the same `ModifyCamera` |
| Radial scale | `PlayerCameraManager.cpp` `CalcRadialShakeScale` | `(1 − clamp((d − inner) / (outer − inner), 0, 1))^falloff`, d = epicentre to camera = the 500-uu arm |
| Dilated time | `LevelTick.cpp` (`DeltaSeconds *= GetEffectiveTimeDilation()`, then `UpdateCameraManager(DeltaSeconds)`) | the camera manager, and so every shake, ticks in dilated world time: the hit-stop slows the shakes |
| No 4-uu snap of the shake | `PlayerCameraManager.cpp` `AddCameraModifierToList` | a new modifier goes before the first one with an equal or higher priority value; both default modifiers have priority 127, so `BP_PixelPerfectModifier` (listed second) runs before the shake modifier: the 4-uu snap applies to the base view only and the shake moves the image in whole screen pixels |
| Noise function | `Runtime/Core/Private/Math/UnrealMath.cpp` `FMath::PerlinNoise1D` | 16 lattice gradients ±1/8 … ±8/8 through a fixed 256-entry permutation, quintic fade, × 2: 0 at integers, range [−1, 1]. `gradientNoise1D` is built the same way with its own fixed seeded shuffle (the engine table is not copied), picked from 4000 for per-cell peaks distributed like the engine table's (mean 0.428, p90 0.75, max 1) |

### Checked against the Demo captures

Phase correlation of static floor and wall regions in the 60 fps captures (`D:/TAPTAPGAME_studio/tmp/feel/`,
1 capture px = 1 uu at 2560×1440), fitted with the model above (scripts in `D:/TAPTAPGAME_studio/tmp/render-shake/`):

- rec-01, walls-only 4-bounce chain (f176–f232): the shake moves in whole pixels (±0.05 px), starts fresh after the
  first wall contact and drops back to ≈ 0 at every later contact (f190→f191, f199→f200: the restart); the model with
  the dump's numbers (A = 9.6 uu, 8 cells/s, 0.5 s, blends 0.1 s, restarts) reproduces all 57 frames on both axes
  with an rms residual of 0.63 px; amplitude fitted freely: 9.9 ± 1 uu. Peak seen 10 px.
- rec-02, enemy hit (f168–f212): 零点六 + 零点二 at R 550 in hit-stop time reproduce it with an rms residual of
  0.56–0.58 px; the same model without the dilation fits 5× worse, a crit (R 750) or ±25 % amplitudes fit worse; the shake
  ends 0.57 s after the contact (0.5 s of shake time stretched by the hit-stop).
- The tutorial video's hit (17 uu peak, one push, ≈ 233 ms at 30 fps) lies inside the model's spread for a hit:
  median peak 15 uu (quartiles 11–19), time above one video pixel 0.23–0.37 s (10th–90th percentile); this port
  gives the same distribution.

### SPEC-GAP

- The Demo's shake moves in whole screen pixels (1.33 uu at 1080p); this port snaps to whole internal pixels
  (2.67 uu), as the task asks, so it moves in 2-output-pixel steps at ×2.
- The permutation table differs from the engine's, so a given seed does not reproduce a particular Demo shake;
  only the statistics match.

## Debug views

`?view=` (or `r.debugView`): `final`, `lit` (resolve output before post), `light` (the light value `t`: grey up
to 1, warm above), `irradiance`, `surface`, `ramp` (a colour per ramp id), `normal`, `emissive`, `depth`
(stripes every 2 world units), `overlay`. Passes can read `ctx.debugView` to show their own buffers.

## Baseline limits (for the lanes)

- Outline thresholds are in world units (0.18) and tuned for `viewHeight` ≈ 10; creases use the prototype's
  view-space normal bias.
- Bloom is two levels (½, ¼) quantized into 12 steps; grading has no LUT yet; grain is multiplicative.
- Point lights are a per-pixel uniform loop; no specular; one directional key without shadows.
