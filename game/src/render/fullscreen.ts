import * as THREE from 'three';

/** One oversized triangle covering clip space; uv spans [0, 1] over the visible area. */
const geometry = new THREE.BufferGeometry();
geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, 3, 0, -1, -1, 0, 3, -1, 0], 3));
geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 2, 0, 0, 2, 0], 2));

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

export const FULLSCREEN_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

export class Fullscreen {
  private readonly mesh = new THREE.Mesh(geometry);

  constructor() {
    this.mesh.frustumCulled = false;
  }

  draw(gl: THREE.WebGLRenderer, material: THREE.Material, target: THREE.WebGLRenderTarget | null): void {
    this.mesh.material = material;
    gl.setRenderTarget(target);
    gl.render(this.mesh, camera);
  }
}

/** ShaderMaterial for a fullscreen pass with depth testing off. */
export function fullscreenMaterial(
  fragmentShader: string,
  uniforms: Record<string, THREE.IUniform>,
  defines: Record<string, string | number> = {},
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: FULLSCREEN_VERTEX,
    fragmentShader,
    uniforms,
    defines,
    depthTest: false,
    depthWrite: false,
  });
}
