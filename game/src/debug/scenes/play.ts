import * as THREE from 'three';
import { buildRoom, type BuiltRoom, type RoomSpec } from '../../procgen/architecture/room';
import { northstarSpec, NORTHSTAR_SCREEN } from '../../procgen/architecture/northstar';
import { obliqueCamera, obliqueTargetFor, TILE_PX } from '../../procgen/architecture/framing';
import { createWindowLightPass } from '../../procgen/architecture/windowlight';
import { windowShafts, type Shafts } from '../../procgen/architecture/shafts';
import { B1_LIGHT } from '../../procgen/architecture/palette';
import type { RoomLayout } from '../../procgen/architecture/layout';
import { K_OBLIQUE } from '../../procgen/architecture/walls';
import { BeetleKnight } from '../../procgen/creatures/beetle-knight';
import { Mob, watchers } from '../../procgen/creatures/mobs';
import type { PassContext } from '../../render/api';
import {
  aimVector,
  computeLaunchPreview,
  contactAttack,
  planLaunch,
  samplePlayback,
  STARTER_HERO,
  tilePointToUu,
  UU_PER_TILE,
  uuPointToTiles,
  uuToTiles,
  type Hit,
  type LaunchContact,
  type LaunchPlayback,
  type LaunchPreview,
  type LaunchWorld,
  type SolidCircleDef,
  type Vec2,
} from '../../core/launch/index.ts';
import type { Rng } from '../../core/rng';
import { createAudio, type Audio } from '../../audio/index.ts';
import { createVfx, SpawnPerUnit, type TrailHandle, type Vfx } from '../../vfx';
import { BAR_OFFSET, createCombatHud, type CombatHud, type EnemyMark } from '../../ui';
import { addPixelOverlay, type PixelCanvas } from '../../game/overlay';
import { drawLaunchPreview } from '../../game/launch-preview';
import { PreviewPulse } from '../../game/preview-pulse';
import { aimOf, bestAim, cursorPoint, sweepAngle } from '../../game/auto-aim';
import { canvasGrid, gridPixel, internalGrid, PixelCursor, type PixelGrid } from '../../game/cursor';
import { advanceLaunchClock } from '../../game/hit-stop';
import { changeStamina, firstQuest, HERO_ROW, heroStart, stat, STAMINA_PER_ACTION } from '../../game/hero';
import { chargeBounce, startingLoadout, type ChargeCard } from '../../game/loadout';
import { meleeHit, meleeVictims, type MeleeHit, type MeleeTarget } from '../../game/melee';
import { placeholderHit } from '../../game/placeholder-combat';
import { clientToInternal, internalToFloor, type FloorView } from '../../game/pointer';
import { aroundCharacter, damageAngle, DAMAGE_PICKS, killExp } from '../../game/popups';
import { HERO_START, KNIGHT_BOX, ROOM_ENEMIES, roomBodies, roomSolids, roomWorld } from '../../game/reference-room';
import { demoExp, type DemoBody } from '../../game/roster';
import { TurnScore } from '../../game/turn-score';
import { defineScene, type SceneContext } from '../types';

/**
 * The reference combat room: the Demo's launch (src/core/launch) under the Ink & Bone HUD (src/ui), with the Demo's
 * launch feel (spec/launch-feel.md) from the feel modules; src/game/README.md has the wiring table.
 * Aim with the mouse: the preview is the core's chain, hidden while the pointer is over the HUD. A left press only
 * records; the RELEASE launches along the current aim (FEEL-001), and the frame that processes it already moves the
 * knight (FEEL-003). Every contact bumps, shakes, charges 旧剑 and scores; an enemy contact adds the hit-stop (the
 * world, the shakes, the effects and the creatures slow, never the HUD or the sound), the touched enemy's squash and
 * recoil, the whirlwind slash and the melee AoE. A kill adds only its death, its corpse and the "+N经验" at the
 * knight. At the rest the control is back at once. The HUD shows 幽冥骑士's numbers (the beetle knight is its
 * reskin). With ?t= (tools) or ?auto=1 the shot is scripted: the best whole-degree aim, or ?aim=<degrees>
 * (0 = east, clockwise), released at AIM_TIME. ?zoom=2&at=x,z zooms in.
 * The HUD is created only when this is the active scene: ui-hud reuses the room under its own HUD.
 */

