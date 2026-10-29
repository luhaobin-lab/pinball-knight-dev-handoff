import * as THREE from 'three';
import { PASS_ORDER } from '../constants';
import { fullscreenMaterial } from '../fullscreen';
import type { PassContext, RenderPass } from '../api';

/**
 * Colour grade: highlight shoulder (identity below `uKnee`, so palette colours stay exact),
 * saturation, shadow lift / highlight gain tint, vignette and animated film grain.
 * Biome LUTs replace this pass later (p1-render-core).
 */
const fragment = /* glsl */ `
uniform sampler2D tInput;
uniform vec2 uSize;
uniform float uFrame;
uniform float uKnee;
uniform float uSaturation;
uniform vec3 uLift;
uniform vec3 uGain;
uniform float uVignette;
uniform float uGrain;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

vec3 shoulder(vec3 c) {
  vec3 over = max(c - uKnee, 0.0);
  float room = 1.0 - uKnee;
  return min(c, vec3(uKnee)) + room * (1.0 - exp(-over / room));
}

float hash(vec2 p) {
  p = fract(p * vec2(0.1031, 0.1030));
  p += dot(p, p.yx + 33.33);
  return fract((p.x + p.y) * p.x);
}

void main() {
  vec2 px = gl_FragCoord.xy;
  vec3 c = texelFetch(tInput, ivec2(px), 0).rgb;
  c = shoulder(c * uGain);
  float l = dot(c, LUMA);
  c = mix(vec3(l), c, uSaturation);
  c += uLift * (1.0 - l);
  vec2 v = px / uSize - 0.5;
  c *= 1.0 - uVignette * smoothstep(0.35, 0.85, length(v * vec2(uSize.x / uSize.y * 0.7, 1.0)));
  // Multiplicative grain: in linear space an additive term would swamp the dark palette colours.
  c *= 1.0 + (hash(px + fract(uFrame * 0.61803) * 517.0) - 0.5) * uGrain;
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;

export function createGradePass(): RenderPass {
  const size = new THREE.Vector2(1, 1);
  const material = fullscreenMaterial(fragment, {
    tInput: { value: null },
    uSize: { value: size },
    uFrame: { value: 0 },
    uKnee: { value: 0.78 },
    uSaturation: { value: 1.08 },
    uLift: { value: new THREE.Vector3(0.0015, 0.003, 0.004) },
    uGain: { value: new THREE.Vector3(1, 1, 1) },
    uVignette: { value: 0.32 },
    uGrain: { value: 0.08 },
  });
  return {
    name: 'grade',
    order: PASS_ORDER.grade,
    render(ctx: PassContext) {
      const u = material.uniforms;
      u.tInput.value = ctx.input;
      size.set(ctx.width, ctx.height);
      u.uFrame.value = ctx.frame;
      ctx.fullscreen(material);
    },
    dispose() {
      material.dispose();
    },
  };
}
