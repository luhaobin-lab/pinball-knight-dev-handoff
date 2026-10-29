/**
 * Public render API. Every lane builds against this file; it is owned by the integrator.
 * Implementations live in the other files of src/render and may change freely as long as
 * they keep satisfying these types and the contract in README.md.
 */
import type * as THREE from 'three';

export { createRenderer } from './pipeline';
export { createToonMaterial, TOON_TIME, TOON_GBUFFER_GLSL } from './toon';
export { fullscreenMaterial, FULLSCREEN_VERTEX } from './fullscreen';
export { registerRamp, type RampParams } from './ramps';
export { blueNoiseTexture } from './bluenoise';
export {
  LAYERS,
  GBUFFER,
  SURFACE_FLAGS,
  PASS_ORDER,
  RAMP_MAX_COLORS,
  MAX_RAMPS,
  MAX_LIGHTS,
  DEFAULT_INTERNAL_HEIGHT,
  DEFAULT_VIEW_HEIGHT,
} from './constants';

/** A colour: '#rrggbb' or 0xrrggbb (sRGB), any CSS colour string, or a THREE.Color (linear). */
export type Hex = THREE.ColorRepresentation;

export type Stage = 'gbuffer' | 'lighting' | 'post' | 'overlay';

export type Quality = 'high' | 'medium' | 'low';

/**
 * What the canvas shows: 'final' (default) or one buffer for debugging. 'light' is the resolve's
 * light value before the ramp (grey up to 1, warm above); 'ramp' colours each ramp id.
 */
export type DebugView = 'final' | 'lit' | 'light' | 'irradiance' | 'surface' | 'ramp' | 'normal' | 'emissive' | 'depth' | 'overlay';

export interface RendererOptions {
  /** Internal height the integer upscale aims for (default 360, i.e. 640×360 at 16:9). */
  internalHeight?: number;
  /** Force the integer upscale factor instead of deriving it from `internalHeight`. */
  pixelScale?: number;
  /** Output device pixel ratio (default `window.devicePixelRatio`). */
  pixelRatio?: number;
  /** Light budget and effect quality (default 'high'). */
  quality?: Quality;
  /** World units visible across the internal height (default 10). */
  viewHeight?: number;
  /** Keep the drawing buffer after presenting (needed for canvas readback). */
  preserveDrawingBuffer?: boolean;
}

export interface InternalSize {
  /** Internal render width in pixels. */
  readonly width: number;
  /** Internal render height in pixels. */
  readonly height: number;
  /** Integer upscale factor from internal pixels to output pixels. */
  readonly scale: number;
  readonly outputWidth: number;
  readonly outputHeight: number;
}

/** G-buffer at internal resolution. Layout: README.md "G-buffer". */
export interface GBuffer {
  /** MRT target: textures[GBUFFER.surface | normal | emissive] plus `depth`. */
  readonly target: THREE.WebGLRenderTarget;
  /** rgb = albedo tint (linear), a = ramp id. */
  readonly surface: THREE.Texture;
  /** rgb = world-space unit normal, a = ramp shift in bands. */
  readonly normal: THREE.Texture;
  /** rgb = emissive radiance (linear HDR), a = SURFACE_FLAGS bits. */
  readonly emissive: THREE.Texture;
  /** Hardware depth in [0, 1]; orthographic, so linear between near and far. */
  readonly depth: THREE.DepthTexture;
}

export interface FrameTargets {
  /** Additive diffuse irradiance written by lighting passes with order < 0 (GI). Cleared every frame. */
  readonly irradiance: THREE.WebGLRenderTarget;
  /** HDR scene colour after the resolve; holds a copy of the G-buffer depth for forward rendering. */
  readonly lit: THREE.WebGLRenderTarget;
  /** World-anchored clean layer (premultiplied alpha), composited after all colour effects. */
  readonly overlay: THREE.WebGLRenderTarget;
}

