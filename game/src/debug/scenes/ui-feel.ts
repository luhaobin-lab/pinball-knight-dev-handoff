import { buildRoom } from '../../procgen/architecture/room';
import { northstarSpec, NORTHSTAR_SCREEN } from '../../procgen/architecture/northstar';
import { obliqueCamera, obliqueTargetFor, TILE_PX } from '../../procgen/architecture/framing';
import { createWindowLightPass } from '../../procgen/architecture/windowlight';
import { windowShafts } from '../../procgen/architecture/shafts';
import { B1_LIGHT } from '../../procgen/architecture/palette';
import { K_OBLIQUE } from '../../procgen/architecture/walls';
import { BeetleKnight } from '../../procgen/creatures/beetle-knight';
import { Mob } from '../../procgen/creatures/mobs';
import { hitStopDilation, STARTER_HERO, uuToTiles } from '../../core/launch/index.ts';
import type { Rng } from '../../core/rng';
import { HERO_START, ROOM_ENEMIES, roomBodies } from '../../game/reference-room';
import { firstQuest, heroStart } from '../../game/hero';
import { startingLoadout } from '../../game/loadout';
import { damageAngle, DAMAGE_PICKS } from '../../game/popups';
import { TurnScore } from '../../game/turn-score';
import { BAR_OFFSET, createCombatHud, type CombatHud, type EnemyMark } from '../../ui';
import { defineScene, type SceneContext } from '../types';

/**
 * The combat UI's motion over the reference room (lane ui, feel wave): one scripted launch on the HUD's real-time
 * clock, its events fed to the HUD like the game will (蓝图_动作游戏模式 and 蓝图_效果_受伤 order):
 * - 1.0 s release: hud.beginLaunch() (进入战斗状态), the head bars fade out, the intents go;
 * - three hits on the jelly, 6, +8, +7: one UI_伤害提示 counting 6 → 14 → 21 with 数值更新 bumps;
 * - a crit of 24 on the skull (27-pt numerals, 会心图标), a kill of 9 on the small acolyte with its +EXP (sapphire),
 *   which starts at the knight (增加经验's 经验来源 is the hero), not at the acolyte;
 * - every contact scores 反弹 and its hits through the game's TurnScore: 回合统计出现, then 评级更新 and 更新闪烁 per
 *   event; 乱舞 at the stop (2.6 s); 回合统计结束 at 2.9 s (gone by 5.9 s);
 * - 3.2 s aiming again: the living enemies' bars fade back in.
 * The world clock runs under the Demo's hit-stop (0.2× / 1.5× after each enemy contact) and the HUD does not.
 * The cast stands idle: hit and death reactions are the creatures lane's.
 * ?hit=<n> replaces the hits with one normal hit of n on the jelly at 1.2 s (to set beside demo-rec-02's "30").
 */

/** The scripted launch, seconds of real time. */
const RELEASE = 1.0;
const STOP = 2.6;
const ROUND_END = 2.9;
const AIM_AGAIN = 3.2;

/** Knight's whirlwind hit (可控挥击) on enemy `foe` (ROOM_ENEMIES index); `kill` scores 击杀敌人 and shows the EXP. */
interface Hit {
  readonly at: number;
  readonly foe: number;
  readonly damage: number;
  readonly crit?: boolean;
  readonly kill?: { exp: number };
}

const HITS: readonly Hit[] = [
  { at: 1.2, foe: 3, damage: 6 },
  { at: 1.45, foe: 3, damage: 8 },
  { at: 1.7, foe: 4, damage: 24, crit: true },
  { at: 1.95, foe: 3, damage: 7 },
  { at: 2.2, foe: 1, damage: 9, kill: { exp: 12 } },
];

/** 乱舞 of the scripted stop (FTrunc(散布分数 × (0.015 + 0.02 n)), a 300-uu spread). */
const MOVEMENT_RANGE = 172;

/** As play.ts: the bar hangs 2 px under the front of the footprint (the widget's own offset given back). */
const BAR_LIFT = BAR_OFFSET.z - K_OBLIQUE * BAR_OFFSET.y - 5 / TILE_PX;

interface Foe {
  readonly id: string;
  readonly mob: Mob;
  hp: number;
  readonly hpMax: number;
  readonly intent?: number;
  readonly head: number;
  readonly height: number;
}

