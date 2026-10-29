import * as THREE from 'three';
import { PASS_ORDER, SURFACE_FLAGS } from '../constants';
import { rampAtlas, RAMP_PARAMS_TEXEL } from '../ramps';
import { blueNoiseTexture } from '../bluenoise';
import { fullscreenMaterial } from '../fullscreen';
import type { LightStore } from '../lights';
import type { PassContext, RenderPass } from '../api';

const fragment = /* glsl */ `
uniform sampler2D tSurface;
uniform sampler2D tNormal;
uniform sampler2D tEmissive;
uniform sampler2D tDepth;
uniform sampler2D tIrradiance;
uniform sampler2D tRamps;
uniform sampler2D tNoise;
uniform mat4 uInvViewProj;
uniform vec4 uLightPos[MAX_LIGHTS];
uniform vec4 uLightCol[MAX_LIGHTS];
uniform int uLightCount;
uniform vec3 uAmbSky;
uniform vec3 uAmbGround;
uniform vec3 uKeyDir;
uniform vec3 uKeyCol;
uniform vec3 uBackground;
uniform float uExposure;
uniform float uTint;
uniform vec2 uSize;
uniform vec2 uNoiseOffset;
uniform int uDebugLight;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

void main() {
  ivec2 px = ivec2(gl_FragCoord.xy);
  float depth = texelFetch(tDepth, px, 0).r;
  gl_FragDepth = depth;
  if (depth >= 1.0) {
    gl_FragColor = vec4(uBackground, 1.0);
    return;
  }
  vec4 surface = texelFetch(tSurface, px, 0);
  vec4 normalData = texelFetch(tNormal, px, 0);
  vec4 emissive = texelFetch(tEmissive, px, 0);
  int id = int(surface.a + 0.5);
  int flags = int(emissive.a + 0.5);
  vec4 params = texelFetch(tRamps, ivec2(RAMP_PARAMS_TEXEL, id), 0);
  int count = int(params.x + 0.5);
  if ((flags & SURFACE_UNLIT) != 0 || count < 2) {
    vec3 top = texelFetch(tRamps, ivec2(max(count - 1, 0), id), 0).rgb;
    gl_FragColor = vec4(surface.rgb * top + emissive.rgb, 1.0);
    return;
  }

  vec3 n = normalize(normalData.xyz);
  vec2 uv = (vec2(px) + 0.5) / uSize;
  vec4 wp = uInvViewProj * vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  vec3 p = wp.xyz / wp.w;

  vec3 light = mix(uAmbGround, uAmbSky, n.y * 0.5 + 0.5);
  light += uKeyCol * max(dot(n, uKeyDir), 0.0);
  for (int i = 0; i < MAX_LIGHTS; i++) {
    if (i >= uLightCount) break;
    vec4 lp = uLightPos[i];
    vec3 d = lp.xyz - p;
    float dist = length(d);
    float x = dist / lp.w;
    if (x >= 1.0) continue;
    float fall = 1.0 - x * x;
    float facing = clamp(dot(n, d / max(dist, 1e-4)) * 0.6 + 0.4, 0.0, 1.0);
    light += uLightCol[i].rgb * (fall * fall * facing);
  }
  light += texelFetch(tIrradiance, px, 0).rgb;

  // Total light picks the ramp band (blue-noise dithered near band edges); its hue tints the band.
  float lum = max(dot(light, LUMA), 1e-5);
  vec3 hue = light / lum;
  float t = pow(lum * uExposure, params.z);
  if (uDebugLight == 1) {
    gl_FragColor = vec4(t > 1.0 ? mix(vec3(1.0, 0.85, 0.3), vec3(1.0, 0.1, 0.0), min(t - 1.0, 1.0)) : vec3(t), 1.0);
    return;
  }
  float pos = t * float(count - 1) + normalData.a;
  float noise = texelFetch(tNoise, (px + ivec2(uNoiseOffset)) & 63, 0).r - 0.5;
  int band = clamp(int(floor(pos + 0.5 + noise * params.y)), 0, count - 1);
  vec3 ramp = texelFetch(tRamps, ivec2(band, id), 0).rgb;
  float over = 1.0 + max(t - 1.0, 0.0) * params.w;
  gl_FragColor = vec4(ramp * surface.rgb * mix(vec3(1.0), hue, uTint) * over + emissive.rgb, 1.0);
}
`;

/** lighting stage, order 0: deferred toon resolve of the G-buffer into `lit` (also copies depth). */
export function createResolvePass(lights: LightStore): RenderPass {
  const invViewProj = new THREE.Matrix4();
  const keyDir = new THREE.Vector3();
  const ambSky = new THREE.Color();
  const ambGround = new THREE.Color();
  const keyCol = new THREE.Color();
  const size = new THREE.Vector2(1, 1);
  const material = fullscreenMaterial(
    fragment,
    {
      tSurface: { value: null },
      tNormal: { value: null },
      tEmissive: { value: null },
      tDepth: { value: null },
      tIrradiance: { value: null },
      tRamps: { value: rampAtlas },
      tNoise: { value: blueNoiseTexture() },
      uInvViewProj: { value: invViewProj },
      uLightPos: { value: lights.positions },
      uLightCol: { value: lights.colors },
      uLightCount: { value: 0 },
      uAmbSky: { value: ambSky },
      uAmbGround: { value: ambGround },
      uKeyDir: { value: keyDir },
      uKeyCol: { value: keyCol },
      uBackground: { value: new THREE.Color() },
      uExposure: { value: 1 },
      uTint: { value: 0.5 },
      uSize: { value: size },
      uNoiseOffset: { value: new THREE.Vector2() },
      uDebugLight: { value: 0 },
    },
    { MAX_LIGHTS: lights.budget, RAMP_PARAMS_TEXEL, SURFACE_UNLIT: SURFACE_FLAGS.unlit },
  );
  // Writes gl_FragDepth so forward objects can depth-test against the opaque scene.
  material.depthTest = true;
  material.depthWrite = true;
  material.depthFunc = THREE.AlwaysDepth;

  return {
    name: 'resolve',
    order: PASS_ORDER.resolve,
    render(ctx: PassContext) {
      const u = material.uniforms;
      const L = ctx.lighting;
      u.tSurface.value = ctx.gbuffer.surface;
      u.tNormal.value = ctx.gbuffer.normal;
      u.tEmissive.value = ctx.gbuffer.emissive;
      u.tDepth.value = ctx.gbuffer.depth;
      u.tIrradiance.value = ctx.targets.irradiance.texture;
      u.uLightCount.value = lights.count;
      invViewProj.multiplyMatrices(ctx.camera.projectionMatrix, ctx.camera.matrixWorldInverse).invert();
      ambSky.copy(L.ambientSky).multiplyScalar(L.ambientIntensity);
      ambGround.copy(L.ambientGround).multiplyScalar(L.ambientIntensity);
      keyDir.copy(L.keyDirection).normalize();
      keyCol.copy(L.keyColor).multiplyScalar(L.keyIntensity);
      (u.uBackground.value as THREE.Color).copy(L.background);
      u.uExposure.value = L.exposure;
      u.uTint.value = L.tint;
      size.set(ctx.width, ctx.height);
      (u.uNoiseOffset.value as THREE.Vector2).set(ctx.pixelOrigin.x, ctx.pixelOrigin.y);
      u.uDebugLight.value = ctx.debugView === 'light' ? 1 : 0;
      ctx.fullscreen(material);
    },
    dispose() {
      material.dispose();
    },
  };
}
