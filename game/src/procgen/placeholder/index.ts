/**
 * The placeholder kit (README.md): one visual language for every enemy, boss, prop and item icon the prototype
 * needs before its final art. Deterministic: the same row always builds the same figure.
 */
export { FACE_YAW, MAX_YAW, placeholderEnemy, PlaceholderMob, type DieOptions, type FigureOptions, type MobLike } from './figure';
export { placeholderBoss } from './boss';
export { placeholderProp, PROP_FOR_ROW, PROP_KINDS, PROP_NAMES, type PlaceholderProp, type PropKind, type PropOptions } from './props';
export {
  ENEMY_ROWS,
  FAMILIES,
  figureSpec,
  FIGURE_HEIGHT_PER_UU,
  KNIGHT_HEIGHT,
  type DetailId,
  type EnemyRow,
  type Family,
  type FamilyId,
  type FigureSpec,
  type FormId,
  type SizePolicy,
  type Tier,
  type Variant,
} from './spec';
export { GRIN, SIGILS, socketRadius, type SigilId } from './face';
export { ENEMY, GLOW, MARK, NEUTRAL, type Look } from './palette';
export { GLYPHS, SOLIDS, type GlyphKind, type Solid } from './sculpt';
