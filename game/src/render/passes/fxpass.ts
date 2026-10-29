import * as THREE from 'three';
import { PASS_ORDER } from '../constants';
import { fullscreenMaterial } from '../fullscreen';
import type { ImpactKind, PassContext, RenderPass } from '../api';

/** post stage: chromatic split, impact frames (two-tone + radial speed lines) and colour flash from FxState. */
const fragment = /* glsl */ `
uniform sampler2D tInput;
uniform vec2 uSize;
uniform float uChroma;
uniform vec3 uFlashColor;
uniform float uFlash;
uniform int uImpact;
uniform vec2 uFocus;
uniform float uSeed;
uniform float uImpactStrength;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
const vec3 PAPER = vec3(0.92, 0.84, 0.66);
const vec3 INK = vec3(0.012, 0.006, 0.02);

float hash1(float x) {
  return fract(sin(x * 91.3458) * 47453.5453);
}

void main() {
  ivec2 px = ivec2(gl_FragCoord.xy);
  ivec2 last = ivec2(uSize) - 1;
  vec3 c = texelFetch(tInput, px, 0).rgb;
  if (uChroma > 0.0) {
    vec2 dir = vec2(px) - uSize * 0.5;
    float len = length(dir);
    ivec2 o = len > 0.5 ? ivec2(round(dir / len * uChroma * 3.0)) : ivec2(0);
    c.r = texelFetch(tInput, clamp(px + o, ivec2(0), last), 0).r;
    c.b = texelFetch(tInput, clamp(px - o, ivec2(0), last), 0).b;
  }
  if (uImpact > 0) {
    vec2 rel = vec2(px) - uFocus;
    float sector = floor((atan(rel.y, rel.x) / 6.2831853 + 0.5) * 220.0);
    float h = hash1(sector + uSeed * 13.0);
    float line = step(0.78, h) * step(28.0 + h * 90.0, length(rel));
    float bright = step(0.14, dot(c, LUMA));
    vec3 frame;
    if (uImpact == 1) {
      frame = mix(mix(PAPER, INK, bright), INK, line * (1.0 - bright));
    } else if (uImpact == 2) {
      frame = mix(mix(INK, PAPER, bright), PAPER, line * (1.0 - bright));
    } else {
      frame = mix(vec3(1.0), INK, line);
    }
    c = mix(c, frame, uImpactStrength);
  }
  gl_FragColor = vec4(mix(c, uFlashColor, uFlash), 1.0);
}
`;

const IMPACT_CODE: Record<ImpactKind, number> = { invert: 1, silhouette: 2, white: 3 };

export function createFxPass(getFlashScale: () => number): RenderPass {
  const size = new THREE.Vector2(1, 1);
  const focus = new THREE.Vector2();
  const material = fullscreenMaterial(fragment, {
    tInput: { value: null },
    uSize: { value: size },
    uChroma: { value: 0 },
    uFlashColor: { value: new THREE.Color() },
    uFlash: { value: 0 },
    uImpact: { value: 0 },
    uFocus: { value: focus },
    uSeed: { value: 0 },
    uImpactStrength: { value: 1 },
  });
  return {
    name: 'fx',
    order: PASS_ORDER.fx,
    render(ctx: PassContext) {
      const u = material.uniforms;
      const fx = ctx.fx;
      u.tInput.value = ctx.input;
      size.set(ctx.width, ctx.height);
      u.uChroma.value = fx.chroma * getFlashScale();
      (u.uFlashColor.value as THREE.Color).copy(fx.flashColor);
      u.uFlash.value = fx.flashAmount;
      u.uImpact.value = fx.impact ? IMPACT_CODE[fx.impact] : 0;
      focus.set(fx.impactX, ctx.height - fx.impactY);
      u.uSeed.value = ctx.frame;
      u.uImpactStrength.value = getFlashScale();
      ctx.fullscreen(material);
    },
    dispose() {
      material.dispose();
    },
  };
}
