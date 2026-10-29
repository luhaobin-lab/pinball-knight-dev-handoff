/**
 * Palette data for the architecture kit, ported from the art bible companion
 * `ART_BIBLE-palettes.json` (V0 Plain rows; §8.4 shared ramps, §8.6 cycles and jewels, §8.7 biomes).
 * Ramps run deep → shade → mid → light → highlight; the deep step doubles as the coloured outline.
 *
 * The p1-materials lane owns the full material library; this file keeps only what the room kit needs so
 * the kit renders on its own. Swapping to the shared library later only touches materials.ts.
 */

export type Ramp = readonly string[];

/** §8.7 B1 棺底 Coffin Floor and the shared sacred ramps used by the necropolis kit. */
export const RAMPS = {
  // B1 Coffin Floor
  graveSoil: ['#160E12', '#2D1F21', '#4C362D', '#74563F', '#A0805C'],
  plank: ['#1C0F12', '#39211F', '#5F3A2A', '#93603E', '#C99466'],
  slab: ['#0F171C', '#233038', '#3E4C55', '#66707A', '#A6A49E'],
  board: ['#13090C', '#28171A', '#452822', '#6E4430', '#A8714A'],
  mold: ['#041210', '#0A2C29', '#155248', '#2A7E6C', '#63B49C'],
  paper: ['#423B58', '#81779C', '#BFB4D2', '#EEE7F4', '#FFFFFF'],
  satin: ['#402B47', '#7E5874', '#BD8F9F', '#EBC6C6', '#FFF0EC'],
  iron: ['#17131F', '#2E293D', '#534C69', '#827B98', '#C2BCD0'],
  rust: ['#1B0E0A', '#4A2315', '#7A3B1E', '#A65F2E', '#D08850'],
  // shared sacred ramps (§8.4)
  wax: ['#5C3A40', '#A9785E', '#DDB27F', '#F7DDB0', '#FFF6E3'],
  bone: ['#4A3B3F', '#8B755F', '#C4AF8F', '#EADBC0', '#FFF7E8'],
  gold: ['#4E2610', '#9C5A1C', '#E39B2D', '#FFD35C', '#FFF7CC'],
  leadCame: ['#120A10', '#1E1418', '#2A1E22', '#3A2B2D', '#4A3A3C'],
  verdigris: ['#0E2A2C', '#1F5450', '#3A8F7E', '#6FD1B0', '#9FF0D0'],
  vermilion: ['#451010', '#8E1E1E', '#D93A2A', '#FF6A4A', '#FFB09A'],
  velvet: ['#0E0A12', '#1E1424', '#34223C', '#4E3456', '#6E4A72'],
  bronze: ['#351A10', '#6A3A1E', '#A86A2E', '#E0A050', '#FFE2A0'],
  // borrowed from the other biomes for the gothic-fungal vocabulary (§8.7 B2, B3)
  /** Pale mushroom stems: a cooler, chalkier sibling of bone (B3 stem column lifted for B1 light levels). */
  stem: ['#2A2226', '#5E4E4C', '#9A8A7E', '#CFC2B0', '#F4EDE2'],
  capFlesh: ['#240A10', '#5A2C2A', '#8C5640', '#BC8668', '#E4BEA0'],
  chitin: ['#06040C', '#1A152A', '#383350', '#60526B', '#8C7C94'],
  rootBark: ['#221118', '#44222A', '#6F3A2B', '#A6623E', '#DDA06C'],
  puffball: ['#4A3A3A', '#7E6A5E', '#ADA088', '#D6CCB2', '#F8F0DE'],
  /** Lamp-shade cap flesh: thin and translucent, the glowing gills shine through it (M10). */
  lampCap: ['#06201F', '#0B3A36', '#1D8170', '#55D9B3', '#EAFFF6'],
  violetCap: ['#1A0B2A', '#2C1247', '#612895', '#A96BE0', '#F7EAFF'],
} as const satisfies Record<string, Ramp>;

/** §8.6 emissive cycles (8 steps, dim → white core). */
export const CYCLES = {
  candle: ['#3A0D08', '#7A1F0E', '#C43D1F', '#FF6A2A', '#FF9A3C', '#FFC15E', '#FFE6A3', '#FFFBE8'],
  mycena: ['#06201F', '#0B3A36', '#11594F', '#1D8170', '#2FAE92', '#55D9B3', '#9CF7D8', '#EAFFF6'],
  foxfire: ['#08200E', '#0F3A18', '#175A24', '#238034', '#36A94A', '#5FD36A', '#A8F59C', '#EFFFE6'],
  violet: ['#1A0B2A', '#2C1247', '#441B6B', '#612895', '#8441BF', '#A96BE0', '#D3A6F6', '#F7EAFF'],
  neuronGold: ['#2A1606', '#4A2A0A', '#734412', '#A0661D', '#CC8F2C', '#F0BD4A', '#FFE48F', '#FFFBE0'],
} as const satisfies Record<string, Ramp>;

/** §8.6 the 8 elytra jewel panes: dim · mid · lit · blaze. Order is the hue wheel (ruby 18° … rose madder 350°). */
export const JEWELS = [
  ['#441318', '#912C38', '#DA5762', '#FFBEBE'], // ruby
  ['#3C1E00', '#7D4600', '#C67100', '#FFC390'], // amber
  ['#2E2600', '#635500', '#9E8900', '#E1D288'], // citrine
  ['#003018', '#00663A', '#00A360', '#9DE4B7'], // emerald
  ['#002D2F', '#006266', '#009CA3', '#7FE4E9'], // aquamarine
  ['#11254B', '#29519F', '#4F85EC', '#B9D2FF'], // sapphire
  ['#2E1C44', '#643E92', '#9C6CDB', '#DBC5FF'], // amethyst
  ['#40142B', '#892E60', '#CF5897', '#FFB9D9'], // rose madder
] as const;

/** §8.7 B1 lighting terms and §8.8 light library colours. */
export const B1_LIGHT = {
  ambientGround: '#0A1214',
  ambientSky: '#1A1E2C',
  void: '#06040A',
  candle: '#FFB347',
  candleCore: '#FFF3D0',
  offering: '#FFC15E',
  god: '#CFC8FF',
  mycena: '#9CF7D8',
  foxfire: '#5FD36A',
  moldFrontier: '#55D9B3',
  ember: '#FF6A2A',
  exitSeam: '#FFF3D4',
} as const;
