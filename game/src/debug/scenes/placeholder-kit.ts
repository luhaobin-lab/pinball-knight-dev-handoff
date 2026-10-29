import type * as THREE from 'three';
import { buildRoom, type BuiltRoom } from '../../procgen/architecture/room';
import { SHAPES } from '../../procgen/architecture/layout';
import { obliqueCamera, TILE_PX } from '../../procgen/architecture/framing';
import { northstarSpec } from '../../procgen/architecture/northstar';
import { HERO_START, ROOM_ENEMIES } from '../../game/reference-room';
import { createWindowLightPass } from '../../procgen/architecture/windowlight';
import { K_OBLIQUE } from '../../procgen/architecture/walls';
import { B1_LIGHT } from '../../procgen/architecture/palette';
import { BeetleKnight } from '../../procgen/creatures/beetle-knight';
import { STAND } from '../../procgen/creatures/shapes';
import { ENEMY_ROWS, FAMILIES, figureSpec, placeholderEnemy, placeholderProp, PROP_NAMES, type FamilyId, type PlaceholderMob, type PlaceholderProp, type PropKind, type SizePolicy } from '../../procgen/placeholder';
import { addPixelOverlay } from '../../game/overlay';
import { Surface } from '../../ui/core/surface';
import { PixelFont } from '../../ui/text/font';
import { BONE, INK, type ItemType } from '../../ui/style/palette';
import { ICON_ACCENT, itemIcon, itemIconSpec, ITEM_ROWS } from '../../procgen/icons';
import type { PassContext, PixelRenderer } from '../../render/api';
import { defineScene, type SceneContext } from '../types';

/**
 * The placeholder kit's reference sheet (src/procgen/placeholder/README.md), in pages at the gameplay camera scale
 * (zoom 1: 960×540, 24 px per tile). ?page=
 *   enemies (default)  every normal and nightmare row of 数据表_敌人_普通, grouped by family, the knight for scale
 *   bosses             the five 首领 rows, and the seven rows with an elite pool rolled elite
 *   props              the neutral rows of the table (chests, the wall, the test rows) and every set piece
 *   icons              the HUD icon of every item row (合成数据表_修炼物品, 200 rows) by type; &names=0..1 pages
 *                      them with their names, &iconsize= draws another HUD size (46: the 中型 / 大型 cards)
 *   overview           every page at once (zoom 0.31)
 *   combat             the reference combat room (play, golden 01/02) with placeholders in the small fry's spots
 * ?zoom=&at=x,z override the framing; ?labels=0 hides the names; ?hit=1 hits every figure at t = 0.6 s (squash,
 * recoil, blink); ?die=1 kills every figure at t = 0.5 s (with ?hit=1: at 1.6 s); ?sizes=demo draws the Demo's
 * relative sizes instead of the art bible's knight-height floor (spec.ts SizePolicy, for the producer's ruling).
 */

type Item = { readonly kind: 'row'; readonly row: string; readonly elite?: boolean } | { readonly kind: 'prop'; readonly prop: PropKind } | { readonly kind: 'knight' };

interface Band {
  /** Plaque under the group: the family name (zh and en). */
  readonly title: string;
  readonly items: readonly Item[];
}

interface LineSpec {
  /** Floor row the figures stand on (tiles). */
  readonly z: number;
  readonly bands: readonly Band[];
}

interface Slot {
  readonly x: number;
  readonly w: number;
  readonly label: string;
  readonly mob?: PlaceholderMob;
  readonly prop?: PlaceholderProp;
  readonly knight?: BeetleKnight;
  readonly radius: number;
}

interface Plaque {
  readonly title: string;
  readonly x0: number;
  readonly x1: number;
  readonly z: number;
}

interface PlacedLine {
  readonly slots: Slot[];
  readonly plaques: Plaque[];
  readonly z: number;
  readonly labelZ: number;
}

