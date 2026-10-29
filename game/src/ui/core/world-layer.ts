import * as THREE from 'three';
import { fullscreenMaterial, type PassContext, type PixelRenderer } from '../../render/api';
import { Surface } from './surface';

/** World point → internal px (top-left origin) on the snapped grid of the frame being drawn. */
export type Project = (world: THREE.Vector3Like) => { x: number; y: number; depth: number };

/**
 * World-anchored marks (enemy head bars, intents, weak points) on the renderer's overlay stage:
 * drawn every frame into a Surface at internal resolution with the pass's `project`, uploaded as
 * a texture and blended premultiplied over whatever the overlay already holds, so the marks sit
 * exactly on their targets and move with screen shake like the world does.
 */
export class WorldLayer {
  private surface = new Surface(1, 1);
  private texture: THREE.DataTexture | null = null;
  private readonly material: THREE.ShaderMaterial;
  private readonly remove: () => void;

  constructor(
    renderer: PixelRenderer,
    private readonly draw: (s: Surface, project: Project, ctx: PassContext) => boolean,
    order = 10,
  ) {
    this.material = fullscreenMaterial(
      /* glsl */ `
uniform sampler2D tMarks;
uniform vec2 uSize;
void main() {
  vec2 uv = (floor(gl_FragCoord.xy) + 0.5) / uSize;
  vec4 c = texture2D(tMarks, vec2(uv.x, 1.0 - uv.y));
  gl_FragColor = vec4(c.rgb * c.a, c.a);
}`,
      { tMarks: { value: null }, uSize: { value: new THREE.Vector2(1, 1) } },
    );
    // premultiplied "over" the overlay drawn by earlier passes
    this.material.transparent = true;
    this.material.premultipliedAlpha = true;
    this.remove = renderer.addPass('overlay', {
      name: 'ui-world-marks',
      order,
      render: ctx => this.render(ctx),
    });
  }

  private render(ctx: PassContext): void {
    if (this.surface.w !== ctx.width || this.surface.h !== ctx.height) {
      this.surface = new Surface(ctx.width, ctx.height);
      this.texture?.dispose();
      this.texture = new THREE.DataTexture(new Uint8Array(this.surface.data.buffer), ctx.width, ctx.height, THREE.RGBAFormat, THREE.UnsignedByteType);
      this.texture.colorSpace = THREE.SRGBColorSpace;
      this.texture.magFilter = THREE.NearestFilter;
      this.texture.minFilter = THREE.NearestFilter;
      this.texture.generateMipmaps = false;
      this.material.uniforms.tMarks.value = this.texture;
      this.material.uniforms.uSize.value.set(ctx.width, ctx.height);
    }
    this.surface.clear();
    if (!this.draw(this.surface, p => ctx.project(p), ctx)) return;
    this.texture!.needsUpdate = true;
    ctx.fullscreen(this.material);
  }

  dispose(): void {
    this.remove();
    this.texture?.dispose();
    this.material.dispose();
  }
}
