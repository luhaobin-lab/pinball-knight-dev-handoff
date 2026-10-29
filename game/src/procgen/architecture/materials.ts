import * as THREE from 'three';
import { createToonMaterial, type ToonMaterial, type ToonShaderHooks } from '../../render/api';
import { PPT_GLSL } from '../../render/density';
import { CYCLES, JEWELS, RAMPS, type Ramp } from './palette';
import { ELYTRA_GLSL, NOISE_GLSL } from './shaders';

/**
 * The room kit's materials (art bible §10: M5 mold, M7 elytra glass, M8 stone, M9 rotten wood, M10 fungus,
 * plus wax, bone, gold and iron), built on createToonMaterial with GLSL hooks. One instance set per room:
 * the uniforms (`KitUniforms`) carry the room's sigils, mold field and the Fervor-driven glow levels.
 *
 * Mesh conventions: vertex `color` is a linear tint; `aData` (vec4) and `uv` carry per-piece parameters,
 * documented on each material below.
 */

const linear = (hex: string): THREE.Color => new THREE.Color(hex);

export interface SigilSpec {
  /** Centre in world tiles (x, z). */
  readonly x: number;
  readonly z: number;
  /** Outer radius in tiles. */
  readonly radius: number;
  /** Radial gills: 24, 36 or 48 (never fewer than 24, art bible §4). */
  readonly gills: 24 | 36 | 48;
}

export const MAX_SIGILS = 4;
/** Fire sources the anti-light reads (candles of the room plus 丸子's flame). */
export const MAX_FIRES = 16;

export interface KitUniforms {
  /** Window emissive level (Fervor: 0.5 at F0 → 2.2 at F7). */
  readonly uWindowGlow: THREE.IUniform<number>;
  /** Floor sigil channels, 0 dormant … 1 awake. */
  readonly uSigilGlow: THREE.IUniform<number>;
  /** Bioluminescence multiplier (fungi, mold frontier, foxfire). */
  readonly uBioGlow: THREE.IUniform<number>;
  /** Candle-lit wax glow multiplier. */
  readonly uCandleGlow: THREE.IUniform<number>;
  readonly uSigils: THREE.IUniform<THREE.Vector4[]>;
  readonly uSigilCount: THREE.IUniform<number>;
  readonly uGlyphs: THREE.IUniform<number[]>;
  /** Room-space mold density (R), 16 texels per tile. */
  readonly uMold: THREE.IUniform<THREE.Texture | null>;
  /** xy = world origin of the mold texture (tiles), zw = 1 / size in tiles. */
  readonly uMoldRect: THREE.IUniform<THREE.Vector4>;
  /** Fire sources for anti-light (art bible §3 P1): xyz position, w = reach in tiles. */
  readonly uFire: THREE.IUniform<THREE.Vector4[]>;
  readonly uFireCount: THREE.IUniform<number>;
}

export function createKitUniforms(glyphs: readonly number[]): KitUniforms {
  return {
    uWindowGlow: { value: 0.5 },
    uSigilGlow: { value: 0.12 },
    uBioGlow: { value: 1 },
    uCandleGlow: { value: 1 },
    uSigils: { value: Array.from({ length: MAX_SIGILS }, () => new THREE.Vector4()) },
    uSigilCount: { value: 0 },
    uGlyphs: { value: glyphs.slice(0, 32) },
    uMold: { value: null },
    uMoldRect: { value: new THREE.Vector4(0, 0, 1, 1) },
    uFire: { value: Array.from({ length: MAX_FIRES }, () => new THREE.Vector4()) },
    uFireCount: { value: 0 },
  };
}

const DATA_VARYING = /* glsl */ `
attribute vec4 aData;
varying vec4 vData;
`;
const DATA_COPY = 'vData = aData;';
const DATA_IN = 'varying vec4 vData;\n';

function hooks(u: Partial<KitUniforms> | Record<string, THREE.IUniform>, fragmentPars: string, fragment: string, withData = true): ToonShaderHooks {
  return {
    uniforms: u as Record<string, THREE.IUniform>,
    vertexPars: withData ? DATA_VARYING : '',
    vertex: withData ? DATA_COPY : '',
    fragmentPars: (withData ? DATA_IN : '') + NOISE_GLSL + fragmentPars,
    fragment,
  };
}

