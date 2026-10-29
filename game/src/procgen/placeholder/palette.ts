import { RAMPS, type Ramp } from '../architecture/palette';
import { BLOOD } from '../creatures/mob-rigs';

/**
 * The placeholder palette: nothing but the approved ramps (ART_BIBLE rule 2), in three groups that never mix.
 * Ramps run deep → light; the toon resolve picks the band from the light, the outline pass draws each silhouette
 * in a darker shade of its own colour. "Glyph" looks are unlit and outline-free: flat marks painted on a surface.
 */

/** Enemies: blood red, bone white and black, burning red eyes (the small fry's own ramps, mob-rigs.ts). */
export const ENEMY = {
  blood: BLOOD,
  /** Soft organic flesh (slime, brains): the communion jelly's crimson. */
  flesh: ['#22030F', '#5A0A2A', '#9A1446', '#E0306E', '#FF9EC0'],
  bone: RAMPS.bone,
  black: ['#07050B', '#120C18', '#1F1626', '#2E2236', '#463650'],
  /** Wax of the candles the cult carries (the wickling's red wax). */
  wax: ['#2A0610', '#6A1022', '#A8203A', '#D85868', '#FFB0B8'],
} as const satisfies Record<string, Ramp>;

/** Neutral set pieces (the background group): navy stone, brown wood, iron, wax, bone, teal fungus. */
export const NEUTRAL = {
  stone: RAMPS.slab,
  /** Built stone (walls, plinths, pillars): one step under the old masonry, the room's own wall values. */
  masonry: ['#0A1016', '#141C24', '#2C3A46', '#4B5C68', '#7C8A92'],
  wood: RAMPS.board,
  plank: RAMPS.plank,
  iron: RAMPS.iron,
  wax: RAMPS.wax,
  bone: RAMPS.bone,
  cloth: RAMPS.velvet,
  straw: RAMPS.puffball,
  rust: RAMPS.rust,
  fungus: RAMPS.mold,
  /** The dark plate under a trap: the floor's grout. */
  soot: ['#040508', '#080B10', '#0E131A', '#161D26'],
} as const satisfies Record<string, Ramp>;

/** Flat marks (unlit, no outline): eyes, mouths, emblems, cracks, runes. */
export const MARK = {
  /** Sockets, mouths, keyholes: the deepest ink. */
  void: ['#050307', '#0A0610'],
  /** Bone glyphs: emblems and pupils' glints. */
  glyph: ['#C4AF8F', '#EADBC0'],
  /** Teeth in a grin. */
  tooth: ['#F3ECE0', '#FFFFFF'],
  /** Blood glyphs on bone (veins, cracks of an egg). */
  vein: ['#8A1022', '#C01830'],
  /** Bone glyphs on stone (runes, mortar highlights). */
  rune: ['#5E6A72', '#A6A49E'],
} as const satisfies Record<string, Ramp>;

/** Emissive looks: the only light-giving colours of the kit. */
export const GLOW = {
  /** Burning eyes, lava seams, the boss crown's gem: a hot red-orange, like the skull guard's eye fire. */
  ember: { ramp: ['#E01E1E', '#FF4A2E'], emissive: '#FF2A1A', intensity: 1.4 },
  /** An eyeball's iris: red, burning a little less than a pupil. */
  iris: { ramp: ['#B0102A', '#FF4A5A'], emissive: '#FF2030', intensity: 0.55 },
  /** Shadowflame and candle tongues. */
  flame: { ramp: ['#FF2E1E', '#FF7A30'], emissive: '#FF3A1C', intensity: 1.1 },
  /** Candle and campfire cores (warm, ART_BIBLE light source 2). */
  fire: { ramp: ['#FFB040', '#FFF2B0'], emissive: '#FFC060', intensity: 1.3 },
  /** Living fungus and portals: the world's teal. */
  teal: { ramp: ['#1D8170', '#9CF7D8'], emissive: '#2FAE92', intensity: 0.9 },
} as const;

export type EnemyLook = keyof typeof ENEMY;
export type NeutralLook = keyof typeof NEUTRAL;
export type MarkLook = keyof typeof MARK;
export type GlowLook = keyof typeof GLOW;
/** Every look a placeholder part can take. */
export type Look = EnemyLook | NeutralLook | MarkLook | GlowLook;

/** The enemy silhouette rim and floor glow (the cast's, mobs.ts). */
export const ENEMY_RIM = { color: '#FF2440', strength: 0.55 } as const;
export const ENEMY_FLOOR_GLOW = '#FF1E3C';
/**
 * The red light an enemy carries (its burning eyes): low at the front of its footprint, so it pools on the floor
 * under it without tinting its own bone; reach 1 + radius tiles.
 */
export const ENEMY_LIGHT = { color: '#FF3A2A', intensity: 0.3, at: [0, 0.3, 1.2] } as const;

/**
 * Extra ramp bands (the toon resolve's ramp shift) per solid look, so characters stand a step above the dark room:
 * lit bodies of the cast read at a median HSV value of ~50 with highlights over 75, as the golden small fry do.
 * Bone is bright on its own; black needs the most to show its lit band (#463650) at all.
 */
export const ENEMY_LIFT: Readonly<Record<EnemyLook, number>> = { blood: 0.8, flesh: 0.8, bone: 0.45, black: 1.8, wax: 0.8 };
/** Set pieces stay in the room's values (its walls take no lift): two bands of form, no more. */
export const NEUTRAL_LIFT = 0.5;
/** Walls, plinths and pillars: the room's walls exactly. */
export const MASONRY_LIFT = 0.6;

/**
 * Form shading: bands added toward the top-left of the screen and taken away toward the bottom-right
 * (`FORM_DIR` in world space under the oblique camera), so every solid shows a lit and a shaded side whatever
 * lights are near.
 */
export const FORM = { enemy: 0.75, black: 2.2, neutral: 0.7 } as const;
/** Toward the top-left of the screen and a little toward the camera (world space, oblique camera). */
export const FORM_DIR = [-0.5, 0.86, -0.05] as const;
/** The 1-px cool highlight on black solids, where the surface faces FORM_DIR. */
export const BLACK_HIGHLIGHT = '#3A3150';

/** Fire on set pieces (candles, braziers, the campfire): small amber pools (ART_BIBLE rule 3). */
export const FIRE_LIGHT = { color: '#FF9A3C', maxIntensity: 0.6, maxRadius: 2.5 } as const;
/** Living fungus and portals. */
export const TEAL_LIGHT = '#55D9B3';
