import * as THREE from 'three';
import type { PointLightOptions } from '../../render/api';
import { createRng } from '../../core/rng';
import { dropShadow, stand } from '../creatures/shapes';
import { sigil } from './face';
import { FORMS } from './forms';
import { lookMaterial } from './materials';
import { FIRE_LIGHT, TEAL_LIGHT, type Look } from './palette';
import { Sculptor, type V3 } from './sculpt';
import { figureSpec } from './spec';

/**
 * Placeholder set pieces in the kit's language: the same solids and glyphs as the enemies, in the background
 * group's colours (navy stone, brown wood, iron, wax, bone) with teal fungus and candle fire as their only lights.
 * Every piece shows two toon bands of form and the darker-shade outline (it rises at least 0.16 tiles off the floor,
 * enough depth for the outline pass), and its wood and stone carry the room's world-locked pixel patterns.
 * Props are built in tiles. Upright ones stand like the cast (`stand()`: leaned back so their fronts read like
 * sprites) and drop the cast's checkered shadow; floor pieces (spikes, pads, the vortex, the campfire) lie flat.
 * Footprints follow the Demo rows where one exists (宝箱 50 uu, 神像 / 商人 60 uu, 任务祭坛 80 uu, 箱子 / 精核矿 50 uu,
 * 灌草 40 uu).
 */

export const PROP_KINDS = [
  'chest',
  'crate',
  'statue',
  'shop',
  'portal',
  'anvil',
  'campfire',
  'altar',
  'spikes',
  'vortex',
  'bounce-pad',
  'wall',
  'coffin',
  'brazier',
  'jar',
  'candles',
  'pillar',
  'shield-generator',
  'charge-tower',
  'ore',
  'soul-shard',
  'grass',
  'dummy',
] as const;
export type PropKind = (typeof PROP_KINDS)[number];

/** What the sheet and the game call each set piece. */
export const PROP_NAMES: Readonly<Record<PropKind, string>> = {
  chest: '宝箱',
  crate: '木箱',
  statue: '雕像',
  shop: '商店',
  portal: '传送门',
  anvil: '铁砧',
  campfire: '篝火',
  altar: '祭坛',
  spikes: '地刺',
  vortex: '漩涡',
  'bounce-pad': '弹板',
  wall: '石墙',
  coffin: '棺材',
  brazier: '火盆',
  jar: '罐子',
  candles: '蜡烛堆',
  pillar: '石柱',
  'shield-generator': '护盾塔',
  'charge-tower': '充能塔',
  ore: '精矿',
  'soul-shard': '灵魂碎片',
  grass: '灌草',
  dummy: '木人桩',
};

export interface PlaceholderProp {
  readonly kind: PropKind;
  /** Add this to the scene; it stays at the origin. */
  readonly group: THREE.Group;
  /** The piece itself (placed by `place`; lights follow it). */
  readonly body: THREE.Group;
  /** Footprint radius in tiles (what a launch would bounce off, if it is solid). */
  readonly radius: number;
  /** Upright pieces lean like the cast; floor pieces lie flat. */
  readonly stands: boolean;
  /** Lights it carries (they follow `body`): register them with the renderer. */
  readonly lights: PointLightOptions[];
  /** Puts the piece on the floor at (x, z) tiles, turned by `yaw`. */
  place(x: number, z: number, yaw?: number): void;
  /** Animates flames, swirls and glows (`time` in seconds). */
  update(time: number): void;
}

export interface PropOptions {
  /** Seeds the small jitters (default 1). */
  seed?: number;
}

const HALF_PI = Math.PI / 2;

interface Built {
  readonly radius: number;
  readonly shadow?: number;
  readonly flat?: boolean;
  readonly lights?: PointLightOptions[];
  readonly update?: (time: number) => void;
}

type PropBuilder = (s: Sculptor, g: THREE.Group, rand: () => number) => Built;

/** A fire light: amber, small (ART_BIBLE rule 3); `k` scales it down from the largest a set piece may carry. */
function fireLight(y: number, k = 1, z = 0.2): PointLightOptions {
  return { position: { x: 0, y, z }, color: FIRE_LIGHT.color, intensity: FIRE_LIGHT.maxIntensity * k, radius: FIRE_LIGHT.maxRadius * Math.sqrt(k), flicker: 0.35 };
}

