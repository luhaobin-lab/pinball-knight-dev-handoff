/** The source recovery statue (not the persistent EternalBox): both health/mana heals, clear current corruption. */
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { 函数库_工具, 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make治疗 } from '../../../../../core/bp/structs.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
import type { 蓝图_通用路口 } from '../../../../../core/sim/junction.ts';
export class 蓝图_能力_神像 extends 蓝图_能力 {
  static override readonly path = 'CatapultHero/BP/Skill/Ability/道具/蓝图_能力_神像';
  override 执行技能(_read: boolean): void {
    const o = this.拥有者; if (!o) return;
    函数库_工具.更新目标和自身运动数据(this, o); const target = o.当前目标; if (!this.world.isValid(target)) return;
    for (const hp of [false, true]) target.获得治疗(make治疗({ 生命护甲: hp,
      治疗百分比: sciOf(函数库_技能.获取技能参数(this, this, 0, false, '').参数值, 0),
      特效位置: { x: target.当前位置.x + target.高度, y: target.当前位置.y, z: target.当前位置.z }, 来自技能: this }), true, false);
    this.world.mode.增加腐化(-this.world.mode.当前腐化, true, null);
    for (const e of this.world.mode.环境交互物) if (e && '激活路口' in e) (e as 蓝图_通用路口).激活路口(true);
    // L1954 source cast is intentionally required; the non-Demo shrine row must not become a generic item ability.
    if (o.def.path === 'CatapultHero/BP/环境/恢复点/蓝图_角色_卡牌_血之雕像') {
      this.fx.ui({ op: 'update', widget: 'actor.audio', data: { id: o.id, fadeOut: .3 } }); this.释放结束(false);
    }
  }
  override 被选中(): void { 函数库_工具.选择角色作为目标(this, this.拥有者); }
  override 检查子条件(): void {}
  override 子初始化(): void {}
}