interface State {
  room: BuiltRoom;
  lines: PlacedLine[];
  font: PixelFont;
  view: string;
  labels: boolean;
  die: boolean;
  hit: boolean;
}

let st: State | null = null;

const PAGE_X = 22.5;
const GAP = 0.8;
const BAND_GAP = 1.4;

const rowsOf = (family: FamilyId): Item[] => ENEMY_ROWS.filter(r => figureSpec(r).family === family).map(row => ({ kind: 'row', row }) as const).sort((a, b) => figureSpec(a.row).radius - figureSpec(b.row).radius);
const band = (family: FamilyId): Band => ({ title: `${FAMILIES[family].zh} ${FAMILIES[family].en}`, items: rowsOf(family) });
const ELITE_ROWS = ENEMY_ROWS.filter(r => figureSpec(r).tier === 'normal' && !['眼球_融合', '大肠血卵', '大肠血卵_坏卵', '火球精', '西瓜猪'].includes(r));

const props = (title: string, kinds: readonly PropKind[]): Band => ({ title, items: kinds.map(prop => ({ kind: 'prop', prop }) as const) });

const LINES: readonly LineSpec[] = [
  { z: 9.6, bands: [band('eyeball'), band('intestine')] },
  { z: 18.8, bands: [{ title: '', items: [{ kind: 'knight' }] }, band('crystal'), band('brain'), band('slime'), band('wraith'), band('beast')] },
  { z: 29.4, bands: [{ title: '', items: [{ kind: 'knight' }] }, { title: '精英 Rolled elites', items: ELITE_ROWS.map(row => ({ kind: 'row', row, elite: true }) as const) }] },
  { z: 42.2, bands: [band('golem'), band('knight'), band('larva'), band('puppet'), band('dragon')] },
  // the props page: the table's neutral rows, then the set pieces by use
  { z: 50.4, bands: [band('dummy'), band('chest'), band('wall')] },
  { z: 56.4, bands: [props('交互 Interactables', ['chest', 'crate', 'statue', 'shop', 'altar', 'anvil', 'portal'])] },
  { z: 61.6, bands: [props('机关 Floor pieces', ['spikes', 'vortex', 'bounce-pad', 'campfire']), props('装饰 Dressing', ['coffin', 'brazier', 'jar', 'candles'])] },
  { z: 66.8, bands: [props('建筑 Structures', ['wall', 'pillar', 'shield-generator', 'charge-tower']), props('采集 Gathering', ['ore', 'grass']), props('训练 Training', ['dummy'])] },
];

/** Framings: camera target (tiles) and zoom. */
const VIEWS: Readonly<Record<string, { x: number; z: number; zoom: number }>> = {
  enemies: { x: PAGE_X, z: 12.4, zoom: 1 },
  bosses: { x: PAGE_X, z: 36.2, zoom: 1 },
  props: { x: PAGE_X, z: 58.3, zoom: 1 },
  // the sheet covers the screen; the camera only has to show something behind it
  icons: { x: PAGE_X, z: 12.4, zoom: 1 },
  overview: { x: PAGE_X, z: 36.5, zoom: 0.31 },
};

function addKnight(renderer: PixelRenderer, ctx: SceneContext, x: number, z: number): BeetleKnight {
  const k = new BeetleKnight();
  k.position.set(x, z);
  k.facing = 0.35;
  ctx.scene.add(k.group);
  renderer.addPointLight({ position: { x: 0, y: 2.4, z: 0.8 }, follow: k.body, color: '#FFE2B0', intensity: 0.7, radius: 3.6, flicker: 0.06, seed: 11 });
  return k;
}

