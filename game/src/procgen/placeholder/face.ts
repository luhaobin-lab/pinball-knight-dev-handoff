import type * as THREE from 'three';
import { PPT } from '../../render/density';
import type { Look } from './palette';
import type { Sculptor, Surface, V3 } from './sculpt';

/**
 * The marks every placeholder enemy shares, laid out by one formula so a crystal, a brain and a golem still read as
 * one cast: two burning eyes (a black socket with a red ember) and the golden frames' grin, a black crescent whose
 * corners rise, full of pointed fangs; the elite horns and the boss crown on top. Sizes follow the head width with
 * pixel floors, so the smallest enemy keeps whole-pixel eyes and teeth at the gameplay scale.
 */

/** Model units per internal pixel for a figure whose model unit is `unit` tiles. */
export const pixel = (unit: number): number => 1 / (PPT * unit);

export interface FaceOptions {
  /** Centre of the eye line. */
  readonly at: V3;
  /** Head width at the eye line (model units): sets every mark's size. */
  readonly width: number;
  /** Head width at the grin's corner line (default `width`): the grin spans 0.84 of it. */
  readonly mouthWidth?: number;
  readonly on?: Surface;
  /** The grin's own surface, when it is not the eyes' (a dragon's snout). */
  readonly mouthOn?: Surface;
  /** Burning eyes: 2, or 0 where the body is the eye (the eyeball forms). */
  readonly eyes?: 0 | 2;
  /** The grin's corner line below the eye line, in head widths (default 0.24). */
  readonly drop?: number;
  /** Bosses stare: their sockets stop at 5 px. */
  readonly boss?: boolean;
}

export interface Face {
  /** The face group: it turns back toward the camera when the body turns (figure.ts, FACE_YAW). */
  readonly group: THREE.Group;
  /** The burning embers (they flicker and go out at the death). */
  readonly embers: THREE.Mesh[];
  /** The mouth: scale y opens it (1 = at rest). */
  readonly mouth: THREE.Object3D;
  /** The fangs (hidden when the grin closes at the death's splat). */
  readonly teeth: THREE.Object3D;
  /** The grin's two corners, on the surface (the face group's coordinates). */
  readonly corners: readonly [V3, V3];
}

/**
 * The grin's proportions, in head widths: it spans 0.8 of the head at its corner line, its corners rise 0.15 above
 * the middle of its upper lip, and it gapes 0.2 more below that (room for the fangs).
 */
export const GRIN = { span: 0.8, rise: 0.15, open: 0.2 } as const;

/** The socket radius: 0.11 of the head width, at least 3 px, at most 0.2 of the head (small fry) or 5 px (bosses). */
export function socketRadius(width: number, px: number, boss: boolean): number {
  const r = Math.max(3 * px, 0.11 * width);
  return Math.min(r, boss ? 5 * px : 0.2 * width);
}

/** The face formula (every enemy): eyes · grin, top to bottom. `unit` = tiles per model unit. */
export function face(s: Sculptor, parent: THREE.Object3D, o: FaceOptions, unit: number): Face {
  const px = pixel(unit);
  const W = o.width;
  const g = s.group(parent, [0, 0, 0], undefined, 'face');
  const [cx, eyeY, z0] = o.at;
  const embers: THREE.Mesh[] = [];
  const socket = socketRadius(W, px, o.boss === true);
  const ember = Math.max(socket * 0.5, 1.5 * px);
  const eyeX = Math.max(0.22 * W, socket + 1.5 * px);
  for (const k of (o.eyes ?? 2) === 2 ? [-1, 1] : []) {
    const x = cx + k * eyeX;
    // an almond socket of void, the ember burning in its upper half
    s.dot(g, 'void', [x, eyeY, z0], [socket, socket * 1.15], o.on, 1);
    embers.push(s.dot(g, 'ember', [x, eyeY + socket * 0.22, z0], ember, o.on, 2));
  }
  const on = o.mouthOn ?? o.on;
  const cornerY = eyeY - (o.drop ?? 0.24) * W;
  const mw = Math.max(GRIN.span * (o.mouthWidth ?? W), 10 * px);
  const rise = Math.max(GRIN.rise * W, 2 * px);
  const open = Math.max(GRIN.open * W, 4.5 * px);
  const mouth = s.group(g, [cx, cornerY, 0], undefined, 'mouth');
  // the mouth group's origin is the corner line's middle: scale y drops both lips from the corners (opens it)
  const lay: Surface | undefined = on ? (x, y) => on(x + cx, y + cornerY) : undefined;
  s.crescent(mouth, 'void', [0, 0, z0], mw, rise, open, lay, 1);
  const teeth = s.group(mouth, [0, 0, 0], undefined, 'teeth');
  // the lips as functions of x (the crescent's own arcs), to hang the fangs on them
  const lip = (dip: number, x: number): number => {
    const a = mw / 2;
    const R = (a * a + dip * dip) / (2 * dip);
    return R - dip - Math.sqrt(Math.max(0, R * R - x * x));
  };
  const fw = 2 * px;
  const n = Math.max(3, Math.floor((mw * 0.86) / fw));
  for (let i = 0; i < n; i++) {
    const x = -mw * 0.43 + fw * (i + 0.5) + (mw * 0.86 - n * fw) / 2;
    const top = lip(rise, x);
    const gap = top - lip(rise + open, x);
    // alternating 3- and 2-px fangs hang from the upper lip; the lower lip's fangs rise between them
    const h = Math.min((i % 2 ? 2 : 3) * px, gap - 1.2 * px);
    if (h >= 1.4 * px) s.fang(teeth, 'tooth', [x, top - 0.2 * px, z0], fw, h, -1, lay, 2);
    if (i % 2 === 1 && i < n - 1) {
      const xb = x + fw / 2;
      const bottom = lip(rise + open, xb);
      const hb = Math.min((i % 4 === 1 ? 2 : 3) * px, lip(rise, xb) - bottom - 3.2 * px);
      if (hb >= 1.4 * px) s.fang(teeth, 'tooth', [xb, bottom + 0.2 * px, z0], fw, hb, 1, lay, 2);
    }
  }
  const corner = (x: number): V3 => [x, cornerY, on ? on(x, cornerY) : z0];
  return { group: g, embers, mouth, teeth, corners: [corner(cx - mw / 2), corner(cx + mw / 2)] };
}

