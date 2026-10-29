/** Source L2864/L235/L3913: score>=300 and cooldown gate, first child, source animation and Play timeline; Finished releases barrier then shock. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能, 函数库_工具 } from '../../../../../core/bp/index.ts';
import { applyEffect } from '../蓝图_效果_可控弹射.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_评分获得效果 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_评分获得效果';
  override 触发次数 = 0; 触发次数_0 = 0; 冷却回合 = 0; ug_评分时间 = 0;
  override 激活后触发(_d: string): void { this.冷却回合 = 0; }
  override 持续中触发(t: Tag): void {
    if (t === '效果.时机.新一天时') { this.冷却回合 -= 1; return; }
    const s = this.来自技能, o = this.拥有者; if (t !== '效果.时机.结算评分时' || !s || !o || !(this.冷却回合 <= 0 && this.world.mode.回合评分 >= 300)) return;
    this.冷却回合 = 函数库_技能.获取技能参数(this, s, 1, false, '').参数值; o.更新运动数据(); this.world.mode.加入回合开始(this);
    const cfg = s.子效果配置[0]; if (!cfg || !this.world.isValid(o) || o.死掉了) return;
    const e = applyEffect(this, { cfg, owner: o, 释放者: o, 来自技能: s, 效果名: 函数库_技能.获取效果名(this, s, cfg.效果类).效果名字, classOf: o }).effect; if (!e) return; e.激活效果('');
    const anim = s.技能动画[0]; if (anim) this.playAnim(o, anim, { completed: () => {}, cancelled: () => {} });
    this.world.bus.emit({ t: this.world.clock.now, kind: 'time.dilation', curve: 'ratingReward', from: this.world.clock.now - this.ug_评分时间 });
    this.timeline('时间轴', 'Play', { update: time => { this.ug_评分时间 = time; }, finished: () => {
      this.world.mode.退出回合开始(this);
      函数库_工具.以目标为中心释放冲击(this, o, 300, 50000, false, 0, [], false, { x: 0, y: 0, z: 0 });
      this.fx.vfx('CatapultHero/粒子/粒子_Hit_冲击波', o, { attach: true });
    } });
  }
  ReceiveDestroyed(): void {}
}