export interface PassContext {
  readonly gl: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  /** The pixel-snapped camera this frame is rendered with (matrices are current). */
  readonly camera: THREE.OrthographicCamera;
  readonly stage: Stage;
  readonly gbuffer: GBuffer;
  readonly targets: FrameTargets;
  /** Where this pass must draw. Already bound; never cleared for you except where README says so. */
  readonly target: THREE.WebGLRenderTarget;
  /** Post stage: the current colour to read. `null` in other stages and for in-place passes. */
  readonly input: THREE.Texture | null;
  readonly width: number;
  readonly height: number;
  /** Render clock in seconds (advanced by `render(dt)`). */
  readonly time: number;
  readonly dt: number;
  readonly frame: number;
  readonly lighting: LightingSettings;
  readonly fx: FxState;
  /** The active debug view; passes may render their own debug output for it. */
  readonly debugView: DebugView;
  /**
   * The snapped camera position in whole internal pixels (x right, y up). Add it to
   * gl_FragCoord.xy for screen-space patterns (dither, grain) that stay locked to the world when the camera pans.
   */
  readonly pixelOrigin: { readonly x: number; readonly y: number };
  /** Draws `material` with a fullscreen triangle into `target` (default: ctx.target). */
  fullscreen(material: THREE.Material, target?: THREE.WebGLRenderTarget): void;
  /** World position → internal pixel coordinates (top-left origin) and NDC depth. */
  project(world: THREE.Vector3Like): ProjectedPoint;
}

export interface ProjectedPoint {
  x: number;
  y: number;
  /** NDC depth in [-1, 1]; outside means clipped. */
  depth: number;
}

export interface RenderPass {
  /** Unique name; `getPass(name)` finds it. */
  readonly name: string;
  /** Sort key inside the stage (ascending, default 0). Built-in orders: PASS_ORDER. */
  order?: number;
  /** Skipped while false (default true). */
  enabled?: boolean;
  /**
   * Post stage only. false/undefined: read `ctx.input`, write all of `ctx.target`; the chain swaps.
   * true: blend on top of the current colour in place (ctx.target is the current colour target,
   * which therefore cannot be sampled: ctx.input is null).
   */
  inPlace?: boolean;
  /** Called on registration and whenever the internal size changes. */
  setSize?(width: number, height: number): void;
  render(ctx: PassContext): void;
  dispose?(): void;
}

export interface PointLightOptions {
  /** World position, or the local offset when `follow` is set. */
  position?: THREE.Vector3Like;
  /** The light follows this object's world transform (e.g. the candle on the hero's head). */
  follow?: THREE.Object3D;
  color?: Hex;
  /** Peak light added at the centre, in ramp units (1 ≈ lifts a surface to its brightest band). */
  intensity?: number;
  /** World distance at which the light reaches zero. */
  radius?: number;
  /** 0..1 candle flicker of intensity and radius. */
  flicker?: number;
  /** Flicker phase seed (default: the light id). */
  seed?: number;
}

export interface PointLight {
  readonly id: number;
  /** World position, or local offset when following an object. Mutable. */
  readonly position: THREE.Vector3;
  readonly color: THREE.Color;
  intensity: number;
  radius: number;
  flicker: number;
  seed: number;
  follow: THREE.Object3D | null;
  enabled: boolean;
}

/** Global lighting terms of the deferred resolve. Mutable; read every frame. */
export interface LightingSettings {
  /** Hemisphere ambient: colour from above (normal.y = 1) and below (normal.y = -1). */
  readonly ambientSky: THREE.Color;
  readonly ambientGround: THREE.Color;
  ambientIntensity: number;
  /** Direction *towards* the key light (normalized each frame). */
  readonly keyDirection: THREE.Vector3;
  readonly keyColor: THREE.Color;
  keyIntensity: number;
  /** Multiplies the light value before the ramp lookup. */
  exposure: number;
  /** 0..1: how strongly the light colour tints the ramp colour. */
  tint: number;
  /** Colour of pixels with no geometry. */
  readonly background: THREE.Color;
}

export type ImpactKind = 'invert' | 'silhouette' | 'white';

export interface ImpactOptions {
  /** Frames the impact frame is shown (default 2). */
  frames?: number;
  /** World point the speed lines radiate from (default: screen centre). */
  focus?: THREE.Vector3Like;
}

export interface FlashOptions {
  /** Peak mix towards the flash colour, 0..1 (default 0.7). */
  intensity?: number;
  /** Fade-out duration in milliseconds (default 120). */
  ms?: number;
}

/**
 * The Demo's camera shakes (README.md "Camera shakes"): 'bounce' is 摄像机晃动_零点六 at outer radius 520 (every
 * bounce), 'damage' 摄像机晃动_零点二 at 550 (every damage instance), 'crit' 摄像机晃动_零点二 at 750 (a critical one).
 */