/** The scripted cursor sweeps onto its line over SWEEP seconds, holds, and releases at AIM_TIME. */
const SWEEP = 0.8;
const AIM_TIME = 1.4;
/** The Demo's grid at level 1 (ss2): four free rows, the rest 锁定格. */
const UNLOCKED_ROWS = 4;
/**
 * UI_头顶状态条 hangs with its top row 2 px under the front of the footprint (z + 0.9 r), where the golden frames
 * show the HP pips. The HUD adds the widget's own offset (BAR_OFFSET: X −48, Z 40), which puts the bar's centre
 * BAR_OFFSET.z − 0.625 × BAR_OFFSET.y tiles down the screen from its anchor; the anchor gives that back, less the
 * 2-px gap and the bar's half height (3 px).
 * SPEC-GAP: our small fry are bigger than the Demo's, whose sprites stand on the widget's anchor.
 */
const BAR_LIFT = BAR_OFFSET.z - K_OBLIQUE * BAR_OFFSET.y - 5 / TILE_PX;
/** 可控挥击's skill name: 来自技能 of its damage numbers (one merged number per victim and skill). */
const SKILL = '可控挥击';
/** 攻击距离 of 幽冥骑士 (uu): the melee AoE's reach beyond each victim's 宽度. */
const ATTACK_RANGE = stat(HERO_ROW, '攻击距离');

type Phase = 'aim' | 'roll';

interface Foe {
  readonly id: string;
  readonly mob: Mob;
  hp: number;
  readonly hpMax: number;
  readonly intent?: number;
  /** Height of the intent over the floor (tiles), above the model's head. */
  readonly head: number;
  readonly body: DemoBody;
  /** 科学词条.经验 of its Demo row. */
  readonly exp: number;
}

interface Pointer {
  /** Floor point under it (tiles). */
  readonly floor: { x: number; z: number };
}

interface State {
  room: BuiltRoom;
  shafts: Shafts | null;
  watch: { update(t: number): void };
  layout: RoomLayout;
  solids: SolidCircleDef[];
  knight: BeetleKnight;
  foes: Foe[];
  world: LaunchWorld;
  /** Hero centre (uu). */
  hero: Vec2;
  /** The aim point the scripted cursor shows (tiles). */
  cursor: { x: number; z: number };
  preview: LaunchPreview;
  pulse: PreviewPulse;
  launch: LaunchPlayback | null;
  /** Game times of the last launch's enemy contacts (the hit-stop's starts). */
  enemyContacts: number[];
  /**
   * The launch clock: game seconds since the last release, slowed by the hit-stop. It keeps running after the
   * rest, so a hit-stop still going then ends on the world as in the Demo.
   */
  launchT: number;
  nextContact: number;
  phase: Phase;
  /** A release waiting for the next frame, which launches and already moves the hero (FEEL-001, FEEL-003). */
  release: boolean;
  /** The left button went down over the play area (a release launches only after a press). */
  pressed: boolean;
  auto: boolean;
  /** Scripted aim in whole degrees. */
  autoAim: number;
  launched: boolean;
  lastPos: THREE.Vector2;
  view: FloorView;
  zoom: number;
  /** World time: slows with the hit-stop like everything the Demo's global time dilation reaches. */
  time: number;
  /** The HUD's and the sound's clock (UMG and audio ignore the time dilation). */
  uiTime: number;
  hud: CombatHud | null;
  /** UI_光标, over everything. */
  arrow: PixelCursor;
  charge: ChargeCard[];
  stamina: number;
  staminaMax: number;
  /** Hits dealt this session (the placeholder damage cycles through them). */
  hits: number;
  /** UI_伤害提示's pick for the hero's hits (FRandomStream(来自角色.种子)). SPEC-GAP: the hero's 种子 is a run value; drawn from ?seed. */
  pick: number;
  /** The kills' rolls: 死亡产生经验 and 扩散命中中心's angle. */
  rng: Rng;
  /** This action's rating (reset by 进入战斗状态). */
  score: TurnScore;
  pointer: Pointer | null;
  pointerMoved: boolean;
  /**
   * The pointer is over the HUD (a widget or the side panel) or off the game (TRAJEC-005, TRAJEC-008): the preview
   * hides and its chain stays frozen until the pointer moves back over the play area.
   */
  previewHidden: boolean;
  vfx: Vfx;
  trail: TrailHandle | null;
  /** 粒子_Dust_01's SpawnPerUnit: a puff (and its step) every 100 uu the hero travels. */
  dust: SpawnPerUnit;
  audio: Audio;
}

