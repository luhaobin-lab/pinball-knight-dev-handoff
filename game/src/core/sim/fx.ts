/**
 * `this.fx` (ARCHITECTURE §4.9): presentation nodes → PresentEvents on the bus. Arguments stay Demo asset paths or
 * widget names so the game layer's cue table can map them; nothing here feeds back into rules.
 */
import type { PresentEvent } from '../api/events.ts';
import type { EventQueue } from './bus.ts';
import type { BpObject, Fx } from './object.ts';
import type { Vec3 } from './types.ts';

function isObject(x: Vec3 | BpObject): x is BpObject {
  return typeof (x as BpObject).id === 'number' && 'def' in x;
}

export function makeFx(events: EventQueue<PresentEvent>): Fx {
  return {
    vfx(asset, at, opts) {
      if (isObject(at)) {
        events.emit({ kind: 'vfx', asset, at: opts?.attach ? null : at.K2_GetActorLocation(), attach: opts?.attach ? at.id : null });
      } else {
        events.emit({ kind: 'vfx', asset, at: { ...at }, attach: null });
      }
    },
    sound(asset, at, opts) {
      events.emit({ kind: 'sound', asset, at: at ? { ...at } : null, volume: opts?.volume ?? 1, pitch: opts?.pitch ?? 1 });
    },
    shake(asset, at) {
      events.emit({ kind: 'shake', asset, at: at ? { ...at } : null });
    },
    flipbook(on, asset, opts) {
      // A flipbook swap is an animation on the actor: the shell plays the asset (its length is in the anim manifest).
      events.emit({ kind: 'actor.anim', id: on.id, sequence: asset, seconds: 0, loop: opts?.loop ?? false });
    },
    flash(on, seconds) {
      events.emit({ kind: 'actor.flash', id: on.id, seconds });
    },
    headUp(on, text) {
      events.emit({ kind: 'headUp', id: on.id, text: `${text.ns}/${text.key}` });
    },
    popup(p) {
      events.emit({ kind: 'popup', ...p, at: p.at ? { ...p.at } : null });
    },
    log(line) {
      events.emit({ kind: 'log', rich: line.rich });
    },
    ui(op) {
      events.emit({ kind: 'ui', op: op.op, widget: op.widget, data: op.data });
    },
    bgm(state) {
      events.emit({ kind: 'bgm', state });
    },
  };
}
