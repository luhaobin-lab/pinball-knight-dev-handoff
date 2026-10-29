import type { InternalSize } from '../render/api';

/** A client rect (CSS px), e.g. the game canvas's getBoundingClientRect(). */
export interface ClientRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Client (CSS) coordinates → internal pixels (top-left origin): the canvas holds the output, which shows the
 * internal grid upscaled by `scale` and centred.
 */
export function clientToInternal(clientX: number, clientY: number, rect: ClientRect, internal: InternalSize): { x: number; y: number } {
  const ox = ((clientX - rect.left) / Math.max(1, rect.width)) * internal.outputWidth;
  const oy = ((clientY - rect.top) / Math.max(1, rect.height)) * internal.outputHeight;
  return { x: (ox - internal.outputWidth / 2) / internal.scale + internal.width / 2, y: (oy - internal.outputHeight / 2) / internal.scale + internal.height / 2 };
}

/** The oblique camera's view of the floor: the floor point (tiles) at the internal centre, and pixels per tile. */
export interface FloorView {
  readonly target: { readonly x: number; readonly z: number };
  readonly ppt: number;
}

/**
 * The floor point (tiles, y = 0) under an internal pixel. The oblique projection keeps floor tiles square
 * (x_s = ppt·(x − tx), y_s = ppt·(z − tz) on the floor; src/procgen/architecture/framing.ts).
 */
export function internalToFloor(p: { x: number; y: number }, internal: InternalSize, view: FloorView): { x: number; z: number } {
  return { x: view.target.x + (p.x - internal.width / 2) / view.ppt, z: view.target.z + (p.y - internal.height / 2) / view.ppt };
}
