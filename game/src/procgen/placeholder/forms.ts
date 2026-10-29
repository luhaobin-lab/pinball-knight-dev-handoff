import type * as THREE from 'three';
import { bossCrown, eliteHorns, face, pixel, type Face, type FaceOptions } from './face';
import { planeFront, sphereFront, type Sculptor, type Surface, type V3 } from './sculpt';
import type { FigureSpec, FormId } from './spec';

/**
 * The forms: one silhouette per Demo sprite sheet, built only from the kit's solids and glyphs. Every form is
 * authored in footprint radii (x and z in −1..1, the floor at y 0, the creature box 3 tall), so the figure scales it
 * by the row's 宽度 and every member of the cast shares the same proportions:
 *   - the body fills the footprint (what the launch collides with) and rises to about 2.6 of the 3-tall box;
 *   - the face sits on the front of the head: two burning eyes and the grin (face.ts);
 *   - each family carries its one wrong detail at silhouette scale (spec.ts DetailId);
 *   - the head's top carries the tier mark: elite horns, or the boss crown above the box;
 *   - one dominant value per family (blood red, bone or black), the other two as accents.
 * Heads that carry a face are round about their vertical axis (equal x and z radii) or flat-faced: the face (or the
 * flat head) turns back toward the camera about that axis without leaving its surface (figure.ts, FACE_YAW).
 */

export type IdleStyle = 'breathe' | 'hop' | 'hover' | 'sway' | 'still';

export interface FormContext {
  readonly s: Sculptor;
  /** The model: one unit = `unit` tiles. */
  readonly root: THREE.Group;
  readonly spec: FigureSpec;
  /** Tiles per model unit (face.ts turns pixel minimums into model units with it). */
  readonly unit: number;
}

export interface FormParts {
  /** What collapses in the death. */
  readonly body: THREE.Group;
  /** Twitches in the idle, slumps in the death. */
  readonly head?: THREE.Object3D;
  /** Scale y opens it (the hit accent, the death). */
  readonly mouth?: THREE.Object3D | null;
  /** The fangs: hidden when the grin closes at the death's splat. */
  readonly teeth?: THREE.Object3D | null;
  /** Burning marks: they flicker, and go out with the spores (0.5 s into the death). */
  readonly embers: THREE.Object3D[];
  /** Appendages that sway (tendrils, tails, wings). */
  readonly sway?: THREE.Object3D[];
  /** The tier mark (horns or crown): the crown floats, both fall in the death. */
  readonly crest?: THREE.Object3D;
  /** What turns back toward the camera when the body turns: the face, or a head carrying a flat face. */
  readonly turn: THREE.Object3D[];
  readonly idle: IdleStyle;
  /** Height the body floats at (model units). */
  readonly hover?: number;
}

type Builder = (c: FormContext) => FormParts;
type FaceSpec = Omit<FaceOptions, 'boss'>;

const HALF_PI = Math.PI / 2;

/** Face and tier mark together: horns for elites, the crown for bosses. */
function features(c: FormContext, parent: THREE.Object3D, f: FaceSpec, top: V3, hw: number, crestParent = parent): { face: Face; crest?: THREE.Object3D } {
  const made = face(c.s, parent, { ...f, boss: c.spec.tier === 'boss' }, c.unit);
  let crest: THREE.Object3D | undefined;
  if (c.spec.tier === 'boss') {
    const crown = bossCrown(c.s, crestParent, top, hw);
    made.embers.push(crown.gem);
    crest = crown.group;
  } else if (c.spec.elite) crest = eliteHorns(c.s, crestParent, top, hw);
  return { face: made, crest };
}

/**
 * The face of a round head centred at its parent's origin, radii [R, Ry, R]: the eye line `eye` × Ry above the
 * centre, the grin's corners `drop` head widths under it. The default eye line is where the head faces the
 * camera (it leans back 30° under a camera 58° up), so the face reads centred on the head, as in the golden frames.
 */
function roundFace(R: number, Ry: number, eye = 0.48, drop = 0.2, lift = 0.012): FaceSpec {
  const on = sphereFront([0, 0, 0], [R, Ry, R], lift);
  const ye = eye * Ry;
  const width = 2 * R * Math.sqrt(1 - eye * eye);
  const corner = ye - drop * width;
  return { at: [0, ye, R], width, mouthWidth: 2 * R * Math.sqrt(Math.max(0, 1 - (corner / Ry) ** 2)), on, drop };
}

/** An iris on a bone eye of radius R facing +z: a burning red dome, a black pupil, a bone glint. */
function eyeOf(s: Sculptor, eye: THREE.Object3D, R: number, iris: number): THREE.Mesh[] {
  const ir = s.sphere(eye, 'iris', [0, -0.02 * R, R - iris * 0.42], [iris, iris, iris * 0.62]);
  s.sphere(eye, 'void', [0, -0.02 * R, R + iris * 0.08], [iris * 0.44, iris * 0.48, iris * 0.18]);
  s.sphere(eye, 'bone', [-iris * 0.3, iris * 0.24, R + iris * 0.16], iris * 0.13);
  return [ir];
}

/** 眼球系' wrong detail: black lashes fanning up out of the lid above an eye of radius R facing +z. */
function lashes(s: Sculptor, eye: THREE.Object3D, R: number, iris: number, n = 5): void {
  for (let i = 0; i < n; i++) {
    const a = HALF_PI + (i - (n - 1) / 2) * 0.36;
    const x = Math.cos(a) * iris * 1.25;
    const y = Math.sin(a) * iris * 1.25;
    const z = Math.sqrt(Math.max(0, R * R - x * x - y * y));
    const len = R * (0.5 - Math.abs(i - (n - 1) / 2) * 0.06);
    s.cone(eye, 'black', [x, y, z * 0.96], [x + Math.cos(a) * len, y + Math.sin(a) * len, z * 0.96 + len * 0.3], R * 0.07, 6);
  }
}

/** 大肠系' wrong detail: a lit candle of red wax stuck in it. Returns its flame (an ember: it dies with the spores). */
function candle(s: Sculptor, parent: THREE.Object3D, at: V3, k: number, rot: V3 = [0, 0, 0]): THREE.Object3D {
  const g = s.group(parent, at, rot, 'candle');
  s.capsule(g, 'bone', [0, 0, 0], [0, 0.46 * k, 0], 0.13 * k);
  s.sphere(g, 'blood', [0.1 * k, 0.32 * k, 0.07 * k], [0.05 * k, 0.11 * k, 0.05 * k]);
  s.sphere(g, 'blood', [-0.09 * k, 0.24 * k, 0.08 * k], [0.045 * k, 0.13 * k, 0.045 * k]);
  const fl = s.group(g, [0, 0.62 * k, 0], undefined, 'candle-flame');
  s.sphere(fl, 'flame', [0, 0, 0], 0.1 * k);
  s.cone(fl, 'flame', [0, 0, 0], [0, 0.34 * k, 0], 0.1 * k, 10);
  s.cone(fl, 'fire', [0, -0.01 * k, 0.04 * k], [0, 0.18 * k, 0.04 * k], 0.055 * k, 8);
  return fl;
}

