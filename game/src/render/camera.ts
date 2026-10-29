import * as THREE from 'three';

export interface SnapResult {
  /** Snapped camera position in whole internal pixels along the camera's right/up axes. */
  originX: number;
  originY: number;
  /** Remainder in internal pixels (true position minus snapped), in [-0.5, 0.5]. */
  fracX: number;
  fracY: number;
}

const right = new THREE.Vector3();
const up = new THREE.Vector3();

/**
 * Sets the orthographic frustum from `viewHeight` and the internal aspect, then (if `snap`)
 * moves the camera onto the internal pixel grid of its own view plane. Static geometry then
 * rasterizes identically every frame; the present pass shifts by the remainder for smooth motion.
 * Writes the snapped state to `out`; the caller restores the true camera position afterwards.
 */
export function snapCamera(camera: THREE.OrthographicCamera, width: number, height: number, viewHeight: number, snap: boolean, out: SnapResult): void {
  const halfH = viewHeight / 2;
  const halfW = (halfH * width) / height;
  camera.left = -halfW;
  camera.right = halfW;
  camera.top = halfH;
  camera.bottom = -halfH;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  const unit = viewHeight / camera.zoom / height;
  right.setFromMatrixColumn(camera.matrixWorld, 0).normalize();
  up.setFromMatrixColumn(camera.matrixWorld, 1).normalize();
  const px = camera.position.dot(right) / unit;
  const py = camera.position.dot(up) / unit;
  out.originX = Math.round(px);
  out.originY = Math.round(py);
  out.fracX = snap ? px - out.originX : 0;
  out.fracY = snap ? py - out.originY : 0;
  if (snap) {
    camera.position.addScaledVector(right, -out.fracX * unit).addScaledVector(up, -out.fracY * unit);
    camera.updateMatrixWorld();
  }
}
