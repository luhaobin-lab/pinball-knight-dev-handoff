import type { CameraShakeKind } from '../render/api';
import type { CueName } from '../audio';
import type { PresentEvent } from './api';

/**
 * Demo asset paths → our presentation (ARCHITECTURE §8.3). The core names the Demo asset of every `vfx`, `sound`
 * and `shake` event (e.g. 粒子_Hit_01, 摄像机晃动_零点二); handlers in `./cues/*.ts` (discovered, so the feel lanes
 * add or replace them without a shared index) match paths and play our effect. An event no handler takes plays the
 * generic placeholder of its kind and is counted under its path (`unknown`, shown by the debug overlay).
 */
export type CueEvent = Extract<PresentEvent, { kind: 'vfx' | 'sound' | 'shake' }>;

/** What a handler may drive. Points are floor tiles. */
export interface CueTarget {
  shake(kind: CameraShakeKind): void;
  sound(cue: CueName, at: { x: number; z: number } | null): void;
  spark(at: { x: number; z: number }): void;
  spores?(at: { x: number; z: number }, normal: { x: number; z: number }): void;
  deathSplat?(at: { x: number; z: number }): void;
  normal?(e: CueEvent): { x: number; z: number };
  /** The tile point of a room uu point, or of an actor. */
  place(e: CueEvent): { x: number; z: number } | null;
}

export interface CueHandler {
  readonly kind: CueEvent['kind'];
  /** Higher wins among handlers that match. */
  readonly priority?: number;
  match(asset: string): boolean;
  play(e: CueEvent, t: CueTarget): void;
}

const modules = import.meta.glob<{ default: readonly CueHandler[] }>('./cues/*.ts', { eager: true });

export const CUE_HANDLERS: readonly CueHandler[] = Object.keys(modules)
  .sort()
  .flatMap(k => modules[k].default)
  .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

/** The generic placeholder of each kind. */
const FALLBACK: Readonly<Record<CueEvent['kind'], (e: CueEvent, t: CueTarget) => void>> = {
  vfx: (e, t) => {
    const at = t.place(e);
    if (at) t.spark(at);
  },
  sound: () => {},
  shake: (_e, t) => t.shake('bounce'),
};

export class Cues {
  /** Asset paths no handler took, with their counts. */
  readonly unknown = new Map<string, number>();

  constructor(private readonly handlers: readonly CueHandler[] = CUE_HANDLERS) {}

  play(e: CueEvent, t: CueTarget): void {
    const asset = e.kind === 'shake' ? e.asset : (e.asset ?? '');
    const h = this.handlers.find(x => x.kind === e.kind && x.match(asset));
    if (h) return h.play(e, t);
    const key = `${e.kind}:${asset || '(none)'}`;
    this.unknown.set(key, (this.unknown.get(key) ?? 0) + 1);
    FALLBACK[e.kind](e, t);
  }
}