/**
 * Anti-light (art bible §3 P1, §9.3): bioluminescence is suppressed where firelight falls. Returns the
 * fire coverage 0..1 at a world point from the room's fire sources.
 */
const FIRE_GLSL = /* glsl */ `
uniform vec4 uFire[${MAX_FIRES}];
uniform int uFireCount;
float kitFire(vec3 p) {
  float f = 0.0;
  for (int i = 0; i < ${MAX_FIRES}; i++) {
    if (i >= uFireCount) break;
    float x = length(uFire[i].xyz - p) / uFire[i].w;
    f += max(0.0, 1.0 - x * x);
  }
  return clamp(f, 0.0, 1.0);
}
`;

const vec3Glsl = (hex: string): string => {
  const c = linear(hex);
  return `vec3(${c.r.toFixed(5)}, ${c.g.toFixed(5)}, ${c.b.toFixed(5)})`;
};

const cycleGlsl = (name: string, cycle: Ramp): string =>
  `const vec3 ${name}[8] = vec3[8](${cycle.map(vec3Glsl).join(', ')});`;

/**
 * M8 tomb-slab flagstones. aData = (x0, z0, w, d): the stone's world rectangle in tiles; uv = (seed, crack).
 * 1-px bevels (north/west catch the light), seeded random-walk cracks with a lit lip, grimy seams, and the
 * room's Gill Wheel sigils engraved as mold-filled channels with a 菌文 glyph track.
 */