/** 脑系' wrong detail: a third eye on a curved stalk from `base`. Returns the stalk (it sways) and its iris. */
function stalkEye(s: Sculptor, parent: THREE.Object3D, base: V3, k: number, side: number): { stalk: THREE.Group; iris: THREE.Mesh[] } {
  const stalk = s.group(parent, base, [0, 0, side * 0.25], 'stalk-eye');
  const mid: V3 = [side * 0.1 * k, 0.32 * k, 0.02 * k];
  const tip: V3 = [side * 0.04 * k, 0.62 * k, 0.08 * k];
  s.capsule(stalk, 'flesh', [0, 0, 0], mid, 0.075 * k);
  s.capsule(stalk, 'flesh', mid, tip, 0.06 * k);
  const eye = s.group(stalk, [tip[0], tip[1] + 0.15 * k, tip[2]], [0.15, 0, 0]);
  const R = 0.24 * k;
  s.sphere(eye, 'bone', [0, 0, 0], R);
  return { stalk, iris: eyeOf(s, eye, R, R * 0.55) };
}

/**
 * A tapered, wavy tendril from `at` down to `drop` below it: capsules thinning from r0, wobbling `wave` to the sides,
 * the last two curling `curl` (radians, + toward +x) so the tip hooks.
 */
function tendril(s: Sculptor, parent: THREE.Object3D, at: V3, drop: number, r0: number, wave: number, curl: number, look: 'flesh' | 'blood' = 'flesh'): THREE.Group {
  const g = s.group(parent, at);
  const n = 6;
  const pts: V3[] = [[0, 0, 0]];
  let dir = -HALF_PI;
  const step = drop / (n - 1.2);
  for (let i = 1; i <= n; i++) {
    if (i >= n - 1) dir += curl;
    const w = (i % 2 ? 1 : -1) * wave * (i < n - 1 ? 1 : 0.3);
    const [px, py, pz] = pts[i - 1];
    pts.push([px + Math.cos(dir) * step + w, py + Math.sin(dir) * step, pz + 0.02]);
  }
  for (let i = 1; i < pts.length; i++) s.capsule(g, look, pts[i - 1], pts[i], r0 * (1 - (0.62 * (i - 1)) / (n - 1)));
  return g;
}

// ---- 眼球系 ---------------------------------------------------------------------------------------------

/** A big bone eyeball with a burning iris and black lashes, seated in a ring of flesh on a blood mound (the grin). */
const eyeball: Builder = c => {
  const { s, root } = c;
  const body = s.group(root, [0, 0, 0], undefined, 'body');
  const mound: V3 = [0.94, 0.62, 0.94];
  s.sphere(body, 'blood', [0, 0.44, 0], mound);
  s.torus(body, 'blood', [0, 1.05, 0.02], 0.62, 0.19, { rot: [HALF_PI - 0.3, 0, 0] });
  const head = s.group(body, [0, 1.74, 0.04], undefined, 'head');
  const R = 0.84;
  s.sphere(head, 'bone', [0, 0, 0], R);
  const embers = eyeOf(s, head, R, 0.42);
  lashes(s, head, R, 0.42);
  const on = sphereFront([0, 0, 0], [R, R, R]);
  for (const a of [0.2, 2.9, 3.6, 5.9]) s.line(head, 'vein', [Math.cos(a) * 0.56, Math.sin(a) * 0.56, 0], [Math.cos(a + 0.16) * 0.76, Math.sin(a + 0.16) * 0.76, 0], 0.06, on);
  if (c.spec.variant === 'fused') {
    // 融合弹射: the cord it slides home along
    s.capsule(body, 'blood', [0.2, 0.3, -0.75], [0.55, 0.16, -1.25], 0.11);
    s.sphere(body, 'blood', [0.62, 0.14, -1.34], 0.16);
  }
  // the grin sits on the mound, under the eye
  const mo = sphereFront([0, 0.44, 0], mound, 0.012);
  const { face: f, crest } = features(c, body, { at: [0, 0.98, 0], width: 1.3, mouthWidth: 1.4, on: mo, eyes: 0, drop: 0.12 }, [0, R, 0], 0.62, head);
  return { body, head, mouth: f.mouth, teeth: f.teeth, embers: [...embers, ...f.embers], crest, turn: [head, f.group], idle: 'breathe' };
};

/** 眼球虫团: a blood sac studded with eyeballs, lashes on the big one, the grin across its belly. */
const eyeballSac: Builder = c => {
  const { s, root } = c;
  const body = s.group(root, [0, 0, 0], undefined, 'body');
  s.torus(body, 'blood', [0, 0.26, 0], 0.72, 0.24, { rot: [HALF_PI, 0, 0] });
  const sac: V3 = [0.97, 0.98, 0.97];
  const head = s.group(body, [0, 1.26, 0], undefined, 'head');
  s.sphere(head, 'blood', [0, 0, 0], sac);
  const embers: THREE.Mesh[] = [];
  // five eyes, the biggest in front, all looking out of the sac
  const eyes: [number, number, number][] = [
    [0, 0.62, 0.38],
    [-0.64, 0.4, 0.26],
    [0.66, 0.34, 0.26],
    [-0.32, 0.92, 0.2],
    [0.38, 0.9, 0.19],
  ];
  const turn: THREE.Object3D[] = [];
  eyes.forEach(([x, y, r], i) => {
    const n = Math.hypot(x / sac[0], y / sac[1]);
    const z = sac[2] * Math.sqrt(Math.max(0, 1 - n * n));
    const e = s.group(head, [x, y - 0.06, z * 0.82], [-y * 0.5, x * 0.7, 0]);
    s.sphere(e, 'bone', [0, 0, 0], r);
    embers.push(...eyeOf(s, e, r, r * 0.52));
    if (i === 0) {
      lashes(s, e, r, r * 0.52);
      turn.push(e);
    }
  });
  const { face: f, crest } = features(c, head, { ...roundFace(sac[0], sac[1], 0.2, 0.04), width: 1.6, eyes: 0 }, [0, sac[1] - 0.05, 0], 0.66);
  return { body, head, mouth: f.mouth, teeth: f.teeth, embers: [...embers, ...f.embers], crest, turn: [...turn, f.group], idle: 'breathe' };
};

// ---- 大肠系 ---------------------------------------------------------------------------------------------

/** Three turns of gut stacked in a twist, narrowing upward, the loose end poking out of the bottom one. */
function turns(s: Sculptor, parent: THREE.Object3D, at: V3, k: number): void {
  const t: [number, number, number, number, number][] = [
    [0, 0.33, 0.62, 0.33, 0.16],
    [0.13, 0.9, 0.48, 0.3, -0.2],
    [-0.07, 1.4, 0.35, 0.26, 0.18],
  ];
  // the turns alternate blood and flesh, so the coil reads as one gut wound three times
  t.forEach(([x, y, R, tube, tilt], i) => s.torus(parent, i % 2 ? 'flesh' : 'blood', [at[0] + x * k, at[1] + y * k, at[2]], R * k, tube * k, { rot: [Math.PI / 2 + tilt * 0.6, 0, tilt] }));
  s.capsule(parent, 'blood', [at[0] + 0.5 * k, at[1] + 0.2 * k, at[2] + 0.42 * k], [at[0] + 0.86 * k, at[1] + 0.12 * k, at[2] + 0.72 * k], 0.16 * k);
}

