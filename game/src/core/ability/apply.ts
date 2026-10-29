/** The source attach-effect macro: validate, merge gate, deferred spawn, tags, owner list, attachment. No activation is implicit. */
import { 函数库_工具, 函数库_技能 } from '../bp/index.ts';
import { make效果配置, type 效果配置 } from '../bp/structs.ts';
import type { 蓝图_能力 } from './ability.ts';
import type { 蓝图_效果 } from './effect.ts';
import type { BP_ManeActor } from '../sim/actor.ts';
import type { BpObject } from '../sim/object.ts';

const GROUP = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_地形管理组';
export const terrainGroupConfig = () => make效果配置({ 效果类: GROUP, 持续时间: -1, 持续回合: -1, 触发间隔: 1, 叠加层数: 1 });

export function attachSourceEffect<T extends 蓝图_效果>(ctx: BpObject, owner: BP_ManeActor, skill: 蓝图_能力 | null, cfg: 效果配置, allowDead = false): T | null {
  if (!ctx.world.isValid(owner) || (!allowDead && owner.死掉了) || !cfg.效果类) return null;
  const name = 函数库_技能.获取效果名(ctx, skill, cfg.效果类).效果名字;
  if (函数库_工具.附加效果前处理(ctx, cfg, owner, name).不需附加新效果) return null;
  const e = ctx.world.spawn<T>(cfg.效果类, x => {
    x.拥有者 = owner; x.释放者 = owner; x.来自技能 = skill;
    x.持续时长 = cfg.持续时间; x.触发间隔 = cfg.触发间隔; x.持续回合 = cfg.持续回合; x.叠加层数 = cfg.叠加层数; x.临时 = false;
  }, owner.K2_GetActorLocation());
  e.效果名字 = name;
  if (owner.def.name === 'BP_Actor_Equip' || owner.def.name === 'BP_Actor_Card') {
    e.OwnedGameplayTags.add('效果.时机.装上'); e.OwnedGameplayTags.add('效果.时机.卸下');
  } else if (skill?.是天赋) e.OwnedGameplayTags.add('能力.类型.天赋');
  if (!owner.拥有的效果.includes(e)) owner.拥有的效果.push(e);
  e.K2_AttachToActor(owner);
  return e;
}
