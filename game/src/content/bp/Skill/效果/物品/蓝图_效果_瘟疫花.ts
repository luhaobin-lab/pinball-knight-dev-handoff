/** Source L1634/L2024/L2484: positive real healing accumulates counts, next unfinished kill-room bounce spends them on radial poison. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { 蓝图_发射物_毒气 } from '../../发射物/蓝图_发射物_毒气.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { RandomFloatInRange } from '../../../../../core/rng/ue.ts';
import { 科学数变普通, 科学数比较, sciOf, type 科学数 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_瘟疫花 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_瘟疫花';
  角度抖动 = 0; 连击计数_0 = 0; 触发次数_0 = 0; 累计计数 = 0;
  override 激活后触发(_Debug: string): void { this.无延迟连击 = true; }
  override 持续中触发(时机: Tag): void {
    if (时机 === '效果.时机.受到治疗后') { if (科学数比较(this.实际治疗值, '>', sciOf(0, 0))) this.累计计数 = (this.累计计数 + this.触发次数) | 0; return; }
    const task = this.world.mode.当前任务实例, source = this.来自技能?.拥有者;
    if (时机 !== '效果.时机.反弹时' || !(task instanceof 蓝图_能力) || !task.类型.has('能力.类型.任务.杀敌') || !(task as 蓝图_能力 & { 未完成?: boolean }).未完成 || !(this.累计计数 > 0) || !source) return;
    this.连击处理(获取科学映射词条(source.词条, '基础伤害').输出值); this.累计计数 = 0;
  }
  override 额外子触发(结算数值: 科学数, 触发次数: number): void {
    const s = this.来自技能, source = s?.拥有者, hero = this.world.mode.玩家角色; if (!s || !source || !hero) return;
    this.触发次数_0 = 触发次数; hero.更新运动数据(); const count = () => Math.imul(this.触发次数_0, this.累计计数);
    source.创建发射物组(count(), false);
    const n = Math.trunc(科学数变普通(获取科学映射词条(source.词条, '投射分裂').输出值) + hero.毒气基础数);
    const points = 函数库_技能.获取目标范围空地(this, 24, 0, n, hero, false, false, 0);
    for (let i = 0; i < points.查询到的位置.length; i++) {
      const at = points.查询到的位置[i], shot = this.world.spawn(蓝图_发射物_毒气, x => {
        x.来自角色 = source; x.来自技能 = s; x.速度 = 500; x.持续时长 = hero.毒气距离 * RandomFloatInRange(this.world.rng.combat, .75, 1);
        x.ActorRotation.Yaw = Math.fround(points.位置对应角度[i] ?? 0);
      }, { x: at.x, y: at.y, z: 5 });
      shot.伤害数值 = 结算数值; shot.触发次数 = count(); source.创建发射物(shot, count(), false);
    }
  }
}