/** 血蛆: a coil of blood-red gut, three turns rising to a round head with a candle stuck in it. */
const coil: Builder = c => {
  const { s, root } = c;
  const body = s.group(root, [0, 0, 0], undefined, 'body');
  turns(s, body, [0, 0, 0], 1);
  const head = s.group(body, [0, 1.98, 0.08], undefined, 'head');
  const R = 0.6;
  s.sphere(head, 'blood', [0, 0, 0], R);
  const flame = candle(s, head, [0.04, R * 0.78, -R * 0.42], 1.05, [-0.3, 0, -0.12]);
  const { face: f, crest } = features(c, head, roundFace(R, R), [0, R, 0], 0.5);
  return { body, head, mouth: f.mouth, teeth: f.teeth, embers: [flame, ...f.embers], crest, turn: [f.group], idle: 'breathe' };
};

/** 血卵: a bone egg in a nest of gut, a candle stuck in its crown; the bad egg is black, 火球精 burns instead. */
const egg: Builder = c => {
  const { s, root, spec } = c;
  const body = s.group(root, [0, 0, 0], undefined, 'body');
  s.torus(body, 'blood', [0, 0.2, 0], 0.64, 0.21, { rot: [HALF_PI, 0, 0] });
  const head = s.group(body, [0, 1.16, 0], undefined, 'head');
  const shell: V3 = [0.8, 1.06, 0.8];
  s.sphere(head, spec.variant === 'bad' ? 'black' : spec.variant === 'fire' ? 'blood' : 'bone', [0, 0, 0], shell);
  const on = sphereFront([0, 0, 0], shell);
  // a zig-zag crack across the crown
  const crack = spec.variant === 'bad' ? 'glyph' : 'vein';
  const zig: [number, number][] = [[-0.62, 0.36], [-0.36, 0.56], [-0.12, 0.4], [0.12, 0.6], [0.36, 0.42], [0.6, 0.5]];
  for (let i = 1; i < zig.length; i++) s.line(head, crack, [zig[i - 1][0], zig[i - 1][1], 0], [zig[i][0], zig[i][1], 0], 0.07, on);
  const embers: THREE.Object3D[] = [];
  if (spec.variant === 'fire') embers.push(...flames(s, head, [0, shell[1] - 0.16, 0], 0.86));
  else embers.push(candle(s, head, [-0.04, shell[1] * 0.86, -shell[0] * 0.36], 1.0, [-0.3, 0, 0.14]));
  const { face: f, crest } = features(c, head, roundFace(shell[0], shell[1], 0.36, 0.2), [0, shell[1], 0], 0.55);
  return { body, head, mouth: f.mouth, teeth: f.teeth, embers: [...embers, ...f.embers], crest, turn: [f.group], idle: 'still' };
};

/** Three tongues of shadowflame (unlit emissive cones) rising from `at`. */
function flames(s: Sculptor, parent: THREE.Object3D, at: V3, k: number): THREE.Object3D[] {
  const g = s.group(parent, at, undefined, 'flames');
  s.cone(g, 'flame', [0, 0, 0], [0, 1.0 * k, 0], 0.34 * k, 10);
  s.cone(g, 'flame', [-0.28 * k, -0.04 * k, 0], [-0.46 * k, 0.62 * k, -0.04], 0.2 * k, 10);
  s.cone(g, 'flame', [0.28 * k, -0.04 * k, 0], [0.48 * k, 0.66 * k, -0.04], 0.2 * k, 10);
  s.cone(g, 'fire', [0, 0, 0.12 * k], [0, 0.58 * k, 0.12 * k], 0.18 * k, 10);
  return [g];
}

/** 血蛆结节: a mound of gut with three small coils around one big head, a candle in it. */
const coilMass: Builder = c => {
  const { s, root } = c;
  const body = s.group(root, [0, 0, 0], undefined, 'body');
  s.sphere(body, 'blood', [0, 0.5, -0.05], [1, 0.66, 0.92]);
  const sway: THREE.Object3D[] = [];
  for (const [x, z, k, yaw] of [[-0.68, 0.38, 0.5, 0.4], [0.7, 0.34, 0.46, -0.5], [0.05, -0.62, 0.56, 0]] as const) {
    const g = s.group(body, [x, 0.28, z], [0, yaw, 0]);
    turns(s, g, [0, 0, 0], k);
    s.sphere(g, 'blood', [0, 1.98 * k, 0.05], 0.5 * k);
    sway.push(g);
  }
  const head = s.group(body, [0, 1.62, 0.18], undefined, 'head');
  const R = 0.64;
  s.sphere(head, 'blood', [0, 0, 0], R);
  const flame = candle(s, head, [-0.04, R * 0.78, -R * 0.42], 1.0, [-0.3, 0, 0.12]);
  const { face: f, crest } = features(c, head, roundFace(R, R), [0, R, 0], 0.52);
  return { body, head, mouth: f.mouth, teeth: f.teeth, embers: [flame, ...f.embers], sway, crest, turn: [f.group], idle: 'breathe' };
};

// ---- 结晶系 ---------------------------------------------------------------------------------------------

/** A black obsidian bipyramid with blood-red shards at its waist. Returns its upper front facet. */
function crystalBody(s: Sculptor, parent: THREE.Object3D, waist: number, top: number, bottom: number, r: number): Surface {
  // a four-sided cone turned 45° shows a flat facet to the front
  s.cone(parent, 'black', [0, waist, 0], [0, top, 0], r, 4, { spin: Math.PI / 4 });
  s.cone(parent, 'black', [0, waist, 0], [0, bottom, 0], r, 4, { spin: Math.PI / 4 });
  const apothem = r * Math.SQRT1_2;
  return planeFront([0, waist, apothem], [0, apothem / (top - waist), 1], 0.012);
}

/** 结晶系' wrong detail: an eye burning inside the crystal (an iris and a slit, seen through the facet). */
function innerEye(s: Sculptor, parent: THREE.Object3D, at: V3, r: number, on: Surface): THREE.Mesh {
  const iris = s.dot(parent, 'iris', at, [r, r * 1.2], on, 1);
  s.dot(parent, 'void', at, [r * 0.28, r * 0.9], on, 2);
  return iris;
}