interface State {
  hud: CombatHud;
  knight: BeetleKnight;
  foes: Foe[];
  room: ReturnType<typeof buildRoom>;
  shafts: ReturnType<typeof windowShafts>;
  score: TurnScore;
  pick: number;
  /** The scene's seeded stream (ctx.rng): 扩散命中中心's angle for the EXP. */
  rng: Rng;
  /** Real time (the HUD's clock) and the world's clock under the hit-stop. */
  time: number;
  world: number;
  /** Game seconds since the last enemy contact (the hit-stop track's time). */
  sinceContact: number;
  next: number;
  phase: 'aim' | 'launch' | 'stopped' | 'ended';
  hits: readonly Hit[];
}

/** The hero aims (当前环节 2): before the release and from the next aim on. */
const aiming = (s: State): boolean => s.time < RELEASE || s.time >= AIM_AGAIN;

let st: State | null = null;

async function setup(ctx: SceneContext): Promise<void> {
  const { renderer, scene } = ctx;
  const spec = northstarSpec('ns-1');
  const room = buildRoom(spec);
  scene.add(room.group);
  for (const l of room.lights) renderer.addPointLight(l);
  const pass = createWindowLightPass(room.windows);
  pass.glow = 0.95;
  renderer.addPass('lighting', pass);
  room.uniforms.uWindowGlow.value = 0.5;
  room.uniforms.uSigilGlow.value = 0.12;
  room.uniforms.uBioGlow.value = 0.55;
  const shafts = windowShafts(room.windows);
  shafts.glow = 0.8;
  scene.add(shafts.object);
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
  knight.face = 'determined';
  scene.add(knight.group);
  renderer.addPointLight({ position: { x: 0, y: 2.4, z: 0.8 }, follow: knight.body, color: '#FFE2B0', intensity: 0.85, radius: 4.6, flicker: 0.06, seed: 11 });

  const bodies = roomBodies();
  const foes = ROOM_ENEMIES.map((e, i): Foe => {
    const mob = new Mob(e.kind, { seed: i + 1, scale: e.scale });
    mob.position.set(e.x, e.z);
    mob.target.set(HERO_START.x, HERO_START.z);
    mob.facing = Math.atan2(HERO_START.x - e.x, HERO_START.z - e.z);
    scene.add(mob.group);
    for (const l of mob.lights) renderer.addPointLight(l);
    return { id: bodies[i].id, mob, hp: e.hp, hpMax: e.hp, intent: e.intent, head: (e.scale ?? 1) * (e.kind === 'jelly' ? 1.9 : 2.9), height: bodies[i].body.height };
  });

  const scale = TILE_PX / 16;
  const target = obliqueTargetFor(renderer, 0, 0, NORTHSTAR_SCREEN.ox * scale, NORTHSTAR_SCREEN.oy * scale);
  obliqueCamera(renderer, target.x, target.z);

  const loadout = startingLoadout();
  const hud = await createCombatHud({
    renderer,
    state: { hero: heroStart(), aiming: true, enemiesOnField: true, items: loadout.map(l => l.card), unlockedRows: 4, quest: firstQuest() },
  });
  const single = Number(ctx.params.get('hit'));
  const hits = single > 0 ? [{ at: 1.2, foe: 3, damage: single }] : HITS;
  st = { hud, knight, foes, room, shafts, score: new TurnScore(), pick: ctx.rng.pick(DAMAGE_PICKS), rng: ctx.rng, time: 0, world: 0, sinceContact: Infinity, next: 0, phase: 'aim', hits };
}

/**
 * 函数库_工具.扩散命中中心(character, 0, 0.65, 0) for a character that is not a card: its actor location (the capsule
 * centre, 高度 above the floor) plus RotateAngleAxis((0.65 × 高度, 0, 0), RandomFloatInRange(−180, 180), Z), a point
 * ON that circle. The Demo frame has X = screen up = −z and Y = screen right = x.
 * SPEC-GAP: the Demo's camera looks straight down, so there this Z never moves the popup on screen; our oblique camera
 * lifts it 0.625 × 高度, as it does 击中点位置 (play.ts). Where the Demo draws its actor location on the sprite depends
 * on the sprite pivot, which the dump does not have.
 */
function spreadAround(at: { readonly x: number; readonly y: number }, heightUu: number, rng: Rng): { x: number; y: number; z: number } {
  const r = uuToTiles(0.65 * heightUu);
  const a = (rng.range(-180, 180) * Math.PI) / 180;
  return { x: at.x + r * Math.sin(a), y: uuToTiles(heightUu), z: at.y - r * Math.cos(a) };
}

/** 更新回合战斗统计's UI after one scored event. */
function rate(s: State): void {
  s.hud.setTurnStats(s.score.view());
}