function place(ctx: SceneContext, font: PixelFont, spec: LineSpec, sizes: SizePolicy): PlacedLine {
  const { renderer, scene } = ctx;
  const slots: Slot[] = [];
  const plaques: Plaque[] = [];
  // measure first, then centre the line on the page
  const made = spec.bands.map(b =>
    b.items.map(item => {
      if (item.kind === 'knight') return { label: '甲壳虫骑士', radius: 0.875, w: Math.max(1.9, (font.measure('甲壳虫骑士') + 6) / TILE_PX) };
      if (item.kind === 'prop') {
        const prop = placeholderProp(item.prop, { seed: ctx.seed });
        const label = PROP_NAMES[item.prop];
        return { label, radius: prop.radius, w: Math.max(prop.radius * 2, (font.measure(label) + 6) / TILE_PX), prop };
      }
      const mob = placeholderEnemy(item.row, { elite: item.elite, sizes });
      return { label: item.row, radius: mob.visualRadius, w: Math.max(mob.visualRadius * 2, (font.measure(item.row) + 6) / TILE_PX), mob };
    }),
  );
  // a band is at least as wide as its plaque's title
  const titleW = spec.bands.map(b => (b.title ? font.measure(b.title) + 12 : 0) / TILE_PX);
  const widths = made.map((b, i) => Math.max(titleW[i], b.reduce((s, m) => s + m.w, 0) + GAP * (b.length - 1)));
  const total = widths.reduce((s, w) => s + w, 0) + BAND_GAP * (made.length - 1);
  let x = PAGE_X - total / 2;
  const labelZ = spec.z + Math.max(...made.flat().map(m => m.radius)) + 0.3;
  made.forEach((b, i) => {
    const x0 = x;
    const inner = b.reduce((s, m) => s + m.w, 0) + GAP * (b.length - 1);
    x += (widths[i] - inner) / 2;
    for (const m of b) {
      const cx = x + m.w / 2;
      if (m.mob) {
        m.mob.position.set(cx, spec.z);
        m.mob.facing = 0;
        m.mob.target.set(cx, spec.z + 8);
        scene.add(m.mob.group);
        m.mob.bindLights(m.mob.lights.map(l => renderer.addPointLight(l)));
        slots.push({ x: cx, w: m.w, label: m.label, mob: m.mob, radius: m.radius });
      } else if (m.prop) {
        m.prop.place(cx, spec.z);
        scene.add(m.prop.group);
        for (const l of m.prop.lights) renderer.addPointLight(l);
        slots.push({ x: cx, w: m.w, label: m.label, prop: m.prop, radius: m.radius });
      } else slots.push({ x: cx, w: m.w, label: m.label, knight: addKnight(renderer, ctx, cx, spec.z), radius: m.radius });
      x += m.w + GAP;
    }
    x = x0 + widths[i];
    // a band of one row named after it (a boss, the wall) keeps the name in white above and the English on the rule
    const title = spec.bands[i].title;
    const only = b.length === 1 && b[0].label && title.startsWith(b[0].label) ? title.slice(b[0].label.length).trim() : title;
    if (only) plaques.push({ title: only, x0, x1: x, z: labelZ });
    x += BAND_GAP;
  });
  return { slots, plaques, z: spec.z, labelZ };
}

/** Placeholders standing in the reference room's enemy spots (src/game/reference-room.ts), and a chest. */
const COMBAT_CAST: readonly { row: string; elite?: boolean }[] = [{ row: '结晶', elite: true }, { row: '眼球' }, { row: '齐刘海' }, { row: '盗宝黏菌' }, { row: '大肠' }, { row: '水母脑' }];

function lighting(renderer: PixelRenderer, ambient: number): void {
  const L = renderer.lighting;
  L.background.set(B1_LIGHT.void);
  L.ambientSky.set(B1_LIGHT.ambientSky);
  L.ambientGround.set(B1_LIGHT.ambientGround);
  L.ambientIntensity = ambient;
  L.keyColor.set(B1_LIGHT.god);
  L.keyDirection.set(-0.19, 0.67, -0.72);
  L.keyIntensity = 0.06;
  L.tint = 0.6;
}