/** 活体结晶: a floating black crystal with blood shards, an eye burning inside it over its face. */
const crystal: Builder = c => {
  const { s, root } = c;
  const body = s.group(root, [0, 0, 0], undefined, 'body');
  const head = s.group(body, [0, 0, 0], undefined, 'head');
  const waist = 0.92;
  const on = crystalBody(s, head, waist, 2.72, 0.02, 0.9);
  for (const [x, y, z, tx, ty, r] of [[-0.5, 0.9, 0.3, -1.0, 1.44, 0.14], [0.52, 0.86, 0.26, 1.04, 1.32, 0.13], [0.1, 0.82, -0.52, 0.2, 1.36, 0.12]] as const) s.cone(head, 'blood', [x, y, z], [tx, ty, z * 1.2], r, 4);
  const px = pixel(c.unit);
  const eye = innerEye(s, head, [0, 1.98, 0], Math.max(0.12, 3 * px), on);
  const apothem = 0.9 * Math.SQRT1_2;
  const half = (y: number): number => apothem * (1 - (y - waist) / (2.72 - waist));
  const W = 2 * half(1.4) * 0.92;
  const { face: f, crest } = features(c, head, { at: [0, 1.4, 0], width: W, mouthWidth: 2 * half(1.4 - 0.14 * W) * 0.94, on, drop: 0.14 }, [0, 2.36, 0.18], 0.42);
  return { body, head, mouth: f.mouth, teeth: f.teeth, embers: [eye, ...f.embers], crest, turn: [head], idle: 'hover', hover: 0.22 };
};

/** 活体结晶簇: a big crystal ringed by four leaning ones, the eye inside the big one. */
const crystalCluster: Builder = c => {
  const { s, root } = c;
  const body = s.group(root, [0, 0, 0], undefined, 'body');
  const sway: THREE.Object3D[] = [];
  for (const [x, z, lean, h, r] of [[-0.74, 0.12, 0.42, 1.5, 0.36], [0.76, 0.06, -0.46, 1.62, 0.38], [-0.4, -0.62, 0.3, 1.25, 0.3], [0.44, -0.6, -0.28, 1.35, 0.32]] as const) {
    const g = s.group(body, [x, 0, z], [0, 0, lean]);
    crystalBody(s, g, h * 0.36, h, 0, r);
    s.cone(g, 'blood', [0, h * 0.36, r * 0.4], [0, h * 0.7, r * 0.9], r * 0.22, 4);
    sway.push(g);
  }
  const head = s.group(body, [0, 0.1, 0.12], undefined, 'head');
  const waist = 0.86;
  const on = crystalBody(s, head, waist, 2.72, 0, 0.78);
  const apothem = 0.78 * Math.SQRT1_2;
  const half = (y: number): number => apothem * (1 - (y - waist) / (2.72 - waist));
  const eye = innerEye(s, head, [0, 1.92, 0], 0.13, on);
  const W = 2 * half(1.36) * 0.92;
  const { face: f, crest } = features(c, head, { at: [0, 1.36, 0], width: W, mouthWidth: 2 * half(1.36 - 0.14 * W) * 0.94, on, drop: 0.14 }, [0, 2.34, 0.16], 0.38);
  return { body, head, mouth: f.mouth, teeth: f.teeth, embers: [eye, ...f.embers], sway, crest, turn: [head], idle: 'breathe' };
};

// ---- 脑系 -------------------------------------------------------------------------------------------------

/** A brain dome: a flesh ellipsoid with a fissure and two fold ridges on top. */
function brainDome(s: Sculptor, parent: THREE.Object3D, R: V3): void {
  s.sphere(parent, 'flesh', [0, 0, 0], R);
  s.torus(parent, 'flesh', [0, 0.02, 0], R[2] * 0.98, 0.05 * R[0], { rot: [0, HALF_PI, 0], arc: Math.PI });
  for (const side of [-1, 1]) s.torus(parent, 'flesh', [side * R[0] * 0.45, R[1] * 0.42, 0], R[0] * 0.42, 0.045 * R[0], { rot: [HALF_PI * 0.9, side * 0.3, 0], arc: Math.PI * 1.1 });
}

/**
 * 浮游脑: a brain that hovers under a bell rim, five tapered, wavy tendrils curling at their tips a fifth of a tile
 * above the floor, a third eye on a stalk.
 */
const brain: Builder = c => {
  const { s, root, unit } = c;
  const body = s.group(root, [0, 0, 0], undefined, 'body');
  const hover = 0.12;
  const head = s.group(body, [0, 1.86, 0], undefined, 'head');
  const R: V3 = [0.88, 0.7, 0.88];
  brainDome(s, head, R);
  s.torus(head, 'flesh', [0, -0.44, 0], 0.72, 0.12, { rot: [HALF_PI, 0, 0] });
  const sway: THREE.Object3D[] = [];
  // the tips end 0.2 tiles above the floor while it hovers
  const tipY = 0.2 / unit - hover;
  const tendrils: [number, number, number][] = [[-0.5, 0.3, 0.5], [-0.18, 0.5, -0.4], [0.18, 0.5, 0.45], [0.5, 0.3, -0.5], [0, -0.42, 0.4]];
  tendrils.forEach(([x, z, curl], i) => {
    const from: V3 = [x, -0.52, z];
    sway.push(tendril(s, head, from, 1.86 - 0.52 - tipY - 0.06 * (i % 2), 0.1, 0.07, curl * 1.6));
  });
  const stalk = stalkEye(s, head, [0.18, R[1] * 0.9, -0.1], 1, 1);
  sway.push(stalk.stalk);
  const { face: f, crest } = features(c, head, roundFace(R[0], R[1], 0.56, 0.2), [0, R[1], 0], 0.56);
  return { body, head, mouth: f.mouth, teeth: f.teeth, embers: [...stalk.iris, ...f.embers], sway, crest, turn: [f.group], idle: 'hover', hover };
};

/** 活脑母体: a great brain on six tapered tentacles that curl over the floor, a third eye on a stalk. */
const brainMother: Builder = c => {
  const { s, root } = c;
  const body = s.group(root, [0, 0, 0], undefined, 'body');
  const sway: THREE.Object3D[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const g = s.group(body, [Math.cos(a) * 0.42, 0.98, Math.sin(a) * 0.4], [0, -a, 0]);
    // out and down to the floor, the tip curling back up
    s.capsule(g, 'flesh', [0, 0, 0], [0.42, -0.5, 0], 0.16);
    s.capsule(g, 'flesh', [0.42, -0.5, 0], [0.76, -0.8, 0.04], 0.12);
    s.capsule(g, 'flesh', [0.76, -0.8, 0.04], [0.98, -0.78, 0.06], 0.085);
    s.capsule(g, 'flesh', [0.98, -0.78, 0.06], [1.04, -0.62, 0.06], 0.06);
    sway.push(g);
  }
  const head = s.group(body, [0, 1.52, 0], undefined, 'head');
  const R: V3 = [0.99, 0.84, 0.99];
  brainDome(s, head, R);
  const stalk = stalkEye(s, head, [-0.22, R[1] * 0.9, -0.1], 1.2, -1);
  sway.push(stalk.stalk);
  const { face: f, crest } = features(c, head, roundFace(R[0], R[1], 0.56, 0.2), [0, R[1], 0], 0.6);
  return { body, head, mouth: f.mouth, teeth: f.teeth, embers: [...stalk.iris, ...f.embers], sway, crest, turn: [f.group], idle: 'breathe' };
};

