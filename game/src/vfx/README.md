# src/vfx — the launch effects

- **Owner**: the `vfx` lane (task `vfx-launch`, feel wave G1b).
- **Purpose**: the Demo's launch effects, 1:1 in timing, size and amount (ART_BIBLE rule 9), drawn as crisp pixel
  art at the internal 960×540: the trail ribbon, the dust puffs, the hit spark, the spores (the Demo's blood,
  reskinned) with their floor stains, the death splat and the knight's whirlwind slash.
- **Sources**: `D:/TAPTAPGAME_studio/tmp/feel/demo-juice.md` §4.2, §7.2, §8 (the dump) and the 60 fps captures of
  the real Demo `demo-rec-01-frames` (a wall-only 4-bounce launch) and `demo-rec-02-frames` (an enemy hit), measured
  for this lane. Every number lives in `demo.ts` with its source.

## API (the wave's shared contract)

```ts
import { createVfx, SpawnPerUnit } from '../vfx';
const vfx = createVfx(renderer, { seed });           // adds its meshes and a G-buffer build pass
// every frame, in this order:
vfx.update(gameDt);                                   // the game clock, dilated by the hit-stop
const h = vfx.trailBegin();                           // at the release
vfx.trailPoint(h, x, z);                              // the hero's floor point each frame; on a bounce frame pass the contact point first
for (let n = dustMeter.step(x, z); n > 0; n--) vfx.dust(x, z);   // SpawnPerUnit: one puff per 100 uu
vfx.whirlwind(() => ({ x: hero.x, z: hero.z }));      // an enemy contact (回旋斩 restarts on every one)
vfx.hitSpark(ix, iz, nx, nz);                         // per victim, at the hit point (impact point)
vfx.spores(ix, iz, nx, nz);                           // per victim, along the normal
vfx.trailEnd(h);                                      // at the rest
vfx.deathSplat(x, z);                                 // 0.5 s into the Die animation, at the corpse's floor point
vfx.dispose();
```

