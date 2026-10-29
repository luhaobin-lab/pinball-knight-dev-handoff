/**
 * UE engine nodes the runtime needs, with UE semantics (turn-flow §2 [ENGINE]): array edits as KismetArrayLibrary,
 * actor visibility as `SetActorHiddenInGame` (state on the object, so it is part of the digest and the view).
 */
import type { BpObject } from './object.ts';

/** `Array_AddUnique`: appends when absent; returns the index (−1 when it was already there, as UE). */
export function Array_AddUnique<T>(arr: T[], item: T): number {
  if (arr.includes(item)) return -1;
  arr.push(item);
  return arr.length - 1;
}

/** `Array_RemoveItem`: removes every occurrence at once, later elements shift down; true if any was removed. */
export function Array_RemoveItem<T>(arr: T[], item: T): boolean {
  let removed = false;
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] === item) {
      arr.splice(i, 1);
      removed = true;
    }
  }
  return removed;
}

interface Hideable { bHiddenInGame?: boolean }

/** `SetActorHiddenInGame`: stored on the object; emits `actor.hide` for the shell. */
export function SetActorHiddenInGame(o: BpObject, hidden: boolean): void {
  (o as BpObject & Hideable).bHiddenInGame = hidden;
  o.world.bus.emit({ t: o.world.clock.now, kind: 'actor.hide', id: o.id, hidden });
}

/** `IsHidden()`: false until something hides the actor. */
export function isHiddenInGame(o: BpObject): boolean {
  return (o as BpObject & Hideable).bHiddenInGame ?? false;
}