// ---- 黏菌 · 幽魂 · 西瓜猪 ------------------------------------------------------------------------------

/** 盗宝黏菌: a crimson blob with a drip skirt, a stolen sword stuck in its top. */
const slime: Builder = c => {
  const { s, root } = c;
  const body = s.group(root, [0, 0, 0], undefined, 'body');
  const R: V3 = [0.96, 0.86, 0.96];
  const head = s.group(body, [0, 0.8, 0], undefined, 'head');
  s.sphere(head, 'flesh', [0, 0, 0], R);
  s.torus(body, 'flesh', [0, 0.13, 0], 0.84, 0.17, { rot: [HALF_PI, 0, 0] });
  for (const [x, z] of [[-0.86, 0.32], [0.9, 0.18], [0.3, 0.86]] as const) s.sphere(body, 'flesh', [x, 0.12, z], 0.14);
  // the sword: a bone blade sunk in its crown, hilt up, leaning back over its shoulder
  const sword = s.group(head, [-0.34, 0.66, -0.12], [-0.3, 0, 0.5], 'sword');
  s.box(sword, 'bone', [0, 0.3, 0], [0.2, 0.9, 0.07], { bevel: 0.3 });
  s.cone(sword, 'bone', [0, -0.15, 0], [0, -0.4, 0], 0.1, 4, { spin: Math.PI / 4, flat: 0.35 });
  s.box(sword, 'black', [0, 0.78, 0], [0.56, 0.11, 0.14], { bevel: 0.3 });
  s.capsule(sword, 'black', [0, 0.84, 0], [0, 1.12, 0], 0.06);
  s.sphere(sword, 'bone', [0, 1.2, 0], 0.09);
  const { face: f, crest } = features(c, head, roundFace(R[0], R[1]), [0, R[1], 0], 0.6);
  return { body, head, mouth: f.mouth, teeth: f.teeth, embers: f.embers, crest, turn: [f.group], idle: 'hop' };
};

/** 幽魂 (齐刘海): a black floating ghost with a straight-cut blood-red fringe over its burning eyes. */
const wraith: Builder = c => {
  const { s, root } = c;
  const body = s.group(root, [0, 0, 0], undefined, 'body');
  s.cone(body, 'black', [0, 0.4, 0], [0, 2.1, 0], 0.7, 16);
  const sway: THREE.Object3D[] = [];
  for (const [x, z] of [[-0.42, 0.3], [0.44, 0.24], [0, -0.48]] as const) {
    const g = s.group(body, [x, 0.46, z]);
    s.cone(g, 'black', [0, 0, 0], [x * 0.3, -0.42, z * 0.3], 0.24, 10);
    sway.push(g);
  }
  for (const side of [-1, 1]) {
    const g = s.group(body, [side * 0.52, 1.36, 0.1]);
    s.capsule(g, 'black', [0, 0, 0], [side * 0.3, -0.32, 0.18], 0.12);
    s.cone(g, 'bone', [side * 0.3, -0.32, 0.18], [side * 0.42, -0.52, 0.28], 0.06, 6);
    sway.push(g);
  }
  const head = s.group(body, [0, 2.06, 0.04], undefined, 'head');
  const R = 0.68;
  s.sphere(head, 'black', [0, 0, 0], R);
  // 齐刘海: a blood-red bob, its fringe cut in one straight line over the eyes, two locks framing the face
  s.sphere(head, 'blood', [0, 0.2, -0.08], [R * 1.08, R * 1.0, R * 1.02]);
  s.box(head, 'blood', [0, 0.54, 0.22], [1.2, 0.3, 0.72], { bevel: 0.42 });
  for (const side of [-1, 1]) s.capsule(head, 'blood', [side * 0.64, 0.24, 0.1], [side * 0.62, -0.42, 0.16], 0.14);
  const { face: f, crest } = features(c, head, { ...roundFace(R, R, 0.42, 0.2), width: 2 * R * 0.8 }, [0, R + 0.08, 0], 0.62);
  return { body, head, mouth: f.mouth, teeth: f.teeth, embers: f.embers, sway, crest, turn: [f.group], idle: 'hover', hover: 0.16 };
};

/** 西瓜猪: a melon-flesh pig: a round red body with black seeds and a bone rind, a big snout, a straw stuck in it. */
const pig: Builder = c => {
  const { s, root } = c;
  const body = s.group(root, [0, 0, 0], undefined, 'body');
  for (const [x, z] of [[-0.46, 0.42], [0.46, 0.42], [-0.48, -0.4], [0.48, -0.4]] as const) s.capsule(body, 'black', [x, 0.1, z], [x, 0.34, z], 0.14);
  const head = s.group(body, [0, 1.08, 0], undefined, 'head');
  const R: V3 = [0.96, 0.9, 0.96];
  s.sphere(head, 'blood', [0, 0, 0], R);
  s.torus(head, 'bone', [0, -0.66, 0], 0.64, 0.15, { rot: [Math.PI / 2, 0, 0] });
  const seeds = sphereFront([0, 0, 0], R);
  for (const [x, y] of [[-0.66, 0.34], [0.64, 0.4], [-0.4, 0.68], [0.42, 0.7], [0.76, -0.06], [-0.78, -0.08]] as const) s.dot(head, 'void', [x, y, 0], [0.055, 0.08], seeds);
  for (const side of [-1, 1]) s.cone(head, 'blood', [side * 0.5, 0.62, -0.06], [side * 0.86, 1.18, -0.14], 0.26, 10, { flat: 0.55 });
  // the straw: someone has been drinking it
  s.capsule(head, 'bone', [0.3, 0.74, -0.32], [0.48, 1.36, -0.46], 0.055);
  s.capsule(head, 'bone', [0.48, 1.36, -0.46], [0.78, 1.5, -0.48], 0.055);
  const tail = s.group(head, [0, -0.1, -0.92]);
  s.torus(tail, 'blood', [0, 0, 0], 0.16, 0.05, { rot: [0, Math.PI / 2, 0], arc: Math.PI * 1.5 });
  const on = sphereFront([0, 0, 0], R, 0.012);
  const { face: f, crest } = features(c, head, { at: [0, 0.5, R[2]], width: 1.36, mouthWidth: 1.7, on, drop: 0.42 }, [0, R[1], 0], 0.6);
  // the snout turns with the face: it is part of it
  s.disc(f.group, 'flesh', [0, 0.2, 0.84], 0.24, 0.26, { rot: [Math.PI / 2 - 0.2, 0, 0] });
  for (const side of [-1, 1]) s.dot(f.group, 'void', [side * 0.09, 0.22, 0.975], [0.045, 0.07]);
  return { body, head, mouth: f.mouth, teeth: f.teeth, embers: f.embers, sway: [tail], crest, turn: [f.group], idle: 'hop' };
};

// ---- bosses -------------------------------------------------------------------------------------------------