let st: State | null = null;

function playSpec(seed: number): RoomSpec {
  const base = northstarSpec(seed === 1 ? 'ns-1' : seed);
  // gameplay pass: mold only in the corners, so legs, markers and enemies read on clean stone
  return {
    ...base,
    mold: [
      { x: 2.2, z: 4.6, rx: 1.2, rz: 1.0 },
      { x: 21.6, z: 4.7, rx: 1.2, rz: 1.0 },
      { x: 19.6, z: 12.4, rx: 1.3, rz: 0.9 },
      { x: 5.0, z: 9.6, rx: 0.9, rz: 0.6 },
    ],
  };
}

/** The launch world with the living enemies where they stand (corpses stay on the floor but leave the launch). */
function launchWorld(layout: RoomLayout, solids: readonly SolidCircleDef[], foes: readonly Foe[]): LaunchWorld {
  return roomWorld(layout, solids, foes.filter(f => f.hp > 0).map(f => ({ id: f.id, x: f.mob.position.x, z: f.mob.position.y, body: f.body })));
}

/** Whole floor pixels, as obliqueCamera rounds its target. */
const snapped = (v: number): number => Math.round(v * TILE_PX) / TILE_PX;

async function setup(ctx: SceneContext): Promise<void> {
  const { renderer, scene, params } = ctx;
  const spec = playSpec(ctx.seed);
  const room = buildRoom(spec);
  scene.add(room.group);
  for (const l of room.lights) renderer.addPointLight(l);
  const pass = createWindowLightPass(room.windows);
  pass.glow = 0.95;
  renderer.addPass('lighting', pass);
  room.uniforms.uWindowGlow.value = 0.5;
  room.uniforms.uSigilGlow.value = 0.12;
  const shafts = params.get('shafts') === '0' ? null : windowShafts(room.windows);
  if (shafts) {
    shafts.glow = 0.8;
    scene.add(shafts.object);
  }
  const L = renderer.lighting;
  L.background.set(B1_LIGHT.void);
  L.ambientSky.set(B1_LIGHT.ambientSky);
  L.ambientGround.set(B1_LIGHT.ambientGround);
  L.ambientIntensity = 4.4;
  L.keyColor.set(B1_LIGHT.god);
  L.keyDirection.set(-0.19, 0.67, -0.72);
  L.keyIntensity = 0.06;
  L.tint = 0.6;

  const knight = new BeetleKnight();
  knight.position.set(HERO_START.x, HERO_START.z);
  knight.facing = 0.4;
  scene.add(knight.group);
  renderer.addPointLight({ position: { x: 0, y: 2.4, z: 0.8 }, follow: knight.body, color: '#FFE2B0', intensity: 0.85, radius: 4.6, flicker: 0.06, seed: 11 });

  const bodies = roomBodies();
  const foes: Foe[] = ROOM_ENEMIES.map((e, i) => {
    const mob = new Mob(e.kind, { seed: i + 1, scale: e.scale });
    mob.position.set(e.x, e.z);
    mob.target.set(HERO_START.x, HERO_START.z);
    mob.facing = Math.atan2(HERO_START.x - e.x, HERO_START.z - e.z);
    scene.add(mob.group);
    // the candles and burning eyes go out with the death
    mob.bindLights(mob.lights.map(l => renderer.addPointLight(l)));
    const head = (e.scale ?? 1) * (e.kind === 'jelly' ? 1.9 : 2.9);
    return { id: bodies[i].id, mob, hp: e.hp, hpMax: e.hp, intent: e.intent, head, body: bodies[i].body, exp: demoExp(e.kind) };
  });
  // the rest of the congregation watches from the dark beyond the walls
  const eyes: { x: number; y: number; z: number }[] = [];
  const wr = (n: number): number => ((Math.sin(n * 91.7) * 43758.5453) % 1 + 1) % 1;
  for (let i = 0; i < 18; i++) eyes.push({ x: 0.5 + i * 1.32 + wr(i) * 0.6, y: 3.2 + wr(i + 40) * 1.4, z: -1.2 - wr(i + 80) * 1.6 });
  for (let i = 0; i < 7; i++) eyes.push({ x: -1.6 - wr(i + 120) * 2.5, y: 1.4 + wr(i + 160) * 1.2, z: 2 + i * 1.7 });
  // the right-hand ones stand below 回合统计's block (internal x ≥ 820, y 140–320), clear of every HUD text
  for (let i = 0; i < 5; i++) eyes.push({ x: 25.2 + wr(i + 200) * 1.5, y: 1.4 + wr(i + 240) * 1.2, z: 12.4 + i * 1.5 });
  const watch = watchers(eyes);
  scene.add(watch.group);
  room.uniforms.uBioGlow.value = 0.55;

  const solids = roomSolids(spec);
  const world = launchWorld(spec.layout, solids, foes);

  // the Demo framing: the room sits in the combat play rect, the HUD column stays on the left
  const scale = TILE_PX / 16;
  const framed = obliqueTargetFor(renderer, 0, 0, NORTHSTAR_SCREEN.ox * scale, NORTHSTAR_SCREEN.oy * scale);
  const zoom = Math.max(1, Number(params.get('zoom') ?? 1) || 1);
  const [ax, az] = (params.get('at') ?? '11,8').split(',').map(Number);
  const target = zoom > 1 ? { x: ax, z: az } : framed;
  obliqueCamera(renderer, target.x, target.z);
  if (zoom > 1) {
    renderer.camera.zoom = zoom;
    renderer.camera.updateProjectionMatrix();
  }
  renderer.fx.shakeSeed(ctx.seed);

  const hero = tilePointToUu(HERO_START.x, HERO_START.z);
  const auto = params.has('t') || params.get('auto') === '1';
  const autoAim = params.has('aim') ? Number(params.get('aim')) : bestAim(world, hero, new Map(foes.map(f => [f.id, f.hp])));
  const preview = computeLaunchPreview(world, hero, aimOf(autoAim), { hero: STARTER_HERO });
  const loadout = startingLoadout();
  const start = heroStart();
  // the sound runs on the HUD's undilated clock, a deterministic one in stepped runs; the room's draught loops
  const audio = createAudio({ seed: ctx.seed, now: () => st?.uiTime ?? 0 });
  audio.loop('wind', true);
  st = {
    room,
    shafts,
    watch,
    layout: spec.layout,
    solids,
    knight,
    foes,
    world,
    hero,
    cursor: uuPointToTiles(cursorPoint(preview, hero)),
    preview,
    pulse: new PreviewPulse(),
    launch: null,
    enemyContacts: [],
    launchT: 0,
    nextContact: 0,
    phase: 'aim',
    release: false,
    pressed: false,
    auto,
    autoAim,
    launched: false,
    lastPos: new THREE.Vector2(HERO_START.x, HERO_START.z),
    view: { target: { x: snapped(target.x), z: snapped(target.z) }, ppt: TILE_PX * zoom },
    zoom,
    time: 0,
    uiTime: 0,
    hud: null,
    arrow: new PixelCursor(),
    charge: loadout.flatMap(l => (l.perBounce === null ? [] : [{ id: l.card.id, perBounce: l.perBounce, current: 0 }])),
    stamina: start.stamina,
    staminaMax: start.staminaMax,
    hits: 0,
    pick: ctx.rng.pick(DAMAGE_PICKS),
    rng: ctx.rng.derive('kills'),
    score: new TurnScore(),
    pointer: null,
    pointerMoved: false,
    previewHidden: false,
    vfx: createVfx(renderer, { seed: ctx.seed }),
    trail: null,
    dust: new SpawnPerUnit(),
    audio,
  };

  addPixelOverlay(renderer, (c, pctx) => draw(c, pctx));

  if (params.get('scene') === 'play') {
    st.hud = await createCombatHud({
      renderer,
      state: { hero: start, aiming: true, enemiesOnField: true, items: loadout.map(l => l.card), unlockedRows: UNLOCKED_ROWS, quest: firstQuest() },
    });
  }

  if (!auto) listen(ctx);
}

