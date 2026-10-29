import * as THREE from 'three';
import { SURFACE_FLAGS } from './constants';
import { DEFAULT_RAMP_PARAMS, registerRamp, type RampParams } from './ramps';
import type { Hex, ToonMaterial, ToonMaterialOptions } from './api';

/** Shared clock uniform for toon materials (seconds; driven by the renderer). */
export const TOON_TIME: THREE.IUniform<number> = { value: 0 };

/**
 * G-buffer outputs for custom materials. Use with `glslVersion: THREE.GLSL3` and call
 * `writeGBuffer(...)` once instead of writing gl_FragColor. Layout: README.md "G-buffer".
 */
export const TOON_GBUFFER_GLSL = /* glsl */ `
layout(location = 0) out highp vec4 gSurface;
layout(location = 1) out highp vec4 gNormal;
layout(location = 2) out highp vec4 gEmissive;
void writeGBuffer(vec3 albedo, float rampId, vec3 normalW, float rampShift, vec3 emissive, float flags) {
  gSurface = vec4(albedo, rampId);
  gNormal = vec4(normalW, rampShift);
  gEmissive = vec4(emissive, flags);
}
`;

const COLOR_VARYING = 'defined( USE_COLOR ) || defined( USE_COLOR_ALPHA ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )';

const vertexShader = (pars: string, body: string): string => /* glsl */ `
#include <common>
#include <batching_pars_vertex>
#include <color_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
uniform float uTime;
out vec3 vToonWorld;
out vec3 vToonNormal;
out vec2 vToonUv;
${pars}
void main() {
  #include <color_vertex>
  #include <morphinstance_vertex>
  #include <morphcolor_vertex>
  #include <batching_vertex>
  #include <beginnormal_vertex>
  #include <morphnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <defaultnormal_vertex>
  #include <begin_vertex>
  #include <morphtarget_vertex>
  #include <skinning_vertex>
  ${body}
  #include <project_vertex>
  #include <logdepthbuf_vertex>
  #include <clipping_planes_vertex>
  vec4 toonWorld = vec4(transformed, 1.0);
  #ifdef USE_BATCHING
    toonWorld = batchingMatrix * toonWorld;
  #endif
  #ifdef USE_INSTANCING
    toonWorld = instanceMatrix * toonWorld;
  #endif
  vToonWorld = (modelMatrix * toonWorld).xyz;
  vToonNormal = transformDirectionByInverseViewMatrix(transformedNormal, viewMatrix);
  vToonUv = uv;
}
`;

const fragmentShader = (pars: string, body: string): string => /* glsl */ `
#include <common>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
#if ${COLOR_VARYING}
  in vec4 vColor;
#endif
uniform vec3 uTint;
uniform float uRampId;
uniform vec3 uEmissive;
uniform float uFlags;
uniform float uFlash;
uniform float uAlphaTest;
uniform float uTime;
#ifdef TOON_MAP
  uniform sampler2D uMap;
#endif
in vec3 vToonWorld;
in vec3 vToonNormal;
in vec2 vToonUv;
${TOON_GBUFFER_GLSL}
${pars}
void main() {
  #include <clipping_planes_fragment>
  #include <logdepthbuf_fragment>
  vec4 tint = vec4(uTint, 1.0);
  #ifdef TOON_MAP
    tint *= texture(uMap, vToonUv);
  #endif
  #if ${COLOR_VARYING}
    tint *= vColor;
  #endif
  #ifdef TOON_ALPHATEST
    if (tint.a < uAlphaTest) discard;
  #endif
  vec3 albedo = tint.rgb;
  vec3 normalW = normalize(vToonNormal);
  #ifdef DOUBLE_SIDED
    normalW *= gl_FrontFacing ? 1.0 : -1.0;
  #endif
  float rampShift = 0.0;
  vec3 emissive = uEmissive;
  float flags = uFlags;
  ${body}
  emissive += vec3(2.0 * uFlash);
  writeGBuffer(albedo, uRampId, normalW, rampShift, emissive, flags);
}
`;

/** Global multiplier on every material's blue-noise dither width. */
export const DITHER_SCALE = 0.45;

class ToonMaterialImpl extends THREE.ShaderMaterial implements ToonMaterial {
  readonly isToonMaterial = true as const;
  private readonly params: RampParams;

  constructor(private readonly options: ToonMaterialOptions) {
    const hooks = options.hooks ?? {};
    const params: RampParams = {
      // the look runs at half the authored dither: a cleaner, less noisy image (producer note 2026-10-22)
      dither: (options.dither === true ? 0.35 : typeof options.dither === 'number' ? THREE.MathUtils.clamp(options.dither, 0, 1) : 0) * DITHER_SCALE,
      curve: options.curve ?? DEFAULT_RAMP_PARAMS.curve,
      overbright: options.overbright ?? DEFAULT_RAMP_PARAMS.overbright,
    };
    const flags = (options.outline === false ? SURFACE_FLAGS.noOutline : 0) | (options.unlit ? SURFACE_FLAGS.unlit : 0);
    const defines: Record<string, string> = {};
    if (options.map) defines.TOON_MAP = '';
    if (options.alphaTest !== undefined) defines.TOON_ALPHATEST = '';
    super({
      glslVersion: THREE.GLSL3,
      vertexShader: vertexShader(hooks.vertexPars ?? '', hooks.vertex ?? ''),
      fragmentShader: fragmentShader(hooks.fragmentPars ?? '', hooks.fragment ?? ''),
      uniforms: {
        uTint: { value: new THREE.Color(options.tint ?? 0xffffff) },
        uRampId: { value: registerRamp(options.ramp, params) },
        uEmissive: { value: new THREE.Color(options.emissive ?? 0x000000).multiplyScalar(options.emissiveIntensity ?? 1) },
        uFlags: { value: flags },
        uFlash: { value: 0 },
        uAlphaTest: { value: options.alphaTest ?? 0 },
        uMap: { value: options.map ?? null },
        uTime: TOON_TIME,
        ...hooks.uniforms,
      },
      defines,
      vertexColors: options.vertexColors ?? false,
      side: options.side ?? THREE.FrontSide,
      fog: false,
      lights: false,
    });
    this.params = params;
    this.name = `toon#${this.rampId}`;
    this.userData.gbuffer = true;
  }

  get rampId(): number {
    return this.uniforms.uRampId.value as number;
  }

  get flash(): number {
    return this.uniforms.uFlash.value as number;
  }

  set flash(value: number) {
    this.uniforms.uFlash.value = value;
  }

  setRamp(ramp: readonly Hex[]): void {
    this.uniforms.uRampId.value = registerRamp(ramp, this.params);
    this.name = `toon#${this.rampId}`;
  }

  /** Independent instance with the same options (own tint, emissive and flash; hook uniforms stay shared). */
  override clone(): this {
    const copy = new ToonMaterialImpl(this.options) as this;
    copy.uniforms.uRampId.value = this.rampId;
    return copy;
  }
}

export function createToonMaterial(options: ToonMaterialOptions): ToonMaterial {
  return new ToonMaterialImpl(options);
}
