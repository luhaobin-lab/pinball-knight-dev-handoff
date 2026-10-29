import * as THREE from 'three';
import { PASS_ORDER, SURFACE_FLAGS } from '../constants';
import { fullscreenMaterial } from '../fullscreen';
import type { PassContext, RenderPass } from '../api';

/**
 * One-pixel outlines from depth discontinuities, drawn in a darker, more saturated shade of the
 * surface's own colour (never black), plus highlights on convex creases from normal changes.
 * Ported from the water-shrine / ricochet prototypes (4-neighbour test, view-space normal bias).
 */
const fragment = /* glsl */ `
uniform sampler2D tInput;
uniform sampler2D tDepth;
uniform sampler2D tNormal;
uniform sampler2D tEmissive;
uniform mat3 uView;
uniform vec2 uSize;
uniform float uDepthRange;
uniform float uDepthThreshold;
uniform float uOutline;
uniform float uShade;
uniform float uCrease;

bool noOutline(ivec2 p) {
  return (int(texelFetch(tEmissive, p, 0).a + 0.5) & SURFACE_NO_OUTLINE) != 0;
}

vec3 outlineShade(vec3 c) {
  float m = max(max(c.r, c.g), c.b);
  vec3 chroma = c / max(m, 1e-5);
  return pow(chroma, vec3(1.4)) * m * uShade;
}

void main() {
  ivec2 px = ivec2(gl_FragCoord.xy);
  ivec2 last = ivec2(uSize) - 1;
  vec3 color = texelFetch(tInput, px, 0).rgb;
  float d = texelFetch(tDepth, px, 0).r;
  if (d >= 1.0 || noOutline(px)) {
    gl_FragColor = vec4(color, 1.0);
    return;
  }
  vec3 n = uView * texelFetch(tNormal, px, 0).xyz;
  float depthEdge = 0.0;
  float normalEdge = 0.0;
  for (int i = 0; i < 4; i++) {
    ivec2 o = i == 0 ? ivec2(1, 0) : i == 1 ? ivec2(-1, 0) : i == 2 ? ivec2(0, 1) : ivec2(0, -1);
    ivec2 q = clamp(px + o, ivec2(0), last);
    float dd = (texelFetch(tDepth, q, 0).r - d) * uDepthRange;
    depthEdge = max(depthEdge, step(uDepthThreshold, dd));
    if (noOutline(q)) continue;
    vec3 nn = uView * texelFetch(tNormal, q, 0).xyz;
    float bias = step(0.01, dot(n - nn, vec3(1.0, 0.67, 0.23)));
    normalEdge += max(0.0, 1.0 - dot(n, nn)) * bias * step(-0.06, dd) * step(abs(dd), uDepthThreshold);
  }
  float crease = step(0.2, normalEdge) * (1.0 - depthEdge);
  vec3 result = mix(color, outlineShade(color), depthEdge * uOutline);
  result = mix(result, color * 1.45 + 0.015, crease * uCrease);
  gl_FragColor = vec4(result, 1.0);
}
`;

export function createOutlinePass(): RenderPass {
  const view = new THREE.Matrix3();
  const size = new THREE.Vector2(1, 1);
  const material = fullscreenMaterial(
    fragment,
    {
      tInput: { value: null },
      tDepth: { value: null },
      tNormal: { value: null },
      tEmissive: { value: null },
      uView: { value: view },
      uSize: { value: size },
      uDepthRange: { value: 1 },
      uDepthThreshold: { value: 0.18 },
      uOutline: { value: 1 },
      uShade: { value: 0.42 },
      uCrease: { value: 0.55 },
    },
    { SURFACE_NO_OUTLINE: SURFACE_FLAGS.noOutline },
  );
  return {
    name: 'outline',
    order: PASS_ORDER.outline,
    render(ctx: PassContext) {
      const u = material.uniforms;
      u.tInput.value = ctx.input;
      u.tDepth.value = ctx.gbuffer.depth;
      u.tNormal.value = ctx.gbuffer.normal;
      u.tEmissive.value = ctx.gbuffer.emissive;
      view.setFromMatrix4(ctx.camera.matrixWorldInverse);
      size.set(ctx.width, ctx.height);
      u.uDepthRange.value = ctx.camera.far - ctx.camera.near;
      ctx.fullscreen(material);
    },
    dispose() {
      material.dispose();
    },
  };
}
