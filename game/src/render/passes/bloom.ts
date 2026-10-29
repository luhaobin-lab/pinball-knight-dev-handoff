import * as THREE from 'three';
import { PASS_ORDER } from '../constants';
import { fullscreenMaterial } from '../fullscreen';
import type { PassContext, RenderPass } from '../api';

const downsample = /* glsl */ `
uniform sampler2D tInput;
uniform vec2 uInputSize;
uniform float uThreshold;
void main() {
  ivec2 base = ivec2(gl_FragCoord.xy) * 2;
  ivec2 last = ivec2(uInputSize) - 1;
  vec3 c = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    c += texelFetch(tInput, min(base + ivec2(i & 1, i >> 1), last), 0).rgb;
  }
  c *= 0.25;
  // Threshold on luminance and keep the hue: a per-channel cut turns orange flames into red halos.
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  gl_FragColor = vec4(c * (max(l - uThreshold, 0.0) / max(l, 1e-5)), 1.0);
}
`;

const blur = /* glsl */ `
uniform sampler2D tInput;
uniform vec2 uInputSize;
uniform vec2 uDirection;
const float W[5] = float[5](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);
void main() {
  ivec2 px = ivec2(gl_FragCoord.xy);
  ivec2 last = ivec2(uInputSize) - 1;
  ivec2 dir = ivec2(uDirection);
  vec3 c = texelFetch(tInput, px, 0).rgb * W[0];
  for (int i = 1; i < 5; i++) {
    c += texelFetch(tInput, clamp(px + dir * i, ivec2(0), last), 0).rgb * W[i];
    c += texelFetch(tInput, clamp(px - dir * i, ivec2(0), last), 0).rgb * W[i];
  }
  gl_FragColor = vec4(c, 1.0);
}
`;

const composite = /* glsl */ `
uniform sampler2D tInput;
uniform sampler2D tNear;
uniform sampler2D tWide;
uniform vec2 uSize;
uniform float uNear;
uniform float uWide;
uniform float uLevels;
void main() {
  vec2 uv = gl_FragCoord.xy / uSize;
  vec3 c = texelFetch(tInput, ivec2(gl_FragCoord.xy), 0).rgb;
  vec3 b = texture2D(tNear, uv).rgb * uNear + texture2D(tWide, uv).rgb * uWide;
  // Quantized glow: bloom rises in visible steps, like hand-placed halo pixels.
  b = floor(b * uLevels + 0.5) / uLevels;
  gl_FragColor = vec4(c + b, 1.0);
}
`;

function halfTarget(): THREE.WebGLRenderTarget {
  return new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    generateMipmaps: false,
    depthBuffer: false,
  });
}

/** Linear luminance above which pixels glow. */
const THRESHOLD = 0.85;

/** post stage: two-level pixel bloom (1/2 and 1/4 resolution) with quantized steps. */
export function createBloomPass(): RenderPass {
  const near = [halfTarget(), halfTarget()];
  const wide = [halfTarget(), halfTarget()];
  const inputSize = new THREE.Vector2(1, 1);
  const size = new THREE.Vector2(1, 1);
  const downMaterial = fullscreenMaterial(downsample, { tInput: { value: null }, uInputSize: { value: inputSize }, uThreshold: { value: THRESHOLD } });
  const blurMaterial = fullscreenMaterial(blur, { tInput: { value: null }, uInputSize: { value: new THREE.Vector2(1, 1) }, uDirection: { value: new THREE.Vector2(1, 0) } });
  const compositeMaterial = fullscreenMaterial(composite, {
    tInput: { value: null },
    tNear: { value: near[0].texture },
    tWide: { value: wide[0].texture },
    uSize: { value: size },
    uNear: { value: 0.55 },
    uWide: { value: 0.35 },
    uLevels: { value: 12 },
  });

  const blurInto = (ctx: PassContext, pair: THREE.WebGLRenderTarget[]): void => {
    const u = blurMaterial.uniforms;
    (u.uInputSize.value as THREE.Vector2).set(pair[0].width, pair[0].height);
    u.tInput.value = pair[0].texture;
    (u.uDirection.value as THREE.Vector2).set(1, 0);
    ctx.fullscreen(blurMaterial, pair[1]);
    u.tInput.value = pair[1].texture;
    (u.uDirection.value as THREE.Vector2).set(0, 1);
    ctx.fullscreen(blurMaterial, pair[0]);
  };

  return {
    name: 'bloom',
    order: PASS_ORDER.bloom,
    setSize(width, height) {
      const hw = Math.max(1, Math.ceil(width / 2));
      const hh = Math.max(1, Math.ceil(height / 2));
      for (const t of near) t.setSize(hw, hh);
      for (const t of wide) t.setSize(Math.max(1, Math.ceil(hw / 2)), Math.max(1, Math.ceil(hh / 2)));
    },
    render(ctx: PassContext) {
      const d = downMaterial.uniforms;
      d.tInput.value = ctx.input;
      d.uThreshold.value = THRESHOLD;
      inputSize.set(ctx.width, ctx.height);
      ctx.fullscreen(downMaterial, near[0]);
      blurInto(ctx, near);
      d.tInput.value = near[0].texture;
      d.uThreshold.value = 0;
      inputSize.set(near[0].width, near[0].height);
      ctx.fullscreen(downMaterial, wide[0]);
      blurInto(ctx, wide);
      compositeMaterial.uniforms.tInput.value = ctx.input;
      size.set(ctx.width, ctx.height);
      ctx.fullscreen(compositeMaterial);
    },
    dispose() {
      for (const t of [...near, ...wide]) t.dispose();
      downMaterial.dispose();
      blurMaterial.dispose();
      compositeMaterial.dispose();
    },
  };
}