/** One flame: a teardrop of shadow-free fire (a ball under a cone) with a hot core. Its group flickers. */
function fire(s: Sculptor, parent: THREE.Object3D, at: V3, k: number): THREE.Group {
  const g = s.group(parent, at, undefined, 'fire');
  s.sphere(g, 'flame', [0, 0.13 * k, 0], 0.15 * k);
  s.cone(g, 'flame', [0, 0.13 * k, 0], [0, 0.62 * k, 0], 0.15 * k, 10);
  s.sphere(g, 'fire', [0, 0.12 * k, 0.05 * k], 0.085 * k);
  s.cone(g, 'fire', [0, 0.12 * k, 0.05 * k], [0, 0.36 * k, 0.05 * k], 0.085 * k, 10);
  return g;
}

/** Flickers fire groups at 12 fps (the room's candle rate), each with its own phase. */
function flicker(fires: THREE.Group[]): (time: number) => void {
  return time => {
    const tick = Math.floor(time * 12);
    fires.forEach((f, i) => {
      const n = Math.sin(tick * 1.7 + i * 13) * 0.5 + Math.sin(tick * 0.63 + i * 7) * 0.5;
      f.scale.set(1 - 0.08 * n, 1 + 0.16 * n, 1 - 0.08 * n);
    });
  };
}

/** A figure form of the enemy table reused as a prop (宝箱, 石墙, the test rows). */
function fromForm(row: string): PropBuilder {
  return (s, g) => {
    const spec = figureSpec(row);
    const model = s.group(g, [0, 0, 0], undefined, 'model');
    model.scale.setScalar(spec.radius);
    FORMS[spec.form]({ s, root: model, spec, unit: spec.radius });
    return { radius: spec.radius, shadow: spec.radius * 0.95 };
  };
}

const front = (z: number) => (): number => z;

