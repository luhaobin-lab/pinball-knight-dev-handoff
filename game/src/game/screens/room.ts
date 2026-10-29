import type { GameView, PresentEvent } from '../api';
import { RoomStage } from '../room/stage';
import type { ScreenController, ScreenDeps } from './controller';

/**
 * The room screen: the 3D room of `view.room` with its actors (RoomStage). Core views are fresh plain snapshots;
 * only a changed room identity or plan rebuilds the stage, so actor motion survives ordinary frame updates.
 */
export function roomScreen(deps: ScreenDeps, view: GameView): ScreenController {
  // Box solids are live terrain (e.g. an elite's rocks). RoomStage updates them without restarting every actor.
  const keyOf = (v: GameView): string => JSON.stringify([v.run?.chapter, v.run?.floor, v.map?.current,
    v.room ? { ...v.room, solids: v.room.solids.filter(s => s.kind !== 'box') } : null]);
  let planKey = keyOf(view);
  let stage: RoomStage | null = view.room ? new RoomStage(deps.renderer, view, deps.seed) : null;
  const pending: PresentEvent[] = [];
  return {
    screen: 'room',
    hud: true,
    get stage() {
      return stage;
    },
    update(v, dt) {
      const nextKey = keyOf(v);
      if (nextKey !== planKey) {
        stage?.dispose();
        planKey = nextKey;
        stage = v.room ? new RoomStage(deps.renderer, v, deps.seed) : null;
      }
      const events = pending.splice(0);
      // Source removes a dying enemy from field immediately: preserve its view before sync retires missing actors.
      // The launch starts before this frame's pose tick; the authored curl never delays actual movement.
      const early = (e: PresentEvent): boolean => e.kind === 'launch.start' || e.kind === 'actor.die' || (e.kind === 'ui' && e.widget === 'actor.corpse');
      for (const e of events) if (early(e)) stage?.event(e);
      stage?.sync(v, dt);
      for (const e of events) if (!early(e)) stage?.event(e);
    },
    event(e) {
      // reactions play after the stage has the actors of this frame
      pending.push(e);
    },
    exit() {
      stage?.dispose();
      stage = null;
    },
  };
}
