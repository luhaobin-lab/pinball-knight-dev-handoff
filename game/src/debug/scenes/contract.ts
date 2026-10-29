import * as THREE from 'three';
import hello from './hello';
import { createToonMaterial, fullscreenMaterial, LAYERS, type PassContext, type RenderPass } from '../../render/api';
import { defineScene, type SceneContext } from '../types';

/**
 * Render-contract smoke test and reference for lanes: the hello crypt plus one custom
 * extension per stage — a G-buffer pass (extra scene), a lighting pass writing irradiance
 * (a floor sigil, the way GI plugs in), a forward-layer object (dust motes), an in-place post
 * pass (frame) and an overlay pass anchored with ctx.project (candle markers).
 */

const MARKERS = 8;

function relicPass(scene: THREE.Scene): RenderPass {
  return {
    name: 'contract-relic',
    order: 10,
    render(ctx: PassContext) {
      ctx.gl.render(scene, ctx.camera);
    },
  };
}

function sigilPass(): RenderPass {
  const invViewProj = new THREE.Matrix4();
  const size = new THREE.Vector2();
  const material = fullscreenMaterial(
    /* glsl */ `
    uniform sampler2D tDepth;
    uniform sampler2D tNormal;
    uniform mat4 uInvViewProj;
    uniform vec2 uSize;
    uniform float uTime;
    void main() {
      ivec2 px = ivec2(gl_FragCoord.xy);
      float d = texelFetch(tDepth, px, 0).r;
      if (d >= 1.0 || texelFetch(tNormal, px, 0).y < 0.7) discard;
      vec4 w = uInvViewProj * vec4((vec2(px) + 0.5) / uSize * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
      vec2 p = w.xz / w.w - vec2(0.0, 0.4);
      float r = length(p);
      float ring = smoothstep(0.07, 0.0, abs(r - 1.35)) + smoothstep(0.05, 0.0, abs(r - 0.9));
      float spokes = smoothstep(0.06, 0.0, abs(sin(atan(p.y, p.x) * 3.0)) * r) * step(0.9, r) * step(r, 1.35);
      gl_FragColor = vec4(vec3(0.55, 0.25, 1.0) * (ring + spokes) * (0.7 + 0.3 * sin(uTime * 2.0)), 1.0);
    }`,
    { tDepth: { value: null }, tNormal: { value: null }, uInvViewProj: { value: invViewProj }, uSize: { value: size }, uTime: { value: 0 } },
  );
  material.blending = THREE.AdditiveBlending;
  return {
    name: 'contract-sigil',
    order: -10,
    render(ctx: PassContext) {
      const u = material.uniforms;
      u.tDepth.value = ctx.gbuffer.depth;
      u.tNormal.value = ctx.gbuffer.normal;
      u.uTime.value = ctx.time;
      invViewProj.multiplyMatrices(ctx.camera.projectionMatrix, ctx.camera.matrixWorldInverse).invert();
      size.set(ctx.width, ctx.height);
      ctx.fullscreen(material);
    },
  };
}

function framePass(): RenderPass {
  const size = new THREE.Vector2();
  const material = fullscreenMaterial(
    /* glsl */ `
    uniform vec2 uSize;
    void main() {
      vec2 p = min(gl_FragCoord.xy, uSize - gl_FragCoord.xy);
      float edge = min(p.x, p.y);
      if (edge < 5.0 || edge > 7.0) discard;
      gl_FragColor = vec4(1.0, 0.78, 0.36, 0.85);
    }`,
    { uSize: { value: size } },
  );
  material.transparent = true;
  return {
    name: 'contract-frame',
    order: 250,
    inPlace: true,
    render(ctx: PassContext) {
      size.set(ctx.width, ctx.height);
      ctx.fullscreen(material);
    },
  };
}

function markerPass(points: () => THREE.Vector3[]): RenderPass {
  const markers = Array.from({ length: MARKERS }, () => new THREE.Vector3());
  const material = fullscreenMaterial(
    /* glsl */ `
    uniform vec3 uMarkers[MARKERS];
    void main() {
      vec4 c = vec4(0.0);
      for (int i = 0; i < MARKERS; i++) {
        float d = length(gl_FragCoord.xy - uMarkers[i].xy);
        float ring = step(abs(d - uMarkers[i].z), 0.75);
        float shadow = step(abs(d - uMarkers[i].z - 1.0), 0.75);
        c = max(c, max(vec4(1.0, 0.96, 0.86, 1.0) * ring, vec4(0.05, 0.02, 0.06, 1.0) * shadow * (1.0 - ring)));
      }
      if (c.a == 0.0) discard;
      gl_FragColor = c;
    }`,
    { uMarkers: { value: markers } },
    { MARKERS },
  );
  material.transparent = true;
  return {
    name: 'contract-markers',
    render(ctx: PassContext) {
      const list = points();
      for (let i = 0; i < MARKERS; i++) {
        const world = list[i];
        const p = world ? ctx.project(world) : { x: -100, y: -100 };
        markers[i].set(p.x, ctx.height - p.y, 5);
      }
      ctx.fullscreen(material);
    },
  };
}

let motes: THREE.Points | null = null;
let relic: THREE.Mesh | null = null;

async function setup(ctx: SceneContext): Promise<void> {
  await hello.setup(ctx);
  const { renderer, rng } = ctx;

  const relicScene = new THREE.Scene();
  relic = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.45, 0),
    createToonMaterial({ ramp: ['#2a1606', '#7a4a12', '#d49a2a', '#ffe9a0'], emissive: '#ffb030', emissiveIntensity: 0.15 }),
  );
  relic.geometry.computeVertexNormals();
  relic.position.set(0, 1.6, 0.4);
  relicScene.add(relic);
  renderer.addPass('gbuffer', relicPass(relicScene));
  renderer.addPass('lighting', sigilPass());
  renderer.addPass('post', framePass());
  renderer.addPass('overlay', markerPass(() => renderer.lights.map(l => l.position)));

  const positions = new Float32Array(90 * 3);
  for (let i = 0; i < 90; i++) positions.set([rng.range(-5.5, 5.5), rng.range(0.2, 2.4), rng.range(-3.8, 3.8)], i * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  motes = new THREE.Points(
    geometry,
    new THREE.PointsMaterial({ color: '#ffd9a0', size: 2, sizeAttenuation: false, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }),
  );
  motes.layers.set(LAYERS.forward);
  ctx.scene.add(motes);
}

function update(ctx: SceneContext, dt: number): void {
  hello.update?.(ctx, dt);
  if (relic) relic.rotation.y = ctx.time * 0.8;
  if (motes) motes.position.y = Math.sin(ctx.time * 0.6) * 0.15;
}

export default defineScene({
  name: 'contract',
  description: 'Hello crypt plus one custom pass per render stage and a forward-layer object (reference for lanes).',
  setup,
  update,
});
