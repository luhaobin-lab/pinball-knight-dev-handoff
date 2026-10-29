import type { BotView } from './api.ts';

/**
 * The numbers the bot reads from a view for its report, by the names of `src/core/api/view.ts` (RunView.floor / 金币 /
 * 英雄等级, HeroView.hp, InventoryView.equip + backpack); undefined while a slice is absent.
 * SPEC-GAP: the view has no talent count yet; `talentsTaken` stays null until RunView or HeroView carries one.
 */
export interface ViewSample {
  readonly floor?: number;
  readonly hp?: number;
  readonly dead?: boolean;
  readonly gold?: number;
  readonly items?: number;
  readonly level?: number;
  readonly talents?: number;
}

const field = (obj: unknown, key: string): number | undefined => {
  const v = obj && typeof obj === 'object' ? (obj as Record<string, unknown>)[key] : undefined;
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
};
const count = (obj: unknown, ...keys: string[]): number | undefined => {
  if (!obj || typeof obj !== 'object') return undefined;
  const lists = keys.map(k => (obj as Record<string, unknown>)[k]).filter(Array.isArray);
  return lists.length ? lists.reduce((n, l) => n + l.length, 0) : undefined;
};

export function sampleView(view: BotView): ViewSample {
  const out: Record<string, number> = {};
  const put = (key: keyof ViewSample, v: number | undefined): void => {
    if (v !== undefined) out[key] = v;
  };
  put('floor', field(view.run, 'floor'));
  put('gold', field(view.run, '金币'));
  put('level', field(view.run, '英雄等级'));
  put('hp', field(view.hero, 'hp'));
  put('items', count(view.inventory, 'equip', 'backpack'));
  const dead = view.hero && typeof view.hero === 'object' ? (view.hero as { dead?: unknown }).dead : undefined;
  return typeof dead === 'boolean' ? { ...out, dead } : out;
}

/** The key whose change counts as "the phase moved" for the softlock detector. */
export const phaseKey = (view: BotView): string => `${view.screen}|${String(view.phase ?? '')}|${view.modal?.kind ?? ''}`;
