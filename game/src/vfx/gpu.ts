import * as THREE from 'three';
import { registerRamp, SURFACE_FLAGS, TOON_GBUFFER_GLSL } from '../render/api';

/**
 * Shared GPU pieces of the launch effects. Every effect is opaque pixel art written into the G-buffer on the world
 * layer (like the drop shadows of src/procgen/creatures/shapes.ts): unlit, so its colour is exact, and without
 * outline, so the outline pass neither rims it nor draws the silhouettes behind it through it. Fades are ordered
 * dithers (whole pixels drop out), never blending. Depth is real, so the hero, the enemies and the walls occlude the
 * effects that lie behind them.
 */

/** G-buffer flags of every effect pixel. */
export const VFX_FLAGS = SURFACE_FLAGS.unlit | SURFACE_FLAGS.noOutline;

let whiteRamp = 0;
/** A two-colour ramp whose top colour is white: an unlit surface then shows its albedo exactly. */
function rampId(): number {
  if (!whiteRamp) whiteRamp = registerRamp(['#000000', '#FFFFFF']);
  return whiteRamp;
}

/** GLSL helpers available to every effect shader. */
export const VFX_GLSL = /* glsl */ `
float bayer4(ivec2 p) {
  const int M[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  return (float(M[(p.y & 3) * 4 + (p.x & 3)]) + 0.5) / 16.0;
}
uint vfxHash(uint x) {
  x ^= x >> 16u; x *= 0x7feb352du; x ^= x >> 15u; x *= 0x846ca68bu; x ^= x >> 16u;
  return x;
}
/** Uniform float in [0, 1) from two integers (|n| < 65536) and a seed in [0, 1). */
float hash3(int a, int b, float seed) {
  uint h = vfxHash(uint(a + 65536) * 0x9E3779B1u ^ vfxHash(uint(b + 65536) + 0x632BE5ABu) ^ uint(seed * 16777216.0));
  return float(h >> 8u) / 16777216.0;
}
`;

export interface VfxMaterialOptions {
  /** GLSL at vertex global scope (attributes, varyings as \`out\`). */
  vertexPars?: string;
  /** Vertex main body; must set gl_Position. */
  vertex: string;
  /** GLSL at fragment global scope (varyings as \`in\`, uniforms, functions). */
  fragmentPars?: string;
  /** Fragment main body: sets \`vec3 color\` (linear) or discards. */
  fragment: string;
  uniforms?: Record<string, THREE.IUniform>;
}

/** A ShaderMaterial that writes the G-buffer contract (README of src/render) as an unlit, unoutlined effect. */
export function vfxMaterial(o: VfxMaterialOptions): THREE.ShaderMaterial {
  const material = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: { uRampId: { value: rampId() }, ...o.uniforms },
    vertexShader: /* glsl */ `
${o.vertexPars ?? ''}
void main() {
${o.vertex}
}`,
    fragmentShader: /* glsl */ `
precision highp float;
precision highp int;
${TOON_GBUFFER_GLSL}
${VFX_GLSL}
uniform float uRampId;
${o.fragmentPars ?? ''}
void main() {
  vec3 color = vec3(1.0);
${o.fragment}
  writeGBuffer(color, uRampId, vec3(0.0, 1.0, 0.0), 0.0, vec3(0.0), ${VFX_FLAGS.toFixed(1)});
}`,
    fog: false,
    lights: false,
  });
  material.userData.gbuffer = true;
  return material;
}

/** Linear colours of a palette as a uniform array. */
export function paletteUniform(colors: readonly string[]): THREE.IUniform<THREE.Color[]> {
  return { value: colors.map(c => new THREE.Color(c)) };
}

/** How a sprite's depth is set: a camera-facing card at its anchor, or lying on the floor plane through it. */
export type SpriteDepth = 'card' | 'floor';

/** Where and how big one sprite is: world anchor (tiles), depth bias toward the camera (tiles), size (px). */
export interface SpriteSpec {
  x: number;
  y: number;
  z: number;
  bias: number;
  w: number;
  h: number;
  /** Screen angle the shape is turned by (radians, clockwise on screen). */
  angle?: number;
  depth: SpriteDepth;
}

/**
 * Pixel sprites: instanced screen-aligned quads centred on a world anchor snapped to the internal pixel grid and sized
 * in whole internal pixels, so every sprite is crisp. Per instance: the anchor (xyz, tiles) and a depth bias toward
 * the camera (w, tiles), the size in pixels (box.xy), a screen angle (box.z, radians, for shapes that turn), the depth
 * mode (box.w: 0 card, 1 floor) and eight free parameters (a, b) for the effect's fragment shader.
 * - A card has one depth, its anchor's (plus the bias): airborne things that must read over the bodies at a contact.
 * - A floor sprite takes the depth of the plane y = anchor.y under each pixel (plus the bias), so the floor never
 *   cuts it and whatever stands on it hides it.
 * The fragment shader gets \`vec2 vPx\`, the pixel's offset from the sprite centre in pixels (x right, y down;
 * half-integers on even sizes), with the angle already undone, plus \`vBox\`, \`vA\`, \`vB\`.
 */