/** The chest's spot in the combat room: on the floor between the jelly's spot and the skull's, clear of the lamp pillars. */
const COMBAT_CHEST = { x: 14.4, z: 9.4 } as const;

/** The floor point that centres a box on screen under the oblique camera (x, and z − k·y over its corners). */
function centreOf(box: THREE.Box3): { x: number; z: number } {
  const ys = [box.min.z - K_OBLIQUE * box.max.y, box.max.z - K_OBLIQUE * box.min.y];
  return { x: (box.min.x + box.max.x) / 2, z: (ys[0] + ys[1]) / 2 };
}

/** The combat page: the play scene's room and lighting, centred, the knight at his start, placeholders around him. */
function setupCombat(ctx: SceneContext, font: PixelFont, sizes: SizePolicy): State {
  const { renderer, scene, params } = ctx;
  const room = buildRoom({ ...northstarSpec('ns-1'), mold: [{ x: 2.2, z: 4.6, rx: 1.2, rz: 1.0 }, { x: 21.6, z: 4.7, rx: 1.2, rz: 1.0 }, { x: 19.6, z: 12.4, rx: 1.3, rz: 0.9 }] });
  scene.add(room.group);
  for (const l of room.lights) renderer.addPointLight(l);
  const pass = createWindowLightPass(room.windows);
  pass.glow = 0.95;
  renderer.addPass('lighting', pass);
  room.uniforms.uWindowGlow.value = 0.5;
  room.uniforms.uBioGlow.value = 0.55;
  lighting(renderer, 4.4);
  const slots: Slot[] = [{ x: HERO_START.x, w: 0, label: '', radius: 0.875, knight: addKnight(renderer, ctx, HERO_START.x, HERO_START.z) }];
  COMBAT_CAST.forEach((c, i) => {
    const e = ROOM_ENEMIES[i];
    const mob = placeholderEnemy(c.row, { elite: c.elite, sizes });
    mob.position.set(e.x, e.z);
    mob.target.set(HERO_START.x, HERO_START.z);
    mob.facing = Math.atan2(HERO_START.x - e.x, HERO_START.z - e.z);
    scene.add(mob.group);
    mob.bindLights(mob.lights.map(l => renderer.addPointLight(l)));
    slots.push({ x: e.x, w: 0, label: '', mob, radius: mob.radius });
  });
  const chest = placeholderProp('chest', { seed: ctx.seed });
  chest.place(COMBAT_CHEST.x, COMBAT_CHEST.z);
  scene.add(chest.group);
  for (const l of chest.lights) renderer.addPointLight(l);
  slots.push({ x: COMBAT_CHEST.x, w: 0, label: '', prop: chest, radius: chest.radius });
  const framed = centreOf(room.bounds);
  const zoom = Number(params.get('zoom') ?? 1);
  const [ax, az] = (params.get('at') ?? (zoom > 1 ? '11.5,7' : `${framed.x},${framed.z}`)).split(',').map(Number);
  obliqueCamera(renderer, ax, az);
  renderer.camera.zoom = zoom;
  renderer.camera.updateProjectionMatrix();
  return { room, lines: [{ slots, plaques: [], z: 0, labelZ: 0 }], font, view: 'combat', labels: false, die: params.get('die') === '1', hit: params.get('hit') === '1' };
}