function strike(s: State, h: Hit): void {
  const foe = s.foes[h.foe];
  const m = foe.mob.position;
  // the contact on the side facing the knight, at the hero's centre height (击中点位置); the normal points at him
  const nx = HERO_START.x - m.x;
  const nz = HERO_START.z - m.y;
  const len = Math.hypot(nx, nz);
  const hit = { x: m.x + (nx / len) * foe.mob.radius, y: uuToTiles(STARTER_HERO.height), z: m.y + (nz / len) * foe.mob.radius };
  // 反弹中 scores the bounce, then 发动攻击: 触发会心 before the damage, 所有伤害 per victim, 击杀敌人 on the kill
  s.score.event('反弹');
  rate(s);
  if (h.crit) {
    s.score.event('触发会心');
    rate(s);
  }
  s.score.event('所有伤害', h.damage, foe.id);
  rate(s);
  s.hud.popup({
    kind: h.crit ? 'crit' : 'damage',
    value: h.damage,
    at: { world: hit },
    owner: foe.id,
    skill: '可控挥击',
    angle: damageAngle({ x: nx / len, y: nz / len }, s.pick),
    height: foe.height,
  });
  foe.hp = Math.max(0, foe.hp - (h.crit ? 3 : 1));
  if (h.kill) {
    foe.hp = 0;
    s.score.event('击杀敌人');
    rate(s);
    // the kill calls 增加经验(死亡产生经验, 游戏模式.玩家角色) (BP_Actor_Other L8845): the popup's 拥有者 is the HERO, and
    // UI_拾取提示 (L2882) starts it at 扩散命中中心(hero, 0, 0.65, 0), 36.4 uu from the knight's centre, not at the acolyte
    s.hud.popup({ kind: 'exp', value: h.kill.exp, at: { world: spreadAround(s.knight.position, STARTER_HERO.height, s.rng) } });
  }
  s.sinceContact = 0;
}

function marks(s: State): EnemyMark[] {
  const shown = aiming(s);
  return s.foes
    .filter(f => f.hp > 0)
    .map((f): EnemyMark => {
      const { x, y: z } = f.mob.position;
      return {
        id: f.id,
        at: { x, y: 0, z: z + f.mob.radius * 0.9 - BAR_LIFT },
        head: { x, y: f.head, z },
        hp: f.hp,
        hpMax: f.hpMax,
        intent: f.intent !== undefined ? { kind: 'attack', value: f.intent } : undefined,
        hidden: !shown,
      };
    });
}

function update(ctx: SceneContext, dt: number): void {
  const s = st;
  if (!s) return;
  s.time += dt;
  if (s.phase === 'aim' && s.time >= RELEASE) {
    // 进入战斗状态: 当前环节 3, the maps cleared, the rating starts over
    s.phase = 'launch';
    s.score = new TurnScore();
    s.hud.beginLaunch();
    s.hud.setCombat({ aiming: false });
  }
  while (s.next < s.hits.length && s.hits[s.next].at <= s.time) strike(s, s.hits[s.next++]);
  if (s.phase === 'launch' && s.time >= STOP) {
    s.phase = 'stopped';
    s.score.movementRange(MOVEMENT_RANGE);
    rate(s);
  }
  if (s.phase === 'stopped' && s.time >= ROUND_END) {
    s.phase = 'ended';
    s.hud.endTurnStats();
  }
  if (s.phase === 'ended' && aiming(s)) s.hud.setCombat({ aiming: true, enemiesOnField: s.foes.some(f => f.hp > 0) });
  // the world under the hit-stop (蓝图_效果_时间变速 after an enemy contact); the HUD on real time
  const dilation = hitStopDilation(s.sinceContact);
  const gdt = dt * dilation;
  s.world += gdt;
  s.sinceContact += gdt;
  s.knight.update(gdt, ctx.camera);
  for (const f of s.foes) f.mob.update(gdt, ctx.camera);
  s.room.setFires([{ x: s.knight.position.x, y: 1.5, z: s.knight.position.y, reach: 2.8 }]);
  s.room.update(ctx.renderer.time, dt);
  s.shafts.update(ctx.renderer.time);
  s.hud.setEnemies(marks(s));
  s.hud.update(dt);
}

export default defineScene({
  name: 'ui-feel',
  description: 'combat UI motion (feel wave): merged damage numbers with bumps, crit, kill +EXP, 回合统计 in/update/flash/out, head bar fades',
  setup,
  update,
});
