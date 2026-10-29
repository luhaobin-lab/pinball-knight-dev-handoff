/**
 * Module `launch` (WAVE_A A16, Appendix W2): the hero launch. The Demo functions of `LaunchFns`, the native
 * LaunchTrajectoryLibrary the launch blueprints call (`LaunchTrajectoryLibrary`, reached as
 * `world.sys.launch.LaunchTrajectoryLibrary`), the `preview` hook behind game.preview, and `view.launch`.
 */
import type { Systems } from '../../bp/systems.ts';
import type { World } from '../../sim/world.ts';
import type { GameView } from '../../api/view.ts';
import type { LaunchPreview } from '../../launch/index.ts';
import { actorFns, toolFns } from './actor.ts';
import { LaunchTrajectoryLibrary, livePickups, liveCurrencyPickups, consumeCurrencyAlongMove } from './native.ts';
import { nearMissPlayer } from './near-miss.ts';
import { previewSkill } from './skill-aim.ts';
import { playerTick } from './player-tick.ts';

/** game.preview(aim): the aim display in phase 2 (交互场牌) from the current state; no ids, no randomness. */
function preview(world: World, aim: { x: number; y: number }): LaunchPreview | null {
  const hero = world.mode.玩家角色;
  if (!hero || world.mode.当前环节 !== '交互场牌') return null;
  return LaunchTrajectoryLibrary.PreviewLaunch(hero, aim);
}

function view(world: World): Partial<GameView> {
  const hero = world.mode.玩家角色;
  return {
    launch: hero ? LaunchTrajectoryLibrary.ActiveLaunch(hero) : null,
    pickups: [
      ...livePickups(world).filter(p => p.未激活特效开启 !== false)
        .map(p => ({ id: p.id, row: p.def.name.replace('蓝图_可拾取物_', ''), position: p.K2_GetActorLocation() })),
      ...liveCurrencyPickups(world).map(p => ({ id: p.id, row: '灵魂碎片', position: p.K2_GetActorLocation() })),
    ],
  };
}

export const launch: Systems['launch'] & {
  readonly LaunchTrajectoryLibrary: typeof LaunchTrajectoryLibrary;
  readonly preview: typeof preview;
  readonly consumeCurrencyAlongMove: typeof consumeCurrencyAlongMove;
  readonly previewSkill: typeof previewSkill;
} = {
  BP_ManeActor: actorFns,
  BP_Actor_Player: { ...nearMissPlayer, ...playerTick },
  函数库_工具: toolFns,
  LaunchTrajectoryLibrary,
  preview,
  consumeCurrencyAlongMove,
  previewSkill,
  view,
};

export { LaunchTrajectoryLibrary } from './native.ts';