export type CameraShakeKind = 'bounce' | 'damage' | 'crit';

/** One running Demo camera shake, as of the last rendered frame. */
export interface CameraShakeReading {
  /** The Demo shake class: '摄像机晃动_零点六' or '摄像机晃动_零点二'. */
  readonly shake: string;
  /** The kind that started or last restarted it. */
  readonly kind: CameraShakeKind;
  /** Blend weight, 0..1. */
  readonly weight: number;
  /** Camera offset in uu (x right, y up) after the radial scale and the blend weight, before snapping. */
  readonly x: number;
  readonly y: number;
  /** Shake seconds since it started or last restarted. */
  readonly elapsed: number;
}

/** Hit-feel hooks. Simple working implementations; the VFX lane layers richer effects on top. */
export interface FxHooks {
  /**
   * Plays one of the Demo's camera shakes. One running instance per Demo class: a new play restarts it ('damage'
   * and 'crit' share 摄像机晃动_零点二); different classes add up. Location only (no roll); the summed offset is
   * snapped to whole internal pixels.
   */
  cameraShake(kind: CameraShakeKind): void;
  /**
   * Shake-time scale: the game passes the hit-stop dilation every frame (its game dt over the real dt), so the
   * Demo shakes tick in dilated time like the Demo's camera manager. Default 1; it stays until changed.
   */
  shakeTime(scale: number): void;
  /** Reseeds the noise offsets drawn when a Demo shake starts fresh (default seed 1; the sequence is deterministic). */
  shakeSeed(seed: number): void;
  /**
   * Adds trauma (0..1, accumulates, decays); shake = trauma², translation + roll, optional direction bias.
   * The prototype's shake, kept for other scenes; the Demo's shakes are `cameraShake`.
   */
  shake(trauma: number, direction?: { x: number; y: number }): void;
  /** Freezes game time for `ms` milliseconds (longest request wins). */
  hitstop(ms: number): void;
  /** Shows 1–2 flat two-tone frames with radial speed lines. */
  impactFrame(kind: ImpactKind, options?: ImpactOptions): void;
  /** Chromatic split pulse, 0..1 (decays quickly). */
  chroma(amount: number): void;
  /** Full-screen colour flash that fades out. */
  flash(color: Hex, options?: FlashOptions): void;
  /** Game-time multiplier: 0 during hitstop, else 1. Multiply simulation dt by it. */
  readonly timeScale: number;
  /** Accessibility scales, 0..1: shake amplitude; flash, chroma and impact-frame strength. */
  readonly settings: { shake: number; flash: number };
  readonly state: FxState;
}

/** Per-frame fx values read by passes. */
export interface FxState {
  readonly trauma: number;
  /**
   * Screen shake translation in internal pixels (x right, y up): the camera's offset, so the image moves the other
   * way. The Demo shakes' snapped sum plus the trauma shake.
   */
  readonly shakeX: number;
  readonly shakeY: number;
  /** Screen shake roll in radians (trauma shake only). */
  readonly roll: number;
  /** The Demo camera shakes running this frame. */
  readonly cameraShakes: readonly CameraShakeReading[];
  readonly chroma: number;
  readonly flashColor: THREE.Color;
  readonly flashAmount: number;
  /** Active impact frame kind, or null. */
  readonly impact: ImpactKind | null;
  /** Impact focus in internal pixels (top-left origin). */
  readonly impactX: number;
  readonly impactY: number;
  /** Seconds of hitstop left. */
  readonly hitstop: number;
}

export interface RenderStats {
  frame: number;
  calls: number;
  triangles: number;
  points: number;
  lines: number;
  lights: number;
  lightsVisible: number;
  passes: number;
  internal: { width: number; height: number; scale: number };
  output: { width: number; height: number };
}

