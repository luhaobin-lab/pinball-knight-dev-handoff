/** Source L1300/L38: armour completion creates6+split sword waves using current hero armour, source card caster and talent skill owner. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { 科学数变普通 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import { 蓝图_发射物_剑气 } from '../../发射物/蓝图_发射物_剑气.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_铠甲大师 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_铠甲大师';
  计数 = 0;
  override 持续中触发(_t: Tag): void {
    const s = this.来自技能, c = this.world.cult.当前完成充能的牌, hero = this.world.mode.玩家角色; if (!s || !hero || !c?.OwnedGameplayTags.has('可交互.修炼牌.护甲')) return;
    hero.更新运动数据(); c.创建发射物组(this.触发次数, false);
    const n = (Math.trunc(科学数变普通(获取科学映射词条(c.词条, '投射分裂').输出值)) + 6) | 0;
    const r = 函数库_技能.获取目标范围空地(this, 24, 0, n, hero, false, false, 0);
    for (let i = 0; i < r.查询到的位置.length; i++) {
      const e = this.world.spawn(蓝图_发射物_剑气, x => { x.来自角色 = c; x.来自技能 = s; x.速度 = 1500; x.ActorRotation = { Pitch: 0, Yaw: Math.fround(r.位置对应角度[i] ?? 0), Roll: 0 }; }, r.查询到的位置[i]);
      e.伤害数值 = hero.当前护甲值; e.触发次数 = this.触发次数; c.创建发射物(e, 1, false);
    }
  }
  ReceiveDestroyed(): void {}
}