/** The pixel grid the cursor snaps to: the HUD's layer when there is one, else the internal grid. */
function cursorGrid(ctx: SceneContext): PixelGrid {
  return st?.hud ? canvasGrid(st.hud.canvas) : internalGrid(ctx.renderer);
}

/** Whether the client point is over the HUD: one of its targets or the side panel (the HUD layer's hit test). */
function overHud(clientX: number, clientY: number): boolean {
  const hud = st?.hud;
  if (!hud) return false;
  const p = gridPixel(canvasGrid(hud.canvas), clientX, clientY);
  return hud.hitTest(p.x, p.y) !== null;
}

/**
 * Mouse aim, press and release (LAUNCH-004/007, FEEL-001): the floor point under the pointer aims; a left press
 * only records, the release launches the current aim. The Demo's cursor replaces the system one over the whole
 * game, the HUD included; presses and releases on HUD targets never reach the game (the HUD swallows them). Over
 * the HUD or off the game the preview hides with its chain frozen (TRAJEC-005, TRAJEC-008) until the first move
 * back over the play area. The first press anywhere unlocks the sound (a user gesture).
 */
function listen(ctx: SceneContext): void {
  const { renderer } = ctx;
  const canvas = renderer.canvas;
  const track = (ev: PointerEvent): void => {
    if (!st) return;
    canvas.style.cursor = 'none';
    st.arrow.show(cursorGrid(ctx), ev.clientX, ev.clientY);
    st.previewHidden = overHud(ev.clientX, ev.clientY);
    if (st.previewHidden) return;
    const internal = clientToInternal(ev.clientX, ev.clientY, canvas.getBoundingClientRect(), renderer.internal);
    st.pointer = { floor: internalToFloor(internal, renderer.internal, st.view) };
    st.pointerMoved = true;
  };
  const unlock = (): void => void st?.audio.unlock();
  window.addEventListener('pointerdown', unlock, true);
  window.addEventListener('pointerup', unlock, true);
  canvas.addEventListener('pointermove', track);
  canvas.addEventListener('pointerleave', () => {
    if (!st) return;
    st.pointer = null;
    st.previewHidden = true;
    st.pressed = false;
    st.arrow.hide();
    canvas.style.cursor = '';
  });
  canvas.addEventListener('pointerdown', ev => {
    if (!st || ev.button !== 0) return;
    track(ev);
    st.pressed = st.phase === 'aim';
  });
  canvas.addEventListener('pointerup', ev => {
    if (!st || ev.button !== 0 || !st.pressed) return;
    st.pressed = false;
    if (st.phase !== 'aim') return;
    track(ev);
    // a release through a hover-only status cell launches the frozen chain
    if (!st.previewHidden && st.pointer) aimAtFloor(st, st.pointer.floor);
    st.release = true;
  });
}