export class SpriteBatch {
  readonly mesh: THREE.Mesh;
  readonly material: THREE.ShaderMaterial;
  private readonly geometry = new THREE.InstancedBufferGeometry();
  private readonly anchor: THREE.InstancedBufferAttribute;
  private readonly box: THREE.InstancedBufferAttribute;
  private readonly a: THREE.InstancedBufferAttribute;
  private readonly b: THREE.InstancedBufferAttribute;
  private count = 0;

  constructor(
    readonly capacity: number,
    fragment: { pars?: string; body: string; uniforms?: Record<string, THREE.IUniform> },
    size: THREE.IUniform<THREE.Vector2>,
  ) {
    const g = this.geometry;
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    const attr = (name: string): THREE.InstancedBufferAttribute => {
      const a = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
      a.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute(name, a);
      return a;
    };
    this.anchor = attr('aAnchor');
    this.box = attr('aBox');
    this.a = attr('aA');
    this.b = attr('aB');
    g.instanceCount = 0;
    this.material = vfxMaterial({
      vertexPars: /* glsl */ `
in vec4 aAnchor;
in vec4 aBox;
in vec4 aA;
in vec4 aB;
uniform vec2 uSize;
out vec2 vPx;
flat out vec4 vBox;
flat out vec4 vA;
flat out vec4 vB;`,
      vertex: /* glsl */ `
  vec4 view = viewMatrix * vec4(aAnchor.xyz, 1.0);
  view.z += aAnchor.w;
  vec4 clip = projectionMatrix * view;
  vec2 px = (clip.xy / clip.w * 0.5 + 0.5) * uSize;
  vec2 size = max(vec2(1.0), floor(aBox.xy + 0.5));
  vec2 odd = mod(size, 2.0);
  vec2 centre = mix(floor(px + 0.5), floor(px) + 0.5, odd);
  vec2 local = position.xy * size;
  if (aBox.w > 0.5) {
    // slide the corner along the view direction onto the plane y = anchor.y: its depth on the floor
    vec2 dview = local / (0.5 * uSize * vec2(projectionMatrix[0][0], projectionMatrix[1][1]));
    vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
    vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    vec3 toCam = vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
    vec3 dw = right * dview.x + up * dview.y;
    view.z -= dw.y / toCam.y;
  }
  vPx = vec2(local.x, -local.y);
  float c = cos(aBox.z), s = sin(aBox.z);
  vPx = mat2(c, -s, s, c) * vPx;
  vBox = vec4(size, aBox.zw);
  vA = aA;
  vB = aB;
  vec4 depth = projectionMatrix * view;
  gl_Position = vec4((centre + local) / uSize * 2.0 - 1.0, depth.z / depth.w, 1.0);`,
      fragmentPars: /* glsl */ `
in vec2 vPx;
flat in vec4 vBox;
flat in vec4 vA;
flat in vec4 vB;
${fragment.pars ?? ''}`,
      fragment: fragment.body,
      uniforms: { uSize: size, ...fragment.uniforms },
    });
    this.mesh = new THREE.Mesh(g, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.matrixAutoUpdate = false;
  }

  /** Starts a new frame's instance list. */
  clear(): void {
    this.count = 0;
  }

  /** Adds one sprite; silently drops it when the batch is full. */
  add(s: SpriteSpec, a: readonly number[], b: readonly number[] = ZERO4): void {
    if (this.count >= this.capacity) return;
    const i = this.count++;
    this.anchor.setXYZW(i, s.x, s.y, s.z, s.bias);
    this.box.setXYZW(i, s.w, s.h, s.angle ?? 0, s.depth === 'floor' ? 1 : 0);
    this.a.setXYZW(i, a[0] ?? 0, a[1] ?? 0, a[2] ?? 0, a[3] ?? 0);
    this.b.setXYZW(i, b[0] ?? 0, b[1] ?? 0, b[2] ?? 0, b[3] ?? 0);
  }

  /** Uploads the instances added since `clear`. */
  commit(): void {
    this.geometry.instanceCount = this.count;
    this.mesh.visible = this.count > 0;
    for (const a of [this.anchor, this.box, this.a, this.b]) {
      a.clearUpdateRanges();
      a.addUpdateRange(0, this.count * 4);
      a.needsUpdate = true;
    }
  }

  get size(): number {
    return this.count;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}

const ZERO4 = [0, 0, 0, 0] as const;