function slabHooks(u: KitUniforms): ToonShaderHooks {
  return hooks(
    u,
    /* glsl */ `
uniform vec4 uSigils[${MAX_SIGILS}];
uniform int uSigilCount;
uniform float uSigilGlow;
uniform int uGlyphs[32];
uniform sampler2D uMold;
uniform vec4 uMoldRect;
${FIRE_GLSL}
${cycleGlsl('MYCENA', CYCLES.mycena)}
// Engraved Gill Wheel: rings at R and 0.62R, radial gills, a hub, and a mycoglyph track outside.
float gillWheel(vec2 px, vec4 s, out float glyphLit) {
  glyphLit = 0.0;
  vec2 d = px - s.xy * ${PPT_GLSL};
  float r = length(d);
  float R = s.z * ${PPT_GLSL};
  float a = atan(d.y, d.x);
  float ch = 0.0;
  ch = max(ch, step(abs(r - R), 0.6));
  ch = max(ch, step(abs(r - R * 0.62), 0.6));
  ch = max(ch, step(abs(r - R * 0.18), 0.6));
  ch = max(ch, step(r, R * 0.07));
  float g = s.w;
  float cell = a / 6.28318 * g;
  float gd = abs(fract(cell + 0.5) - 0.5) / g * 6.28318 * r;
  ch = max(ch, step(gd, 0.55) * step(R * 0.62, r) * step(r, R));
  // glyph track: 5-px tall glyphs on the ring R + 3 .. R + 8, 7 px apart along the circumference
  float t = r - (R + 3.0);
  if (t >= 0.0 && t < 5.0) {
    float circ = a / 6.28318 * 6.28318 * (R + 5.5);
    float slot = floor(circ / 7.0);
    float gx = floor(mod(circ, 7.0));
    if (gx < 5.0) {
      int gi = int(mod(slot * 7.0 + s.w, 32.0));
      int bitIdx = int(4.0 - floor(t)) * 5 + int(gx);
      if (((uGlyphs[gi] >> bitIdx) & 1) == 1) { ch = 1.0; glyphLit = 1.0; }
    }
  }
  return ch;
}
`,
    /* glsl */ `
vec2 wpx = floor(vToonWorld.xz * ${PPT_GLSL}) + 0.5;
vec2 lp = (vToonWorld.xz - vData.xy) * ${PPT_GLSL};
vec2 sz = vData.zw * ${PPT_GLSL};
float seed = vToonUv.x;
if (normalW.y > 0.5) {
  // 1-px bevel: edges facing the north-west key catch light, the others fall into shade.
  if (lp.x < 1.0 || lp.y < 1.0) rampShift += 1.0;
  else if (lp.x > sz.x - 1.0 || lp.y > sz.y - 1.0) rampShift -= 1.0;
  // grimy seams and slow blotches
  float edge = min(min(lp.x, lp.y), min(sz.x - lp.x, sz.y - lp.y));
  float grime = kitFbm(wpx * 0.07 + seed * 41.0);
  if (edge < 3.0 && grime > 0.56) rampShift -= 1.0;
  rampShift += (kitFbm(wpx * 0.018 + 3.7) - 0.5) * 0.9;
  float contact = texture(uMold, (vToonWorld.xz - uMoldRect.xy) * uMoldRect.zw).g;
  rampShift -= contact * 1.6;
  // chipped corners: the mold grout shows through
  vec2 cd = min(lp, sz - lp);
  if (cd.x + cd.y < 1.6 + 1.8 * kitHash(vec2(seed * 91.0, floor(lp.x / sz.x * 1.999) + 2.0 * floor(lp.y / sz.y * 1.999)))) discard;
  int fl = int(vToonUv.y + 0.5);
  // a carved mycoglyph (10×10 px, 2 px per glyph cell), mold-filled
  if ((fl & 2) == 2) {
    vec2 g = floor((lp - (sz * 0.5 - 5.0)) / 2.0);
    if (g.x >= 0.0 && g.y >= 0.0 && g.x < 5.0 && g.y < 5.0) {
      int gi = int(seed * 31.0);
      if (((uGlyphs[gi] >> (int(g.y) * 5 + int(g.x))) & 1) == 1) {
        rampShift -= 1.2;
        albedo *= vec3(0.6, 1.1, 1.05);
        emissive += MYCENA[3] * 0.25 * (1.0 - 0.85 * kitFire(vToonWorld));
      }
    }
  }
  // seeded random-walk cracks (1 px) with a lit lip on their north side
  if ((fl & 1) == 1) {
    vec2 p = vec2(kitHash(vec2(seed, 1.3)), kitHash(vec2(seed, 2.7))) * sz;
    float ang = kitHash(vec2(seed, 4.1)) * 6.28318;
    float dmin = 1e3;
    float lipMin = 1e3;
    for (int i = 0; i < 6; i++) {
      ang += (kitHash(vec2(seed, float(i) + 9.0)) - 0.5) * 1.6;
      vec2 q = p + vec2(cos(ang), sin(ang)) * (2.5 + kitHash(vec2(seed, float(i) + 19.0)) * 4.0);
      dmin = min(dmin, kitSegDist(lp, p, q));
      lipMin = min(lipMin, kitSegDist(lp + vec2(0.0, 1.0), p, q));
      p = q;
    }
    if (dmin < 0.6) { rampShift -= 1.5; albedo *= 0.8; }
    else if (lipMin < 0.6) rampShift += 1.0;
  }
  // engraved sigils
  for (int i = 0; i < ${MAX_SIGILS}; i++) {
    if (i >= uSigilCount) break;
    float glyphLit;
    float ch = gillWheel(wpx, uSigils[i], glyphLit);
    if (ch > 0.5) {
      rampShift -= 1.0;
      albedo *= vec3(0.55, 1.15, 1.05);
      float run = fract(length(wpx - uSigils[i].xy * ${PPT_GLSL}) * 0.02 - uTime * 0.12);
      int step8 = int(clamp(3.0 + uSigilGlow * 4.0 + step(0.85, run) * 1.0, 0.0, 7.0));
      emissive += MYCENA[step8] * uSigilGlow * (0.55 + 0.45 * glyphLit) * (1.0 - 0.85 * kitFire(vToonWorld));
    }
  }
}
`,
  );
}

/**
 * M5 living mold: velvet steps, 1-px hyphae threads, a breathing cold glow, a bright frontier that pulses
 * outward, fruiting pinheads, and anti-light 0.85 (the glow recoils from fire).
 * aData.x: 0 = grout plane under the floor (the hyphal graph shows in the 1-px joints), 1 = carpet patch
 * (alpha-tested against the room mold field), 2 = mold on walls and props (plain velvet).
 */
