import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createToonMaterial, LAYERS, type ToonMaterial } from '../../render/api';
import type { Ramp } from '../architecture/palette';
import { K_OBLIQUE } from '../architecture/walls';

/**
 * Shape kit for the cast: readable primitives (spheres, lathes, tapered tubes, sphere patches) and the
 * "stand" transform that keeps characters legible under the Demo's oblique camera.
 */

export function roundedBox(w: number, h: number, d: number, r: number, segments = 2): THREE.BufferGeometry {
  return new RoundedBoxGeometry(w, h, d, segments, Math.min(r, w / 2, h / 2, d / 2));
}

/** Lathe through a Catmull-Rom spline of [radius, height] points, bottom to top. */
export function smoothLathe(profile: [number, number][], samples = 16, segments = 20): THREE.BufferGeometry {
  const curve = new THREE.SplineCurve(profile.map(([r, y]) => new THREE.Vector2(r, y)));
  return new THREE.LatheGeometry(
    curve.getPoints(samples).map(p => new THREE.Vector2(Math.max(p.x, 0.0001), p.y)),
    segments,
  );
}

/** Tube along a curve with a radius that varies from start to end (horns, tails). Outward winding. */
export function taperTube(curve: THREE.Curve<THREE.Vector3>, radius: (t: number) => number, tubular = 16, radial = 10): THREE.BufferGeometry {
  const frames = curve.computeFrenetFrames(tubular, false);
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular;
    curve.getPointAt(t, p);
    const r = radius(t);
    for (let j = 0; j <= radial; j++) {
      const a = (j / radial) * Math.PI * 2;
      n.copy(frames.normals[i]).multiplyScalar(Math.cos(a)).addScaledVector(frames.binormals[i], Math.sin(a)).normalize();
      positions.push(p.x + n.x * r, p.y + n.y * r, p.z + n.z * r);
      normals.push(n.x, n.y, n.z);
    }
  }
  for (let i = 0; i < tubular; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = (i + 1) * (radial + 1) + j;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const capStart = positions.length / 3;
  curve.getPointAt(0, p);
  positions.push(p.x, p.y, p.z);
  const t0 = curve.getTangentAt(0).negate();
  normals.push(t0.x, t0.y, t0.z);
  for (let j = 0; j < radial; j++) indices.push(capStart, j + 1, j);
  const capEnd = positions.length / 3;
  curve.getPointAt(1, p);
  positions.push(p.x, p.y, p.z);
  const t1 = curve.getTangentAt(1);
  normals.push(t1.x, t1.y, t1.z);
  const last = tubular * (radial + 1);
  for (let j = 0; j < radial; j++) indices.push(capEnd, last + j, last + j + 1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setIndex(indices);
  return geo;
}

/** Patch of a sphere: phi around +Y (π/2 faces +Z), theta from the top. Painted regions on round parts. */
export function spherePatch(radius: number, phiCenter: number, phiHalf: number, thetaFrom: number, thetaTo: number, segments = 20): THREE.BufferGeometry {
  return new THREE.SphereGeometry(radius, segments, Math.max(4, Math.round(segments / 2)), phiCenter - phiHalf, phiHalf * 2, thetaFrom, thetaTo - thetaFrom);
}

/** Flame / drop: round bottom, pointed top. */
export function teardrop(radius: number, height: number, segments = 12): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  const n = 10;
  for (let i = 0; i <= n; i++) {
    const y = -radius + (i / n) * (height + radius);
    const r = y < 0 ? Math.sqrt(Math.max(0, radius * radius - y * y)) : radius * Math.pow(Math.max(0, 1 - y / height), 1.4) * (1 + 0.15 * Math.sin((y / height) * Math.PI));
    pts.push(new THREE.Vector2(Math.max(r, 0.0001), y));
  }
  return new THREE.LatheGeometry(pts, segments);
}

export interface PartOptions {
  ramp: Ramp;
  dither?: number;
  emissive?: THREE.ColorRepresentation;
  emissiveIntensity?: number;
  unlit?: boolean;
  outline?: boolean;
  /** Team rim: a thin emissive band on the silhouette (hero warm gold, enemies blood red). */
  rim?: { color: THREE.ColorRepresentation; strength: number };
  /** Bands of extra brightness, so characters stay a step above the dark room. */
  lift?: number;
}

/** View direction the rims are measured against (toward the camera); scenes set it for their camera. */
export const RIM_VIEW = { value: new THREE.Vector3(0, 1, K_OBLIQUE).normalize() };

const RIM_PARS = /* glsl */ `
uniform vec3 uRimView;
uniform vec3 uRimColor;
uniform float uRimStrength;
uniform float uLift;
`;
const RIM_BODY = /* glsl */ `
rampShift += uLift;
float rimF = 1.0 - clamp(dot(normalW, uRimView), 0.0, 1.0);
emissive += uRimColor * smoothstep(0.58, 0.82, rimF) * uRimStrength;
`;

