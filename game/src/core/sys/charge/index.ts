/**
 * Module `charge` (WAVE_A A16, Appendix W2): item charge, Infuse and the completion events (draft
 * charge-infuse-echocast).
 */
import type { Systems } from '../../bp/systems.ts';
import { cardAddCharge, 给装备的物品充能, 武器充能回合计数, 武器充能耐久计数 } from './charge.ts';

export const charge: Systems['charge'] = {
  BP_Actor_Card: { 添加行动力: cardAddCharge },
  函数库_技能: { 给装备的物品充能, 武器充能回合计数, 武器充能耐久计数 },
};

export { chargePerBounce, chargePopupNumber, TAG_CHARGEABLE } from './charge.ts';