/** 守门人: a black stone golem with lava seams and a hammer resting on the floor. */
const golem: Builder = c => {
  const { s, root } = c;
  const body = s.group(root, [0, 0, 0], undefined, 'body');
  for (const side of [-1, 1]) s.box(body, 'black', [side * 0.42, 0.44, 0], [0.5, 0.88, 0.56]);
  s.box(body, 'black', [0, 1.0, 0], [1.12, 0.38, 0.72]);
  const torso = s.group(body, [0, 1.7, 0], undefined, 'torso');
  s.box(torso, 'black', [0, 0, 0], [1.56, 1.08, 0.96], { bevel: 0.14 });
  const on = planeFront([0, 0, 0.49], [0, 0, 1]);
  const seam: [number, number][] = [[-0.5, 0.36], [-0.22, 0.08], [-0.34, -0.18], [-0.02, -0.4], [0.26, -0.12], [0.18, 0.18], [0.48, 0.34]];
  for (let i = 1; i < seam.length; i++) s.line(torso, 'ember', [seam[i - 1][0], seam[i - 1][1], 0], [seam[i][0], seam[i][1], 0], 0.06, on);
  const sway: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    s.sphere(torso, 'black', [side * 0.86, 0.38, 0], 0.36);
    const arm = s.group(torso, [side * 0.92, 0.3, 0]);
    s.capsule(arm, 'black', [0, 0, 0], [side * 0.1, -0.78, 0.22], 0.2);
    s.sphere(arm, 'black', [side * 0.12, -0.86, 0.26], 0.27);
    sway.push(arm);
  }
  // the hammer: a bone haft from the right fist to a lava-seamed head on the floor
  s.capsule(body, 'bone', [1.04, 0.92, 0.32], [1.18, 0.12, 0.62], 0.07);
  const hammer = s.group(body, [1.2, 0.2, 0.66], [0.2, 0.3, 0.1]);
  s.box(hammer, 'black', [0, 0, 0], [0.62, 0.36, 0.38]);
  s.line(hammer, 'ember', [-0.2, 0, 0.2], [0.2, 0, 0.2], 0.06, planeFront([0, 0, 0.19], [0, 0, 1]));
  const head = s.group(body, [0, 2.4, 0.12], undefined, 'head');
  s.box(head, 'black', [0, 0, 0], [0.8, 0.62, 0.62]);
  const { face: f, crest } = features(c, head, { at: [0, 0.1, 0.31], width: 0.76, mouthWidth: 0.72, on: planeFront([0, 0, 0.31], [0, 0, 1], 0.012), drop: 0.18 }, [0, 0.31, 0], 0.5);
  return { body, head, mouth: f.mouth, teeth: f.teeth, embers: f.embers, sway, crest, turn: [head], idle: 'breathe' };
};

/** 结晶骑士: black armour with blood-red crystal growths, a crystal greatsword and a tower shield. */
const knight: Builder = c => {
  const { s, root } = c;
  const body = s.group(root, [0, 0, 0], undefined, 'body');
  for (const side of [-1, 1]) s.capsule(body, 'black', [side * 0.3, 0.16, 0], [side * 0.3, 0.78, 0], 0.2);
  const torso = s.group(body, [0, 1.36, 0], undefined, 'torso');
  s.capsule(torso, 'black', [0, -0.36, 0], [0, 0.36, 0], 0.56);
  s.torus(torso, 'bone', [0, -0.38, 0], 0.54, 0.07, { rot: [HALF_PI, 0, 0] });
  for (const side of [-1, 1]) {
    s.sphere(torso, 'black', [side * 0.62, 0.56, 0], 0.32);
    s.cone(torso, 'blood', [side * 0.66, 0.74, 0], [side * 0.86, 1.22, -0.06], 0.13, 4);
    s.cone(torso, 'blood', [side * 0.8, 0.62, -0.1], [side * 1.08, 0.92, -0.16], 0.09, 4);
  }
  // the crystal greatsword, point up, in the right hand
  const sword = s.group(body, [0.86, 1.08, 0.36], undefined, 'sword');
  s.sphere(sword, 'black', [0, 0, 0], 0.17);
  s.box(sword, 'bone', [0, 0.18, 0], [0.5, 0.1, 0.14]);
  s.cone(sword, 'blood', [0, 0.22, 0], [0, 1.82, 0], 0.15, 4, { spin: Math.PI / 4, flat: 0.45 });
  s.capsule(sword, 'bone', [0, -0.05, 0], [0, -0.32, 0], 0.05);
  // the tower shield on the left arm, a red diamond on its face
  const shield = s.group(body, [-0.86, 1.22, 0.36], [0, 0.22, 0], 'shield');
  s.box(shield, 'black', [0, 0, 0], [0.66, 1.12, 0.14]);
  s.box(shield, 'bone', [0, 0, -0.01], [0.74, 1.2, 0.1], { bevel: 0.4 });
  s.cone(shield, 'blood', [0, 0, 0.06], [0, 0, 0.2], 0.2, 4, { spin: 0 });
  const head = s.group(body, [0, 2.3, 0.06], undefined, 'head');
  const R = 0.46;
  s.sphere(head, 'black', [0, 0, 0], R);
  const look = roundFace(R, R, 0.34, 0.24);
  const { face: f, crest } = features(c, head, look, [0, R, 0], 0.46);
  // the visor: a slit of void painted across the helm, the eyes burning in it
  s.dot(f.group, 'void', [0, look.at[1], 0], [R * 0.7, R * 0.2], look.on, 1);
  return { body, head, mouth: f.mouth, teeth: f.teeth, embers: f.embers, sway: [shield], crest, turn: [head], idle: 'breathe' };
};

/** 弑神幼虫: a giant pale grub rearing up in an S toward its head, blood rings between its segments, acid drool. */
const larva: Builder = c => {
  const { s, root } = c;
  const body = s.group(root, [0, 0, 0], undefined, 'body');
  const segs: V3[] = [
    [-0.96, 0.24, -0.34],
    [-0.8, 0.48, -0.26],
    [-0.5, 0.82, -0.14],
    [-0.1, 1.28, -0.02],
    [0.18, 1.86, 0.1],
  ];
  const radii = [0.24, 0.38, 0.52, 0.64, 0.6];
  const sway: THREE.Object3D[] = [];
  segs.forEach((p, i) => {
    const g = s.group(body, p);
    s.sphere(g, 'bone', [0, 0, 0], radii[i]);
    const next = segs[i + 1] ?? [0.3, 2.42, 0.3];
    const axis: V3 = [next[0] - p[0], next[1] - p[1], next[2] - p[2]];
    const len = Math.hypot(...axis);
    if (i > 0) s.torus(g, 'blood', [(axis[0] / len) * radii[i] * 0.5, (axis[1] / len) * radii[i] * 0.5, (axis[2] / len) * radii[i] * 0.5], radii[i] * 0.86, radii[i] * 0.13, { axis });
    sway.push(g);
  });
  const head = s.group(body, [0.3, 2.42, 0.3], undefined, 'head');
  const R = 0.6;
  s.sphere(head, 'bone', [0, 0, 0], R);
  const { face: f, crest } = features(c, head, roundFace(R, R), [0, R, 0], 0.54);
  // acid drool from the corners of its grin (it turns with the face)
  for (const [x, y, z] of f.corners) s.capsule(f.group, 'blood', [x * 0.94, y - 0.02, z - 0.03], [x * 0.9, y - 0.3, z - 0.08], 0.045);
  return { body, head, mouth: f.mouth, teeth: f.teeth, embers: f.embers, sway, crest, turn: [f.group], idle: 'sway' };
};

