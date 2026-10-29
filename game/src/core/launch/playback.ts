/**
 * The controlled launch: 蓝图_效果_可控弹射 replaying the preview chain through the native path follower
 * (ULaunchPathFollowerComponent driven by a CurveTable progress curve; native-trajectory §5.8/5.9, §7.4;
 * launch-movement §6.D–F). Main legs 0..K replay the displayed circles' main paths; the speed rises by 300 uu/s
 * after every leg that was not a gravity bounce. The terminal leg replays the last circle's terminal path at
 * 0.3 × the last speed. Every main leg ends in its circle's contact; the terminal leg ends in none. The legs are
 * the preview's own path objects, so the launch goes exactly where the aim showed.
 *
 * Time is continuous game time: a leg lasts exactly its duration and the next one starts at once.
 * SPEC-GAP: the Demo's follower finishes a leg on the first frame whose curve target reaches the path end (the
 * curves reach 1 at t ≈ 0.9986 main, 0.9943 terminal, NATIVE-084/089) and the launch starts the next leg after
 * the latent resume (native-trajectory U-10), so its legs end on frame boundaries, up to a frame or two later.
 * Global time dilation (the hit-stop of hostile contacts, settings.ts HIT_STOP) maps game time to real time; that
 * is the caller's.
 */
import { CURVE_MAIN_LEG, CURVE_TERMINAL_LEG, evalRichCurve, richCurveSlope, type RichKey } from './curves.ts';
import { type Vec2, clamp, distance, f32, mul, ZERO } from './math.ts';
import { isPlayablePath, isStationaryCollision, sampleTrajectory, type Trajectory } from './path.ts';
import { canBounceOff, isHostile, type LaunchPreview, type PreviewCircle } from './preview.ts';
import { type HeroLaunchStats, LAUNCH_RULES } from './settings.ts';
import type { Hit } from './world.ts';

/** Main-leg speed (可控弹射 L1882): FMin(疲劳 × 300 + 2000, 6000), passed to the native as a float. */
export const mainLegSpeed = (fatigue: number): number =>
  f32(Math.min(fatigue * LAUNCH_RULES.legSpeedPerFatigue + LAUNCH_RULES.legSpeedBase, LAUNCH_RULES.legSpeedMax));

/** Terminal-leg speed (L1196): 移动当前速度 × 0.3, the speed the last main leg was started with. */
export const terminalLegSpeed = (lastMainSpeed: number): number => f32(lastMainSpeed * LAUNCH_RULES.terminalSpeedFactor);

/** Leg duration (StartLegacyPreviewLeg, exe@0x1445b250b–0x1445b2526): max(Total / Speed, 0.01) in float. */
export const legDuration = (length: number, speed: number): number => Math.max(f32(f32(length) / f32(speed)), f32(LAUNCH_RULES.minLegDuration));

/** enemy = a hostile actor, wall = any other blocking actor, gravity = a deferred gravity bounce in the air. */
export type ContactKind = 'enemy' | 'wall' | 'gravity';

/** The contact a main leg ends in (蓝图_效果_可控反弹时交互 on 效果.时机.主动激活.可控反弹, LAUNCH-045). */
export interface LaunchContact {
  /** Order of the contact in the launch. */
  readonly index: number;
  /** The main leg (= preview circle) that ends in it. */
  readonly leg: number;
  /** Game seconds after the release. */
  readonly time: number;
  /** Hero centre at the contact: the leg end, where the preview drew its marker. */
  readonly position: Vec2;
  readonly kind: ContactKind;
  /** The circle's blocking hit (its actor, normal and impact point); null for a gravity bounce. */
  readonly hit: Hit | null;
  /** ordinary = spent one Bounce Limit; gravity = paid by a 回弹漩涡 credit; none = leg 0 on a contact it may not bounce off. */
  readonly bounce: 'ordinary' | 'gravity' | 'none';
  /**
   * The hero gets 蓝图_效果_反弹中 (判断目标可反弹 in 弹性处理, or the deferred gravity path): item charge, the 反弹
   * stats, camera shake, 反弹时 effects and the squash of a touched body; plus the hit-stop when `kind` is enemy.
   */
  readonly reacts: boolean;
  /** 移动当前速度 at the contact: the speed of the leg that ended. */
  readonly speed: number;
}

export interface PlaybackLeg {
  /** Position in `LaunchPlayback.legs`: main leg i replays preview circle i; the terminal leg comes last. */
  readonly index: number;
  readonly terminal: boolean;
  /** The preview's path (the same object). */
  readonly path: Trajectory;
  /** 可控反弹曲线 for main legs, 可控终末确定曲线 for the terminal leg. */
  readonly curve: readonly RichKey[];
  /** 疲劳 when the leg starts. */
  readonly fatigue: number;
  readonly speed: number;
  readonly start: number;
  readonly duration: number;
  readonly end: number;
  readonly contact: LaunchContact | null;
}

export interface LaunchPlayback {
  readonly origin: Vec2;
  readonly legs: readonly PlaybackLeg[];
  /** In time order. */
  readonly contacts: readonly LaunchContact[];
  readonly duration: number;
  /** Where the hero comes to rest. */
  readonly end: Vec2;
  /** 疲劳 when the launch ends. */
  readonly fatigue: number;
  /** False when a displayed circle has no playable path: the launch stops before it, as the Demo's does (L3003). */
  readonly complete: boolean;
  /** 乱舞, the Movement Range stat scored when the launch ends. */
  readonly movementRange: number;
}

