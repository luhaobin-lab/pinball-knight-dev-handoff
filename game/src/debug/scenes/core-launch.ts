import { buildRoom, type BuiltRoom } from '../../procgen/architecture/room';
import { northstarSpec, NORTHSTAR_SCREEN } from '../../procgen/architecture/northstar';
import { obliqueCamera, obliqueTargetFor, TILE_PX } from '../../procgen/architecture/framing';
import { createWindowLightPass } from '../../procgen/architecture/windowlight';
import { B1_LIGHT } from '../../procgen/architecture/palette';
import { addPixelOverlay, INK, WHITE, type PixelCanvas } from '../../game/overlay';
import {
  computeLaunchPreview,
  contactAttack,
  createLaunchWorld,
  planLaunch,
  samplePlayback,
  STARTER_HERO,
  tilePointToUu,
  tilesToUu,
  uuPointToTiles,
  type LaunchPlayback,
  type LaunchPreview,
  type LaunchWorld,
  type Vec2,
} from '../../core/launch/index.ts';
import { defineScene, type SceneContext } from '../types';

/**
 * The core launch (src/core/launch) in the reference room, drawn flat in the overlay: the preview chain the aim
 * shows (chevrons per leg, the Demo's leg-end marks: enemy dashed ring, wall dot + arc, air dot; numbered contacts;
 * the dimmer terminal line), then the launch it plays. The aim sweeps between shots; ?aim=<deg> fixes it,
 * ?mode=aim shows the preview only. Enemies are red rings, bouncy decorations grey rings, the hero a white disc.
 */

const ENEMIES: [number, number, number][] = [[13.3, 3.4, 52], [6.2, 2.9, 40], [19.2, 2.8, 40], [11.2, 6.5, 44], [18.0, 10.4, 40], [3.6, 7.1, 40]];
const HERO_START = tilePointToUu(10.5, 11.6);
const AIM_TIME = 1.2;
const REST_TIME = 0.8;
const RED = '#FF4D5E';
const DIM = '#B9B2D6';

interface State {
  room: BuiltRoom;
  world: LaunchWorld;
  hero: Vec2;
  aim: number;
  preview: LaunchPreview;
  launch: LaunchPlayback | null;
  clock: number;
  fixed: boolean;
  aimOnly: boolean;
}

let st: State | null = null;

function aimPreview(world: LaunchWorld, hero: Vec2, deg: number): LaunchPreview {
  const a = (deg * Math.PI) / 180;
  return computeLaunchPreview(world, hero, { x: Math.cos(a), y: Math.sin(a) }, { hero: STARTER_HERO });
}

function setup(ctx: SceneContext): void {
  const { renderer, scene, params } = ctx;
  const spec = northstarSpec('ns-1');
  const room = buildRoom(spec);
  scene.add(room.group);
  for (const l of room.lights) renderer.addPointLight(l);
  renderer.addPass('lighting', createWindowLightPass(room.windows));
  room.uniforms.uWindowGlow.value = 0.5;
  const L = renderer.lighting;
  L.background.set(B1_LIGHT.void);
  L.ambientSky.set(B1_LIGHT.ambientSky);
  L.ambientGround.set(B1_LIGHT.ambientGround);
  L.ambientIntensity = 4.4;
  L.keyColor.set(B1_LIGHT.god);
  L.keyDirection.set(-0.19, 0.67, -0.72);
  L.keyIntensity = 0.06;
  const t = obliqueTargetFor(renderer, 0, 0, NORTHSTAR_SCREEN.ox * (TILE_PX / 16), NORTHSTAR_SCREEN.oy * (TILE_PX / 16));
  obliqueCamera(renderer, t.x, t.z);

  const solids = [...(spec.pillars ?? []), ...(spec.urns ?? []).map(u => ({ ...u, radius: u.radius ?? 0.45 })), ...(spec.mounds ?? [])];
  const world = createLaunchWorld({
    grid: spec.layout,
    bodies: ENEMIES.map(([x, z, r], i) => ({ id: `enemy-${i}`, ...tilePointToUu(x, z), radius: r })),
    circles: solids.map((s, i) => ({ id: `solid-${i}`, ...tilePointToUu(s.x, s.z), radius: tilesToUu(s.radius) })),
  });
  const fixed = params.has('aim');
  const aim = fixed ? Number(params.get('aim')) : -62;
  st = { room, world, hero: HERO_START, aim, preview: aimPreview(world, HERO_START, aim), launch: null, clock: 0, fixed, aimOnly: params.get('mode') === 'aim' };
  addPixelOverlay(renderer, (c, pctx) => draw(c, p => pctx.project({ x: uuPointToTiles(p).x, y: 0, z: uuPointToTiles(p).z })));
}

