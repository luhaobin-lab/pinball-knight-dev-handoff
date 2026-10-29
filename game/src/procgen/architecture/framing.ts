import * as THREE from 'three';
import type { PixelRenderer } from '../../render/api';
import { K_OBLIQUE } from './walls';
import { PPT } from '../../render/density';

/**
 * Cameras for looking at rooms (art bible §13.1, §13.6), until the render core owns them:
 * - `oblique`: the Demo's cabinet projection. Floor tiles are square at 16 px, heights are foreshortened
 *   by k = 0.625 (10 px per tile). Built as an orthographic camera pitched to 58° whose projection is
 *   stretched vertically by √(1 + k²), which is exactly x_s = 16x, y_s = 16(z − k·y).
 * - `iso`: the 45° beauty camera, 2:1 dimetric (elevation 30°), a tile is a 28×14-px diamond.
 */

export const TILE_PX = PPT;
const STRETCH = Math.sqrt(1 + K_OBLIQUE * K_OBLIQUE);
const VIEW_DIR = new THREE.Vector3(0, 1, K_OBLIQUE).normalize();

type ProjectionOverride = THREE.OrthographicCamera & { __obliqueBase?: () => void };

function setStretch(camera: THREE.OrthographicCamera, stretch: number): void {
  const cam = camera as ProjectionOverride;
  if (!cam.__obliqueBase) cam.__obliqueBase = THREE.OrthographicCamera.prototype.updateProjectionMatrix;
  const base = cam.__obliqueBase;
  cam.updateProjectionMatrix = function (this: THREE.OrthographicCamera) {
    base.call(this);
    if (stretch !== 1) {
      const e = this.projectionMatrix.elements;
      e[1] *= stretch;
      e[5] *= stretch;
      e[9] *= stretch;
      e[13] *= stretch;
      this.projectionMatrixInverse.copy(this.projectionMatrix).invert();
    }
  };
  camera.updateProjectionMatrix();
}

/**
 * Points the renderer's camera at world (x, z) on the floor with the Demo projection. (x, z) are rounded
 * to whole floor pixels so tile edges land on pixel edges; pixel snapping is turned off because the
 * stretched projection is already aligned (the renderer's snap assumes square view-plane pixels).
 */
export function obliqueCamera(renderer: PixelRenderer, x: number, z: number): void {
  const cam = renderer.camera;
  const tx = Math.round(x * TILE_PX) / TILE_PX;
  const tz = Math.round(z * TILE_PX) / TILE_PX;
  cam.up.set(0, 1, 0);
  cam.position.set(tx, 0, tz).addScaledVector(VIEW_DIR, 120);
  cam.lookAt(tx, 0, tz);
  cam.zoom = 1;
  renderer.viewHeight = renderer.internal.height / TILE_PX;
  renderer.pixelSnap = false;
  setStretch(cam, STRETCH);
}

/** The camera target that puts world (x, z) of the floor at internal pixel (px, py) (top-left origin). */
export function obliqueTargetFor(renderer: PixelRenderer, x: number, z: number, px: number, py: number): { x: number; z: number } {
  return { x: x - (px - renderer.internal.width / 2) / TILE_PX, z: z - (py - renderer.internal.height / 2) / TILE_PX };
}

/** Where a world point lands in internal pixels under the oblique camera targeted at (tx, tz). */
export function obliqueProject(renderer: PixelRenderer, tx: number, tz: number, p: THREE.Vector3Like): { x: number; y: number } {
  return {
    x: renderer.internal.width / 2 + (p.x - tx) * TILE_PX,
    y: renderer.internal.height / 2 + (p.z - K_OBLIQUE * p.y - tz) * TILE_PX,
  };
}

/** 2:1 dimetric beauty camera looking at `centre` from the south-east (yaw 45°, elevation 30°). */
export function isoCamera(renderer: PixelRenderer, centre: THREE.Vector3, tilePx = 28, yawDeg = 45): void {
  const cam = renderer.camera;
  setStretch(cam, 1);
  const yaw = THREE.MathUtils.degToRad(yawDeg);
  const el = THREE.MathUtils.degToRad(30);
  const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(el), Math.sin(el), Math.cos(yaw) * Math.cos(el));
  cam.up.set(0, 1, 0);
  cam.position.copy(centre).addScaledVector(dir, 120);
  cam.lookAt(centre);
  cam.zoom = 1;
  // a tile's diagonal spans `tilePx` pixels: one world unit is tilePx / √2 pixels
  renderer.viewHeight = renderer.internal.height / (tilePx / Math.SQRT2);
  renderer.pixelSnap = true;
}