- Coordinates are floor tiles (x east, z south, y up), as in `src/game`. Normals are unit vectors on the floor from
  the enemy toward the hero (the core's `Hit.normal` as it is).
- Every effect is a function of the game clock `update` advances and of the seeded RNG (one derived stream per
  effect, drawn only when something spawns), so `?t=` stills and clips reproduce, and the result at a time does not
  depend on the steps that led to it (tests/vfx-launch). The GPU lists are rebuilt in a G-buffer pass right before
  the scene pass, so spawns made after `update` show in the same frame.
- Additive to the contract: `vfx.time` (the effects' clock); `whirlwind(follow, { mirror })` (the Demo's 更新朝向 flip;
  `follow` may also return `y`, the centre height in tiles, default the pearl ball's); `SpawnPerUnit` (the Niagara
  SpawnPerUnit cadence for the dust, every 100 uu, spawning at the frame's position); the pure timing functions and
  the Demo numbers (`trailVisible`, `dustFrame`, `sparkFrame`, `whirlPose`, `stainCover`, `TRAIL`, `DUST`, …) for
  tests and tools.
- The audio lane's `play('step')` belongs with every dust puff (the Demo's dust carries the step sound,
  音效并发_脚步: ≤ 1 per 0.2 s).

## What each effect does

| Effect | Demo | Ours |
|---|---|---|
| Trail `trail.ts` | 粒子_轨迹: CPU ribbon, 46 uu, 1 point / 8 uu, masked dither + noise, Deactivate at the rest | a floor strip 46 uu (17 px) wide, a point every 8 uu (interpolated over each step), its head on the hero, mitred corners. Each point dissolves by age: solid bone white, then bone streaks (2-px lanes × 40-uu dashes) over a dim checker veil (Bayer 4×4), thinning to nothing at 1.15 s, so the band dissolves from the tail |
| Dust `dust.ts` | 粒子_Dust_01 on every mover: SpawnPerUnit 0.01, 4 × 1 flipbook, life 0.4 s | a puff 35 uu across 26 uu south of the mover (at the feet), lit from the upper left; 4 frames of 0.1 s: the puff, three blobs, two specks, two dots |
| Hit spark `spark.ts` | 粒子_Hit_01: life U(0.2, 0.6), size U(32, 64), rotation U(0, 360), 6-frame flipbook, +30 Z | the same numbers; frames: a jagged ring, a burst growing into a ragged disc, the disc bitten into a crescent that thins away; bone white |
| Spores `spores.ts` | 粒子_Blood_01: a burst along the normal, velocity-aligned drops (20 /s for 0.3 s + a burst), 2 splashes; all gone at once | a spore plume along the normal (0.12 s); two spore clouds that grow by 0.2 s, settle 50 and 120 uu out and shrink from 0.3 s; 10 round ichor droplets stretched by their speed that fall from 30 uu and slide on (≈ 1000 uu/s at most, drag 1 /s); everything vanishes 0.54 s after the hit |
| Stains `spores.ts` | BP_Decal from ReceiveParticleData: 50 %, DecalScale 2.0 × U(0.9, 1.3), fade-in 0.01 s, 10 s, fade 4 s | a droplet touching the floor leaves an ichor blot with 50 % chance, 2 × U(0.9, 1.3) its size per axis, dithered in over 0.01 s, held 10 s, dithered out over 4 s |
| Death splat `spores.ts` | 粒子_Blood_02 at the Die notify 0.5 s, (+10, 0, +20): burst, splash, smoke | 8 spore blobs thrown up and out (0.6 s), two ichor splashes on the floor (0.3–0.4 s), a spore cloud with bright spores in it (0.1–0.4 s), 10 uu up the screen and 20 uu over the corpse |
| Whirlwind `whirlwind.ts` | 回旋斩, Actor_C01_SQ_Attack02: 4 frames at 10 fps | a bone-white crescent with an ink outline and a dim speed line, 180 uu (67 px) across, behind the hero; four poses of 0.1 s (a 330° ring, then 240°, 184° and a thin 124° crescent), following the hero |

Colours (`palette.ts`): the Ink & Bone bones for the trail, dust, spark and slash; the enemies' corruption red
(the BLOOD ramp of `src/procgen/creatures/mobs.ts`) for the spores, the stains and the splat. The Demo's blood shows
as a dark red on screen, so the bulk is the ramp's dark step and the lit rims its light step: round droplets and
spore puffs, no gore.

## How it is drawn (`gpu.ts`)

- Everything is opaque pixel art in the G-buffer on the world layer: `vfxMaterial` writes the unlit and no-outline
  flags with a white-topped ramp, so a colour shows exactly and the outline pass neither rims an effect nor draws
  the silhouettes behind it through it. Fades are ordered dithers (whole pixels drop out), never blending.
- Depth is real: the hero, the enemies and the walls hide what lies behind them. Floor effects are lifted toward the
  camera along the view direction, which keeps their pixels in place: stains 0.10, trail 0.11, sliding droplets
  and splashes 0.115, dust 0.12 tiles (over the mold carpet and the planks, ≤ 0.09).
- `SpriteBatch`: instanced screen-aligned quads snapped to the internal pixel grid, sized in whole pixels; the
  fragment shader gets the pixel's offset from the centre. A *card* has its anchor's depth plus a bias (the hit
  effects: 3 tiles toward the camera, so they read over the bodies at the contact, as the Demo's translucent
  particles draw over its sprites); a *floor* sprite takes the floor plane's depth under each pixel. The whirlwind
  is a card at the ball's centre just behind it, which the ball hides and which hides the floor.

## Debug scene and measurements

`?scene=vfx-launch`: one Demo launch in the reference room (aim 243.5°: the pillar, the skull, the west wall, an urn,
the glide; legs 469 / 219 / 162 / 92 uu and 117 uu, rest 0.63 s after the release, like rec-01's 483 / 378 / 154 /
209 / 83 uu and 0.67 s), at the Demo's leg speeds and curves with the enemy contact's hit-stop. The release is at
0.5 s; `?aim=`, `?release=`, `?cast=0` (no enemies) and `?seed=` vary it. The comparison sheets and the numbers are
in the task result (`D:/TAPTAPGAME_studio/shots/vfx-launch/sheets/`).

Open points:
- SPEC-GAP: the stains follow the dump; rec-02 shows none after its hit (its blood is gone at 0.55 s). The Demo rolls
  the 50 % once per ReceiveParticleData batch (BP_ManeActor L7685), and its decals come from the Blood_Burst
  emitter's reported particles, so a hit there leaves a set of stains or none.
- SPEC-GAP: the Niagara modules are compiled VM code in the dump; the lifetimes, sizes and speeds that are not
  literals were measured on the captures (the spark's frames, the splashes' rest distances, the drops' flight).
