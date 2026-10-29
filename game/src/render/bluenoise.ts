import * as THREE from 'three';
import { createRng } from '../core/rng';

/**
 * Blue-noise threshold map made with the void-and-cluster method (Ulichney 1993) on a torus.
 * Every value in 0..size²-1 appears exactly once; normalized ranks are in [0, 1).
 * Deterministic (fixed seed). 64×64 takes a few tens of milliseconds once.
 */
export function blueNoiseRanks(size = 64, sigma = 1.5, seed = 0xb10e): Float32Array {
  const n = size * size;
  // The Gaussian is negligible beyond 4σ, so energy updates only touch a small window.
  const radius = Math.min(Math.ceil(4 * sigma), Math.floor((size - 1) / 2));
  const span = radius * 2 + 1;
  const kernel = new Float32Array(span * span);
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      kernel[(dy + radius) * span + dx + radius] = Math.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma));
    }
  }
  const energy = new Float32Array(n);
  const bits = new Uint8Array(n);
  const splat = (p: number, sign: number): void => {
    const px = p % size;
    const py = (p - px) / size;
    for (let dy = -radius; dy <= radius; dy++) {
      const row = ((py + dy + size) % size) * size;
      const krow = (dy + radius) * span + radius;
      for (let dx = -radius; dx <= radius; dx++) {
        energy[row + ((px + dx + size) % size)] += sign * kernel[krow + dx];
      }
    }
  };
  const extreme = (wantBit: number, max: boolean): number => {
    let best = -1;
    let value = max ? -Infinity : Infinity;
    for (let i = 0; i < n; i++) {
      if (bits[i] !== wantBit) continue;
      if (max ? energy[i] > value : energy[i] < value) {
        value = energy[i];
        best = i;
      }
    }
    return best;
  };

  const rng = createRng(seed);
  const initial = Math.max(1, Math.floor(n / 10));
  for (let placed = 0; placed < initial; ) {
    const p = rng.int(0, n - 1);
    if (bits[p]) continue;
    bits[p] = 1;
    splat(p, 1);
    placed++;
  }
  // Relax the initial pattern: move the tightest cluster point into the largest void until stable.
  for (let guard = 0; guard < n; guard++) {
    const cluster = extreme(1, true);
    bits[cluster] = 0;
    splat(cluster, -1);
    const voidAt = extreme(0, false);
    if (voidAt === cluster) {
      bits[cluster] = 1;
      splat(cluster, 1);
      break;
    }
    bits[voidAt] = 1;
    splat(voidAt, 1);
  }

  const ranks = new Float32Array(n);
  const prototype = bits.slice();
  const prototypeEnergy = energy.slice();
  for (let rank = initial - 1; rank >= 0; rank--) {
    const cluster = extreme(1, true);
    bits[cluster] = 0;
    splat(cluster, -1);
    ranks[cluster] = rank;
  }
  bits.set(prototype);
  energy.set(prototypeEnergy);
  for (let rank = initial; rank < n; rank++) {
    const voidAt = extreme(0, false);
    bits[voidAt] = 1;
    splat(voidAt, 1);
    ranks[voidAt] = rank;
  }
  for (let i = 0; i < n; i++) ranks[i] /= n;
  return ranks;
}

let shared: THREE.DataTexture | null = null;

/** Shared 64×64 single-channel blue-noise texture (nearest, repeat). Sample with `texelFetch(t, px & 63, 0).r`. */
export function blueNoiseTexture(): THREE.DataTexture {
  if (shared) return shared;
  const tex = new THREE.DataTexture(blueNoiseRanks(64), 64, 64, THREE.RedFormat, THREE.FloatType);
  tex.name = 'blue-noise-64';
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  shared = tex;
  return tex;
}