function moldHooks(u: KitUniforms): ToonShaderHooks {
  return hooks(
    u,
    /* glsl */ `
uniform sampler2D uMold;
uniform vec4 uMoldRect;
uniform float uBioGlow;
${FIRE_GLSL}
${cycleGlsl('MYCENA', CYCLES.mycena)}
`,
    /* glsl */ `
vec2 wpx = floor(vToonWorld.xz * ${PPT_GLSL}) + 0.5;
float breathe = 0.5 + 0.5 * sin(uTime * 6.28318 * 0.2 + wpx.x * 0.013 + wpx.y * 0.007);
float anti = 1.0 - 0.85 * kitFire(vToonWorld);
if (vData.x > 1.5 && vData.x < 2.5) {
  vec3 q = floor(vToonWorld * ${PPT_GLSL});
  rampShift += (kitHash(q.xy + q.z * 7.3) - 0.5) * 1.2 + 0.4;
  emissive += MYCENA[2] * 0.25 * uBioGlow * anti * (0.7 + 0.3 * breathe);
  if (kitHash(q.xz + q.y * 7.0) > 0.975) emissive += MYCENA[6] * 0.7 * uBioGlow * anti;
} else {
  float dens = texture(uMold, (vToonWorld.xz - uMoldRect.xy) * uMoldRect.zw).r;
  if (vData.x > 2.5) {
    // wall-top carpet: coverage from noise, denser toward the back of the wall
    dens = kitFbm(wpx * 0.11 + vData.y * 13.0) * 1.25 - 0.5 + vData.z;
  }
  if (vData.x > 0.5) {
    float fringe = kitNoise(wpx * vec2(0.23, 0.07) + vData.y * 5.0);
    float onThread = step(abs(fringe - 0.5), 0.045);
    if (dens < 0.2 || (dens < 0.3 && onThread < 0.5)) discard;
    float clump = kitFbm(wpx * 0.2 + vData.y * 3.0);
    // velvet clumps: lit on their north flank (the god light), dark in the gaps; islands near the edge
    float north = kitFbm((wpx + vec2(0.0, -1.5)) * 0.2 + vData.y * 3.0);
    if (dens < 0.45 && clump < 0.62 - dens) discard;
    rampShift += -0.5 + clump * 1.9 + (clump - north) * 9.0 + 0.3 * (breathe - 0.5);
    albedo *= mix(vec3(0.75, 0.88, 1.0), vec3(0.95, 0.92, 0.72), kitNoise(wpx * 0.05 + 7.0));
    float edge = (1.0 - smoothstep(0.3, 0.37, dens)) * step(0.45, kitNoise(wpx * 0.09 + vData.y * 11.0));
    vec3 glow = MYCENA[2] * (0.05 + 0.08 * clump) * (0.6 + 0.4 * breathe);
    glow += MYCENA[4] * onThread * 0.18;
    float run = fract(dens * 4.0 - uTime * 0.3);
    glow += MYCENA[int(4.0 + 2.0 * step(0.7, run))] * edge * (1.0 - onThread * step(dens, 0.3)) * 0.85;
    if (dens > 0.65 && kitHash(wpx + 13.0) > 0.982) glow += MYCENA[6] * 0.8;
    emissive += glow * uBioGlow * anti;
  } else {
    // grout: the hyphal graph, dark velvet with slow pulses that brighten near the carpets
    float run = fract(kitNoise(wpx * 0.05) * 6.0 - uTime * 0.25);
    emissive += (MYCENA[2] * (0.04 + 0.5 * dens) + MYCENA[5] * step(0.95, run) * (0.3 + 0.5 * dens)) * uBioGlow * anti;
    rampShift -= 0.5;
  }
}
`,
  );
}

/**
 * M9 rotten wood: grain stretched 1:8 along the plank, dark streaks, knots, rot patches one band darker
 * with foxfire glowing inside them. aData = (length, width, seed, rot) in tiles; uv spans each box face.
 */
