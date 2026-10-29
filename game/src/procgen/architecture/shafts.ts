import * as THREE from 'three';
import { blueNoiseTexture, LAYERS } from '../../render/api';
import { JEWELS } from './palette';
import { ELYTRA_GLSL } from './shaders';
import type { WindowLight } from './walls';

/**
 * Light shafts through the elytra windows (art bible §9.7 Low tier: analytic additive shaft quads), the
 * preview the room kit ships until p1-gi-atmos ray-marches the real ones from the same WindowLight
 * descriptors. Each window gets a few stacked sheets from its glass down along the light to the floor;
 * every fragment traces back to the pane it came through, so shafts carry the window's jewel colours.
 * Additive and posterized into 3 levels, with blue-noise dithering only at the level edges.
 */

const vertex = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const fragment = /* glsl */ `
uniform vec3 uCentre;
uniform vec3 uRight;
uniform vec3 uUp;
uniform vec3 uDir;
uniform vec2 uHalf;
uniform float uKind;
uniform float uPetals;
uniform float uSeed;
uniform float uLength;
uniform float uStrength;
uniform float uTime;
uniform sampler2D tNoise;
varying vec3 vWorld;
const vec3 JEWEL[32] = vec3[32](JEWEL_LIST);
${ELYTRA_GLSL}
void main() {
  vec3 plane = cross(uRight, uUp);
  float t = dot(uCentre - vWorld, plane) / dot(uDir, plane);
  vec3 q = vWorld + uDir * t - uCentre;
  vec2 lp = vec2(dot(q, uRight) / uHalf.x, dot(q, uUp) / uHalf.y);
  if (elytraId(lp, uKind, uPetals) < 0.0) discard;
  // coarse colour cells: shafts carry broad bands of the window's colours, not per-pane noise
  float id = elytraId(floor(lp * 2.5) / 2.5 + 0.2, uKind, uPetals);
  float hue = mod(max(id, 0.0) * 3.0 + floor(uSeed * 8.0), 8.0);
  vec3 c = mix(JEWEL[int(hue) * 4 + 2], vec3(0.9, 0.85, 1.0), 0.45);
  float along = clamp(t / uLength, 0.0, 1.0);
  float edge = 1.0 - smoothstep(0.55, 1.0, max(abs(lp.x), abs(lp.y)));
  float dust = 0.8 + 0.2 * sin(vWorld.x * 2.1 + vWorld.y * 1.3 - uTime * 0.5) * sin(vWorld.z * 1.7 + uTime * 0.3);
  float a = (1.0 - along) * (0.4 + 0.6 * smoothstep(0.0, 0.1, along)) * dust * (0.5 + 0.5 * edge);
  // posterize into 3 levels; blue noise only dithers the band edges
  float n = texelFetch(tNoise, ivec2(gl_FragCoord.xy) & 63, 0).r - 0.5;
  float level = floor(a * 3.0 + 0.5 + n * 0.7) / 3.0;
  if (level <= 0.0) discard;
  gl_FragColor = vec4(c * level * uStrength, 1.0);
}
`;

export interface ShaftOptions {
  /** Sheets per window (more = denser volume, default 3). */
  readonly sheets?: number;
  /** Additive strength per sheet (default 0.1). */
  readonly strength?: number;
}

export interface Shafts {
  readonly object: THREE.Group;
  /** Window glow (Fervor) multiplier. */
  glow: number;
  update(time: number): void;
  dispose(): void;
}

const kindCode = { lancet: 0, rose: 1, roundel: 2 } as const;

export function windowShafts(windows: readonly WindowLight[], options: ShaftOptions = {}): Shafts {
  const group = new THREE.Group();
  group.name = 'arch-shafts';
  const jewelList = JEWELS.flat()
    .map(h => {
      const c = new THREE.Color(h);
      return `vec3(${c.r.toFixed(5)}, ${c.g.toFixed(5)}, ${c.b.toFixed(5)})`;
    })
    .join(', ');
  const materials: THREE.ShaderMaterial[] = [];
  const base: number[] = [];
  const sheets = options.sheets ?? 3;
  const strength = options.strength ?? 0.1;
  for (const w of windows) {
    // distance along the light from the glass centre down to the floor
    const length = w.centre.y / Math.max(0.05, w.lightDir.y);
    const material = new THREE.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment.replace('JEWEL_LIST', jewelList),
      uniforms: {
        uCentre: { value: w.centre },
        uRight: { value: w.right },
        uUp: { value: w.up },
        uDir: { value: w.lightDir },
        uHalf: { value: new THREE.Vector2(w.halfWidth, w.halfHeight) },
        uKind: { value: kindCode[w.kind] },
        uPetals: { value: w.petals },
        uSeed: { value: w.seed },
        uLength: { value: length + w.halfHeight },
        uStrength: { value: strength * w.intensity * (w.kind === 'roundel' ? 0.35 : 1) },
        uTime: { value: 0 },
        tNoise: { value: blueNoiseTexture() },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    materials.push(material);
    base.push(material.uniforms.uStrength.value as number);
    const pos: number[] = [];
    const down = w.lightDir.clone().negate();
    for (let i = 0; i < sheets; i++) {
      // a sheet through one row of the glass, from the glass along the light to below the floor
      const v = ((i + 0.5) / sheets) * 2 - 1;
      const o = w.centre.clone().addScaledVector(w.up, v * w.halfHeight * 0.9);
      const reach = (o.y + 0.05) / Math.max(0.05, -down.y);
      const a = o.clone().addScaledVector(w.right, -w.halfWidth);
      const b = o.clone().addScaledVector(w.right, w.halfWidth);
      const c = b.clone().addScaledVector(down, reach);
      const d = a.clone().addScaledVector(down, reach);
      pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z, a.x, a.y, a.z, c.x, c.y, c.z, d.x, d.y, d.z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const mesh = new THREE.Mesh(g, material);
    mesh.name = `shaft-${w.kind}`;
    mesh.layers.set(LAYERS.forward);
    mesh.frustumCulled = false;
    group.add(mesh);
  }
  const shafts: Shafts = {
    object: group,
    glow: 1,
    update(time) {
      materials.forEach((m, i) => {
        m.uniforms.uTime.value = time;
        m.uniforms.uStrength.value = base[i] * shafts.glow;
      });
    },
    dispose() {
      for (const m of materials) m.dispose();
      group.traverse(o => (o as THREE.Mesh).geometry?.dispose());
    },
  };
  return shafts;
}
