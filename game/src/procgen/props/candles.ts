import * as THREE from 'three';
import type { Rng } from '../../core/rng';
import { tint, type Kit } from '../architecture/kit';
import { lathe, PRIM, trs } from '../architecture/mesh';
import { B1_LIGHT } from '../architecture/palette';

/**
 * Funeral candles (art bible §10 M2 wax, M13 flame, §8.8 L-CANDLE / L-OFFERING): ivory candles with drip
 * lips and runs, puddled wax pools, candle forests on wax mounds with a waxfall, and the 3-wick Offering
 * Candle. Each cluster registers one aggregated flickering point light (two for forests), as §9.2 asks:
 * dozens of candles cost a handful of lights.
 */

export interface CandleClusterSpec {
  readonly x: number;
  readonly z: number;
  /** Base height (0 on the floor, the wall height on a wall top). */
  readonly y?: number;
  readonly count: number;
  /** Scatter radius in tiles. */
  readonly radius?: number;
  /** Candle heights in tiles (screen: 10 px per tile). */
  readonly minHeight?: number;
  readonly maxHeight?: number;
  /** Fraction of candles lit (art bible §5: rooms start with 30–50% lit, the rest light during play). */
  readonly lit?: number;
  readonly pool?: boolean;
  /** Light strength multiplier (default 1). */
  readonly light?: number;
}

export interface MoundSpec {
  readonly x: number;
  readonly z: number;
  readonly radius: number;
  readonly height?: number;
  readonly candles?: number;
  readonly lit?: number;
  readonly offering?: boolean;
}

const WAX_IVORY = 0xffffff;

/** One candle body with its lip, drips and (when lit) a glowing top; returns the flame height. */
export function candle(kit: Kit, rng: Rng, x: number, y: number, z: number, h: number, r: number, lit: boolean): number {
  const c = tint(rng, 0.06, 0.03, WAX_IVORY);
  const glowTop = lit ? 0.7 : 0.1;
  const body = h * 0.7;
  kit.batch('wax').add(PRIM.cylinder(7), trs(x, y + body / 2, z, 0, rng.next() * 6, 0, r, body, r), c, [0.05, 0, 0, 0]);
  kit.batch('wax').add(PRIM.cylinder(7), trs(x, y + body + (h - body) / 2, z, 0, rng.next() * 6, 0, r, h - body, r), c, [glowTop, 0, 0, 0]);
  // drip lip: a slightly wider ring of wax at the top, and runs down the side
  kit.batch('wax').add(PRIM.cylinder(7), trs(x, y + h - 0.015, z, 0, 0, 0, r * 1.18, 0.05, r * 1.18), c, [glowTop * 0.8, 0, 0, 0]);
  const runs = rng.int(1, 3);
  for (let i = 0; i < runs; i++) {
    const a = rng.next() * Math.PI * 2;
    const len = rng.range(0.15, 0.55) * h;
    kit.batch('wax').add(PRIM.cylinder(4), trs(x + Math.cos(a) * r, y + h - len / 2, z + Math.sin(a) * r, 0, 0, 0, 0.02, len, 0.02), c, [glowTop * 0.4, 0, 0, 0]);
    kit.batch('wax').add(PRIM.sphere(4, 3), trs(x + Math.cos(a) * r, y + h - len, z + Math.sin(a) * r, 0, 0, 0, 0.03, 0.03, 0.03), c, [0.1, 0, 0, 0]);
  }
  // wick
  kit.batch('lead').add(PRIM.box(), trs(x, y + h + 0.03, z, 0, 0, 0, 0.025, 0.07, 0.025), tint(rng, 0.02));
  return y + h + 0.05;
}