function woodHooks(u: KitUniforms, edgeAxis: 'y' | 'z'): ToonShaderHooks {
  return hooks(
    u,
    /* glsl */ `
uniform float uBioGlow;
uniform sampler2D uMold;
uniform vec4 uMoldRect;
${FIRE_GLSL}
${cycleGlsl('FOXFIRE', CYCLES.foxfire)}
`,
    /* glsl */ `
vec2 lp = vToonUv * vData.xy * ${PPT_GLSL};
float seed = vData.z;
float g = kitNoise(vec2(lp.x * 0.07, lp.y * 0.6) + seed * 13.0);
if (g > 0.7) rampShift -= 0.8;
else if (g < 0.22) rampShift += 0.5;
float knot = length((fract(lp / vec2(23.0, 7.0) + seed) - 0.5) * vec2(23.0, 7.0));
if (kitHash(floor(lp / vec2(23.0, 7.0)) + seed) > 0.8 && knot < 1.6) rampShift -= 1.2;
float rot = kitFbm(lp * 0.06 + seed * 7.0);
if (rot > 1.0 - 0.45 * vData.w) { rampShift -= 1.0; albedo *= vec3(0.82, 0.96, 0.86); }
if (rot > 1.0 - 0.2 * vData.w) {
  float b = 0.5 + 0.5 * sin(uTime * 0.94 + seed * 6.0);
  emissive += FOXFIRE[int(4.0 + step(0.9, kitHash(floor(lp) + seed)) * 2.0)] * (0.28 + 0.12 * b) * uBioGlow * (1.0 - 0.7 * kitFire(vToonWorld));
}
if (abs(normalW.${edgeAxis}) > 0.5 && (lp.y < 1.0 || lp.y > vData.y * ${PPT_GLSL} - 1.0)) rampShift -= 1.0;
${edgeAxis === 'y' ? 'rampShift -= texture(uMold, (vToonWorld.xz - uMoldRect.xy) * uMoldRect.zw).g * 1.6;' : ''}
`,
  );
}

/**
 * Fibrous mushroom stems, roots and mycelium cords: vertical striations. uv = (around, along);
 * aData.y = glow (root and cord tips), aData.z = seed.
 */
function stemHooks(u: KitUniforms): ToonShaderHooks {
  return hooks(
    u,
    /* glsl */ `
uniform float uBioGlow;
${FIRE_GLSL}
${cycleGlsl('MYCENA', CYCLES.mycena)}
`,
    /* glsl */ `
float f = kitNoise(vec2(vToonUv.x * 38.0, vToonUv.y * 2.5 + vData.z * 9.0));
if (f > 0.72) rampShift -= 0.8;
if (f < 0.12) rampShift += 0.6;
if (vData.y > 0.0) emissive += MYCENA[5] * vData.y * uBioGlow * (1.0 - 0.6 * kitFire(vToonWorld));
`,
  );
}

/**
 * M10 caps: thin translucent caps with glowing gills shining through as radial stripes, a lub-dub pulse,
 * light running outward, a glossy slime band and seeded spots. uv = (angle / 2π, profile 0..1 from the
 * centre top to the rim); aData = (gills, glow, phase, spots).
 */
function capHooks(u: KitUniforms, cycle: Ramp): ToonShaderHooks {
  return hooks(
    u,
    /* glsl */ `
uniform float uBioGlow;
${FIRE_GLSL}
${cycleGlsl('GLOW', cycle)}
`,
    /* glsl */ `
float ang = vToonUv.x;
float t = clamp(vToonUv.y / 0.62, 0.0, 1.0);
float gills = vData.x;
float pulse = (0.55 + 0.45 * kitLubDub(uTime, 0.3125, vData.z)) * (1.0 - 0.5 * kitFire(vToonWorld));
if (vData.y > 0.0) {
  float stripe = gills > 0.0 ? step(0.5, fract(ang * gills)) : 1.0;
  float thin = smoothstep(0.25, 0.95, t);
  int run = int(mod(t * 6.0 - uTime * 1.5 + vData.z * 8.0, 3.0));
  vec3 glow = GLOW[4 + run] * stripe * (0.25 + 0.75 * thin) + GLOW[3] * (1.0 - stripe) * thin * 0.5;
  emissive += glow * vData.y * pulse * uBioGlow;
  if (t > 0.92) emissive += GLOW[6] * vData.y * 0.6 * uBioGlow;
}
if (vData.w > 0.0) {
  vec2 cellUv = vec2(ang * 9.0, t * 4.0);
  vec2 cid = floor(cellUv);
  float h = kitHash(cid + vData.z * 31.0);
  vec2 cp = fract(cellUv) - vec2(0.5);
  if (h < vData.w && length(cp * vec2(1.0, 1.4)) < 0.28) { rampShift += 2.0; albedo *= 1.25; }
}
if (abs(t - 0.35) < 0.05) rampShift += 1.0;
`,
  );
}

