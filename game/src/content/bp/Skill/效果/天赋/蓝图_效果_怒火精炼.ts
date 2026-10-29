/** Source L137/L1086/L1745: one per event, post-remainder threshold, fixed p0 time stacks with owner cap. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能, 函数库_工具 } from '../../../../../core/bp/index.ts';
import { make效果配置 } from '../../../../../core/bp/structs.ts';
import { 科学数变普通 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import { 蓝图_效果_精神状态_光阴 } from '../玩家/精神状态/蓝图_效果_精神状态_光阴.ts';
import { applyEffect } from '../蓝图_效果_可控弹射.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_怒火精炼 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_怒火精炼';
  词条名 = '闪避%'; 触发计数 = 1; 触发阈值 = 0; 累计值 = 0;
  override 激活后触发(_d: string): void { this.触发阈值 = 函数库_技能.获取技能参数(this, this.来自技能, 1, false, '').参数值; }
  override 持续中触发(_t: Tag): void {
    const s = this.来自技能, source = s?.拥有者, o = this.拥有者; if (!s || !source || !o) return;
    const q = () => 函数库_工具.计算除余数(this, this.累计值, 1, this.触发阈值); this.累计值 = q().余数;
    if (!q().超出阈值 || !this.world.isValid(o) || o.死掉了) return;
    const cls = 蓝图_效果_精神状态_光阴.path, cfg = make效果配置({ 效果类: cls, 持续时间: -1, 触发间隔: 1, 持续回合: -1, 叠加层数: Math.trunc(函数库_技能.获取技能参数(this, s, 0, false, '').参数值), 唯一: true, 检查效果名: false, 叠加上限: Math.trunc(科学数变普通(获取科学映射词条(o.词条, '心流层上限').输出值)) });
    applyEffect(this, { cfg, owner: o, 释放者: source, 来自技能: s, 效果名: 函数库_技能.获取效果名(this, s, cls).效果名字, classOf: source }).effect?.激活效果('');
  }
}
