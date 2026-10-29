# src/procgen/creatures — the beetle knight and the small fry

- **Owner**: the `creatures` lane (with `src/anim/`).
- **Files**: `shapes.ts` (part kit, `toon`, `stand`, `dropShadow`, rims), `beetle-knight.ts` (the hero), `mobs.ts`
  (`Mob`, `watchers`), `mob-rigs.ts` (the four small fry: model, idle pose, death flipbook).
- **Feel**: hits, deaths and the hero's launch states are the Demo's (ART_BIBLE rule 9; demo-juice §4.1, §7.2,
  §7.3). The keys and their dump sources are in `src/anim/reactions.ts`. Everything advances only in
  `update(gameDt)`: pass the hit-stop's dilated game dt and the reactions slow with the world, as in the Demo.
  Debug scene: `creatures-feel` (`?zoom=`, `?at=x,z`, `?kinds=`).

## Mob

| Member | What |
|---|---|
| `new Mob(kind, { scale?, seed? })` | as before: `scale` (elites are bigger), `seed` (idle phase). The Demo row (质量 or anything else) does not enter the reactions. |
| `position`, `facing`, `target`, `radius`, `group`, `body` | as before: floor point (tiles, x east / z south), the stare target (the hero) |
| `lights` + `bindLights(handles)` | (additive) pass back the `PointLight`s made from `lights`, in order: they go out with the death |
| `hitReact(nx, nz, hitterSpeedUu)` | the **touched** enemy only, dead or alive: 反弹动画2 (width 1 → 0.9 → 1.2 → 0.95 → 1, height 1 → 1.2 → 0.9 → 1.1 → 1, 0.5 s; feet stay on the floor) and 可控反弹动画 (the body and its shadow pushed along −n by track × MapRangeClamped(speed, 3000, 6000, 48, 96) uu: 14 uu at once, 48 at 0.07 s, −9.6 at 0.36 s, 0 at 0.56 s). The same distance for every body, light or heavy: the effect's mass factor, MapRangeClamped(拥有者.初始质量, 50, 800, 1, 0.2), is 1 because 初始质量 is never assigned (BP_ManeActor default 0; the row's 质量 attribute goes to SetMassOverrideInKg in 更新角色质量, never into 初始质量). (nx, nz) is the unit contact normal from the enemy toward the hero; restarts on every contact. |
| `flash(seconds = 0.3)` | **every victim** of a hit: a flat near-white blink (4 Hz square wave on the mob's game clock, gated for `seconds`; below the bloom threshold). Skipped while `attacking` (additive, set by the game during the enemy's attack). Also opens the mouth for 0.5 s. |
| `die({ onSplat? })` | 10 frames at 10 fps (1 s); `onSplat` once at 0.5 s (spawn the spores, play the splat); eyes, candles, floor glow and bound lights go out from 0.5 to 1.0 s; from 0.9 s the corpse darkens over 1.2 s (明度 1 → 0.5, 饱和度 0 → 0.35). The corpse stays (no collision is the game's: drop it from the launch world). |
| `corpse` | true once the corpse has settled (2.1 s after `die`) |
| `update(gameDt, camera?)` | advances everything; `camera` turns the glow cards |

## BeetleKnight

| Member | What |
|---|---|
| `launchStart()` | curls into the pearl ball in `CURL_SECONDS` (0.1 s; the ball shows from 45 %) while it already moves; interrupts a pop |
| `launchEnd()` | pops back out in `POP_SECONDS` (0.3 s, with the hop and the happy face), non-blocking |
| `slash()` | 回旋斩 on an enemy contact: 4 steps at 10 fps (0.4 s); the body whirls a quarter turn per step and flares (ramp lift +1.2, +0.8, +0.45, +0.2 bands). The crescent is the VFX lane's. |
| `recoil(nx, nz)` | off a surviving enemy only: the body and shadow pushed 48 uu × the recoil track along (nx, nz), the same contact normal (enemy → hero) |
| `roll(dx, dz)` | rolls the ball by the floor displacement, without slipping up to `ROLL_RATE_MAX` (30° per 60-fps frame), slipping beyond, so the seams never strobe |
| `setCurl(k)`, `face`, `facing`, `mode`, `position`, `flash` (0..1 hit flash) | as before |

## Wiring a contact (the Demo's order, launch-movement §9.2)

1. `mob.hitReact(hit.normal.x, hit.normal.y, contact.speed)` on the touched enemy (`hit.normal` from the core points
   from the enemy toward the hero; uu x/y are the floor's x/z).
2. `knight.slash()` on an enemy contact, `mob.flash()` on every victim, `mob.die({ onSplat })` on the killed.
3. `knight.recoil(hit.normal.x, hit.normal.y)` if the touched enemy survived.

The reactions show their first frame (age 0, the Demo's frame of the contact) at once. Calling them after the
frame's `update` shows exactly that frame; calling them before shows the frame one `gameDt` later. For exact ages
split the frame at the contact: `update(before)`, react, `update(after)` (the `creatures-feel` scene does).
`update` (Mob and BeetleKnight) treats a negative `gameDt` as 0, so an `after` that rounds a hair below zero (a
contact on a frame boundary: thirty 1/60-s frames end at 0.49999999999999994) keeps the contact frame.