/**
 * The elite mark: two bone horns rising from the top corners of the head (the head bar's 精英图标 horns, in 3D).
 * `top` is the head's top centre, `hw` its half-width.
 */
export function eliteHorns(s: Sculptor, parent: THREE.Object3D, top: V3, hw: number): THREE.Group {
  const g = s.group(parent, [0, 0, 0], undefined, 'elite-horns');
  for (const side of [-1, 1]) {
    const base: V3 = [top[0] + side * hw * 0.52, top[1] - hw * 0.16, top[2]];
    const mid: V3 = [top[0] + side * hw * 1.0, top[1] + hw * 0.36, top[2] - hw * 0.04];
    const tip: V3 = [top[0] + side * hw * 1.06, top[1] + hw * 0.96, top[2] - hw * 0.12];
    s.cone(g, 'bone', base, mid, hw * 0.26, 10);
    s.cone(g, 'bone', mid, tip, hw * 0.16, 10);
  }
  return g;
}

/**
 * The boss mark: a floating bone crown of five spikes with a burning gem on the front one. `top` is the top centre
 * of the head, `hw` its half-width. Returns the crown and its gem (an ember).
 */
export function bossCrown(s: Sculptor, parent: THREE.Object3D, top: V3, hw: number): { group: THREE.Group; gem: THREE.Mesh } {
  const g = s.group(parent, [top[0], top[1] + hw * 0.38, top[2]], undefined, 'boss-crown');
  const R = hw * 0.72;
  s.torus(g, 'bone', [0, 0, 0], R, hw * 0.12, { rot: [Math.PI / 2, 0, 0] });
  for (let i = 0; i < 5; i++) {
    const a = Math.PI / 2 + (i / 5) * Math.PI * 2;
    const x = Math.cos(a) * R;
    const z = Math.sin(a) * R;
    const h = i === 0 ? hw * 0.9 : hw * 0.62;
    s.cone(g, 'bone', [x, hw * 0.04, z], [x * 1.1, h, z * 1.1], hw * 0.16, 8);
  }
  const gem = s.sphere(g, 'ember', [0, hw * 0.16, R + hw * 0.1], hw * 0.15);
  return { group: g, gem };
}

/**
 * Sigils for set pieces (statue, shop, altar, pillar): bold marks of at least 9 px with 2-px strokes and filled
 * shapes, authored in a unit square (−1..1, y up). Enemy families carry a physical wrong detail instead.
 */
export const SIGILS = ['eye', 'coin', 'triad', 'diamond'] as const;
export type SigilId = (typeof SIGILS)[number];

/** Draws sigil `id` centred at `at` with half-size `size` (≥ 4.5 px) and 2-px strokes. */
export function sigil(s: Sculptor, parent: THREE.Object3D, id: SigilId, look: Look, at: V3, size: number, unit: number, on?: Surface): THREE.Group {
  const px = pixel(unit);
  const h = Math.max(size, 4.5 * px);
  const w = 2 * px;
  const g = s.group(parent, [0, 0, 0], undefined, `sigil:${id}`);
  const P = (x: number, y: number): V3 => [at[0] + x * h, at[1] + y * h, at[2]];
  switch (id) {
    case 'eye':
      // an almond outline and a filled pupil
      s.arc(g, look, P(0, -0.55), h * 1.15, w, Math.PI * 0.22, Math.PI * 0.78, on);
      s.arc(g, look, P(0, 0.55), h * 1.15, w, Math.PI * 1.22, Math.PI * 1.78, on);
      s.dot(g, look, P(0, 0), h * 0.34, on);
      break;
    case 'coin':
      // 方孔钱: a disc with a square hole
      s.dot(g, look, P(0, 0), h, on, 1, h * 0.32);
      break;
    case 'triad':
      for (const [x, y] of [[0, 0.5], [-0.56, -0.42], [0.56, -0.42]] as const) s.dot(g, look, P(x, y), h * 0.36, on);
      break;
    case 'diamond':
      s.line(g, look, P(0, 1), P(0.7, 0), w, on);
      s.line(g, look, P(0.7, 0), P(0, -1), w, on);
      s.line(g, look, P(0, -1), P(-0.7, 0), w, on);
      s.line(g, look, P(-0.7, 0), P(0, 1), w, on);
      s.dot(g, look, P(0, 0), h * 0.26, on);
      break;
  }
  return g;
}