function setAim(s: State, aim: Vec2): void {
  s.preview = computeLaunchPreview(s.world, s.hero, aim, { hero: STARTER_HERO });
}

/** 设置指引点向量: the floor point snapped to the 4-uu grid, minus the hero. */
function aimAtFloor(s: State, floor: { x: number; z: number }): void {
  const aim = aimVector(s.hero, tilePointToUu(floor.x, floor.z));
  if (Math.hypot(aim.x, aim.y) < 1) return;
  s.cursor = { x: floor.x, z: floor.z };
  setAim(s, aim);
}

/** The knight's floor point (tiles), where the sounds he makes play. */
const heroAt = (s: State): { x: number; z: number } => ({ x: s.knight.position.x, z: s.knight.position.y });

/**
 * The release (释放开始 → 可控弹射, FEEL-003/005): the whoosh, the knight curls while the launch already runs (the
 * frame that processes the release moves him), the trail starts at him; 进入战斗状态: the preview and the head bars
 * go, the rating and the damage-number maps start over.
 */
function startLaunch(): void {
  const s = st!;
  const k = s.knight;
  s.launch = planLaunch(s.preview);
  s.enemyContacts = s.launch.contacts.filter(c => c.kind === 'enemy').map(c => c.time);
  s.launchT = 0;
  s.nextContact = 0;
  s.phase = 'roll';
  k.face = 'neutral';
  k.launchStart();
  k.facing = Math.atan2(s.preview.aim.x, s.preview.aim.y);
  s.lastPos.copy(k.position);
  s.audio.play('launch', heroAt(s));
  s.trail = s.vfx.trailBegin();
  s.vfx.trailPoint(s.trail, k.position.x, k.position.y);
  s.dust.reset();
  s.dust.step(k.position.x, k.position.y);
  s.score = new TurnScore();
  s.hud?.beginLaunch();
  s.hud?.setCombat({ aiming: false });
}