/** 重生傀儡: a bone marionette hanging from its control bar, a burning heart in its chest. */
const puppet: Builder = c => {
  const { s, root } = c;
  const body = s.group(root, [0, 0, 0], undefined, 'body');
  const doll = s.group(body, [0, 0, 0], undefined, 'doll');
  const torso = s.group(doll, [0, 1.6, 0], undefined, 'torso');
  s.box(torso, 'bone', [0, 0, 0], [0.82, 0.86, 0.5]);
  const heart = s.sphere(torso, 'ember', [0, 0.06, 0.24], [0.12, 0.13, 0.06]);
  s.sphere(doll, 'black', [0, 1.06, 0], 0.24);
  const sway: THREE.Object3D[] = [];
  const hands: V3[] = [];
  for (const side of [-1, 1]) {
    const arm = s.group(torso, [side * 0.48, 0.34, 0]);
    s.sphere(arm, 'black', [0, 0, 0], 0.13);
    s.capsule(arm, 'bone', [0, 0, 0], [side * 0.24, -0.5, 0.06], 0.09);
    s.sphere(arm, 'black', [side * 0.24, -0.52, 0.06], 0.1);
    s.capsule(arm, 'bone', [side * 0.24, -0.52, 0.06], [side * 0.32, -0.98, 0.14], 0.08);
    s.sphere(arm, 'bone', [side * 0.33, -1.06, 0.15], 0.12);
    hands.push([side * 0.8, 0.56, 0.15]);
    sway.push(arm);
    const leg = s.group(doll, [side * 0.22, 1.0, 0]);
    s.capsule(leg, 'bone', [0, 0, 0], [side * 0.05, -0.44, 0.04], 0.1);
    s.sphere(leg, 'black', [side * 0.05, -0.46, 0.04], 0.11);
    s.capsule(leg, 'bone', [side * 0.05, -0.46, 0.04], [side * 0.04, -0.86, 0.1], 0.09);
    sway.push(leg);
  }
  const head = s.group(doll, [0, 2.36, 0.04], undefined, 'head');
  const R = 0.5;
  s.sphere(head, 'bone', [0, 0, 0], R);
  const on = sphereFront([0, 0, 0], [R, R, R]);
  for (const [a, b] of [[[0.1, 0.46], [0.2, 0.3]], [[0.2, 0.3], [0.34, 0.24]]] as const) s.line(head, 'void', [a[0], a[1], 0], [b[0], b[1], 0], 0.04, on);
  // the control bar above, strings to the head and both hands
  const bar = s.group(body, [0, 3.18, 0], undefined, 'bar');
  s.box(bar, 'black', [0, 0, 0], [1.3, 0.1, 0.12]);
  s.box(bar, 'black', [0, 0, 0], [0.12, 0.1, 0.7]);
  for (const end of [[-0.6, 0, 0], [0.6, 0, 0], [0, 0, 0]] as const) {
    const to: V3 = end[0] < 0 ? hands[0] : end[0] > 0 ? hands[1] : [0, 2.86, 0.04];
    s.capsule(body, 'bone', [end[0], 3.12, end[2]], [to[0], to[1] + 1.0, to[2]], 0.02);
  }
  const { face: f, crest } = features(c, head, roundFace(R, R), [0, R, 0], 0.46);
  return { body, head: doll, mouth: f.mouth, teeth: f.teeth, embers: [heart, ...f.embers], sway, crest, turn: [f.group], idle: 'sway', hover: 0.14 };
};

/**
 * A bat wing: an arm bone up to a wrist, three finger bones fanning out of it, and the membrane: one black leaf
 * hung along each finger and one back to the body, overlapping at the wrist, so the trailing edge scallops between
 * the finger tips.
 */
function batWing(s: Sculptor, parent: THREE.Object3D, at: V3, side: number, k: number): THREE.Group {
  const wing = s.group(parent, at, [0.1, 0, side * 0.12], 'wing');
  const wrist: V3 = [side * 0.5 * k, 0.62 * k, -0.04 * k];
  s.capsule(wing, 'bone', [0, 0, 0], wrist, 0.065 * k);
  s.cone(wing, 'bone', wrist, [wrist[0] + side * 0.06 * k, wrist[1] + 0.2 * k, wrist[2]], 0.05 * k, 6);
  // finger angles from the outward horizontal, and lengths
  const fingers: [number, number][] = [[0.95, 0.92], [0.32, 1.0], [-0.32, 0.86]];
  for (const [ang, len] of fingers) {
    const dir: V3 = [side * Math.cos(ang), Math.sin(ang), 0];
    const tip: V3 = [wrist[0] + dir[0] * len * k, wrist[1] + dir[1] * len * k, wrist[2]];
    s.capsule(wing, 'bone', wrist, tip, 0.04 * k);
    const cx = wrist[0] + dir[0] * len * k * 0.44;
    const cy = wrist[1] + dir[1] * len * k * 0.44;
    s.sphere(wing, 'black', [cx, cy, wrist[2] - 0.015], [len * k * 0.5, 0.26 * k, 0.03 * k], { rot: [0, 0, Math.atan2(dir[1], dir[0])] });
  }
  // the last leaf joins the lowest finger back to the flank
  s.sphere(wing, 'black', [side * 0.36 * k, 0.12 * k, -0.02], [0.42 * k, 0.3 * k, 0.03 * k], { rot: [0, 0, side * -0.5] });
  return wing;
}

