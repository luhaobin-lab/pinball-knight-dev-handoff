import type * as THREE from 'three';
import type { FxHooks, PixelRenderer } from '../render/api';
import type { Rng } from '../core/rng';

/** What a debug scene receives. `time` and `frame` advance as the router steps the scene. */
export interface SceneContext {
  readonly renderer: PixelRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.OrthographicCamera;
  readonly fx: FxHooks;
  /** Normalized uint32 seed from ?seed= (default 1). */
  readonly seed: number;
  /** Fresh stream from `seed`, for the scene's own use. */
  readonly rng: Rng;
  /** All query parameters (scene-specific options travel as extra parameters). */
  readonly params: URLSearchParams;
  /** Game time in seconds (stands still during hitstop). */
  readonly time: number;
  /** Frames rendered so far. */
  readonly frame: number;
}

/**
 * A debug scene module lives at src/debug/scenes/<name>.ts and exports either
 * `export default defineScene({ name, setup, update })` or the same members as named exports.
 * `name` must equal the file name; lanes prefix theirs: `<lane>-<what>.ts`.
 */
export interface DebugScene {
  readonly name: string;
  readonly description?: string;
  setup(ctx: SceneContext): void | Promise<void>;
  /** Called before every rendered frame with game dt (0 while paused or in hitstop). */
  update?(ctx: SceneContext, dt: number): void;
}

export function defineScene(scene: DebugScene): DebugScene {
  return scene;
}