/**
 * M7 elytra stained glass, backlit. uv spans the window quad; aData = (kind, seed, petals, 0). 1-px lead
 * came wherever the pane id changes; panes step dim → mid → lit → blaze with the window glow (Fervor) and
 * are brighter toward the top, where the god light comes through.
 */
function glassHooks(u: KitUniforms): ToonShaderHooks {
  const jewels = JEWELS.flat().map(vec3Glsl).join(', ');
  return hooks(
    u,
    /* glsl */ `
uniform float uWindowGlow;
const vec3 JEWEL[32] = vec3[32](${jewels});
${ELYTRA_GLSL}
`,
    /* glsl */ `
vec2 p = vToonUv * 2.0 - 1.0;
float id;
float lead = elytraLead(p, dFdx(p), dFdy(p), vData.x, vData.z, id);
if (id < 0.0 || lead > 0.5) {
  emissive = vec3(0.0);
} else {
  float hue = mod(id * 3.0 + floor(vData.y * 8.0), 8.0);
  float var = kitHash(vec2(id, vData.y * 17.0));
  float level = clamp(uWindowGlow * 1.8 + var * 0.9 + p.y * 0.35 + (vData.x > 0.5 ? 0.35 : 0.0) - 0.1, 0.0, 3.0);
  int li = int(level);
  vec3 c = JEWEL[int(hue) * 4 + li];
  // a sparse one-band sparkle so big panes are not flat
  if (kitHash(floor(vToonUv * vec2(48.0, 64.0)) + id) > 0.93) c = JEWEL[int(hue) * 4 + min(li + 1, 3)];
  emissive = c * (0.75 + 0.5 * uWindowGlow) * (vData.x > 0.5 ? 1.35 : 1.0);
  albedo *= 0.5;
}
`,
  );
}

/** M2 wax: rose-shifted shadows; wax near a lit wick glows from within. aData.x = glow 0..1. */
function waxHooks(u: KitUniforms): ToonShaderHooks {
  return hooks(
    u,
    /* glsl */ `
uniform float uCandleGlow;
`,
    /* glsl */ `
emissive += vec3(1.0, 0.745, 0.451) * vData.x * vData.x * 0.5 * uCandleGlow;
rampShift += vData.x * 0.8;
`,
  );
}

/** M3 gold leaf trims: single-pixel twinkles at 8 Hz. */
function goldHooks(): ToonShaderHooks {
  return hooks(
    {},
    '',
    /* glsl */ `
vec3 q = floor(vToonWorld * ${PPT_GLSL});
if (kitHash(q.xz + q.y * 3.1 + floor(uTime * 8.0) * 0.37) > 0.993) emissive += vec3(1.6, 1.5, 1.2);
`,
    false,
  );
}

/** M1-lite chitin: dark glossy segments with a thin-film jewel rim that snaps between hues. */
function chitinHooks(): ToonShaderHooks {
  const jewels = JEWELS.map(j => vec3Glsl(j[1])).join(', ');
  return hooks(
    {},
    /* glsl */ `
const vec3 JEWEL_MID[8] = vec3[8](${jewels});
`,
    /* glsl */ `
float film = fract(dot(normalW, vec3(0.55, 0.35, 0.75)) * 1.7 + vData.z);
float rim = step(0.6, 1.0 - abs(normalW.y));
emissive += JEWEL_MID[int(film * 8.0)] * 0.22 * rim;
`,
  );
}

export interface KitMaterials {
  readonly uniforms: KitUniforms;
  readonly slab: ToonMaterial;
  /** Plain carved stone (gargoyles, statues): the slab ramp without the floor hooks. */
  readonly stone: ToonMaterial;
  readonly mold: ToonMaterial;
  readonly soil: ToonMaterial;
  readonly plank: ToonMaterial;
  readonly board: ToonMaterial;
  readonly bone: ToonMaterial;
  readonly stem: ToonMaterial;
  readonly chitin: ToonMaterial;
  readonly iron: ToonMaterial;
  readonly rust: ToonMaterial;
  readonly gold: ToonMaterial;
  readonly lead: ToonMaterial;
  readonly glass: ToonMaterial;
  readonly wax: ToonMaterial;
  readonly flame: ToonMaterial;
  readonly paper: ToonMaterial;
  readonly satin: ToonMaterial;
  readonly root: ToonMaterial;
  readonly ceramic: ToonMaterial;
  readonly verdigris: ToonMaterial;
  readonly vermilion: ToonMaterial;
  readonly velvet: ToonMaterial;
  readonly capMycena: ToonMaterial;
  readonly capViolet: ToonMaterial;
  readonly capFlesh: ToonMaterial;
  readonly capFoxfire: ToonMaterial;
  all(): ToonMaterial[];
}