/** 幽焰龙: a blood-red dragon: a long neck up to a horned head with a snout, bat wings, shadowflame, a tail. */
const dragon: Builder = c => {
  const { s, root } = c;
  const body = s.group(root, [0, 0, 0], undefined, 'body');
  s.sphere(body, 'blood', [0, 0.74, -0.16], [0.62, 0.58, 0.6]);
  s.sphere(body, 'bone', [0, 0.68, 0.2], [0.36, 0.42, 0.34]);
  for (const side of [-1, 1]) {
    s.capsule(body, 'blood', [side * 0.4, 0.2, 0.16], [side * 0.44, 0.5, 0.06], 0.14);
    s.cone(body, 'bone', [side * 0.4, 0.08, 0.24], [side * 0.42, 0.04, 0.46], 0.07, 6);
  }
  const sway: THREE.Object3D[] = [];
  for (const side of [-1, 1]) sway.push(batWing(s, body, [side * 0.36, 1.12, -0.42], side, 1.2));
  const tail = s.group(body, [0.32, 0.18, -0.62]);
  s.capsule(tail, 'blood', [0, 0, 0], [0.55, -0.06, 0.28], 0.15);
  s.capsule(tail, 'blood', [0.55, -0.06, 0.28], [0.86, -0.1, 0.7], 0.1);
  s.cone(tail, 'bone', [0.86, -0.1, 0.7], [1.0, -0.1, 1.0], 0.11, 4);
  sway.push(tail);
  // shadowflame rising from its back, between the wings
  const embers: THREE.Object3D[] = [...flames(s, body, [0, 1.22, -0.5], 0.46)];
  // the neck: three segments arching up and forward, so it shows under the head
  const neck: V3[] = [[0, 1.08, 0.02], [0, 1.52, 0.18], [0, 1.96, 0.42], [0, 2.3, 0.64]];
  for (let i = 1; i < neck.length; i++) {
    const r = 0.17 - i * 0.02;
    s.capsule(body, 'blood', neck[i - 1], neck[i], r);
    // bone plates down its throat, so the neck reads against the body
    const [x, y, z] = neck[i - 1].map((v, j) => (v + neck[i][j]) / 2);
    s.sphere(body, 'bone', [x, y, z + r * 0.75], [r * 0.8, r * 0.7, r * 0.45]);
  }
  const head = s.group(body, [0, 2.46, 0.74], undefined, 'head');
  const R = 0.36;
  s.sphere(head, 'blood', [0, 0, 0], R);
  // the snout: a rounded muzzle pushed forward and down, the grin across its front
  const snout: V3 = [0.3, 0.24, 0.3];
  const sc: V3 = [0, -0.14, 0.32];
  s.sphere(head, 'blood', sc, snout);
  for (const side of [-1, 1]) {
    s.cone(head, 'bone', [side * 0.18, 0.24, -0.08], [side * 0.4, 0.68, -0.32], 0.09, 10);
    s.cone(head, 'bone', [side * 0.28, 0.12, -0.14], [side * 0.56, 0.3, -0.34], 0.06, 8);
  }
  const { face: f, crest } = features(
    c,
    head,
    { at: [0, 0.18, R], width: 0.56, mouthWidth: 0.44, on: sphereFront([0, 0, 0], [R, R, R], 0.012), mouthOn: sphereFront(sc, snout, 0.012), drop: 0.28 },
    [0, R, 0],
    0.42,
  );
  return { body, head, mouth: f.mouth, teeth: f.teeth, embers: [...embers, ...f.embers], sway, crest, turn: [head], idle: 'breathe' };
};

// ---- neutral rows of the enemy table --------------------------------------------------------------------------

/** 宝箱: a wooden chest under a domed lid, two iron straps over both, a bone lock plate whose keyhole glows teal. */
export const chest: Builder = c => {
  const { s, root } = c;
  const body = s.group(root, [0, 0, 0], undefined, 'body');
  s.box(body, 'plank', [0, 0.4, 0], [1.76, 0.8, 1.2], { bevel: 0.1 });
  const lid = s.group(body, [0, 0.78, 0], undefined, 'head');
  s.sphere(lid, 'plank', [0, 0, 0], [0.9, 0.46, 0.62]);
  s.box(body, 'wood', [0, 0.8, 0], [1.8, 0.1, 1.24], { bevel: 0.3 });
  for (const x of [-0.56, 0.56]) {
    s.box(body, 'iron', [x, 0.4, 0], [0.16, 0.84, 1.24], { bevel: 0.2 });
    s.sphere(lid, 'iron', [x, 0, 0], [0.09, 0.49, 0.65]);
  }
  s.box(body, 'bone', [0, 0.72, 0.62], [0.34, 0.42, 0.08], { bevel: 0.3 });
  // the keyhole glows with the living fungus: there is something inside
  s.dot(body, 'teal', [0, 0.72, 0.665], [0.06, 0.09]);
  return { body, head: lid, embers: [], turn: [], idle: 'still' };
};

/** 石墙: four courses of built stone with pale chips, one cell wide (box height 3.2 radii). */
export const wall: Builder = c => {
  const { s, root } = c;
  const body = s.group(root, [0, 0, 0], undefined, 'body');
  const rows: [number, number, number][][] = [
    [[-0.5, 0.38, 0.96], [0.5, 0.38, 0.96]],
    [[-0.74, 1.14, 0.5], [0.26, 1.14, 1.44]],
    [[-0.26, 1.9, 1.44], [0.74, 1.9, 0.5]],
    [[-0.5, 2.66, 0.96], [0.5, 2.66, 0.96]],
  ];
  for (const row of rows) for (const [x, y, w] of row) s.box(body, 'masonry', [x, y, 0], [w - 0.06, 0.72, 1.9], { bevel: 0.14 });
  const on = (): number => 0.96;
  s.line(body, 'rune', [-0.6, 0.52, 0], [-0.36, 0.28, 0], 0.06, on);
  s.line(body, 'rune', [0.34, 1.92, 0], [0.56, 1.72, 0], 0.06, on);
  s.line(body, 'rune', [-0.2, 2.8, 0], [0.02, 2.62, 0], 0.06, on);
  s.sphere(body, 'fungus', [-0.7, 0.16, 0.86], [0.32, 0.14, 0.18]);
  s.sphere(body, 'fungus', [0.8, 3.0, 0.4], [0.2, 0.08, 0.3]);
  return { body, embers: [], turn: [], idle: 'still' };
};

/** The 玩家-type test rows (NewRow, NewRow_0): a straw training dummy on a post with a bone target. */
export const dummy: Builder = c => {
  const { s, root } = c;
  const body = s.group(root, [0, 0, 0], undefined, 'body');
  s.disc(body, 'wood', [0, 0.06, 0], 0.62, 0.12);
  s.capsule(body, 'wood', [0, 0.1, 0], [0, 1.4, 0], 0.11);
  const head = s.group(body, [0, 1.62, 0], undefined, 'head');
  s.sphere(head, 'straw', [0, 0, 0], [0.62, 0.72, 0.5]);
  s.capsule(head, 'wood', [-0.86, 0.28, 0], [0.86, 0.28, 0], 0.08);
  s.ring(head, 'bone', [0, -0.04, 0.48], 0.3, 0.1, 0.04, { rot: [HALF_PI, 0, 0] });
  s.dot(head, 'void', [0, -0.04, 0.52], 0.09);
  s.sphere(head, 'straw', [0, 0.92, 0], 0.32);
  for (const [a, b] of [[[-0.12, 1.0], [0.0, 0.88]], [[0.0, 1.0], [-0.12, 0.88]], [[0.06, 1.0], [0.18, 0.88]], [[0.18, 1.0], [0.06, 0.88]]] as const) s.line(head, 'void', [a[0], a[1], 0], [b[0], b[1], 0], 0.05, sphereFront([0, 0.92, 0], [0.32, 0.32, 0.32]));
  return { body, head, embers: [], turn: [], idle: 'still' };
};

export const FORMS: Readonly<Record<FormId, Builder>> = {
  eyeball,
  'eyeball-sac': eyeballSac,
  coil,
  egg,
  'coil-mass': coilMass,
  crystal,
  'crystal-cluster': crystalCluster,
  brain,
  'brain-mother': brainMother,
  slime,
  wraith,
  pig,
  golem,
  knight,
  larva,
  puppet,
  dragon,
  chest,
  wall,
  dummy,
};
