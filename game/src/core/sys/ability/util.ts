/**
 * Engine helpers the ability and kernel modules share: UE array semantics (Array_AddUnique, Array_RemoveItem), the
 * exact class test (GetObjectClass == X) and FText formatting (KismetTextLibrary.Format with named arguments).
 */
import type { FText } from '../../../content/demo/types.ts';
import type { BpObject } from '../../sim/object.ts';
import type { AssetPath } from '../../sim/types.ts';

/** Array_AddUnique: appends when absent; returns the index of the new entry or −1. */
export function addUnique<T>(arr: T[], x: T): number {
  if (arr.includes(x)) return -1;
  arr.push(x);
  return arr.length - 1;
}

/** Array_RemoveItem: removes every occurrence; true if any was removed. */
export function removeItem<T>(arr: T[], x: T): boolean {
  let removed = false;
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] === x) {
      arr.splice(i, 1);
      removed = true;
    }
  }
  return removed;
}

/** GetObjectClass(o) == cls: the exact class, not a subclass (ability-framework ABILIT-052). */
export function isExactClass(o: BpObject | null | undefined, cls: AssetPath | null): boolean {
  return !!o && cls !== null && o.def.path === cls;
}

/** The object's class path (GetObjectClass); null for None. */
export function classOf(o: BpObject | null | undefined): AssetPath | null {
  return o ? o.def.path : null;
}

/** KismetTextLibrary.Format: replaces `{name}` in both languages; unknown arguments stay as written. */
export function formatText(t: FText, args: Readonly<Record<string, FText>>): FText {
  const fill = (s: string, lang: 'zh' | 'en'): string => s.replace(/\{([^{}]+)\}/g, (m, k: string) => (Object.hasOwn(args, k) ? args[k][lang] : m));
  return { zh: fill(t.zh, 'zh'), en: fill(t.en, 'en') };
}

/** A literal Text node. */
export function textOf(zh: string, en = zh): FText {
  return { zh, en };
}