async function setup(ctx: SceneContext): Promise<void> {
  const { renderer, scene, params } = ctx;
  STAND.correction = 1;
  const sizes: SizePolicy = params.get('sizes') === 'demo' ? 'demo' : 'bible';
  if (params.get('page') === 'combat') {
    st = setupCombat(ctx, await PixelFont.load(), sizes);
    return;
  }
  const room = buildRoom({
    layout: SHAPES.rect(45, 72),
    seed: ctx.seed,
    northHeight: 1.5,
    dressing: 0.2,
    maxLights: 12,
    // living mold only in the corners: the floor under the cast stays clean
    mold: [
      { x: 2.4, z: 2.6, rx: 1.4, rz: 1.0 },
      { x: 43.2, z: 2.8, rx: 1.3, rz: 1.0 },
      { x: 2.2, z: 70, rx: 1.4, rz: 1.1 },
      { x: 43.4, z: 70.4, rx: 1.2, rz: 0.9 },
    ],
  });
  scene.add(room.group);
  for (const l of room.lights) renderer.addPointLight(l);
  renderer.addPass('lighting', createWindowLightPass(room.windows));
  lighting(renderer, 4.2);

  const font = await PixelFont.load();
  const view = params.get('page') ?? 'enemies';
  const lines = view === 'icons' ? [] : LINES.map(l => place(ctx, font, l, sizes));
  const target = VIEWS[view] ?? VIEWS.enemies;
  const zoom = Number(params.get('zoom') ?? target.zoom);
  const [ax, az] = (params.get('at') ?? `${target.x},${target.z}`).split(',').map(Number);
  obliqueCamera(renderer, ax, az);
  renderer.camera.zoom = zoom;
  renderer.camera.updateProjectionMatrix();

  st = { room, lines, font, view, labels: params.get('labels') !== '0', die: params.get('die') === '1', hit: params.get('hit') === '1' };
  let surface = new Surface(1, 1);
  addPixelOverlay(renderer, (c, pctx) => {
    if (!st) return;
    if (surface.w !== pctx.width || surface.h !== pctx.height) surface = new Surface(pctx.width, pctx.height);
    surface.clear();
    if (st.view === 'icons') drawIconSheet(surface, st.font, Number(params.get('iconsize') ?? 32), params.has('names') ? Number(params.get('names')) : null);
    else if (st.labels && zoom >= 1) for (const line of st.lines) drawLine(surface, pctx, st.font, line);
    c.g.putImageData(new ImageData(new Uint8ClampedArray(surface.data.buffer), surface.w, surface.h), 0, 0);
  });
}

/** Names centred under each figure on one baseline, then the family plaque: a dim rule with the title in its gap. */
function drawLine(s: Surface, ctx: PassContext, font: PixelFont, line: PlacedLine): void {
  const name = { color: BONE.base, outline: INK.deep };
  const title = { color: BONE.dim, outline: INK.deep };
  const y = Math.round(ctx.project({ x: 0, y: 0, z: line.labelZ }).y);
  for (const slot of line.slots) {
    if (!slot.label) continue;
    const p = ctx.project({ x: slot.x, y: 0, z: line.labelZ });
    font.draw(s, slot.label, Math.round(p.x - font.measure(slot.label) / 2), y, name);
  }
  for (const pl of line.plaques) {
    const a = Math.round(ctx.project({ x: pl.x0, y: 0, z: pl.z }).x);
    const b = Math.round(ctx.project({ x: pl.x1, y: 0, z: pl.z }).x);
    const ty = y + 17;
    const tw = font.measure(pl.title);
    const mid = Math.round((a + b) / 2);
    const t0 = mid - Math.ceil(tw / 2) - 4;
    const t1 = mid + Math.ceil(tw / 2) + 4;
    const ry = ty + 7;
    if (t0 > a) {
      s.fill(a, ry, t0 - a, 1, BONE.faint);
      s.fill(a, ry - 2, 1, 2, BONE.faint);
    }
    if (b > t1) {
      s.fill(t1, ry, b - t1, 1, BONE.faint);
      s.fill(b - 1, ry - 2, 1, 2, BONE.faint);
    }
    font.draw(s, pl.title, mid - Math.round(tw / 2), ty, title);
  }
}

const TYPES: readonly { type: ItemType; zh: string; en: string }[] = [
  { type: 'weapon', zh: '武器', en: 'Weapon' },
  { type: 'armor', zh: '护甲', en: 'Armour' },
  { type: 'tool', zh: '工具', en: 'Tool' },
  { type: 'accessory', zh: '饰品', en: 'Accessory' },
  { type: 'consumable', zh: '治疗', en: 'Consumable' },
  { type: 'loot', zh: '战利品', en: 'Loot' },
];

