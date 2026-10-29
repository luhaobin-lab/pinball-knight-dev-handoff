/** Source L4821/L2747: physical/explosion/shock/swordqi, external attacker, cancel incoming hit and save a separate nonunique debt. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make伤害 } from '../../../../../core/bp/structs.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
import { applyEffect, effectStruct } from '../蓝图_效果_可控弹射.ts';
import { 蓝图_效果_延时护符加成 } from './蓝图_效果_延时护符加成.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_延时护符 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_延时护符';
  连击计数_0 = 0;
  override 持续中触发(时机: Tag): void {
    const owner = this.拥有者, s = this.来自技能;
    if (时机 !== '效果.时机.受到伤害前' || !owner || !this.world.isValid(owner) || owner.死掉了 || !s?.拥有者 || owner === this.伤害数据.来自角色) return;
    if (!['物理', '爆炸', '剑气', '电击'].includes(this.伤害数据.伤害类型)) return;
    const cls = 蓝图_效果_延时护符加成.path;
    const r = applyEffect(this, { cfg: effectStruct(cls, -1, 1, -1, false), owner, 释放者: s.拥有者, 来自技能: s,
      效果名: 函数库_技能.获取效果名(this, s, cls).效果名字, classOf: s.拥有者 });
    if (!r.effect || r.refreshed) return;
    r.effect.伤害数据 = { ...this.伤害数据 };
    owner.当前受伤数据 = make伤害({ ...r.effect.伤害数据, 是弱点: false, 伤害数值: sciOf(0, 0), 所需回合: 3, 触发次数: 1 });
    r.effect.激活效果('');
  }
}
