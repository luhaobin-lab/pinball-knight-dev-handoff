import { LAYERS, PASS_ORDER } from '../constants';
import type { PassContext, RenderPass } from '../api';

/** gbuffer stage: renders every object on LAYERS.world with its G-buffer material. */
export function createScenePass(): RenderPass {
  return {
    name: 'scene',
    order: PASS_ORDER.scene,
    render(ctx: PassContext) {
      ctx.camera.layers.set(LAYERS.world);
      ctx.gl.render(ctx.scene, ctx.camera);
    },
  };
}

/** lighting stage: renders LAYERS.forward objects (glows, particles, transparents) into `lit`, depth-tested. */
export function createForwardPass(): RenderPass {
  return {
    name: 'forward',
    order: PASS_ORDER.forward,
    render(ctx: PassContext) {
      ctx.camera.layers.set(LAYERS.forward);
      ctx.gl.render(ctx.scene, ctx.camera);
      ctx.camera.layers.set(LAYERS.world);
    },
  };
}
