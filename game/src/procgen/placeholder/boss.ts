import { PlaceholderMob, type FigureOptions } from './figure';
import { figureSpec } from './spec';

/**
 * A placeholder boss: the row's own composite form, the crown, a brighter carried light. The Demo's five 首领 rows
 * (守门人, 结晶骑士, 弑神幼虫, 重生傀儡, 幽焰龙) are all tagged 可交互.角色.AI.仇恨.首领; any other row is refused, so a
 * boss never ends up looking like the small fry it summons.
 */
export function placeholderBoss(rowName: string, options: FigureOptions = {}): PlaceholderMob {
  const spec = figureSpec(rowName);
  if (spec.tier !== 'boss') throw new Error(`placeholder: ${rowName} is not a boss row (tier ${spec.tier}); use placeholderEnemy`);
  return new PlaceholderMob(rowName, options);
}