export interface PixelRenderer {
  readonly gl: THREE.WebGLRenderer;
  readonly canvas: HTMLCanvasElement;
  /** Scene graph. Do not set scene.background; use lighting.background. */
  readonly scene: THREE.Scene;
  /**
   * Orthographic camera. Move/rotate/zoom it freely (keep it unparented); the renderer owns its
   * frustum (from `viewHeight` and the internal aspect) and snaps it to the pixel grid per frame.
   */
  readonly camera: THREE.OrthographicCamera;
  readonly internal: InternalSize;
  /** World units across the internal height (divided by camera.zoom). */
  viewHeight: number;
  /** Snap the camera to whole internal pixels and compensate the remainder when presenting (default true). */
  pixelSnap: boolean;
  /** What the canvas shows (default 'final'). */
  debugView: DebugView;
  readonly lighting: LightingSettings;
  readonly fx: FxHooks;
  readonly gbuffer: GBuffer;
  readonly targets: FrameTargets;
  readonly time: number;
  readonly frame: number;
  readonly quality: Quality;
  /** Registers a pass; returns a function that removes it. */
  addPass(stage: Stage, pass: RenderPass): () => void;
  removePass(pass: RenderPass): void;
  getPass(name: string): RenderPass | undefined;
  passes(stage: Stage): readonly RenderPass[];
  addPointLight(options?: PointLightOptions): PointLight;
  removeLight(light: PointLight): void;
  readonly lights: readonly PointLight[];
  /** Advances render time by `dt` seconds (fx decay, flicker) and renders + presents one frame. */
  render(dt: number): void;
  /** Re-reads the canvas size (or uses the given CSS size) and reallocates targets if needed. */
  resize(cssWidth?: number, cssHeight?: number): void;
  /**
   * World position → internal pixel coordinates (top-left origin) of where it appears on screen,
   * using the true (unsnapped) camera. Inside passes use ctx.project, which matches the snapped grid
   * of the internal targets.
   */
  project(world: THREE.Vector3Like): ProjectedPoint;
  /** World position → CSS pixels relative to the canvas's top-left corner (for DOM elements; ignores shake). */
  projectToScreen(world: THREE.Vector3Like): ProjectedPoint;
  stats(): RenderStats;
  /** Lists scene problems (e.g. meshes on the world layer without a G-buffer material). */
  validate(): string[];
  dispose(): void;
}

export interface ToonShaderHooks {
  /** Extra uniforms (merged into the material's uniforms). */
  uniforms?: Record<string, THREE.IUniform>;
  /** GLSL at vertex global scope. */
  vertexPars?: string;
  /** GLSL in vertex main after skinning, before projection; may modify `vec3 transformed` (object space). */
  vertex?: string;
  /** GLSL at fragment global scope. */
  fragmentPars?: string;
  /**
   * GLSL in fragment main before the G-buffer write. May modify:
   * `vec3 albedo`, `float rampShift`, `vec3 emissive`, `vec3 normalW`, `float flags`.
   * May read: `vToonWorld` (world position), `vToonUv`, `uTime`.
   */
  fragment?: string;
}

export interface ToonMaterialOptions {
  /** Palette ramp from deepest shadow to brightest light, 2..6 sRGB colours. */
  ramp: readonly Hex[];
  /** Emissive colour added after lighting (unaffected by light). */
  emissive?: Hex;
  /** HDR multiplier for `emissive` (default 1). Values > 1 bloom. */
  emissiveIntensity?: number;
  /** Blue-noise dithered band edges: true = 0.35 bands wide, a number = width in bands (0..1). */
  dither?: boolean | number;
  /** Multiplies the ramp colour (default white). */
  tint?: Hex;
  /** Use the geometry's `color` attribute as tint. */
  vertexColors?: boolean;
  /** sRGB texture multiplied into the tint (uv channel 0). */
  map?: THREE.Texture;
  /** Discard fragments whose tint alpha is below this. */
  alphaTest?: number;
  /** Draw outline and crease highlights (default true). */
  outline?: boolean;
  /** Skip lighting: albedo × brightest ramp colour + emissive. */
  unlit?: boolean;
  /** Light-to-ramp curve exponent (default 0.8; < 1 lifts mid tones). */
  curve?: number;
  /** How much light above 1 brightens the top band (default 0.35). */
  overbright?: number;
  side?: THREE.Side;
  hooks?: ToonShaderHooks;
}

/** A ShaderMaterial that writes the G-buffer contract. */
export interface ToonMaterial extends THREE.ShaderMaterial {
  readonly isToonMaterial: true;
  /** Row of this material's ramp in the shared ramp atlas. */
  readonly rampId: number;
  /** Replaces the ramp (registers a new atlas row if needed). */
  setRamp(ramp: readonly Hex[]): void;
  /** 0..1 white hit flash (per material instance). */
  flash: number;
}