const alive = (s: State): boolean => s.foes.some(f => f.hp > 0);

/** 更新回合战斗统计's UI after one scored event (the HUD plays 回合统计出现 for the launch's first). */
function rate(s: State): void {
  s.hud?.setTurnStats(s.score.view());
}

/** The hero moved to (x, z) tiles: the trail follows, and 粒子_Dust_01 puffs (with its step) every 100 uu. */
function travel(s: State, x: number, z: number): void {
  if (s.trail) s.vfx.trailPoint(s.trail, x, z);
  for (let n = s.dust.step(x, z); n > 0; n--) {
    s.vfx.dust(x, z);
    s.audio.play('step', { x, z });
  }
}

/**
 * One synthesized contact, in the Demo's order (launch-movement §9.2): the bounce (弹性处理: the bump; 反弹中: item
 * charge, 反弹, the bounce shake, the touched body's squash and recoil), then the attack, then the mirrored contact.
 */
function contact(ctx: SceneContext, c: LaunchContact): void {
  const s = st!;
  const hit = c.hit;
  const foe = hit && hit.actor.kind === 'body' ? s.foes.find(f => f.id === hit.actor.id) : undefined;
  if (c.reacts) {
    s.audio.play('bump', heroAt(s));
    ctx.renderer.fx.cameraShake('bounce');
    // every equipped 有充能 card charges while an enemy is on the field (LAUNCH-051/063); then the bounce scores
    for (const e of chargeBounce(s.charge, alive(s))) {
      s.hud?.popup({ kind: 'charge', value: e.shown, at: { item: e.id } });
      s.hud?.updateItem(e.id, { charge: e.current / 100 });
      if (e.completions > 0) {
        s.hud?.flashItem(e.id);
        s.audio.play('charge');
      }
    }
    s.score.event('反弹');
    rate(s);
    if (foe && hit) foe.mob.hitReact(hit.normal.x, hit.normal.y, c.speed);
  }
  if (foe && hit && foe.hp > 0 && contactAttack(c, STARTER_HERO) === 'melee') attack(ctx, c, foe, hit);
}

/** A foe as the melee sees it (uu). */
const meleeTarget = (f: Foe): MeleeTarget & { foe: Foe } => ({ id: f.id, center: tilePointToUu(f.mob.position.x, f.mob.position.y), width: f.body.width, foe: f });

/**
 * 发动攻击 on an enemy contact (LAUNCH-057): 进入攻击状态 plays 回旋斩 (the slash, the swing notify, the crescent),
 * the AoE hits every victim, and the knight recoils off the touched enemy if it survived (FEEL-023).
 */
function attack(ctx: SceneContext, c: LaunchContact, touched: Foe, hit: Hit): void {
  const s = st!;
  const k = s.knight;
  k.slash();
  s.audio.play('swing', heroAt(s));
  s.vfx.whirlwind(() => ({ x: k.position.x, z: k.position.y }));
  const living = s.foes.filter(f => f.hp > 0).map(meleeTarget);
  for (const v of meleeVictims(c.position, meleeTarget(touched), living, ATTACK_RANGE)) {
    strike(ctx, v.foe, v.foe === touched ? { point: hit.impactPoint, normal: hit.normal } : meleeHit(c.position, v));
  }
  if (touched.hp > 0) k.recoil(hit.normal.x, hit.normal.y);
}

/** One damage instance on a victim (蓝图_效果_受伤, FEEL-064), with the placeholder damage. */
function strike(ctx: SceneContext, foe: Foe, at: MeleeHit): void {
  const s = st!;
  const h = placeholderHit(s.hits++);
  const ip = uuPointToTiles(at.point);
  const n = at.normal;
  // the crit is rolled before the hit lands (RATING-020), then 所有伤害 per victim (RATING-019)
  if (h.crit) {
    s.score.event('触发会心');
    rate(s);
  }
  s.score.event('所有伤害', h.damage, foe.id);
  rate(s);
  // UI_伤害提示 at 击中点位置 (the contact point at the hero's centre height), merged per victim and skill
  s.hud?.popup({
    kind: h.crit ? 'crit' : 'damage',
    value: h.damage,
    at: { world: { x: ip.x, y: uuToTiles(STARTER_HERO.height), z: ip.z } },
    owner: foe.id,
    skill: SKILL,
    angle: damageAngle(n, s.pick),
    height: foe.body.height,
  });
  foe.mob.flash();
  s.vfx.hitSpark(ip.x, ip.z, n.x, n.y);
  s.vfx.spores(ip.x, ip.z, n.x, n.y);
  s.audio.play('hit', { x: foe.mob.position.x, z: foe.mob.position.y });
  ctx.renderer.fx.cameraShake(h.crit ? 'crit' : 'damage');
  foe.hp = Math.max(0, foe.hp - h.pips);
  if (foe.hp === 0) kill(foe);
}

