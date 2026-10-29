import { toHex } from '../ui/core/color';
import { BONE, INK as INK_RGBA } from '../ui/style/palette';

/**
 * The effects' colours (sRGB). The Demo's are mapped onto ours (ART_BIBLE §2, §5): its cream trail, white dust and
 * #D6D9CA spark and slash become the Ink & Bone bones; its blood #8D2A21 becomes the corruption red of the enemies
 * (the BLOOD ramp of src/procgen/creatures/mobs.ts), never on the hero's side.
 */

/** Bone white (BONE.base): the trail's head and streaks, the spark, the slash. */
export const BONE_WHITE = toHex(BONE.base);
/** Secondary bone (BONE.dim): the dust's lit side, the slash's speed lines. */
export const BONE_DIM = toHex(BONE.dim);
/**
 * The trail's veil and the dust's shaded side: the Demo's veil and dust shade sit a quarter of the head's contrast
 * over its floor; on our floor that is this grey between BONE.dim and BONE.faint.
 */
export const VEIL = '#575064';
/** The slash's outline (INK.base). */
export const INK = toHex(INK_RGBA.base);

/** Corruption red, dark to light (mobs.ts BLOOD ramp): #8D2A21 maps to CORRUPTION[3]. */
export const CORRUPTION = ['#14040A', '#3A0814', '#6E0F22', '#A8182E', '#E0425A'] as const;
