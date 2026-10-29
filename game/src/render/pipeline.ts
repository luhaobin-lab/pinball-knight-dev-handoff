import * as THREE from 'three';
import { DEFAULT_INTERNAL_HEIGHT, DEFAULT_VIEW_HEIGHT, GBUFFER, LAYERS, MAX_LIGHTS } from './constants';
import { snapCamera, type SnapResult } from './camera';
import { Fullscreen } from './fullscreen';
import { Fx } from './fx';
import { LightStore } from './lights';
import { TOON_TIME } from './toon';
import { createForwardPass, createScenePass } from './passes/scene';
import { createResolvePass } from './passes/resolve';
import { createOutlinePass } from './passes/outline';
import { createBloomPass } from './passes/bloom';
import { createGradePass } from './passes/grade';
import { createFxPass } from './passes/fxpass';
import { Present } from './passes/present';
import type {
  FrameTargets,
  GBuffer,
  InternalSize,
  LightingSettings,
  PassContext,
  PixelRenderer,
  ProjectedPoint,
  RendererOptions,
  RenderPass,
  RenderStats,
  Stage,
} from './api';

const STAGES: readonly Stage[] = ['gbuffer', 'lighting', 'post', 'overlay'];

function colorTarget(depthBuffer = false): THREE.WebGLRenderTarget {
  return new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    generateMipmaps: false,
    depthBuffer,
  });
}

type MutableContext = { -readonly [K in keyof PassContext]: PassContext[K] };

/**
 * Low-resolution deferred toon pipeline (README.md): G-buffer → lighting → post → overlay →
 * integer upscale with sub-pixel camera compensation and screen shake.
 */