/**
 * 角色死亡 (FEEL-070): no freeze, no impact frame, no extra shake. The death plays (the splat and its sound 0.5 s
 * in), the corpse stays on the floor; 击杀敌人 scores (RATING-021) and 增加经验 shows "+N经验" at the knight.
 */
function kill(foe: Foe): void {
  const s = st!;
  const at = { x: foe.mob.position.x, z: foe.mob.position.y };
  foe.mob.die({
    onSplat: () => {
      s.vfx.deathSplat(at.x, at.z);
      s.audio.play('death', at);
    },
  });
  if (!alive(s)) s.hud?.setCombat({ enemiesOnField: false });
  s.score.event('击杀敌人');
  rate(s);
  // SPEC-GAP: the EXP bar and the level-up (增加经验 当前经验, 尝试提升等级) are not ported; only the popup shows
  s.hud?.popup({ kind: 'exp', value: killExp(foe.exp, s.rng), at: { world: aroundCharacter(heroAt(s), STARTER_HERO.height, s.rng) } });
}

/**
 * The rest (可控弹射 销毁前触发 → 结束行动): the trail stops laying points, 乱舞 scores (RATING-027), the knight pops out
 * of the ball (non-blocking), 玩家被动 takes its Stamina, and the control is back at once.
 * SPEC-GAP: without the enemy turn (turn-flow, enemy-ai-intents) the action's end is the round's end (RATING-031):
 * 回合统计结束 plays and the player aims again at once.
 */
function rest(s: State, launch: LaunchPlayback): void {
  s.hero = launch.end;
  if (s.trail) s.vfx.trailEnd(s.trail);
  s.trail = null;
  s.score.movementRange(launch.movementRange);
  rate(s);
  s.knight.launchEnd();
  s.stamina = changeStamina(s.stamina, s.staminaMax, STAMINA_PER_ACTION);
  s.hud?.setHero({ stamina: s.stamina });
  s.hud?.endTurnStats();
  // the dead leave the board; the next aim starts from where the knight came to rest
  s.world = launchWorld(s.layout, s.solids, s.foes);
  s.launch = null;
  s.phase = 'aim';
  aimAtFloor(s, s.pointer?.floor ?? s.cursor);
  s.hud?.setCombat({ aiming: true });
}

/** Advances the creatures by `gameDt` of the (dilated) game clock; the knight's floor point applies here. */
function advanceCreatures(ctx: SceneContext, s: State, gameDt: number): void {
  s.knight.update(gameDt, ctx.camera);
  for (const f of s.foes) {
    f.mob.target.copy(s.knight.position);
    f.mob.update(gameDt, ctx.camera);
  }
}

/** Moves the knight (and his ball's roll) to the floor point (x, z) in tiles. */
function moveKnight(s: State, x: number, z: number): void {
  s.knight.roll(x - s.lastPos.x, z - s.lastPos.y);
  s.knight.position.set(x, z);
  s.lastPos.set(x, z);
}

