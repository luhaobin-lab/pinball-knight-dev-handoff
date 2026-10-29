import { BossBarPage } from '../../../ui/pages/boss-bar/page';
import type { BossBarModel } from '../../../ui/pages/boss-bar/model';
import type { ActorView, GameView } from '../../api';
import { synced, type PageBinding } from '../page-model';

/**
 * UI_首领状态条 (ui-pages `BossBarPage`) at the bottom of the play area while a boss lives in the room (the room's base
 * page). SPEC-GAP: 显示名 is the boss's row name and 剩余持续性伤害 / 溢出的治疗量 are 0 until the actor view carries them.
 */
export const bossOf = (v: Pick<GameView, 'field'>): ActorView | undefined => v.field.find(a => a.boss && a.hp > 0);

export function bossBarModel(v: Pick<GameView, 'field'>): BossBarModel {
  const b = bossOf(v);
  return { name: b?.row ?? '', hp: b?.hp ?? 0, hpMax: b?.maxHp ?? 1, armor: b?.armor ?? 0, dotPending: 0, overflowHeal: 0 };
}

const binding: PageBinding = {
  id: 'boss-bar',
  modal: false,
  match: v => v.screen === 'room' && !v.modal && bossOf(v) !== undefined,
  live: host => synced(new BossBarPage(host.font, bossBarModel({ field: [] })), bossBarModel),
};
export default binding;