function update(ctx: SceneContext, dt: number): void {
  if (!st) return;
  const s = st;
  s.clock += dt;
  s.room.update(ctx.renderer.time, dt);
  if (s.aimOnly) return;
  if (!s.launch) {
    if (!s.fixed) s.preview = aimPreview(s.world, s.hero, s.aim + 25 * Math.sin(s.clock * 1.3));
    if (s.clock >= AIM_TIME) {
      s.launch = planLaunch(s.preview);
      s.clock = 0;
    }
  } else if (s.clock >= s.launch.duration + REST_TIME) {
    // next shot from where the hero came to rest, aimed back across the room
    s.hero = s.launch.end;
    s.aim = s.fixed ? s.aim : (s.aim + 137) % 360;
    s.preview = aimPreview(s.world, s.hero, s.aim);
    s.launch = null;
    s.clock = 0;
  }
}

function draw(c: PixelCanvas, P: (p: Vec2) => { x: number; y: number }): void {
  if (!st) return;
  const s = st;
  const pxPerUu = TILE_PX / 64;
  const ring = (p: Vec2, r: number, color: string, dash = 0): void => {
    const q = P(p);
    c.ring(q.x, q.y, Math.round(r * pxPerUu), color, dash, false);
  };
  for (const body of s.world.circles) ring(body.center, body.radius, body.actor.kind === 'body' ? RED : '#6F6A80');

  const preview = s.preview;
  const chevrons = (line: readonly Vec2[], color: string, size: number): void => {
    for (let i = 1; i < line.length; i++) {
      const a = P(line[i - 1]);
      const b = P(line[i]);
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len < 0.5) continue;
      if (i % 2 === 0 || line.length < 4) c.chevron((a.x + b.x) / 2, (a.y + b.y) / 2, (b.x - a.x) / len, (b.y - a.y) / len, size, color);
    }
  };
  if (!s.launch || s.aimOnly) {
    let n = 0;
    for (const leg of preview.legs) {
      chevrons(leg.line, WHITE, 3);
      const q = P(leg.end);
      if (leg.marker === 'enemy') ring(leg.end, 60, WHITE, 4);
      else if (leg.marker === 'wall' && leg.hit) {
        const away = P({ x: leg.end.x - leg.hit.normal.x * 60, y: leg.end.y - leg.hit.normal.y * 60 });
        const ang = Math.atan2(away.y - q.y, away.x - q.x);
        c.arc(q.x, q.y, Math.round(60 * pxPerUu), ang - 0.68, ang + 0.68, WHITE);
      }
      c.dot(q.x, q.y, WHITE, leg.marker === 'enemy' ? 4 : 3);
      if (leg.marker !== 'none' || leg.deferredGravityBounce) c.number(String(++n), q.x + 8, q.y - 8, WHITE, { big: true });
    }
    if (preview.terminal) chevrons(preview.terminal.line, DIM, 2);
    const h = P(s.hero);
    c.ring(h.x, h.y, Math.round(STARTER_HERO.width * pxPerUu), WHITE, 0, true);
    return;
  }
  const launch = s.launch;
  const now = samplePlayback(launch, s.clock);
  for (const contact of launch.contacts) {
    const age = s.clock - contact.time;
    if (age < 0 || age > 0.3) continue;
    const q = P(contact.position);
    c.ring(q.x, q.y, Math.round((40 + age * 200) * pxPerUu), contactAttack(contact, STARTER_HERO) ? RED : WHITE, 0, true);
  }
  const h = P(now.position);
  const r = Math.round(STARTER_HERO.width * pxPerUu);
  for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) c.px(Math.round(h.x) + x, Math.round(h.y) + y, x * x + y * y > (r - 1) * (r - 1) ? INK : WHITE);
}

export default defineScene({
  name: 'core-launch',
  description: 'core launch in the reference room: the preview chain the aim shows, then the launch it plays',
  setup,
  update,
});
