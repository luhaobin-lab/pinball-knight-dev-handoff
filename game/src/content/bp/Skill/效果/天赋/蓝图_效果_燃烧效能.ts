/** Source L21883/L15/L1685/L17066: positive own burn creates explosions at even cross rings0/2; every loop condition draws even at P=1. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能, 函数库_工具 } from '../../../../../core/bp/index.ts';
import { make伤害, make效果配置 } from '../../../../../core/bp/structs.ts';
import { sciOf, 科学数比较 } from '../../../../../core/math/sci.ts';
import { 蓝图_效果_爆炸 } from '../蓝图_效果_爆炸.ts';
import { applyEffect } from '../蓝图_效果_可控弹射.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_燃烧效能 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_燃烧效能';
  来源名字 = '元素伤害%'; 待触发持续性伤害 = 0; 触发计数 = 1;
  override 持续中触发(t: Tag): void {
    const o = this.拥有者, s = this.来自技能, caster = this.释放者; if (t !== '效果.时机.新一天时' || !o || !s) return;
    const burn = o.总持续伤害映射.get('燃烧'); if (!burn || !科学数比较(burn.剩余值, '>', sciOf(0, 0))) return;
    caster?.更新运动数据();
    // The source switch is literal1: its alternate scattered-point branch is dead.
    for (let ring = 0; ring <= (函数库_工具.传统概率判断(this, 1).触发 ? 3 : 0); ring++) {
      if (ring % 2 !== 0) continue;
      const points = 函数库_技能.选取范围地形格_十字环(this, this.world.mode, o.K2_GetActorLocation(), ring, false).选取到的格子;
      const positions = points.length ? points : [o.K2_GetActorLocation()];
      for (const point of positions) {
        if (!this.world.isValid(o)) continue; // source does not reject a dead owner
        const cls = 蓝图_效果_爆炸.path, cfg = make效果配置({ 效果类: cls, 持续时间: 2, 触发间隔: 1, 持续回合: -1, 叠加层数: 1, 唯一: false, 检查效果名: false, 叠加上限: 100 });
        const e = applyEffect(this, { cfg, owner: o, 释放者: caster, 来自技能: s, 效果名: 函数库_技能.获取效果名(this, s, cls).效果名字, classOf: caster ?? o }).effect;
        if (!(e instanceof 蓝图_效果_爆炸)) continue;
        e.伤害数据 = make伤害({ 伤害来源: '被动', 伤害类型: '爆炸', 伤害数值: o.总持续伤害映射.get('燃烧')?.剩余值 ?? sciOf(0, 0), 所需回合: 3, 触发次数: this.world.mode.回合开始触发数, 来自技能: s, 来自角色: caster });
        e.爆炸位置 = { ...point }; e.序号 = ring; e.触发次数 = e.伤害数据.触发次数;
        caster?.附加效果前(e); e.激活效果(''); caster?.附加效果后(e);
      }
    }
  }
}
