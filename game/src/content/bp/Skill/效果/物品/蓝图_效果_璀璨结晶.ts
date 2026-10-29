/** Source L4068/L214/L814: post-remainder threshold; remove every 璀璨结晶// cooldown source before adding this skill's gain. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能, 函数库_工具 } from '../../../../../core/bp/index.ts';
import { sciOf, 科学数乘除 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条, 科学映射原始值, 添加科学映射值, 移除科学映射值 } from '../../../../../core/math/stats.ts';
import { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_璀璨结晶 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_璀璨结晶';
  词条名 = '元素伤害%'; 计数 = 0; 目标牌: (BP_Actor_Card | null)[] = []; 来自牌: BP_Actor_Card | null = null; 累计值 = 0;
  override 激活后触发(_Debug: string): void { const card = this.来自技能?.拥有者; if (card instanceof BP_Actor_Card) this.来自牌 = card; }
  override 持续中触发(时机: Tag): void {
    const s = this.来自技能, owner = s?.拥有者; if (!s || !owner) return;
    if (时机 === '效果.时机.新战斗层时') { this.目标牌 = 函数库_技能.技能条件筛选物品(this, this.world.cult, s, -1).筛选后; return; }
    if (时机 === '效果.时机.结束层时') {
      this.累计值 = 0;
      for (const target of this.目标牌) if (target && this.world.isValid(target)) {
        const p = 函数库_技能.获取技能参数(this, s, 0, false, '');
        if (移除科学映射值(target.词条, p.词条, s.唯一ID)) target.更新外观数据();
      }
      return;
    }
    if (时机 !== '效果.时机.自身完成充能') return;
    const q = () => 函数库_工具.计算除余数(this, this.累计值, this.触发次数, 函数库_技能.获取技能参数(this, s, 1, false, '').参数值);
    this.累计值 = q().余数; if (!q().超出阈值) return;
    for (let i = 0; i < this.目标牌.length; i++) {
      const target = this.目标牌[i]; if (!target || !this.world.isValid(target)) continue;
      for (const key of [...(target.词条.get('加速冷却%')?.来源映射.keys() ?? [])]) {
        const split = key.indexOf('//'); if (split >= 0 && key.slice(0, split) === '璀璨结晶') 移除科学映射值(target.词条, '加速冷却%', key);
      }
      const p = 函数库_技能.获取技能参数(this, s, 0, false, ''), raw = s.参数[0];
      const base = raw?.词条.slice(0, 1).toUpperCase() === 'Y' ? 科学映射原始值(owner.词条, p.词条, true) : 获取科学映射词条(owner.词条, p.词条).输出值;
      const amount = raw?.['不预算？'] ? sciOf(p.参数值, 0) : 科学数乘除(sciOf(p.参数值, 0), base, false);
      添加科学映射值(target.词条, p.词条, s.唯一ID, 科学数乘除(amount, sciOf(q().除数, 0), false), true);
      // Source has both post-gain callbacks disabled; changing action-rate/appearance here would change behaviour.
    }
  }
}