/** One toon material per look and character (hit flashes stay individual). */
export function toon(o: PartOptions): ToonMaterial {
  const lit = !o.unlit && (o.rim || o.lift);
  return createToonMaterial({
    ramp: [...o.ramp],
    dither: o.dither ?? 0.15,
    emissive: o.emissive,
    emissiveIntensity: o.emissiveIntensity,
    unlit: o.unlit,
    outline: o.outline,
    hooks: lit
      ? {
          uniforms: {
            uRimView: RIM_VIEW,
            uRimColor: { value: new THREE.Color(o.rim?.color ?? '#000000') },
            uRimStrength: { value: o.rim?.strength ?? 0 },
            uLift: { value: o.lift ?? 0 },
          },
          fragmentPars: RIM_PARS,
          fragment: RIM_BODY,
        }
      : undefined,
  });
}

export function mesh(geo: THREE.BufferGeometry, material: THREE.Material, name?: string): THREE.Mesh {
  const m = new THREE.Mesh(geo, material);
  if (name) m.name = name;
  return m;
}

/** Additive glow card on the forward layer (flames, eyes): faces the camera via `faceCamera`. */
let glowTex: THREE.Texture | null = null;
export function glowCard(color: THREE.ColorRepresentation, size: number, opacity = 0.5): THREE.Mesh {
  if (!glowTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.35)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    glowTex = new THREE.CanvasTexture(c);
  }
  const card = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ color, map: glowTex, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  card.layers.set(LAYERS.forward);
  card.userData.faceCamera = true;
  return card;
}

/** Turns every `faceCamera` card under root toward the camera. */
export function faceCamera(root: THREE.Object3D, camera: THREE.Camera): void {
  const q = new THREE.Quaternion();
  root.traverse(o => {
    if (!o.userData.faceCamera || !o.parent) return;
    o.parent.getWorldQuaternion(q);
    o.quaternion.copy(q.invert().multiply(camera.quaternion));
  });
}

// ---- standing under the oblique camera ------------------------------------------------------------

/** Camera up in world space for the Demo's oblique camera (pitched toward −z). */
const CAMERA_UP = new THREE.Vector3(0, K_OBLIQUE, -1).normalize();
/** The projection stretches screen-y by √(1+k²); squashing along camera-up by its inverse keeps spheres round. */
const SPHERE_FIX = 1 / Math.sqrt(1 + K_OBLIQUE * K_OBLIQUE);

export const STAND = {
  /** Characters lean back (radians) so their fronts face the high camera like sprites. */
  lean: 0.52,
  /** 1 under the oblique camera; 0 for ordinary cameras (iso beauty shots). */
  correction: 1,
};

const tmp = new THREE.Matrix4();

/**
 * Sets `obj.matrix` (matrixAutoUpdate off) to place a character with its feet at (x, z):
 * translate · sphere fix along camera-up · lean back · vertical compensation · yaw.
 * `pose` 0 = standing (full lean, heights read at their modelled size), 1 = ball (no lean, no stretch).
 */
export function stand(obj: THREE.Object3D, x: number, z: number, yaw: number, pose = 0, y = 0): void {
  const lean = STAND.lean * (1 - pose) * STAND.correction;
  const s = 1 + (SPHERE_FIX - 1) * STAND.correction;
  const u = CAMERA_UP;
  const fix = new THREE.Matrix4().set(
    1 + (s - 1) * u.x * u.x, (s - 1) * u.x * u.y, (s - 1) * u.x * u.z, 0,
    (s - 1) * u.y * u.x, 1 + (s - 1) * u.y * u.y, (s - 1) * u.y * u.z, 0,
    (s - 1) * u.z * u.x, (s - 1) * u.z * u.y, 1 + (s - 1) * u.z * u.z, 0,
    0, 0, 0, 1,
  );
  // apparent height of a leaned, fixed, stretched vertical axis, brought back to 1 when standing
  const apparent = (u.y * Math.cos(lean) - u.z * Math.sin(lean)) * s * Math.sqrt(1 + K_OBLIQUE * K_OBLIQUE);
  const comp = STAND.correction ? THREE.MathUtils.lerp(1 / apparent, 1, pose) : 1;
  obj.matrixAutoUpdate = false;
  obj.matrix.makeTranslation(x, y, z).multiply(fix).multiply(tmp.makeRotationX(-lean)).multiply(tmp.makeScale(1, comp, 1)).multiply(tmp.makeRotationY(yaw));
  obj.matrixWorldNeedsUpdate = true;
}

/** Checker-dithered drop shadow disc (pixel-art style): every other pixel is discarded. */
export function dropShadow(radius: number): THREE.Mesh {
  const material = createToonMaterial({
    ramp: ['#05040A', '#0B0912'],
    unlit: true,
    outline: false,
    hooks: { fragment: 'if (mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y), 2.0) < 1.0) discard;' },
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(radius, 20), material);
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.01;
  disc.name = 'drop-shadow';
  return disc;
}