const BUILDERS: Readonly<Record<PropKind, PropBuilder>> = {
  chest: fromForm('宝箱'),
  wall: fromForm('石墙'),
  dummy: fromForm('NewRow'),

  // G2 placeholder: source 蓝图_货币 Box(8,8,16), in the existing teal fungal palette.
  // This is a small collectible, not a solid ore deposit; the core owns its overlap and rewards.
  'soul-shard': (s, g) => {
    s.cone(g, 'teal', [0, 0.25, 0], [0, 0.5, 0], 8 / 64, 4);
    s.cone(g, 'fungus', [0, 0.25, 0], [0, 0, 0], 8 / 64, 4);
    return { radius: 8 / 64, flat: true };
  },

  crate: (s, g) => {
    s.box(g, 'plank', [0, 0.5, 0], [1.24, 1.0, 1.1], { bevel: 0.08 });
    const on = front(0.56);
    for (const y of [0.26, 0.5, 0.74]) s.line(g, 'void', [-0.56, y, 0], [0.56, y, 0], 0.045, on);
    s.box(g, 'wood', [0, 0.5, 0.57], [0.16, 1.22, 0.06], { rot: [0, 0, -0.72], bevel: 0.3 });
    for (const x of [-0.6, 0.6]) for (const y of [0.08, 0.92]) s.box(g, 'iron', [x, y, 0.5], [0.16, 0.16, 0.16], { bevel: 0.3 });
    return { radius: 0.78, shadow: 0.7 };
  },

  statue: (s, g) => {
    s.box(g, 'masonry', [0, 0.26, 0], [1.4, 0.52, 1.24], { bevel: 0.1 });
    s.box(g, 'masonry', [0, 0.6, 0], [1.1, 0.18, 0.96], { bevel: 0.2 });
    // a hooded saint at prayer, its halo the living teal fungus
    s.cone(g, 'stone', [0, 0.68, 0], [0, 2.1, 0], 0.56, 16);
    s.sphere(g, 'stone', [0, 2.12, 0.02], 0.34);
    s.cone(g, 'stone', [0, 2.06, -0.04], [0, 2.7, -0.14], 0.4, 16);
    s.dot(g, 'void', [0, 2.06, 0.37], [0.2, 0.1]);
    s.sphere(g, 'bone', [0, 1.46, 0.42], [0.16, 0.2, 0.14]);
    s.torus(g, 'teal', [0, 2.22, -0.3], 0.54, 0.05);
    sigil(s, g, 'eye', 'rune', [0, 0.27, 0.63], 0.2, 1, front(0.63));
    return { radius: 0.94, shadow: 0.85, lights: [{ position: { x: 0, y: 2.2, z: 0.2 }, color: TEAL_LIGHT, intensity: 0.45, radius: 2.6, flicker: 0.05 }] };
  },

  shop: (s, g) => {
    s.box(g, 'plank', [0, 0.44, 0.1], [2.3, 0.88, 0.9], { bevel: 0.08 });
    s.box(g, 'wood', [0, 0.92, 0.1], [2.42, 0.1, 1.0], { bevel: 0.3 });
    for (const x of [-1.04, 1.04]) s.capsule(g, 'wood', [x, 0.92, -0.28], [x, 2.26, -0.28], 0.07);
    // a striped awning (bone and dark cloth), its scalloped edge
    const awning = s.group(g, [0, 2.26, 0.06], [0.42, 0, 0]);
    for (let i = 0; i < 7; i++) {
      const look: Look = i % 2 ? 'cloth' : 'bone';
      s.box(awning, look, [-1.11 + i * 0.37, 0, 0], [0.37, 0.1, 1.1], { bevel: 0.2 });
      s.sphere(awning, look, [-1.11 + i * 0.37, -0.04, 0.55], [0.18, 0.12, 0.08]);
    }
    s.sphere(g, 'wax', [-0.66, 1.14, 0.14], [0.2, 0.22, 0.2]);
    s.disc(g, 'cloth', [-0.66, 1.38, 0.14], 0.09, 0.08);
    s.sphere(g, 'straw', [0.04, 1.1, 0.18], [0.26, 0.2, 0.22]);
    s.box(g, 'iron', [0.68, 1.06, 0.14], [0.36, 0.2, 0.28]);
    s.disc(g, 'teal', [0.68, 1.18, 0.14], 0.12, 0.04);
    sigil(s, g, 'coin', 'glyph', [0, 0.46, 0.56], 0.22, 1, front(0.56));
    return { radius: 0.94, shadow: 1.1, lights: [{ position: { x: 0.66, y: 1.4, z: 0.4 }, color: TEAL_LIGHT, intensity: 0.35, radius: 2.2, flicker: 0.05 }] };
  },

  portal: (s, g) => {
    s.box(g, 'masonry', [0, 0.14, 0], [2.0, 0.28, 0.7], { bevel: 0.2 });
    const ring = s.group(g, [0, 1.3, 0]);
    s.torus(ring, 'masonry', [0, 0, 0], 0.98, 0.17);
    // a dark disc: the hole into the deep, a bright teal rim and a spiral of teal strokes turning in it
    s.disc(ring, 'soot', [0, 0, -0.03], 0.86, 0.06, { rot: [HALF_PI, 0, 0] });
    s.torus(ring, 'teal', [0, 0, 0.03], 0.84, 0.045);
    const swirl = s.group(ring, [0, 0, 0.02]);
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3;
      s.arc(swirl, 'teal', [Math.cos(a) * 0.12, Math.sin(a) * 0.12, 0.03], 0.42, 0.07, a, a + Math.PI * 0.75);
    }
    s.dot(swirl, 'teal', [0, 0, 0.032], 0.07);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      s.dot(ring, 'glyph', [Math.cos(a) * 0.98, Math.sin(a) * 0.98, 0.18], 0.06);
    }
    return { radius: 1.0, shadow: 1.0, lights: [{ position: { x: 0, y: 1.3, z: 0.5 }, color: TEAL_LIGHT, intensity: 0.45, radius: 2.4, flicker: 0.04 }], update: t => (swirl.rotation.z = -t * 0.8) };
  },

  anvil: (s, g) => {
    s.disc(g, 'wood', [0, 0.26, 0], 0.42, 0.52);
    s.ring(g, 'iron', [0, 0.38, 0], 0.44, 0.05, 0.08);
    s.box(g, 'iron', [0, 0.62, 0], [0.42, 0.22, 0.34]);
    s.box(g, 'iron', [-0.04, 0.82, 0], [0.86, 0.22, 0.4], { bevel: 0.2 });
    s.cone(g, 'iron', [0.4, 0.84, 0], [0.82, 0.86, 0], 0.13, 12);
    s.line(g, 'glyph', [-0.4, 0.94, 0], [0.32, 0.94, 0], 0.045, front(0.205));
    const hammer = s.group(g, [-0.42, 0.04, 0.38], [0, 0.3, 0.46]);
    s.capsule(hammer, 'wood', [0, 0, 0], [0, 0.78, 0], 0.05);
    s.box(hammer, 'iron', [0, 0.84, 0], [0.32, 0.16, 0.16]);
    return { radius: 0.6, shadow: 0.55 };
  },

  campfire: (s, g) => {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      s.sphere(g, 'masonry', [Math.cos(a) * 0.52, 0.1, Math.sin(a) * 0.5], [0.16, 0.13, 0.14]);
    }
    s.capsule(g, 'wood', [-0.34, 0.1, -0.16], [0.36, 0.2, 0.18], 0.08);
    s.capsule(g, 'wood', [0.34, 0.1, -0.2], [-0.3, 0.2, 0.2], 0.08);
    const fires = [fire(s, g, [0, 0.12, 0], 1.25), fire(s, g, [-0.18, 0.1, 0.1], 0.8), fire(s, g, [0.2, 0.1, -0.04], 0.75)];
    return { radius: 0.62, flat: true, lights: [fireLight(0.8)], update: flicker(fires) };
  },

  altar: (s, g) => {
    for (const x of [-0.7, 0.7]) s.box(g, 'masonry', [x, 0.36, 0], [0.42, 0.72, 0.7], { bevel: 0.12 });
    s.box(g, 'masonry', [0, 0.82, 0], [2.0, 0.24, 1.0], { bevel: 0.18 });
    s.ring(g, 'teal', [0, 0.95, 0.02], 0.34, 0.06, 0.02);
    s.sphere(g, 'bone', [0, 1.1, 0], [0.22, 0.2, 0.2]);
    for (const x of [-0.07, 0.07]) s.dot(g, 'void', [x, 1.12, 0.2], 0.05);
    const fires: THREE.Group[] = [];
    for (const [x, z, h] of [[-0.78, 0.18, 0.36], [-0.6, -0.2, 0.26], [0.74, 0.12, 0.42], [0.58, -0.22, 0.24]] as const) {
      s.capsule(g, 'wax', [x, 0.94, z], [x, 0.94 + h, z], 0.06);
      fires.push(fire(s, g, [x, 1.0 + h, z], 0.34));
    }
    sigil(s, g, 'triad', 'rune', [0, 0.45, 0.36], 0.2, 1, front(0.36));
    return { radius: 1.25, shadow: 1.05, lights: [fireLight(1.5, 0.75, 0.3)], update: flicker(fires) };
  },

  spikes: (s, g) => {
    // a dark plate in an iron frame, a 3 × 3 bed of iron cones
    s.box(g, 'soot', [0, 0.04, 0], [0.98, 0.08, 0.98], { bevel: 0.3 });
    for (const [x, z, w, d] of [[0, -0.47, 1.0, 0.07], [0, 0.47, 1.0, 0.07], [-0.47, 0, 0.07, 1.0], [0.47, 0, 0.07, 1.0]] as const) s.box(g, 'iron', [x, 0.06, z], [w, 0.1, d], { bevel: 0.3 });
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) s.cone(g, 'iron', [(i - 1) * 0.29, 0.07, (j - 1) * 0.29], [(i - 1) * 0.29, 0.62, (j - 1) * 0.29], 0.115, 8);
    return { radius: 0.5, flat: true };
  },

  vortex: (s, g) => {
    // a raised stone lip (enough for its outline) around a pit of void with a teal swirl
    s.ring(g, 'masonry', [0, 0.09, 0], 0.98, 0.16, 0.18);
    s.disc(g, 'soot', [0, 0.03, 0], 0.84, 0.06);
    const swirl = s.group(g, [0, 0.07, 0], [-HALF_PI, 0, 0]);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      s.arc(swirl, 'teal', [Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0.01], 0.44, 0.07, a, a + Math.PI * 0.75);
    }
    s.dot(swirl, 'teal', [0, 0, 0.012], 0.09);
    return { radius: 0.98, flat: true, lights: [{ position: { x: 0, y: 0.5, z: 0 }, color: TEAL_LIGHT, intensity: 0.4, radius: 2.2, flicker: 0.05 }], update: t => (swirl.rotation.z = t * 1.4) };
  },

  'bounce-pad': (s, g) => {
    s.disc(g, 'masonry', [0, 0.09, 0], 0.9, 0.18);
    s.ring(g, 'teal', [0, 0.19, 0], 0.78, 0.07, 0.02);
    const face = s.group(g, [0, 0.2, 0], [-HALF_PI, 0, 0]);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const c: V3 = [Math.cos(a) * 0.42, Math.sin(a) * 0.42, 0];
      const l: V3 = [c[0] + Math.cos(a + 2.5) * 0.2, c[1] + Math.sin(a + 2.5) * 0.2, 0];
      const r: V3 = [c[0] + Math.cos(a - 2.5) * 0.2, c[1] + Math.sin(a - 2.5) * 0.2, 0];
      s.line(face, 'glyph', l, c, 0.08);
      s.line(face, 'glyph', c, r, 0.08);
    }
    s.dot(face, 'teal', [0, 0, 0.002], 0.14);
    return { radius: 0.9, flat: true };
  },

  coffin: (s, g) => {
    s.box(g, 'plank', [0, 0.24, 0], [0.92, 0.48, 1.9], { bevel: 0.12 });
    s.box(g, 'wood', [0, 0.52, 0], [0.98, 0.1, 1.96], { bevel: 0.3 });
    s.box(g, 'bone', [0, 0.59, -0.1], [0.12, 0.04, 1.0], { bevel: 0.3 });
    s.box(g, 'bone', [0, 0.59, -0.3], [0.56, 0.04, 0.12], { bevel: 0.3 });
    for (const x of [-0.49, 0.49]) for (const z of [-0.7, 0.7]) s.box(g, 'iron', [x, 0.3, z], [0.06, 0.16, 0.24], { bevel: 0.3 });
    return { radius: 0.95, shadow: 0.9 };
  },

  brazier: (s, g) => {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + HALF_PI;
      s.capsule(g, 'iron', [Math.cos(a) * 0.36, 0.04, Math.sin(a) * 0.36], [Math.cos(a) * 0.12, 0.74, Math.sin(a) * 0.12], 0.05);
    }
    s.cone(g, 'iron', [0, 1.04, 0], [0, 0.66, 0], 0.48, 14);
    s.torus(g, 'iron', [0, 1.02, 0], 0.46, 0.05, { rot: [HALF_PI, 0, 0] });
    s.disc(g, 'soot', [0, 1.0, 0], 0.4, 0.04);
    const fires = [fire(s, g, [0, 1.0, 0], 1.05), fire(s, g, [-0.2, 0.99, 0.1], 0.7), fire(s, g, [0.21, 0.99, -0.06], 0.66)];
    return { radius: 0.5, shadow: 0.45, lights: [fireLight(1.6)], update: flicker(fires) };
  },

  jar: (s, g) => {
    s.sphere(g, 'wax', [0, 0.42, 0], [0.4, 0.42, 0.4]);
    s.disc(g, 'wax', [0, 0.86, 0], 0.2, 0.14);
    s.torus(g, 'wax', [0, 0.93, 0], 0.2, 0.05, { rot: [HALF_PI, 0, 0] });
    s.torus(g, 'fungus', [0, 0.5, 0], 0.4, 0.05, { rot: [HALF_PI, 0, 0] });
    s.disc(g, 'cloth', [0, 0.97, 0], 0.16, 0.06);
    return { radius: 0.42, shadow: 0.4 };
  },

  candles: (s, g, rand) => {
    s.disc(g, 'wax', [0, 0.03, 0], 0.5, 0.06);
    const fires: THREE.Group[] = [];
    for (const [x, z, h] of [[0, 0, 0.62], [-0.24, 0.14, 0.4], [0.24, 0.1, 0.48], [-0.08, -0.22, 0.32], [0.2, -0.2, 0.26], [-0.3, -0.08, 0.22]] as const) {
      const hh = h * (0.9 + rand() * 0.2);
      s.capsule(g, 'wax', [x, 0.06, z], [x, hh, z], 0.07);
      fires.push(fire(s, g, [x, hh + 0.06, z], 0.36));
    }
    return { radius: 0.5, shadow: 0.45, lights: [fireLight(0.9, 0.7, 0.1)], update: flicker(fires) };
  },

  pillar: (s, g) => {
    s.disc(g, 'masonry', [0, 0.1, 0], 0.5, 0.2);
    s.disc(g, 'masonry', [0, 1.2, 0], 0.36, 2.0);
    s.disc(g, 'masonry', [0, 2.28, 0], 0.48, 0.18);
    for (const y of [0.6, 1.8]) s.torus(g, 'masonry', [0, y, 0], 0.37, 0.04, { rot: [HALF_PI, 0, 0] });
    const gem = s.group(g, [0, 2.7, 0]);
    s.cone(gem, 'teal', [0, 0, 0], [0, 0.3, 0], 0.16, 4);
    s.cone(gem, 'teal', [0, 0, 0], [0, -0.22, 0], 0.16, 4);
    sigil(s, g, 'diamond', 'rune', [0, 1.2, 0.37], 0.2, 1, front(0.37));
    return { radius: 0.5, shadow: 0.5, lights: [{ position: { x: 0, y: 2.7, z: 0.2 }, color: TEAL_LIGHT, intensity: 0.4, radius: 2.2, flicker: 0.05 }], update: t => (gem.rotation.y = t * 0.9) };
  },

  'shield-generator': (s, g) => {
    s.disc(g, 'masonry', [0, 0.14, 0], 0.62, 0.28);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + HALF_PI;
      s.cone(g, 'bone', [Math.cos(a) * 0.42, 0.24, Math.sin(a) * 0.42], [Math.cos(a) * 0.3, 1.0, Math.sin(a) * 0.3], 0.1, 8);
    }
    const core = s.group(g, [0, 1.3, 0]);
    s.cone(core, 'teal', [0, 0, 0], [0, 0.42, 0], 0.22, 4);
    s.cone(core, 'teal', [0, 0, 0], [0, -0.34, 0], 0.22, 4);
    const halo = s.torus(g, 'teal', [0, 1.3, 0], 0.56, 0.035, { rot: [HALF_PI - 0.3, 0, 0] });
    return {
      radius: 0.62,
      shadow: 0.6,
      lights: [{ position: { x: 0, y: 1.3, z: 0.2 }, color: TEAL_LIGHT, intensity: 0.45, radius: 2.4, flicker: 0.05 }],
      update: t => {
        core.rotation.y = t * 1.2;
        core.position.y = 1.3 + Math.sin(t * 1.8) * 0.05;
        halo.rotation.z = t * 0.6;
      },
    };
  },

  'charge-tower': (s, g) => {
    s.box(g, 'masonry', [0, 0.16, 0], [0.9, 0.32, 0.9], { bevel: 0.2 });
    s.capsule(g, 'iron', [0, 0.3, 0], [0, 2.0, 0], 0.11);
    for (const y of [0.8, 1.15, 1.5]) s.torus(g, 'iron', [0, y, 0], 0.3, 0.05, { rot: [HALF_PI, 0, 0] });
    const orb = s.sphere(g, 'teal', [0, 2.2, 0], 0.24);
    return { radius: 0.5, shadow: 0.55, lights: [{ position: { x: 0, y: 2.2, z: 0.2 }, color: TEAL_LIGHT, intensity: 0.45, radius: 2.4, flicker: 0.1 }], update: t => orb.scale.setScalar(0.24 * (1 + 0.06 * Math.sin(t * 5))) };
  },

  ore: (s, g) => {
    s.sphere(g, 'masonry', [0, 0.3, 0], [0.62, 0.36, 0.54]);
    s.sphere(g, 'masonry', [-0.42, 0.2, 0.26], [0.3, 0.22, 0.28]);
    s.sphere(g, 'masonry', [0.44, 0.18, 0.2], [0.26, 0.18, 0.24]);
    for (const [x, z, tx, ty, r] of [[-0.12, 0.1, -0.24, 1.08, 0.16], [0.2, 0.0, 0.42, 0.94, 0.13], [0.0, 0.32, 0.06, 0.84, 0.11], [-0.32, -0.16, -0.56, 0.74, 0.1]] as const) s.cone(g, 'teal', [x, 0.42, z], [tx, ty, z * 1.2], r, 4);
    return { radius: 0.78, shadow: 0.7, lights: [{ position: { x: 0, y: 0.9, z: 0.3 }, color: TEAL_LIGHT, intensity: 0.35, radius: 2.0, flicker: 0.05 }] };
  },

  grass: (s, g, rand) => {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + rand() * 0.3;
      const r = 0.14 + rand() * 0.16;
      s.cone(g, 'fungus', [Math.cos(a) * r, 0, Math.sin(a) * r], [Math.cos(a) * r * 2.4, 0.5 + rand() * 0.36, Math.sin(a) * r * 2.4], 0.08, 6);
    }
    s.capsule(g, 'fungus', [0, 0, 0], [0.02, 0.62, 0], 0.04);
    const bud = s.sphere(g, 'teal', [0.02, 0.7, 0], 0.11);
    return { radius: 0.62, shadow: 0.5, lights: [{ position: { x: 0, y: 0.7, z: 0.2 }, color: TEAL_LIGHT, intensity: 0.3, radius: 1.8, flicker: 0.05 }], update: t => bud.scale.setScalar(0.11 * (1 + 0.1 * Math.sin(t * 2.6))) };
  },
};

