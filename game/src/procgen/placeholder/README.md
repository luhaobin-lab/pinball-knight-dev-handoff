# src/procgen/placeholder — the placeholder kit

- **Owner**: the `placeholder-kit` task (items/creatures lanes may extend it; keep the rules below).
- **Purpose**: one visual language for every enemy, boss, prop and item icon the prototype needs before its final
  art (方案 v4), so content built by many agents still reads as one designed set inside the approved look
  (`studio/ART_BIBLE.md`): the 3D-pixel crypt at 960×540 through the toon renderer, the three groups apart at a glance.
- **Debug scene**: `?scene=placeholder-kit&page=enemies|bosses|props|icons|combat|overview` (README of the scene in
  its header; `&zoom=2&at=x,z` to inspect, `&hit=1` / `&die=1` play the reactions, `&names=0..1` pages the icons with
  names, `&sizes=demo` draws the Demo's relative sizes for the producer's ruling below).

## API

```ts
import { placeholderEnemy, placeholderBoss, placeholderProp, PROP_NAMES } from '../procgen/placeholder';
import { itemIcon, itemIconSpec, ICON_ACCENT } from '../procgen/icons';

const mob = placeholderEnemy('眼球', { elite: true });  // any row of 数据表_敌人_普通 (a rolled elite gets the horns)
mob.position.set(x, z); mob.target.set(heroX, heroZ);
scene.add(mob.group);
mob.bindLights(mob.lights.map(l => renderer.addPointLight(l)));
mob.update(gameDt, camera);                              // every frame
mob.hitReact(nx, nz, speedUu); mob.flash(); mob.die({ onSplat });  // the Mob reactions, the Demo's timing
mob.radius;        // collision radius in tiles (宽度 / 64)     mob.top;  // silhouette top in tiles (bars, intents)
mob.visualRadius;  // drawn footprint (the size floor below)

const boss = placeholderBoss('守门人');                  // throws for a row that is not tagged 首领

const chest = placeholderProp('chest');                  // PROP_KINDS: 22 set pieces, PROP_NAMES their 中文 names
chest.place(x, z); scene.add(chest.group);
for (const l of chest.lights) renderer.addPointLight(l); // fire and fungus lights follow the piece
chest.update(time);

const icon = itemIcon('旧剑', 32);                       // any row of 合成数据表_修炼物品 → a UI Surface (w × h px)
itemIconSpec('旧剑');                                     // { glyph: 'sword', type: 'weapon', variant: 0, size: 2, … }
```

| Export | What |
|---|---|
| `placeholderEnemy(row, { elite?, scale?, sizes? })` → `PlaceholderMob` | The figure of a 数据表_敌人_普通 row. Deterministic: the row alone decides it. |
| `PlaceholderMob` | The `Mob` API of `src/procgen/creatures/mobs.ts` (`MobLike`): `group`, `body`, `radius`, `position`, `facing`, `target`, `lights` + `bindLights`, `attacking`, `hitReact`, `flash`, `die`, `corpse`, `update`; plus `spec`, `top`, `visualRadius`, `sculptor` (its parts). Reactions run on `src/anim/reactions.ts` (反弹动画2, 可控反弹动画, 闪烁, 角色死亡 + 死亡变色). |
| `placeholderBoss(row)` | The same for the five 首领 rows; refuses any other row. |
| `figureSpec(row, { elite?, sizes? })` | Pure data (no three.js): family, form, tier, elite, variant, radius, height, visualScale, seed. |
| `placeholderProp(kind, { seed? })` → `PlaceholderProp` | `group`, `body`, `radius`, `stands`, `lights`, `place(x, z, yaw?)`, `update(time)`; `PROP_FOR_ROW` maps the interactable rows of 数据表_道具_通用 / 数据表_玩家. |
| `itemIcon(row, w, h = w)` / `itemIconSpec(row)` / `ICON_ACCENT` | `src/procgen/icons`: the HUD icon of an item row, its glyph, variant and accent. |

## Style guide (one page)

**Size.** Footprint (collision) radius = the row's `宽度` / 64 tiles. Height = 3 × `高度` / 64 tiles, the knight's own
proportion (56 uu → 168 uu). Then the size rule: ART_BIBLE rule 5 says enemies are at least as big as the hero, so
a normal row shorter than the knight is drawn at his height (`visualScale = max(1, KNIGHT_HEIGHT / height)`: 眼球
×1.4, 西瓜猪 ×1.51, 水母脑 ×1.27, 结晶 ×1.04); its collision radius does not change. **Ruling pending**: the producer
decides between this and the Demo's relative sizes (`sizes: 'demo'`, `&sizes=demo` in the scene); see SPEC-GAP in
`spec.ts`. Forms are authored in footprint radii in a 2 × 3 box (x, z in −1…1, the floor at y 0); set pieces in tiles.

