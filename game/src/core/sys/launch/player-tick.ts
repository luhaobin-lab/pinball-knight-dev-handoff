import type { BP_Actor_Player } from '../../sim/player.ts';
import type { LaunchFns } from '../../bp/systems.ts';
import { MapRangeClamped } from '../../math/kismet.ts';
import type { BpObject } from '../../sim/object.ts';

type LivePreviewCircle = BpObject & { 更新碰撞预览圈(): void };
type LoopParameters = { speed: number; volume: number };
/** BP_Player L23382→L16938→L16396. The inherited actor tick also performs fog/physics before this function.
 * The source's audio component parameters are state; emit only changes, with no epsilon or random draw.
 */
export const playerTick: NonNullable<LaunchFns['BP_Actor_Player']> = {
  实时检测(self) {
    if (!self.初始化完毕) return;
    const speed = (Math.max(self.当前物理速度, MapRangeClamped(self.移动当前速度, 3000, 6000, 2000, 3000)) - 300) / 2700;
    const next = { speed: Math.fround(speed), volume: Math.fround(speed * .4) };
    const state = self as BP_Actor_Player & { ug_loopSound?: LoopParameters }, old = state.ug_loopSound;
    state.ug_loopSound = next;
    if (!old || old.speed !== next.speed || old.volume !== next.volume)
      self.fx.ui({ op: 'update', widget: 'actor.loopSound', data: { id: self.id, ...next } });
    // L16257 re-reads the live length; no invented snapshot/validity filter.
    // SPEC-GAP: native launch currently uses a separate pure preview/cache. It has no source preview-circle
    // actor array or per-circle one-frame convergence; do not rebuild/overwrite its active path from this tick.
    for (let i = 0; i < self.碰撞预览圈数组.length; i++) {
      const circle = self.碰撞预览圈数组[i] as LivePreviewCircle | null;
      if (circle && typeof circle.更新碰撞预览圈 === 'function') circle.更新碰撞预览圈();
      else self.world.unported('BP_Actor_Player.实时检测:missing preview circle interface');
    }
  },
};