export function createRenderer(canvas: HTMLCanvasElement, options: RendererOptions = {}): PixelRenderer {
  const quality = options.quality ?? 'high';
  const internalHeight = options.internalHeight ?? DEFAULT_INTERNAL_HEIGHT;
  const gl = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    depth: false,
    stencil: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: options.preserveDrawingBuffer ?? false,
  });
  gl.setPixelRatio(1);
  gl.autoClear = false;
  gl.info.autoReset = false;
  gl.outputColorSpace = THREE.SRGBColorSpace;
  gl.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  // World matrices are updated once per frame in render(), not again by every internal draw call.
  scene.matrixWorldAutoUpdate = false;
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  camera.position.set(20, 20, 20);
  camera.lookAt(0, 0, 0);

  const gbufferTarget = new THREE.WebGLRenderTarget(1, 1, {
    count: 3,
    type: THREE.HalfFloatType,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    generateMipmaps: false,
    depthBuffer: true,
  });
  gbufferTarget.depthTexture = new THREE.DepthTexture(1, 1);
  const surface = gbufferTarget.textures[GBUFFER.surface];
  const normal = gbufferTarget.textures[GBUFFER.normal];
  const emissive = gbufferTarget.textures[GBUFFER.emissive];
  surface.name = 'gbuffer.surface';
  normal.name = 'gbuffer.normal';
  emissive.name = 'gbuffer.emissive';
  const gbuffer: GBuffer = { target: gbufferTarget, surface, normal, emissive, depth: gbufferTarget.depthTexture };
  const targets: FrameTargets = { irradiance: colorTarget(), lit: colorTarget(true), overlay: colorTarget() };
  const post = [colorTarget(), colorTarget()];

  const lights = new LightStore(MAX_LIGHTS[quality]);
  const fx = new Fx();
  const lighting: LightingSettings = {
    ambientSky: new THREE.Color('#9fb2c4'),
    ambientGround: new THREE.Color('#3a3540'),
    ambientIntensity: 0.45,
    keyDirection: new THREE.Vector3(0.45, 1, 0.3),
    keyColor: new THREE.Color('#fff3e0'),
    keyIntensity: 0.55,
    exposure: 1,
    tint: 0.5,
    background: new THREE.Color('#0a090e'),
  };

  const quad = new Fullscreen();
  const present = new Present();
  const snap: SnapResult = { originX: 0, originY: 0, fracX: 0, fracY: 0 };
  const trueCameraPosition = new THREE.Vector3();
  const projected = new THREE.Vector3();
  const worldLayer = new THREE.Layers();
  worldLayer.set(LAYERS.world);

  const size = { width: 1, height: 1, scale: 1, outputWidth: 1, outputHeight: 1 };
  let pixelRatio = 1;
  let time = 0;
  let frame = 0;

  const project = (world: THREE.Vector3Like): ProjectedPoint => {
    projected.set(world.x, world.y, world.z).project(camera);
    return { x: (projected.x * 0.5 + 0.5) * size.width, y: (0.5 - projected.y * 0.5) * size.height, depth: projected.z };
  };

  // Inverse of the present mapping: the internal image is centred on the output and scaled by `scale`.
  const projectToScreen = (world: THREE.Vector3Like): ProjectedPoint => {
    const p = project(world);
    return {
      x: ((p.x - size.width / 2) * size.scale + size.outputWidth / 2) / pixelRatio,
      y: ((p.y - size.height / 2) * size.scale + size.outputHeight / 2) / pixelRatio,
      depth: p.depth,
    };
  };

  const ctx: MutableContext = {
    gl,
    scene,
    camera,
    stage: 'gbuffer',
    gbuffer,
    targets,
    target: gbufferTarget,
    input: null,
    width: 1,
    height: 1,
    time: 0,
    dt: 0,
    frame: 0,
    lighting,
    fx: fx.state,
    debugView: 'final',
    pixelOrigin: { x: 0, y: 0 },
    fullscreen: (material, target) => quad.draw(gl, material, target ?? ctx.target),
    project,
  };

  const registry: Record<Stage, RenderPass[]> = { gbuffer: [], lighting: [], post: [], overlay: [] };

  const getPass = (name: string): RenderPass | undefined => {
    for (const stage of STAGES) {
      const found = registry[stage].find(p => p.name === name);
      if (found) return found;
    }
    return undefined;
  };

  const removePass = (pass: RenderPass): void => {
    for (const stage of STAGES) {
      const list = registry[stage];
      const i = list.indexOf(pass);
      if (i >= 0) list.splice(i, 1);
    }
  };

  const addPass = (stage: Stage, pass: RenderPass): (() => void) => {
    if (getPass(pass.name)) throw new Error(`render pass "${pass.name}" is already registered`);
    const list = registry[stage];
    list.push(pass);
    list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    pass.setSize?.(size.width, size.height);
    return () => removePass(pass);
  };

  const clear = (target: THREE.WebGLRenderTarget, depth: boolean): void => {
    gl.setRenderTarget(target);
    gl.setClearColor(0x000000, 0);
    gl.clear(true, depth, false);
  };

  const run = (stage: Stage, pass: RenderPass, target: THREE.WebGLRenderTarget, input: THREE.Texture | null): void => {
    ctx.stage = stage;
    ctx.target = target;
    ctx.input = input;
    gl.setRenderTarget(target);
    pass.render(ctx);
  };

  const resize = (cssWidth?: number, cssHeight?: number): void => {
    pixelRatio = options.pixelRatio ?? window.devicePixelRatio ?? 1;
    const cw = cssWidth ?? (canvas.clientWidth || window.innerWidth);
    const ch = cssHeight ?? (canvas.clientHeight || window.innerHeight);
    const outputWidth = Math.max(1, Math.round(cw * pixelRatio));
    const outputHeight = Math.max(1, Math.round(ch * pixelRatio));
    const scale = options.pixelScale ?? Math.max(1, Math.round(Math.min(outputWidth, outputHeight) / internalHeight));
    const width = Math.ceil(outputWidth / scale);
    const height = Math.ceil(outputHeight / scale);
    if (outputWidth !== size.outputWidth || outputHeight !== size.outputHeight) gl.setSize(outputWidth, outputHeight, false);
    const internalChanged = width !== size.width || height !== size.height;
    Object.assign(size, { width, height, scale, outputWidth, outputHeight });
    ctx.width = width;
    ctx.height = height;
    if (!internalChanged) return;
    gbufferTarget.setSize(width, height);
    for (const t of [targets.irradiance, targets.lit, targets.overlay, ...post]) t.setSize(width, height);
    for (const stage of STAGES) for (const pass of registry[stage]) pass.setSize?.(width, height);
  };

  const render = (dt: number): void => {
    time += dt;
    frame++;
    TOON_TIME.value = time;
    ctx.time = time;
    ctx.dt = dt;
    ctx.frame = frame;
    ctx.debugView = renderer.debugView;
    gl.info.reset();

    // scene.background would be drawn by every internal render call; the resolve owns the background.
    const background = scene.background;
    scene.background = null;
    scene.updateMatrixWorld();
    trueCameraPosition.copy(camera.position);
    snapCamera(camera, size.width, size.height, renderer.viewHeight, renderer.pixelSnap, snap);
    ctx.pixelOrigin = { x: snap.originX, y: snap.originY };
    lights.update(time, camera);
    fx.update(dt, time, size.width, size.height, project);

    clear(gbufferTarget, true);
    for (const pass of registry.gbuffer) if (pass.enabled !== false) run('gbuffer', pass, gbufferTarget, null);

    clear(targets.irradiance, false);
    for (const pass of registry.lighting) {
      if (pass.enabled === false) continue;
      run('lighting', pass, (pass.order ?? 0) < 0 ? targets.irradiance : targets.lit, null);
    }

    let current = targets.lit;
    for (const pass of registry.post) {
      if (pass.enabled === false) continue;
      if (pass.inPlace) {
        run('post', pass, current, null);
        continue;
      }
      const next = current === post[0] ? post[1] : post[0];
      run('post', pass, next, current.texture);
      current = next;
    }

    clear(targets.overlay, false);
    for (const pass of registry.overlay) if (pass.enabled !== false) run('overlay', pass, targets.overlay, null);

    const s = fx.state;
    const view = renderer.debugView;
    const shown = view === 'lit' || view === 'light' ? targets.lit.texture : view === 'irradiance' ? targets.irradiance.texture : current.texture;
    present.set(view, shown, targets.overlay.texture, gbuffer, camera.far - camera.near, size, snap.fracX + s.shakeX, snap.fracY + s.shakeY, s.roll);
    quad.draw(gl, present.material, null);
    fx.endFrame();

    camera.position.copy(trueCameraPosition);
    camera.updateMatrixWorld();
    scene.background = background;
  };

  const stats = (): RenderStats => {
    let passes = 0;
    for (const stage of STAGES) for (const pass of registry[stage]) if (pass.enabled !== false) passes++;
    return {
      frame,
      calls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      points: gl.info.render.points,
      lines: gl.info.render.lines,
      lights: lights.total,
      lightsVisible: lights.count,
      passes,
      internal: { width: size.width, height: size.height, scale: size.scale },
      output: { width: size.outputWidth, height: size.outputHeight },
    };
  };

  const validate = (): string[] => {
    const problems: string[] = [];
    if (scene.background) problems.push('scene.background is ignored; set renderer.lighting.background instead');
    scene.traverse(object => {
      if (!object.layers.test(worldLayer)) return;
      const label = `${object.type} "${object.name || object.uuid.slice(0, 8)}"`;
      const o = object as THREE.Mesh & THREE.Points & THREE.Line & THREE.Sprite;
      if (o.isPoints || o.isLine || o.isSprite) {
        problems.push(`${label} is on the world layer; points, lines and sprites belong on LAYERS.forward`);
      } else if (o.isMesh) {
        const materials = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of materials) {
          if (!m.userData.gbuffer) problems.push(`${label} uses ${m.type}, which does not write the G-buffer; use createToonMaterial or LAYERS.forward`);
        }
      }
    });
    return problems;
  };

  const renderer: PixelRenderer = {
    gl,
    canvas,
    scene,
    camera,
    get internal(): InternalSize {
      return size;
    },
    viewHeight: options.viewHeight ?? DEFAULT_VIEW_HEIGHT,
    pixelSnap: true,
    debugView: 'final',
    lighting,
    fx,
    gbuffer,
    targets,
    get time() {
      return time;
    },
    get frame() {
      return frame;
    },
    quality,
    addPass,
    removePass,
    getPass,
    passes: stage => registry[stage],
    addPointLight: o => lights.add(o),
    removeLight: l => lights.remove(l),
    get lights() {
      return lights.list;
    },
    render,
    resize,
    project,
    projectToScreen,
    stats,
    validate,
    dispose() {
      for (const stage of STAGES) for (const pass of registry[stage]) pass.dispose?.();
      for (const t of [gbufferTarget, targets.irradiance, targets.lit, targets.overlay, ...post]) t.dispose();
      present.dispose();
      gl.dispose();
    },
  };

  addPass('gbuffer', createScenePass());
  addPass('lighting', createResolvePass(lights));
  addPass('lighting', createForwardPass());
  addPass('post', createOutlinePass());
  addPass('post', createBloomPass());
  addPass('post', createGradePass());
  addPass('post', createFxPass(() => fx.settings.flash));
  resize();
  return renderer;
}
