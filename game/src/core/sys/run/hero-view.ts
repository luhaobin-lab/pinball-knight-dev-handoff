/**
 * Read-only HeroView projection (ARCHITECTURE Appendix A.8). Resource fields are the live BP_Actor_Player values;
 * 魔力 is the Demo's Stamina (SCM-010). Status stacks/turns are 蓝图_效果's ABILIT-042/045 state, and skill costs /
 * cooldowns are the values read by UI_技能格. Never run 检查条件 here: it mutates the ability and draws combat RNG.
 */
import type { HeroView, SkillSlotView, StatusView } from '../../api/view.ts';
import type { 蓝图_效果 } from '../../ability/effect.ts';
import { 科学数变普通 } from '../../math/sci.ts';
import { 获取科学映射词条 } from '../../math/stats.ts';
import type { World } from '../../sim/world.ts';

/** Mental effects keep the UI_增减益格 text/icon as plain state (SCM-070); no dependency on a content class. */
type StatusEffect = 蓝图_效果 & { 对应增减益格?: { 名字: { zh: string }; 图标: string | null } | null };

function statusView(e: StatusEffect, w: World): StatusView {
  const ability = w.isValid(e.来自技能) ? e.来自技能 : null;
  const cell = e.对应增减益格;
  return {
    name: cell?.名字.zh || ability?.额外描述[0]?.zh || ability?.能力名 || e.效果名字 || e.def.name,
    stacks: e.叠加层数,
    turns: e.剩余回合,
    icon: cell?.图标 ?? ability?.图标 ?? '',
  };
}

export function heroView(w: World): HeroView | null {
  const hero = w.mode.玩家角色;
  if (!w.isValid(hero)) return null;
  const skills: SkillSlotView[] = [];
  // Preserve array positions: ability 0 is the launch, and the core's skill.press slots are 1..4.
  hero.拥有的主动能力.forEach((ability, slot) => {
    if (!w.isValid(ability)) return;
    const cooldown = w.isValid(ability.冷却效果) ? ability.冷却效果 : null;
    skills.push({
      slot, row: ability.能力名, cost: ability.当前消耗,
      // UI_技能格 displays the remaining rounds; -1 remains the timed/permanent sentinel, not a new timer.
      cooldown: cooldown?.剩余回合 ?? 0,
      usable: slot === 0 ? ability.本技能可释放 : (w.sys.turn as { activeSlotReady?(w: World, slot: number): boolean }).activeSlotReady?.(w, slot) ?? false,
    });
  });
  const statuses = hero.拥有的效果
    .filter((e): e is 蓝图_效果 => w.isValid(e) && !e.已销毁
      // Positive mental effects such as 饱腹 have a HUD cell but no 增益 tag in the Demo's CDO.
      && ((e as StatusEffect).对应增减益格 != null || e.OwnedGameplayTags.hasAny(['效果.类型.增益', '效果.类型.减益', '状态'])))
    .map(e => statusView(e, w));
  return {
    selectedSkill: hero.有选中主动技能 ? hero.当前能力?.能力名 ?? null : null,
    id: hero.id, row: hero.名字, position: hero.K2_GetActorLocation(),
    hp: 科学数变普通(hero.当前生命), maxHp: 科学数变普通(hero.当前最大生命), armor: 科学数变普通(hero.当前护甲值), dead: hero.死掉了,
    stamina: 科学数变普通(hero.当前魔力), maxStamina: 科学数变普通(hero.当前最大魔力),
    // UI_持续伤害栏 reads the detail calculation: retained overheal offsets pending DoT in the HUD.
    dot: 科学数变普通(hero.计算持续伤害详情().剩余持续伤害), statuses, skills,
    stats: Object.fromEntries([...hero.词条.keys()].map(name => [name, 科学数变普通(获取科学映射词条(hero.词条, name).输出值)])),
  };
}