/**
 * The set piece standing in for an interactable row of 数据表_道具_通用 (chests, boxes, the quest altar, ore, grass) or
 * an NPC row of 数据表_玩家 (the merchant's stall, the blood statue); undefined for the shop goods, which are items
 * (`itemIcon`).
 */
export const PROP_FOR_ROW: Readonly<Record<string, PropKind>> = {
  宝箱: 'chest',
  任务宝箱: 'chest',
  任务祭坛: 'altar',
  交互宝箱_武器: 'crate',
  交互宝箱_非武器: 'crate',
  交互宝箱_废品: 'crate',
  交互宝箱_附魔: 'crate',
  撞击宝箱: 'crate',
  精核矿: 'ore',
  灌草: 'grass',
  商人: 'shop',
  神像: 'statue',
};

/** A placeholder set piece of `kind`; put it down with `place(x, z)`. */
export function placeholderProp(kind: PropKind, options: PropOptions = {}): PlaceholderProp {
  const group = new THREE.Group();
  group.name = `prop-${kind}`;
  const body = new THREE.Group();
  group.add(body);
  const materials = new Map<Look, THREE.Material>();
  const s = new Sculptor(look => {
    let m = materials.get(look);
    if (!m) {
      m = lookMaterial(look, false);
      materials.set(look, m);
    }
    return m;
  });
  const rng = createRng(`${kind}:${options.seed ?? 1}`);
  const built = BUILDERS[kind](s, body, () => rng.next());
  const shadow = built.shadow ? dropShadow(built.shadow) : null;
  if (shadow) group.add(shadow);
  const stands = !built.flat;
  const lights = (built.lights ?? []).map(l => ({ ...l, follow: body }));
  const place = (x: number, z: number, yaw = 0): void => {
    if (stands) stand(body, x, z, yaw, 0);
    else {
      body.position.set(x, 0, z);
      body.rotation.y = yaw;
    }
    shadow?.position.set(x, 0.01, z);
  };
  place(0, 0);
  return { kind, group, body, radius: built.radius, stands, lights, place, update: built.update ?? (() => {}) };
}
