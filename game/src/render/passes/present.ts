import * as THREE from 'three';
import { fullscreenMaterial } from '../fullscreen';
import type { DebugView, GBuffer, InternalSize } from '../api';

/**
 * Final blit to the canvas: integer nearest-neighbour upscale of the internal image, shifted by
 * the camera's sub-pixel remainder (smooth motion without re-rasterizing) plus screen shake
 * (translation in internal pixels, roll around the screen centre). The overlay layer is
 * composited with the same transform, then everything is encoded to the output colour space.
 * Debug views show a single buffer instead (README.md "Debug views").
 */
const fragment = /* glsl */ `
uniform sampler2D tWorld;
uniform sampler2D tOverlay;
uniform sampler2D tSurface;
uniform sampler2D tNormal;
uniform sampler2D tEmissive;
uniform sampler2D tDepth;
uniform int uView;
uniform float uDepthRange;
uniform vec2 uInternal;
uniform vec2 uOutput;
uniform float uScale;
uniform vec2 uShift;
uniform float uRoll;

vec3 idColor(float id) {
  if (id < 0.5) return vec3(0.0);
  return fract(sin(vec3(id * 12.9898, id * 78.233, id * 37.719)) * 43758.5453) * 0.8 + 0.2;
}

void main() {
  vec2 c = gl_FragCoord.xy - uOutput * 0.5;
  float s = sin(uRoll);
  float k = cos(uRoll);
  c = vec2(k * c.x - s * c.y, s * c.x + k * c.y);
  vec2 q = c / uScale + uInternal * 0.5 + uShift;
  ivec2 p = clamp(ivec2(floor(q)), ivec2(0), ivec2(uInternal) - 1);
  vec4 overlay = texelFetch(tOverlay, p, 0);
  vec3 color;
  if (uView == 0) {
    color = texelFetch(tWorld, p, 0).rgb * (1.0 - overlay.a) + overlay.rgb;
  } else if (uView == 1) {
    color = texelFetch(tWorld, p, 0).rgb;
  } else if (uView == 2) {
    color = texelFetch(tSurface, p, 0).rgb;
  } else if (uView == 3) {
    color = idColor(floor(texelFetch(tSurface, p, 0).a + 0.5));
  } else if (uView == 4) {
    vec3 n = texelFetch(tNormal, p, 0).xyz;
    color = dot(n, n) > 0.0 ? n * 0.5 + 0.5 : vec3(0.0);
  } else if (uView == 5) {
    color = texelFetch(tEmissive, p, 0).rgb;
  } else if (uView == 6) {
    float d = texelFetch(tDepth, p, 0).r;
    color = d >= 1.0 ? vec3(0.0, 0.0, 0.08) : vec3(fract(d * uDepthRange * 0.5)) * 0.85 + 0.15;
  } else {
    color = vec3(0.06) * (1.0 - overlay.a) + overlay.rgb;
  }
  gl_FragColor = vec4(color, 1.0);
  #include <colorspace_fragment>
}
`;

const VIEW_CODE: Record<DebugView, number> = {
  final: 0,
  lit: 1,
  light: 1,
  irradiance: 1,
  surface: 2,
  ramp: 3,
  normal: 4,
  emissive: 5,
  depth: 6,
  overlay: 7,
};

export class Present {
  readonly material = fullscreenMaterial(fragment, {
    tWorld: { value: null },
    tOverlay: { value: null },
    tSurface: { value: null },
    tNormal: { value: null },
    tEmissive: { value: null },
    tDepth: { value: null },
    uView: { value: 0 },
    uDepthRange: { value: 1 },
    uInternal: { value: new THREE.Vector2(1, 1) },
    uOutput: { value: new THREE.Vector2(1, 1) },
    uScale: { value: 1 },
    uShift: { value: new THREE.Vector2() },
    uRoll: { value: 0 },
  });

  /** `world` is the texture shown by 'final' and the single-texture views ('lit', 'light', 'irradiance'). */
  set(view: DebugView, world: THREE.Texture, overlay: THREE.Texture, gbuffer: GBuffer, depthRange: number, size: InternalSize, shiftX: number, shiftY: number, roll: number): void {
    const u = this.material.uniforms;
    u.uView.value = VIEW_CODE[view];
    u.tWorld.value = world;
    u.tOverlay.value = overlay;
    u.tSurface.value = gbuffer.surface;
    u.tNormal.value = gbuffer.normal;
    u.tEmissive.value = gbuffer.emissive;
    u.tDepth.value = gbuffer.depth;
    u.uDepthRange.value = depthRange;
    (u.uInternal.value as THREE.Vector2).set(size.width, size.height);
    (u.uOutput.value as THREE.Vector2).set(size.outputWidth, size.outputHeight);
    u.uScale.value = size.scale;
    (u.uShift.value as THREE.Vector2).set(shiftX, shiftY);
    u.uRoll.value = roll;
  }

  dispose(): void {
    this.material.dispose();
  }
}