**Groups and palette** (`palette.ts`; nothing else, never a new hex):

| Group | Solids | Marks (flat, no outline) | Glows (emissive) |
|---|---|---|---|
| Enemies | `blood` · `flesh` · `bone` · `black` · `wax`; red rim, ramp lift by look (blood/flesh 0.8, bone 0.45, black 1.8), a red floor glow and one low red light | `void` sockets and mouths · `tooth` · `glyph` · `vein` | `ember` (eyes, lava, gems) · `iris` · `flame` · `fire` |
| Set pieces | `stone` · `masonry` · `wood` · `plank` · `iron` · `wax` · `bone` · `cloth` · `straw` · `fungus` · `soot`; no rim, lift 0.5 (masonry 0.6: the room's walls) | `void` · `glyph` · `rune` | `fire` (candles) · `teal` (living fungus, portals) |

- Every solid takes **form shading**: bands added toward the top-left of the screen, taken away toward the
  bottom-right (`FORM`, `FORM_DIR`), so it shows a lit and a shaded side whatever light is near. Black takes the
  most, so its lit band `#463650` shows on the top-left of every black solid, plus a **1-px cool highlight** where the
  surface faces the light (one pixel's normal change, `materials.ts`).
- Measured on the gameplay camera ×2 (golden 01's framing): lit bodies at a median HSV value of 48 with highlights
  of 75 at p90 (golden 01: 49 / 72, golden 04: 50 / 82).
- Wood and stone of set pieces carry the room's **world-locked pixel patterns** (grain, blotches and chips, in PPT).
- Fire on set pieces is small and amber: `FIRE_LIGHT` #FF9A3C, intensity ≤ 0.6, radius ≤ 2.5 tiles.
- Each family takes one dominant value (blood: guts, eyes' flesh, dragon; black: crystals, wraith, golem, knight;
  bone: eggs, larva, puppet) and the other two as accents. No gold, no blue, no white-and-blue on an enemy.

**Primitives** (`sculpt.ts`): solids `sphere · capsule · cone · box · torus · disc · ring`; glyphs `dot · line · arc ·
crescent · fang`. Glyphs are **decals**: laid onto their surface vertex by vertex, layered (socket, then ember), so a
mark never sinks into a curved body nor sticks out of its silhouette. Nothing else: no lathes, tubes or textures.

**The face formula** (`face.ts`, every enemy), in head widths W at the eye line:
- two **burning eyes**: an almond `void` socket of radius 0.11 W (at least 3 px; at most 0.2 W, bosses at most 5 px),
  an `ember` of half that in its upper half, the eyes 0.22 W apart from the middle;
- the **grin** of the golden frames: a `void` crescent spanning 0.8 of the head at its corner line, the corners rising
  0.15 W above the middle of the upper lip and the mouth gaping 0.2 W more, full of pointed `tooth` **fangs**,
  alternating 3 and 2 px, from the upper lip, and 2–3-px fangs rising between them from the lower lip;
- on a round head the eye line sits on the latitude that faces the camera (figures lean back 30° under a camera
  58° up), so the face reads centred on the head;
- the face **turns back toward the camera**: the body turns up to `MAX_YAW` 43° toward its target, the face (or a
  flat-faced head) counter-rotates so it never shows more than `FACE_YAW` 15°. Round heads that carry a face have
  equal x and z radii, so the face slides on the surface. `tests/placeholder-kit/face.test.ts` projects every row
  at 0° and ±43° and checks every mark's box (the grin: its outline) lies inside the figure's silhouette.

**Families and their wrong detail** (by the Demo sprite sheet, `spec.ts` `DetailId`; one each, silhouette scale):

| Family | Rows (sheet) | Silhouette | Wrong detail |
|---|---|---|---|
| 眼球系 | 眼球, 眼球_融合 (M02); 眼球包 ×4 (M08) | a bone eyeball in a flesh ring on a mound; a sac studded with five | black lashes over the iris |
| 大肠系 | 大肠 (M05); 大肠血卵, 坏卵, 火球精 (M07); 大肠团 (M14) | a two-tone coil; an egg in a nest; a mound of coils | a lit bone candle stuck in its crown (火球精 burns instead) |
| 结晶系 | 结晶 (M15), 结晶簇 (M13) | a black bipyramid with red shards; a ring of them | an eye burning inside the crystal |
| 脑系 | 水母脑 (M16), 章鱼脑 (M18) | a brain hovering on five tapered, curling tendrils; one on six tentacles | a third eye on a stalk |
| 黏菌 · 幽魂 · 西瓜猪 | 盗宝黏菌 (M06), 齐刘海 (M04), 西瓜猪 (M01) | a blob; a black ghost with a red bob; a melon pig | a sword stuck in it; the too-straight fringe; a straw stuck in it |
| bosses | 守门人 (M03), 结晶骑士 (M10), 弑神幼虫 (M17), 重生傀儡 (M09), 幽焰龙 (M11) | golem; armoured knight; rearing grub; marionette; dragon on a long neck with a horned snout | the hammer and lava seams; the crystal greatsword; acid drool; the strings; bat wings (three finger bones, a scalloped membrane) |
| neutral rows | 宝箱 ×2 (P03), 石墙 (地形05), NewRow ×2 (玩家) | chest; four courses of stone; a training dummy | — |

**Tier marks.** Normal: none. Elite (a rolled elite, and every 噩梦 row, which the Demo forces elite): two **bone
horns** rising from the head (the head bar's 精英图标). Boss: a composite silhouette 2–3× the small fry and a floating
**bone crown** of five spikes with a burning gem.

**Motion.** Idles are the kit's five (`breathe`, `hop`, `hover`, `sway`, `still`) plus the cult's twitch (the head
snaps aside every ~4 s); the grin gapes a little (`MOUTH_IDLE`) and opens on a hit. The death is one generic
collapse on the Demo's clock (10 frames at 10 fps): the body sinks into a **flat stain** (12 % of its height), the
embers go out and the **grin shuts** (its fangs hidden) with the spores at 0.5 s, the corpse darkens from 0.9 s
(明度 1 → 0.5, 饱和度 0 → 0.35; teeth and bone marks to the bone ramp's dark step) and stays.

**Set pieces** (`props.ts`, `PROP_NAMES`): the same solids and glyphs in the background group's colours; every piece
rises at least 0.16 tiles off the floor so the outline pass draws it, shows two bands of form, and carries a bold
**sigil** where it has one (`face.ts` `SIGILS`, ≥ 9 px, 2-px strokes, filled shapes; the shop's coin is a 方孔钱).
The spikes are a 3 × 3 bed of iron cones on a dark plate; the portal a dark disc in a bright teal rim with a turning
spiral, no brighter than the hero.

**Item icons** (`src/procgen/icons`): the UI pen's 32-unit grid, two inks (bone body and dim-bone shade; ink details
and the 1-px ink outline) and one accent hue by type (`ICON_ACCENT`: 武器 copper, 护甲 a cool slate, 工具 green,
饰品 violet, 治疗 teal, loot a warm ochre; never gold, red or sapphire). Pills named after a colour wear it (黄 绿 紫);
the reserved 红 and 蓝 get a pattern (dots, stripes). Long objects on the rising diagonal, blades and shafts ≥ 3 px,
round ones centred, light from the top-left. Glyphs shared by several items take a **variant** (what the name says:
长靴, 连弩, 眼球杖 …, else the item's place among them): blade, guard and pommel; bottle; pill band. Every icon weighs
0.17–0.34 of its square (its inks, the outline aside; spread ≤ 2×), and no two items draw alike
(`tests/placeholder-kit/icons.test.ts`).

**Do**
- Add a row by mapping its sprite sheet to a family in `spec.ts`; a new silhouette is a new form built from the kit.
- Size from the row; place the face with `face()` (on a round head, `roundFace`); mark tiers with `eliteHorns()` /
  `bossCrown()`; give the family its one wrong detail; list what turns back to the camera in `turn`.
- Keep details at 2 px or more at the gameplay camera (`pixel(unit)` converts pixels to model units).
- Run `face.test.ts` after touching a face: marks must stay inside the silhouette at ±43°.

**Don't**
- Invent colours, use gold or blue on an enemy, or a red on a set piece.
- Add legs, antennae or mandibles (the beetle lives only in the hero's armour); no gore.
- Scale a figure by eye: change `FIGURE_HEIGHT_PER_UU` or the size rule for all, or nothing.
- Draw a face on an ellipsoid with unequal x and z radii, a mark thinner than a pixel, an outline of your own, or a
  brow emblem: the family is told by its silhouette and its wrong detail.
