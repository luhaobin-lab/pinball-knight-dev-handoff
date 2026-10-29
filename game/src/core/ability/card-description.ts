import type { BP_Actor_Card } from '../sim/card.ts';
/** UI_悬停提示 source250–256: active abilities, passive abilities, then explicit enchantment map keys. */
export function cardDescriptions(card:BP_Actor_Card):string[] {
  return [...card.拥有的主动能力,...card.拥有的被动能力,...card.拥有的附魔能力.keys()]
    .filter(a=>card.world.isValid(a)&&a.描述.zh).map(a=>a!.描述.zh);
}