/** A puddled wax pool: a flat lumpy disc with a raised rim. */
export function waxPool(kit: Kit, rng: Rng, x: number, y: number, z: number, r: number, glow = 0.3): void {
  const sides = 12;
  const profile: [number, number][] = [[0.0, 0.05], [r * 0.55, 0.045], [r * 0.85, 0.035], [r * 0.98, 0.012], [r, 0.0]].reverse() as [number, number][];
  const prim = lathe(profile, sides, rng.next());
  // wobble the rim radius per angle so pools are not perfect discs
  const pos = new Float32Array(prim.positions);
  const k = rng.range(2, 4);
  const ph = rng.next() * 6;
  for (let i = 0; i < pos.length; i += 3) {
    const a = Math.atan2(pos[i + 2], pos[i]);
    const s = 1 + 0.18 * Math.sin(a * k + ph) + 0.08 * Math.sin(a * 5 + ph * 2);
    pos[i] *= s;
    pos[i + 2] *= s;
  }
  kit.batch('wax').add({ ...prim, positions: pos }, trs(x, y, z), tint(rng, 0.05, 0.02, 0xc8b8a8), [glow, 0, 0, 0]);
}

export function candleCluster(kit: Kit, spec: CandleClusterSpec): void {
  const rng = kit.rng.derive(`candles:${spec.x.toFixed(2)},${spec.z.toFixed(2)}`);
  const y = spec.y ?? 0;
  const radius = spec.radius ?? 0.35;
  const minH = spec.minHeight ?? 0.25;
  const maxH = spec.maxHeight ?? 0.9;
  const litFrac = spec.lit ?? 0.7;
  if (spec.pool !== false) waxPool(kit, rng, spec.x, y, spec.z, radius * 0.75 + 0.1, 0.12);
  let sx = 0;
  let sy = 0;
  let sz = 0;
  let lit = 0;
  const placed: [number, number][] = [];
  for (let i = 0; i < spec.count; i++) {
    let cx = spec.x;
    let cz = spec.z;
    for (let t = 0; t < 12; t++) {
      const a = rng.next() * Math.PI * 2;
      const d = Math.sqrt(rng.next()) * radius;
      cx = spec.x + Math.cos(a) * d;
      cz = spec.z + Math.sin(a) * d * 0.85;
      if (placed.every(([px, pz]) => Math.hypot(px - cx, pz - cz) > 0.14)) break;
    }
    placed.push([cx, cz]);
    // tall candles at the back (north) so the cluster reads as a stepped group
    const back = THREE.MathUtils.clamp((spec.z - cz) / radius, -1, 1) * 0.5 + 0.5;
    const h = THREE.MathUtils.lerp(minH, maxH, Math.min(1, rng.next() * 0.7 + back * 0.4));
    const r = rng.range(0.055, 0.085) * (0.8 + h * 0.4);
    const on = rng.chance(litFrac) || i === 0;
    const fy = candle(kit, rng, cx, y + 0.02, cz, h, r, on);
    kit.flames.add({ x: cx, y: fy, z: cz, size: rng.range(0.32, 0.42), phase: rng.next(), lit: on });
    if (on) {
      sx += cx;
      sy += fy;
      sz += cz;
      lit++;
    }
  }
  if (lit === 0) return;
  const k = spec.light ?? 1;
  kit.light({
    kind: 'candle',
    fire: true,
    position: { x: sx / lit, y: sy / lit + 0.25, z: sz / lit + 0.1 },
    color: B1_LIGHT.candle,
    intensity: (0.42 + Math.min(0.24, lit * 0.04)) * k,
    radius: (2.0 + Math.min(1.0, lit * 0.15)) * k,
    flicker: 0.3,
    seed: Math.floor(rng.next() * 1000),
  });
}

