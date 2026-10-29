# Art Bible v3 — the approved look (2026-10-22)

The producer approved this look on 2026-10-22. It is the **only** visual standard: every visual task is judged
against the golden frames in `studio/golden/` and the rules below, nothing else. It replaces the old creative brief,
the 「孢狂弥撒」 art bible and ART_DIRECTION_V2 wherever they disagree. Do not "escalate", "push crazier" or invent a
new style. If you have a better idea, write it under `proposals` in your result; the producer decides.

## World

A **corrupted fungal world**. The beetle knight (甲壳虫骑士) descends into its dungeon to explore it.

- Living fungus glows teal: mold, lamp mushrooms, gill sigils. It is the world.
- Corruption is blood red. The corrupted grin too wide, their eyes burn, red light pools under them. These are the
  enemies.
- The knight is the outsider: white pearl armour, gold trim, sapphire scarf.
- Names and flavour text are ours; rule text keeps the Demo's numbers and mechanics. The roster mapping and the
  final names are decided at gate G3.

## Golden frames (`studio/golden/`)

| File | What it shows |
|---|---|
| `01-combat-zoom.png` | gameplay ×2: the knight in front, the corrupted congregation leaning in |
| `02-aim.png` | the aim preview: chevrons, numbered bounce markers, intents, HP pips |
| `03-kill.png` | a double kill: flash, blast rings, debris |
| `04-cast.png` | the cast sheet: knight turnaround and ball, four small fry |
| `D:/TAPTAPGAME_studio/golden/clip.gif` (and `.mp4`) | one full turn at 60 fps |

The code baseline is `main` at the merge of `task/art-p`. The `play` debug scene is the reference room
(`?scene=play`), `cast` the reference sheet.

## Rules

1. **Pixels.**
   - Internal 960×540, 24 px per floor tile, integer upscale (×2 at 1080p). `?res=pixel` (640×360) exists only for
     comparison.
   - Camera: the Demo's oblique top-down projection (`src/procgen/architecture/framing.ts`). Floor tiles are square;
     heights are foreshortened by 0.625.
   - Global dither is ×0.45 (`DITHER_SCALE`). The image must look clean, not noisy.
   - World-locked pixel patterns use `PPT` (`src/render/density.ts`), never a literal 16 or 24.
2. **Three groups, told apart at a glance.**

   | Group | Colours | Treatment |
   |---|---|---|
   | Hero | white pearl, gold, sapphire | warm-gold rim, a warm light that follows him, the brightest thing on screen |
   | Enemies | blood red, bone white, black | red rim, burning eyes (emissive), red floor glow |
   | Background | dark and desaturated: navy stone, teal fungus, brown wood | mold only along walls and in corners; the floor centre stays clean |

   No red on the hero; no white-and-blue on enemies.
3. **Light.**
   - Only three sources: stained glass, candles, and the small lights characters carry.
   - No screen-wide bloom or glow, no light pollution.
4. **Characters.**
   - Chibi proportions.
   - The beetle exists only in the hero's armour: no legs, antennae or mandibles anywhere.
   - No gore, nothing gross.
   - Characters lean back toward the camera (`STAND.lean`) so faces read like sprites.
   - Balls and round bodies use the sphere fix (`stand()` in `src/procgen/creatures/shapes.ts`).
5. **Enemies press in.**
   - At least as big as the hero; bosses much bigger.
   - Always turned toward the hero and leaning in.
   - A too-wide toothy grin and one wrong detail each (a third eye, an eye in a flame, a sword in a jelly).
   - Twitchy idles.
   - Hit and kill reactions follow the Demo's timing exactly (rule 9). Hit: blinking flash, squash and stretch, a
     recoil away from the hero, the mouth opens. Kill: a death animation of about 1 s with the spore splat at
     0.5 s, then a darkened corpse that stays on the floor. No kill freeze, impact frame or extra kill shake.
6. **Sizes.**
   - Hero collision radius 0.875 tiles (Demo 56 u); the ball's visual radius is 0.76.
   - 1 tile = 64 u in the Demo.
7. **UI: style A「墨与骨」(Ink & Bone), chosen by the producer.**
   - Near-black panels with bone-white pixel lines and lettering.
   - Red only for enemies and danger.
   - Sapphire blue only for the hero's resources (HP, Stamina and the like).
   - **No gold-dominated UI.** Gold does not mean premium; at most a tiny accent, preferably none.
   - Pixel-art UI drawn on the 960×540 grid (crisp, whole pixels).
   - Layout is 1:1 with the Demo's widgets (`D:/TAPTAPGAME_ref/dump/widgets/`, authored at 1920×1080 = 2× our grid).
   - Text in a pixel font with CJK coverage.
8. **Aim preview.**
   - White chevrons with ink outline along each leg.
   - Leg-end marks as in the Demo: enemy contact = dashed ring, wall contact = dot + arc, no contact = dot.
   - Every bounce point is numbered.
   - All of it is drawn in the pixel overlay (`src/game/overlay.ts`), above everything.
9. **Feel: a 1:1 copy of the Demo** (producer, 2026-10-23: 「按照原版…把手感打磨到完全一致」).
   - Everything that shapes how a launch feels is copied from the Demo with its numbers: input on release, timing,
     hit-stop, camera shakes, trail, dust, slash, enemy reactions, damage numbers, rating panel motion and sounds.
   - Sources: `spec/launch-feel.md`; until it lands, `D:/TAPTAPGAME_studio/tmp/feel/demo-juice.md` (every value with
     its dump source) and the 60 fps Demo captures in `D:/TAPTAPGAME_studio/tmp/feel/demo-rec-0{1,2}-frames/`.
   - Only the skin changes:
     - red corruption spores and ichor instead of blood, with the same timing, amount and stain lifetime;
     - the knight's pearl ball: it curls in flight and pops back while the player can already aim, so it adds no
       latency.
   - `studio/golden/03-kill.png` still shows the approved look of the room, not the kill timing; its rings and
     debris are replaced by the Demo's death sequence.

## Forbidden

- Screen-wide glow, heavy dither noise.
- Insect anatomy, gore.
- Gold-dominated UI.
- HD flat "toy" shading.
- Comic-book cel style (style B, rejected).
- Pill bug 丸子 (dropped).
- Anything the Demo does not have.
- Anything that delays or freezes a launch: wind-ups before the hero moves, blocking animations after it stops, kill
  freezes, full-screen impact frames.