export interface PlaybackSample {
  /** Hero centre. */
  readonly position: Vec2;
  /** uu per game second. */
  readonly velocity: Vec2;
  /** Index of the leg in progress: −1 before the release, `legs.length` once the hero is at rest. */
  readonly leg: number;
}

/** The launch a release of this preview plays (可控弹射 activation and leg loop, LAUNCH-028…042). */
export function planLaunch(preview: LaunchPreview): LaunchPlayback {
  const legs: PlaybackLeg[] = [];
  const contacts: LaunchContact[] = [];
  let fatigue = 0;
  let time = 0;
  let speed = 0;
  let complete = true;
  for (const circle of preview.legs) {
    // StartLegacyPreviewLeg refuses a circle without a playable main path; the effect then ends (L3003 → L854).
    if (!isPlayablePath(circle.path)) {
      complete = false;
      break;
    }
    speed = mainLegSpeed(fatigue);
    const duration = legDuration(circle.path.totalDistance, speed);
    const end = time + duration;
    const contact = contactOf(circle, contacts.length, end, speed);
    if (contact) contacts.push(contact);
    legs.push({ index: legs.length, terminal: false, path: circle.path, curve: CURVE_MAIN_LEG, fatigue, speed, start: time, duration, end, contact });
    time = end;
    // AdvanceLegacyPreviewPlayback (NATIVE-099): a leg paid by a gravity credit does not tire the hero.
    if (!circle.deferredGravityBounce) fatigue += 1;
  }
  if (complete && preview.terminal) {
    const terminalSpeed = terminalLegSpeed(speed);
    const duration = legDuration(preview.terminal.path.totalDistance, terminalSpeed);
    legs.push({ index: legs.length, terminal: true, path: preview.terminal.path, curve: CURVE_TERMINAL_LEG, fatigue, speed: terminalSpeed, start: time, duration, end: time + duration, contact: null });
    time += duration;
  }
  const last = legs[legs.length - 1];
  return {
    origin: preview.origin,
    legs,
    contacts,
    duration: time,
    end: last ? last.path.points[last.path.points.length - 1].location : preview.origin,
    fatigue,
    complete,
    movementRange: movementRange(preview.collisionPoints),
  };
}

/** 可控反弹时交互 L4428–L8207: the circle's Out Hit if it blocks, else a deferred gravity bounce, else nothing. */
function contactOf(c: PreviewCircle, index: number, time: number, speed: number): LaunchContact | null {
  const base = { index, leg: c.index, time, position: c.end, speed };
  if (c.hit) return { ...base, kind: isHostile(c.hit.actor) ? 'enemy' : 'wall', hit: c.hit, bounce: c.bounceable ? 'ordinary' : 'none', reacts: canBounceOff(c.hit.actor) };
  if (c.deferredGravityBounce) return { ...base, kind: 'gravity', hit: null, bounce: 'gravity', reacts: true };
  return null;
}

/** Hero position, velocity and leg `time` game seconds after the release. */
export function samplePlayback(playback: LaunchPlayback, time: number): PlaybackSample {
  if (!(time >= 0)) return { position: playback.origin, velocity: ZERO, leg: -1 };
  for (const leg of playback.legs) if (time < leg.end) return sampleLeg(leg, time - leg.start);
  return { position: playback.end, velocity: ZERO, leg: playback.legs.length };
}

function sampleLeg(leg: PlaybackLeg, elapsed: number): PlaybackSample {
  const path = leg.path;
  const at = { velocity: ZERO, leg: leg.index };
  // A stationary path ends on its first tick without moving (NATIVE-082).
  if (isStationaryCollision(path)) return { ...at, position: path.points[0].location };
  // NATIVE-083: t = Elapsed / Duration, travelled = clamp(curve(t), 0, 1) · Total.
  const t = f32(f32(elapsed) / leg.duration);
  const v = evalRichCurve(leg.curve, t);
  const sample = sampleTrajectory(path, f32(clamp(v, 0, 1) * path.totalDistance));
  if (!sample) return { ...at, position: path.points[0].location };
  const rate = v > 0 && v < 1 ? (richCurveSlope(leg.curve, t) * path.totalDistance) / leg.duration : 0;
  return { position: sample.location, velocity: mul(sample.direction, rate), leg: leg.index };
}

/**
 * 乱舞, the Movement Range stat (可控弹射 销毁前触发 L7728 → L4532–L4827): every recorded collision point's distance
 * to its nearest other point (seeded with 999999), summed, times 0.015 + 0.02·n, truncated.
 */
export function movementRange(points: readonly Vec2[]): number {
  const n = points.length;
  if (n < 2) return 0;
  let spread = 0;
  for (let j = 0; j < n; j++) {
    let nearest = 999999;
    for (let i = 0; i < n; i++) if (i !== j) nearest = Math.min(nearest, distance(points[i], points[j]));
    spread += nearest;
  }
  return Math.trunc(spread * (0.015 + 0.02 * n));
}

/**
 * The attack a contact starts (可控反弹时交互 L5427, L9342; LAUNCH-056…059): melee when a hero whose launch skill
 * is not wall-triggered touches a hostile body; ranged when a wall-triggered hero touches anything blocking that
 * is not a body, but only while enemies are on the field (游戏模式.敌方场上, the caller's state at that moment).
 */
export function contactAttack(contact: LaunchContact, hero: HeroLaunchStats): 'melee' | 'ranged' | null {
  const actor = contact.hit ? contact.hit.actor : null;
  if (!actor) return null;
  if (actor.kind === 'body') return !hero.wallTriggered && isHostile(actor) ? 'melee' : null;
  return hero.wallTriggered ? 'ranged' : null;
}
