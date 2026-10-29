import * as THREE from 'three';
import { fullscreenMaterial, type PassContext, type RenderPass } from '../../render/api';
import { JEWELS } from './palette';
import { ELYTRA_GLSL } from './shaders';
import type { WindowLight } from './walls';

/**
 * Window light pools (art bible §9.6 gobos, preview quality): a lighting pass (order < 0, additive into
 * the irradiance buffer) that traces every G-buffer pixel toward each window along its light direction
 * and adds the colour of the elytra pane it passes through. Floors, props and actors standing in a pool
 * all pick up its jewel colours, quantized by the resolve into their own ramps.
 *
 * The p1-gi-atmos lane owns the final gobos (cookies, RC emitters, shafts); this pass consumes the same
 * `WindowLight` descriptors so it can be dropped once that lands.
 */

export const MAX_WINDOWS = 8;

const fragment = /* glsl */ `
uniform sampler2D tDepth;
uniform sampler2D tNormal;
uniform mat4 uInvViewProj;
uniform vec2 uSize;
uniform int uCount;
uniform vec4 uCentre[${MAX_WINDOWS}];   // xyz, w = kind
uniform vec4 uRight[${MAX_WINDOWS}];    // xyz unit, w = half width
uniform vec4 uUp[${MAX_WINDOWS}];       // xyz unit, w = half height
uniform vec4 uDir[${MAX_WINDOWS}];      // xyz toward the light, w = intensity
uniform vec4 uExtra[${MAX_WINDOWS}];    // x = petals, y = seed
uniform float uGlow;
const vec3 JEWEL[32] = vec3[32](JEWEL_LIST);
${ELYTRA_GLSL}
void main() {
  ivec2 px = ivec2(gl_FragCoord.xy);
  float depth = texelFetch(tDepth, px, 0).r;
  if (depth >= 1.0) discard;
  vec3 n = normalize(texelFetch(tNormal, px, 0).xyz);
  vec4 wp = uInvViewProj * vec4((vec2(px) + 0.5) / uSize * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  vec3 p = wp.xyz / wp.w;
  vec3 sum = vec3(0.0);
  for (int i = 0; i < ${MAX_WINDOWS}; i++) {
    if (i >= uCount) break;
    vec3 d = uDir[i].xyz;
    vec3 plane = cross(uRight[i].xyz, uUp[i].xyz);
    float denom = dot(d, plane);
    if (abs(denom) < 1e-4) continue;
    float t = dot(uCentre[i].xyz - p, plane) / denom;
    if (t <= 0.02) continue;
    vec3 q = p + d * t - uCentre[i].xyz;
    vec2 lp = vec2(dot(q, uRight[i].xyz) / uRight[i].w, dot(q, uUp[i].xyz) / uUp[i].w);
    float id;
    float lead = elytraLead(lp, dFdx(lp), dFdy(lp), uCentre[i].w, uExtra[i].x, id);
    if (id < 0.0 || lead > 0.5) continue;
    float hue = mod(id * 3.0 + floor(uExtra[i].y * 8.0), 8.0);
    vec3 c = JEWEL[int(hue) * 4 + 2] * 1.9;
    float facing = clamp(dot(n, d) * 0.8 + 0.2, 0.0, 1.0);
    // pools fade with the distance travelled below the window so long shafts do not flood the far floor
    float fade = 1.0 - smoothstep(4.0, 9.0, t);
    sum += c * uDir[i].w * facing * fade;
  }
  if (dot(sum, sum) <= 0.0) discard;
  gl_FragColor = vec4(sum * uGlow, 1.0);
}
`;

export interface WindowLightPass extends RenderPass {
  /** Overall strength (Fervor: window emissive 0.5 → 2.2 maps to roughly 0.6 → 1.6 here). */
  glow: number;
  setWindows(windows: readonly WindowLight[]): void;
}

export function createWindowLightPass(windows: readonly WindowLight[], name = 'arch-window-light'): WindowLightPass {
  const arr = (): THREE.Vector4[] => Array.from({ length: MAX_WINDOWS }, () => new THREE.Vector4());
  const centre = arr();
  const right = arr();
  const up = arr();
  const dir = arr();
  const extra = arr();
  const invViewProj = new THREE.Matrix4();
  const size = new THREE.Vector2(1, 1);
  const jewelList = JEWELS.flat()
    .map(h => {
      const c = new THREE.Color(h);
      return `vec3(${c.r.toFixed(5)}, ${c.g.toFixed(5)}, ${c.b.toFixed(5)})`;
    })
    .join(', ');
  const material = fullscreenMaterial(
    fragment.replace('JEWEL_LIST', jewelList),
    {
      tDepth: { value: null },
      tNormal: { value: null },
      uInvViewProj: { value: invViewProj },
      uSize: { value: size },
      uCount: { value: 0 },
      uCentre: { value: centre },
      uRight: { value: right },
      uUp: { value: up },
      uDir: { value: dir },
      uExtra: { value: extra },
      uGlow: { value: 1 },
    },
  );
  material.blending = THREE.AdditiveBlending;
  const kindCode = { lancet: 0, rose: 1, roundel: 2 } as const;
  const pass: WindowLightPass = {
    name,
    order: -20,
    glow: 1,
    setWindows(list) {
      const n = Math.min(MAX_WINDOWS, list.length);
      material.uniforms.uCount.value = n;
      for (let i = 0; i < n; i++) {
        const w = list[i];
        centre[i].set(w.centre.x, w.centre.y, w.centre.z, kindCode[w.kind]);
        right[i].set(w.right.x, w.right.y, w.right.z, w.halfWidth);
        up[i].set(w.up.x, w.up.y, w.up.z, w.halfHeight);
        dir[i].set(w.lightDir.x, w.lightDir.y, w.lightDir.z, w.intensity);
        extra[i].set(w.petals, w.seed, 0, 0);
      }
    },
    render(ctx: PassContext) {
      const u = material.uniforms;
      u.tDepth.value = ctx.gbuffer.depth;
      u.tNormal.value = ctx.gbuffer.normal;
      u.uGlow.value = pass.glow;
      invViewProj.multiplyMatrices(ctx.camera.projectionMatrix, ctx.camera.matrixWorldInverse).invert();
      size.set(ctx.width, ctx.height);
      ctx.fullscreen(material);
    },
    dispose() {
      material.dispose();
    },
  };
  pass.setWindows(windows);
  return pass;
}