/**
 * The icon sheet: every item row's HUD icon on a card face of the HUD's size class (32 px for 小型, the default),
 * grouped by the type that picks its accent; the type name, its swatch and count in the left column.
 */
function drawIconSheet(s: Surface, font: PixelFont, size: number, names: number | null): void {
  s.fill(0, 0, s.w, s.h, INK.base);
  const specs = ITEM_ROWS.map(r => itemIconSpec(r));
  if (names !== null) {
    // review sheet: ten columns of icons with their names, as many rows as fit (110 a page at 32 px: ?names=0..1)
    const cw = 94;
    const ch = size + 15;
    const per = 10 * Math.floor((s.h - 20) / ch);
    const page = specs.slice(names * per, names * per + per);
    font.draw(s, `物品图标 ${names * per + 1}–${names * per + page.length} / ${specs.length}`, 16, 4, { color: BONE.base });
    page.forEach((sp, i) => {
      const x = 16 + (i % 10) * cw;
      const y = 20 + Math.floor(i / 10) * ch;
      s.fill(x + (cw - size - 4) / 2, y, size + 4, size + 4, INK.raised);
      s.blit(itemIcon(sp.row, size), x + (cw - size) / 2, y + 2);
      const label = sp.name.length > 7 ? sp.name.slice(0, 7) : sp.name;
      font.draw(s, label, x + Math.round((cw - font.measure(label)) / 2), y + size + 3, { color: ICON_ACCENT[sp.type] });
    });
    return;
  }
  const cell = size + 4;
  const left = 112;
  const cols = Math.floor((s.w - left - 12) / cell);
  let y = 30;
  font.draw(s, `物品图标 Item icons · ${specs.length} rows · 合成数据表_修炼物品`, 16, 8, { color: BONE.base });
  for (const t of TYPES) {
    const rows = specs.filter(sp => sp.type === t.type);
    s.fill(16, y + 4, 6, 6, ICON_ACCENT[t.type]);
    font.draw(s, t.zh, 28, y, { color: BONE.base });
    font.draw(s, `${t.en} ${rows.length}`, 16, y + 15, { color: BONE.dim });
    rows.forEach((sp, i) => {
      const x = left + (i % cols) * cell;
      const yy = y + Math.floor(i / cols) * cell;
      s.fill(x, yy, cell - 2, cell - 2, INK.raised);
      s.frame({ x, y: yy, w: cell - 2, h: cell - 2 }, BONE.faint);
      s.blit(itemIcon(sp.row, size), x + 1, yy + 1);
    });
    y += Math.ceil(rows.length / cols) * cell + 8;
  }
}

/** True on the frame that crosses `at` seconds of game time. */
const crossing = (ctx: SceneContext, dt: number, at: number): boolean => ctx.time >= at && ctx.time - dt < at;

function update(ctx: SceneContext, dt: number): void {
  if (!st) return;
  st.room.update(ctx.renderer.time, dt);
  const hitting = st.hit && crossing(ctx, dt, 0.6);
  const killing = st.die && crossing(ctx, dt, st.hit ? 1.6 : 0.5);
  for (const line of st.lines) {
    for (const slot of line.slots) {
      if (slot.mob) {
        if (hitting) {
          // as if the knight had just bounced off it from the south (the contact normal points at him)
          slot.mob.hitReact(0, 1, 2400);
          slot.mob.flash();
        }
        if (killing) slot.mob.die();
        slot.mob.update(dt, ctx.camera);
      }
      slot.prop?.update(ctx.time);
      slot.knight?.update(dt, ctx.camera);
    }
  }
}

export default defineScene({ name: 'placeholder-kit', description: 'Placeholder kit: every enemy row by family, the bosses, the props, the item icons', setup, update });
