import * as THREE from 'three';
import { createToonMaterial, type ToonMaterial } from '../../render/api';
import { PPT_GLSL } from '../../render/density';
import { NOISE_GLSL } from '../architecture/shaders';
import { RIM_VIEW } from '../creatures/shapes';
import { BLACK_HIGHLIGHT, ENEMY, ENEMY_LIFT, ENEMY_RIM, FORM, FORM_DIR, GLOW, MARK, MASONRY_LIFT, NEUTRAL, NEUTRAL_LIFT, type EnemyLook, type Look, type NeutralLook } from './palette';

/**
 * One material rule for the whole kit. Solids are lit toon surfaces with form shading (a lit top-left, a shaded
 * bottom-right); enemies add the red rim and their lift (black also its 1-px cool highlight), set pieces the
 * room's world-locked pixel patterns on wood and stone. Marks are flat and outline-free; glows flat and emissive.
 */

const GLOWS = GLOW as Readonly<Record<string, { ramp: readonly string[]; emissive: string; intensity: number }>>;
const MARKS = MARK as Readonly<Record<string, readonly string[]>>;
const ENEMY_RAMPS = ENEMY as Readonly<Record<string, readonly string[]>>;
const NEUTRAL_RAMPS = NEUTRAL as Readonly<Record<string, readonly string[]>>;

export function rampOf(look: Look): readonly string[] {
  return GLOWS[look]?.ramp ?? MARKS[look] ?? ENEMY_RAMPS[look] ?? NEUTRAL_RAMPS[look];
}

export const isMark = (look: Look): boolean => look in MARK;
export const isGlow = (look: Look): boolean => look in GLOW;

/** World-locked pixel patterns of the room (src/procgen/architecture/materials.ts), in its own pixels (PPT). */
const PATTERN: Partial<Record<NeutralLook, 'grain' | 'stone'>> = { wood: 'grain', plank: 'grain', stone: 'stone', masonry: 'stone' };

const FORM_GLSL = `vec3(${FORM_DIR.map(v => v.toFixed(3)).join(', ')})`;

const PARS = /* glsl */ `
uniform vec3 uRimView;
uniform vec3 uRimColor;
uniform float uRimStrength;
uniform float uLift;
uniform float uForm;
uniform vec3 uHighlight;
${NOISE_GLSL}
`;

/** Lift and form: the band shift of every lit solid. */
const BODY = /* glsl */ `
rampShift += uLift + uForm * (dot(normalW, normalize(${FORM_GLSL})) - 0.35);
float rimF = 1.0 - clamp(dot(normalW, uRimView), 0.0, 1.0);
emissive += uRimColor * smoothstep(0.58, 0.82, rimF) * uRimStrength;
`;

/**
 * Black's 1-px cool highlight: the pixels whose normal is within one pixel's normal change of FORM_DIR (a dot on
 * round parts, a line along the bevels of boxes). Scaled by the tint, so the blink and the corpse put it out.
 */
const HIGHLIGHT = /* glsl */ `
float hiStep = length(fwidth(normalW));
float hiAngle = acos(clamp(dot(normalW, normalize(${FORM_GLSL})), -1.0, 1.0));
if (hiStep > 1e-4 && hiAngle < hiStep * 1.1) emissive += uHighlight * dot(albedo, vec3(0.3333));
`;

const GRAIN = /* glsl */ `
vec3 q = floor(vToonWorld * ${PPT_GLSL}) + 0.5;
vec2 f = abs(normalW.y) > 0.6 ? q.xz : (abs(normalW.x) > abs(normalW.z) ? q.zy : q.xy);
float g = kitNoise(vec2(f.x * 0.07, f.y * 0.6));
if (g > 0.72) rampShift -= 0.8;
else if (g < 0.2) rampShift += 0.5;
`;

const STONE = /* glsl */ `
vec3 q = floor(vToonWorld * ${PPT_GLSL}) + 0.5;
vec2 f = abs(normalW.y) > 0.6 ? q.xz : (abs(normalW.x) > abs(normalW.z) ? q.zy : q.xy);
rampShift += (kitFbm(f * 0.05 + 3.7) - 0.5) * 0.9;
if (kitHash(floor(f / 3.0)) > 0.94) rampShift -= 1.0;
`;

interface SolidStyle {
  readonly ramp: readonly string[];
  readonly lift: number;
  readonly form: number;
  readonly rim?: { readonly color: string; readonly strength: number };
  readonly highlight?: string;
  readonly pattern?: 'grain' | 'stone';
}

function solid(o: SolidStyle): ToonMaterial {
  const body = BODY + (o.highlight ? HIGHLIGHT : '') + (o.pattern === 'grain' ? GRAIN : o.pattern === 'stone' ? STONE : '');
  return createToonMaterial({
    ramp: [...o.ramp],
    dither: 0.15,
    hooks: {
      uniforms: {
        uRimView: RIM_VIEW,
        uRimColor: { value: new THREE.Color(o.rim?.color ?? '#000000') },
        uRimStrength: { value: o.rim?.strength ?? 0 },
        uLift: { value: o.lift },
        uForm: { value: o.form },
        uHighlight: { value: new THREE.Color(o.highlight ?? '#000000') },
      },
      fragmentPars: PARS,
      fragment: body,
    },
  });
}

export function lookMaterial(look: Look, enemy: boolean): ToonMaterial {
  const glow = GLOWS[look];
  if (glow) return createToonMaterial({ ramp: [...glow.ramp], unlit: true, emissive: glow.emissive, emissiveIntensity: glow.intensity, outline: false });
  const mark = MARKS[look];
  if (mark) return createToonMaterial({ ramp: [...mark], unlit: true, outline: false });
  if (enemy && look in ENEMY) {
    const black = look === 'black';
    return solid({ ramp: ENEMY_RAMPS[look], lift: ENEMY_LIFT[look as EnemyLook], form: black ? FORM.black : FORM.enemy, rim: ENEMY_RIM, highlight: black ? BLACK_HIGHLIGHT : undefined });
  }
  const ramp = NEUTRAL_RAMPS[look] ?? ENEMY_RAMPS[look];
  return solid({ ramp, lift: look === 'masonry' ? MASONRY_LIFT : NEUTRAL_LIFT, form: FORM.neutral, pattern: PATTERN[look as NeutralLook] });
}