/** A candle forest: a wax mound grown from melted candles, 20–48 candles on it, a waxfall and the Offering Candle. */
export function candleMound(kit: Kit, spec: MoundSpec): void {
  const rng = kit.rng.derive(`mound:${spec.x.toFixed(2)},${spec.z.toFixed(2)}`);
  const R = spec.radius;
  const H = spec.height ?? R * 0.42;
  const profileAt = (t: number): number => H * Math.pow(Math.max(0, 1 - t * t), 0.75);
  const profile: [number, number][] = [];
  for (let i = 0; i <= 8; i++) {
    const t = 1 - i / 8;
    profile.push([t * R, profileAt(t)]);
  }
  const prim = lathe(profile, 18, rng.next());
  const pos = new Float32Array(prim.positions);
  const lumps = Array.from({ length: 7 }, () => [rng.next() * Math.PI * 2, rng.range(0.06, 0.16)] as const);
  for (let i = 0; i < pos.length; i += 3) {
    const a = Math.atan2(pos[i + 2], pos[i]);
    let s = 1;
    for (const [la, amp] of lumps) s += amp * Math.max(0, Math.cos(a - la)) ** 6;
    pos[i] *= s;
    pos[i + 2] *= s;
    pos[i + 1] *= 0.92 + 0.16 * (s - 1);
  }
  kit.batch('wax').add({ ...prim, positions: pos }, trs(spec.x, 0, spec.z), tint(rng, 0.04, 0.02, 0xb8a698), [0.05, 0, 0, 0]);
  waxPool(kit, rng, spec.x + 0.1, 0, spec.z + 0.15, R * 1.15, 0.05);
  // waxfall: runs of wax down the mound's front
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * 0.5 + rng.range(-1.1, 1.1);
    const x = spec.x + Math.cos(a) * R * 0.7;
    const z = spec.z + Math.sin(a) * R * 0.7;
    kit.batch('wax').add(PRIM.sphere(6, 4), trs(x, profileAt(0.7) * 0.5, z, 0, a, 0, 0.09, profileAt(0.7) * 0.55, 0.06), tint(rng, 0.04, 0.02, 0xe8d8c8), [0.15, 0, 0, 0]);
  }
  const count = spec.candles ?? 30;
  const litFrac = spec.lit ?? 0.4;
  const groups: { x: number; y: number; z: number; n: number }[] = [
    { x: 0, y: 0, z: 0, n: 0 },
    { x: 0, y: 0, z: 0, n: 0 },
  ];
  for (let i = 0; i < count; i++) {
    const a = rng.next() * Math.PI * 2;
    const t = Math.sqrt(rng.range(0.04, 0.85));
    const x = spec.x + Math.cos(a) * t * R;
    const z = spec.z + Math.sin(a) * t * R * 0.9;
    const base = profileAt(t) - 0.03;
    const h = rng.range(0.4, 1.4) * (1 - t * 0.55);
    const on = rng.chance(litFrac);
    const fy = candle(kit, rng, x, base, z, h, rng.range(0.06, 0.1), on);
    kit.flames.add({ x, y: fy, z, size: rng.range(0.34, 0.46), phase: rng.next(), lit: on });
    if (on) {
      const g = groups[x < spec.x ? 0 : 1];
      g.x += x;
      g.y += fy;
      g.z += z;
      g.n++;
    }
  }
  for (const g of groups) {
    if (g.n === 0) continue;
    kit.light({ kind: 'candle', fire: true, position: { x: g.x / g.n, y: g.y / g.n + 0.3, z: g.z / g.n + 0.15 }, color: B1_LIGHT.candle, intensity: 0.42, radius: 2.6, flicker: 0.3, seed: Math.floor(rng.next() * 1000) });
  }
  if (spec.offering !== false) {
    // the 3-wick Offering Candle on top: a fat candle with three flames
    const top = profileAt(0) - 0.04;
    const ox = spec.x + rng.range(-0.1, 0.1);
    const oz = spec.z + rng.range(-0.1, 0.1);
    const oh = 0.95;
    const fy = candle(kit, rng, ox, top, oz, oh, 0.2, true);
    for (const [dx, dz] of [[-0.09, 0.03], [0.09, 0.03], [0, -0.08]]) {
      kit.batch('lead').add(PRIM.box(), trs(ox + dx, fy - 0.02, oz + dz, 0, 0, 0, 0.025, 0.07, 0.025), tint(rng, 0.02));
      kit.flames.add({ x: ox + dx, y: fy, z: oz + dz, size: 0.5, phase: rng.next() });
    }
    kit.light({ kind: 'candle', fire: true, position: { x: ox, y: fy + 0.35, z: oz + 0.2 }, color: B1_LIGHT.offering, intensity: 0.6, radius: 3.8, flicker: 0.12, seed: Math.floor(rng.next() * 1000) });
  }
}
