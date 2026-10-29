/** Elite 吸血, ENEMY--084; pseudo L605/L1264/L1444. Only 攻击 damage heals, by own max HP. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make治疗 } from '../../../../../core/bp/structs.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';

export class 蓝图_效果_吸血 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/敌人/蓝图_效果_吸血';
  计数 = 0;
  override 激活后触发(_Debug: string): void {
    if (this.拥有者) this.fx.ui({ op: 'update', widget: '精英吸血', data: { actor: this.拥有者.id, range: this.拥有者.高度, active: true } });
  }
  override 持续中触发(tag: Tag): void {
    const owner = this.拥有者;
    if (!owner) return;
    if (tag === '效果.时机.死亡前') { this.fx.ui({ op: 'update', widget: '精英吸血', data: { actor: owner.id, active: false } }); return; }
    if (tag !== '效果.时机.造成伤害后' || this.伤害数据.伤害来源 !== '攻击') return;
    owner.更新运动数据();
    owner.获得治疗(make治疗({
      治疗百分比: sciOf(函数库_技能.获取技能参数(this, this.来自技能, 0, false, '').参数值, 0),
      触发次数: this.伤害数据.触发次数,
      特效位置: { x: owner.当前位置.x + owner.高度, y: owner.当前位置.y, z: owner.当前位置.z },
      来自技能: this.来自技能, 释放者: owner,
    }), true, false);
    this.fx.vfx('CatapultHero/粒子/粒子_自愈_02', owner, { attach: true });
  }
  override ReceiveTick(_dt: number): void {} // source override is empty, not base countdown
  override 销毁前触发(): void {}
}