export function createKitMaterials(uniforms: KitUniforms): KitMaterials {
  const base = { vertexColors: true } as const;
  const mats = {
    uniforms,
    slab: createToonMaterial({ ...base, ramp: RAMPS.slab, dither: 0.35, hooks: slabHooks(uniforms) }),
    stone: createToonMaterial({ ...base, ramp: RAMPS.slab, dither: 0.3 }),
    mold: createToonMaterial({ ...base, ramp: RAMPS.mold, dither: 0.5, hooks: moldHooks(uniforms) }),
    soil: createToonMaterial({ ...base, ramp: RAMPS.graveSoil, dither: 0.5 }),
    plank: createToonMaterial({ ...base, ramp: RAMPS.plank, dither: 0.35, hooks: woodHooks(uniforms, 'y') }),
    board: createToonMaterial({ ...base, ramp: RAMPS.board, dither: 0.35, hooks: woodHooks(uniforms, 'z') }),
    bone: createToonMaterial({ ...base, ramp: RAMPS.bone, dither: 0.3 }),
    stem: createToonMaterial({ ...base, ramp: RAMPS.stem, dither: 0.35, hooks: stemHooks(uniforms) }),
    chitin: createToonMaterial({ ...base, ramp: RAMPS.chitin, dither: 0.25, hooks: chitinHooks() }),
    iron: createToonMaterial({ ...base, ramp: RAMPS.iron, dither: 0.2 }),
    rust: createToonMaterial({ ...base, ramp: RAMPS.rust, dither: 0.35 }),
    gold: createToonMaterial({ ...base, ramp: RAMPS.gold, dither: 0.25, hooks: goldHooks() }),
    lead: createToonMaterial({ ...base, ramp: RAMPS.leadCame, dither: 0.2 }),
    glass: createToonMaterial({ ...base, ramp: RAMPS.leadCame, outline: false, hooks: glassHooks(uniforms) }),
    wax: createToonMaterial({ ...base, ramp: RAMPS.wax, dither: 0.5, curve: 0.7, hooks: waxHooks(uniforms) }),
    flame: createToonMaterial({
      ramp: ['#FF9A3C', '#FFFBE8'],
      vertexColors: true,
      unlit: true,
      outline: false,
      hooks: { fragment: 'emissive += albedo * 0.75;' },
    }),
    paper: createToonMaterial({ ...base, ramp: RAMPS.paper, dither: 0.3 }),
    satin: createToonMaterial({ ...base, ramp: RAMPS.satin, dither: 0.35 }),
    root: createToonMaterial({ ...base, ramp: RAMPS.rootBark, dither: 0.35, hooks: stemHooks(uniforms) }),
    ceramic: createToonMaterial({ ...base, ramp: RAMPS.puffball, dither: 0.3 }),
    verdigris: createToonMaterial({ ...base, ramp: RAMPS.verdigris, dither: 0.3 }),
    vermilion: createToonMaterial({ ...base, ramp: RAMPS.vermilion, dither: 0.3 }),
    velvet: createToonMaterial({ ...base, ramp: RAMPS.velvet, dither: 0.35 }),
    capMycena: createToonMaterial({ ...base, ramp: RAMPS.lampCap, dither: 0.3, hooks: capHooks(uniforms, CYCLES.mycena) }),
    capViolet: createToonMaterial({ ...base, ramp: RAMPS.violetCap, dither: 0.3, hooks: capHooks(uniforms, CYCLES.violet) }),
    capFlesh: createToonMaterial({ ...base, ramp: RAMPS.capFlesh, dither: 0.3, hooks: capHooks(uniforms, CYCLES.candle) }),
    capFoxfire: createToonMaterial({ ...base, ramp: RAMPS.mold, dither: 0.3, hooks: capHooks(uniforms, CYCLES.foxfire) }),
  };
  return {
    ...mats,
    all: () => Object.values(mats).filter((m): m is ToonMaterial => (m as ToonMaterial).isToonMaterial === true),
  };
}