function update(ctx: SceneContext, dt: number): void {
  if (!st) return;
  const s = st;
  const { renderer } = ctx;
  const k = s.knight;
  s.uiTime += dt;

  if (s.phase === 'aim') {
    if (s.auto && !s.launched) {
      // the scripted cursor sweeps onto the chosen line, holds, then releases
      setAim(s, aimOf(sweepAngle(s.autoAim, s.time, SWEEP)));
      s.cursor = uuPointToTiles(cursorPoint(s.preview, s.hero));
      if (s.time >= AIM_TIME) {
        s.launched = true;
        s.release = true;
      }
    } else if (s.pointer && s.pointerMoved) {
      s.pointerMoved = false;
      aimAtFloor(s, s.pointer.floor);
    }
    if (s.release) {
      s.release = false;
      startLaunch();
    } else {
      k.face = 'determined';
      k.facing = THREE.MathUtils.clamp(Math.atan2(s.preview.aim.x, s.preview.aim.y), -1.2, 1.2) * 0.6;
      s.pulse.update(dt, s.preview.pulse);
    }
  }

  // the game clock: the launch clock under the hit-stop of the enemy contacts; it drives the world, the shakes,
  // the effects and the creatures, never the HUD or the sound
  const before = s.launchT;
  s.launchT = advanceLaunchClock(before, dt, s.enemyContacts);
  const gdt = s.launchT - before;
  s.time += gdt;
  renderer.fx.shakeTime(dt > 0 ? gdt / dt : 1);

  const launch = s.launch;
  if (s.phase === 'roll' && launch) {
    // the world up to each contact of this frame, so its reactions and effects start at their own game time
    let t = before;
    while (s.nextContact < launch.contacts.length && launch.contacts[s.nextContact].time <= s.launchT) {
      const c = launch.contacts[s.nextContact++];
      s.vfx.update(c.time - t);
      advanceCreatures(ctx, s, c.time - t);
      t = c.time;
      const at = uuPointToTiles(c.position);
      moveKnight(s, at.x, at.z);
      travel(s, at.x, at.z);
      contact(ctx, c);
    }
    s.vfx.update(s.launchT - t);
    const p = uuPointToTiles(samplePlayback(launch, s.launchT).position);
    moveKnight(s, p.x, p.z);
    travel(s, p.x, p.z);
    advanceCreatures(ctx, s, s.launchT - t);
    if (s.launchT >= launch.duration) rest(s, launch);
  } else {
    s.vfx.update(gdt);
    advanceCreatures(ctx, s, gdt);
  }

  s.audio.setListener(k.position.x, k.position.y);
  s.watch.update(s.time);
  s.room.setFires([{ x: k.position.x, y: 1.5, z: k.position.y, reach: 2.8 }]);
  s.room.update(renderer.time, dt);
  s.shafts?.update(renderer.time);
  if (s.hud) {
    s.hud.setEnemies(marks(s));
    s.hud.update(dt);
  }
  if (s.auto) {
    // the scripted cursor rests on its aim point while the knight aims
    if (s.phase !== 'aim') s.arrow.hide();
    else {
      const q = renderer.projectToScreen({ x: s.cursor.x, y: 0, z: s.cursor.z });
      const r = renderer.canvas.getBoundingClientRect();
      s.arrow.show(cursorGrid(ctx), r.left + q.x, r.top + q.y);
    }
  }
}

/**
 * UI_头顶状态条 and UI_意图提示 of every living enemy: the bar under the front of the footprint (BAR_LIFT). Outside
 * the aim (当前环节 2) the marks are hidden: the bars fade out and back in at 4 per second, the intents go at once
 * (蓝图_效果_意图 hides its widget on 进入战斗时, L848). A dead enemy's mark is left out (its bar fades).
 * SPEC-GAP: the intents return at the next aim at once: the enemy turn that would re-roll them is not ported.
 */
function marks(s: State): EnemyMark[] {
  const hidden = s.phase !== 'aim';
  return s.foes
    .filter(f => f.hp > 0)
    .map((f): EnemyMark => {
      const { x, y: z } = f.mob.position;
      const intent = f.intent !== undefined ? { kind: 'attack' as const, value: f.intent } : undefined;
      return { id: f.id, at: { x, y: 0, z: z + f.mob.radius * 0.9 - BAR_LIFT }, head: { x, y: f.head, z }, hp: f.hp, hpMax: f.hpMax, intent, hidden };
    });
}

function draw(c: PixelCanvas, ctx: PassContext): void {
  if (!st) return;
  const s = st;
  if (s.phase !== 'aim' || s.previewHidden) return;
  const ppt = TILE_PX * s.zoom;
  drawLaunchPreview(c, s.preview, p => ctx.project({ x: uuToTiles(p.x), y: 0, z: uuToTiles(p.y) }), {
    pxPerUu: ppt / UU_PER_TILE,
    zoom: s.zoom,
    hero: s.hero,
    heroBox: KNIGHT_BOX,
    pulse: s.pulse,
    time: s.time,
  });
}

export default defineScene({
  name: 'play',
  description: 'reference combat room: core launch preview and playback under the Ink & Bone HUD with the Demo launch feel; mouse aim, release to launch',
  setup,
  update,
});
