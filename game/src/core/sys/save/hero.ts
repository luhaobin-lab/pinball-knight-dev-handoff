/** BP_Actor_Player: ActorPreSave L22806; talent replay L7482; active cooldowns L15456 and DoT replay L8978.
 * The source recreates learned actives through their passive grant talents, then applies saved cooldowns by index.
 */
import type { SaveFns } from '../../bp/systems.ts';
import type { 蓝图_能力 } from '../../ability/ability.ts';
import type { 蓝图_效果 } from '../../ability/effect.ts';
import type { BP_Actor_Player } from '../../sim/player.ts';
import type { 结构_存档_能力, 结构_存档_持续伤害 } from '../../../content/demo/types.ts';
import { 函数库_工具, 函数库_技能 } from '../../bp/index.ts';
import { make效果配置, structOf } from '../../bp/structs.ts';
import { 比较科学数_纯正, 科学数变普通, sciOf, type 科学数 } from '../../math/sci.ts';

interface Dot extends 蓝图_效果 {
  诞生数据: string; 来源: 结构_存档_持续伤害['来源']; 类型: 结构_存档_持续伤害['类型'];
  剩余伤害: 科学数; 新增值: 科学数; 可合并: boolean;
}
const DOT = 'CatapultHero/BP/Skill/效果/蓝图_效果_持续伤害';
function record(a: 蓝图_能力, seconds: number, rounds: number): 结构_存档_能力 {
  return { 能力名: a.能力名, 技能配置: a.技能配置, 上一次等级: a.上一次等级, 等级: a.等级, 冷却秒: seconds, 冷却回合: rounds, 获取轮次: 0 };
}
function 保存天赋(p: BP_Actor_Player): void {
  p.天赋存档 = p.拥有的被动能力.filter((a): a is 蓝图_能力 => !!a?.是天赋).map(a => record(a, 0, 0));
}
function 保存主动技能(p: BP_Actor_Player): void {
  p.主动能力存档 = p.拥有的主动能力.map(a => {
    if (!a) return structOf('结构_存档_能力'); // Preserve array indices for the source cooldown replay.
    const e = a.冷却效果;
    return record(a, p.world.isValid(e) ? e.剩余时长 : a.冷却秒, p.world.isValid(e) ? e.剩余回合 : 0);
  });
}
function 保存持续伤害(p: BP_Actor_Player): void {
  p.持续伤害存档 = [];
  for (const [key, effect] of p.持续伤害实例映射) {
    const e = effect as Dot | null;
    if (!e) continue;
    const entry: 结构_存档_持续伤害 = { 诞生数据: key, 来源: e.来源, 类型: e.类型, 持续回合: e.剩余回合 - 1,
      伤害总值: { ...e.剩余伤害, 值: 科学数变普通(e.剩余伤害) } };
    if (!p.持续伤害存档.some(x => x.诞生数据 === entry.诞生数据)) p.持续伤害存档.push(entry);
  }
}
function 保存精神状态(p: BP_Actor_Player): void {
  // 精神系统 itself is a bare source return. No mental state is created here. Preserve source save updates for
  // an already existing state/effect; the three instantaneous mental effects are explicitly excluded in L94.
  for (const e of p.拥有的效果) {
    const a = e?.来自技能;
    if (!p.world.isValid(e) || !p.world.isValid(a) || !p.精神存档.has(a.能力名)) continue;
    const path = (e.constructor as { path?: string }).path ?? '';
    if (['蓝图_效果_精神状态_格挡', '蓝图_效果_精神状态_闪避', '蓝图_效果_精神状态_光阴'].some(n => path.endsWith('/' + n))) continue;
    p.精神存档.set(a.能力名, { 能力实例: null, 唯一ID: a.唯一ID, 能力等级: a.等级, 能力品质: a.品质,
      剩余回合: e.剩余回合 > 0 ? e.剩余回合 - 1 : e.剩余回合, 叠加层数: e.叠加层数 });
  }
}
function 读取天赋存档(p: BP_Actor_Player): void {
  for (const saved of p.天赋存档) {
    const cls = saved.技能配置.能力.能力类;
    if (!cls) continue; // BeginDeferredActorSpawnFromClass(None) cannot create an instance.
    const a = p.world.spawn<蓝图_能力>(cls, a => {
      a.唯一ID = saved.能力名; a.能力名 = saved.能力名; a.拥有者 = p; a.等级 = 1; a.品质 = 1; a.种子 = 0;
    });
    a.技能配置 = saved.技能配置; a.上一次等级 = saved.上一次等级; a.等级 = saved.等级;
    a.初始化(); a.子初始化(); p.添加天赋(a, a.等级, false, true);
  }
}
function 读取能力效果存档(p: BP_Actor_Player): void {
  for (let i = 0; i < p.拥有的主动能力.length; i++) {
    const a = p.拥有的主动能力[i], saved = p.主动能力存档[i];
    // Source subtracts one round and does not restore a seconds-only cooldown (L15456).
    if (a && saved && saved.冷却回合 - 1 > 0) a.创建冷却效果(saved.冷却秒, saved.冷却回合 - 1);
  }
  p.更新最大生命魔力();
  for (const saved of p.持续伤害存档) {
    const cfg = make效果配置({ 效果类: DOT, 持续时间: -1, 触发间隔: 1, 持续回合: saved.持续回合, 叠加层数: 1, 唯一: false, 检查效果名: false, 叠加上限: 999 });
    const name = 函数库_技能.获取效果名(p, p.空技能, DOT).效果名字;
    if (!p.world.isValid(p) || p.死掉了) continue;
    if (函数库_工具.附加效果前处理(p, cfg, p, name).不需附加新效果) continue;
    const e = p.world.spawn<Dot>(DOT, e => {
      e.拥有者 = p; e.释放者 = p; e.来自技能 = p.空技能; e.持续时长 = -1; e.触发间隔 = 1;
      e.持续回合 = saved.持续回合; e.叠加层数 = 1; e.临时 = false;
    });
    e.效果名字 = name;
    if (p.world.isValid(p.空技能) && p.空技能.是天赋) e.OwnedGameplayTags.add('能力.类型.天赋');
    if (!p.拥有的效果.includes(e)) p.拥有的效果.push(e); e.K2_AttachToActor(p);
    e.诞生数据 = saved.诞生数据; e.新增值 = 比较科学数_纯正(saved.伤害总值, sciOf(4, 0), false);
    e.来源 = saved.来源; e.类型 = saved.类型; e.可合并 = false;
    p.持续伤害实例映射.set(e.诞生数据, e); e.激活效果('');
  }
  for (const key of p.精神存档.keys()) p.获得精神状态(key, true);
}

export const heroSaveFns: NonNullable<SaveFns['BP_Actor_Player']> = {
  保存主动技能, 保存天赋, 保存持续伤害, 保存精神状态, 读取天赋存档, 读取能力效果存档,
  ActorPreSave(p) { p.保存主动技能(); p.保存天赋(); p.保存持续伤害(); p.保存精神状态(); },
};
