import { PROP_FOR_ROW, type PropKind } from '../../procgen/placeholder';
import type { ActorView as FieldActorView } from '../api';

/**
 * Which view stands for a field actor (ARCHITECTURE §8.2), as data: new rows need no code. The hero is the beetle
 * knight; enemy and boss rows are figures of the placeholder kit; every other row is a set piece, found in
 * `PROP_FOR_ROW` (the kit's interactables), then in `EXTRA_PROPS`, then by the actor's kind (`FALLBACK`).
 */
export type ViewKind = { view: 'hero' } | { view: 'enemy'; row: string } | { view: 'boss'; row: string } | { view: 'prop'; prop: PropKind };

/** Rows the kit does not map yet. */
export const EXTRA_PROPS: Readonly<Record<string, PropKind>> = {
  路口: 'portal',
  传送阵: 'portal',
  地铺: 'campfire',
  铁砧: 'anvil',
  锻造锤_品质青铜: 'anvil',
  锻造锤_品质白银: 'anvil',
  锻造锤_品质黄金: 'anvil',
  锻造锤_标签: 'anvil',
  远古兽肉: 'jar',
  兑换卷_武器: 'altar',
  兑换卷_饰品: 'altar',
  兑换卷_工具: 'altar',
  保护罩生成器: 'shield-generator',
  破损的神像: 'statue',
  永恒神像: 'statue',
  加速点: 'vortex',
  灵魂碎片: 'soul-shard',
  石墙: 'wall',
};

export const FALLBACK: Readonly<Record<FieldActorView['kind'], PropKind>> = {
  hero: 'dummy',
  enemy: 'dummy',
  boss: 'dummy',
  neutral: 'crate',
  card: 'jar',
  pickup: 'jar',
  terrain: 'spikes',
  projectile: 'brazier',
  decoration: 'candles',
};

export function viewKind(actor: Pick<FieldActorView, 'kind' | 'row'>): ViewKind {
  if (actor.kind === 'hero') return { view: 'hero' };
  if (actor.kind === 'boss') return { view: 'boss', row: actor.row };
  if (actor.kind === 'enemy') return { view: 'enemy', row: actor.row };
  return { view: 'prop', prop: PROP_FOR_ROW[actor.row] ?? EXTRA_PROPS[actor.row] ?? FALLBACK[actor.kind] };
}
