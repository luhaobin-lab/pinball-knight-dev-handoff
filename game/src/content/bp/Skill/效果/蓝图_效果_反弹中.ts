/**
 * 蓝图_效果_反弹中 — one bounce (0.2 s, unique): on a player owner the hit-stop effect, item charge (疲劳 ≤ 最大疲劳 in
 * 进行战斗), the 反弹 statistics and the camera shake; on every owner the 反弹时 effects; an unstoppable enemy is
 * redirected; a touched BP_ManeActor gets the squash 可控反弹动画.
 * Demo: CatapultHero/BP/Skill/效果/蓝图_效果_反弹中 (激活后触发 L10609); draft launch-movement LAUNCH-051/052,
 * charge-infuse-echocast CHARGE-012. Parent: 蓝图_效果. Batch: core-launch-sys.
 */
import { 蓝图_效果 } from '../../../../core/ability/effect.ts';
import { BP_ManeActor } from '../../../../core/sim/actor.ts';
import type { Vec3 } from '../../../../core/sim/types.ts';
import { 函数库_工具, 函数库_技能 } from '../../../../core/bp/index.ts';
import { sciOf } from '../../../../core/math/sci.ts';
import { MapRangeClamped } from '../../../../core/math/kismet.ts';
import { applyEffect, effectStruct } from './蓝图_效果_可控弹射.ts';

const PATH_时间变速 = 'CatapultHero/BP/Skill/效果/蓝图_效果_时间变速';
const PATH_可控反弹动画 = 'CatapultHero/BP/Skill/效果/蓝图_效果_可控反弹动画';

export class 蓝图_效果_反弹中 extends 蓝图_效果 {
  static override readonly path = 'CatapultHero/BP/Skill/效果/蓝图_效果_反弹中';
  当前反弹角度: Vec3 = { x: 0, y: 0, z: 0 };
  循环反弹: boolean = false;
  入射方向: Vec3 = { x: 0, y: 0, z: 0 };

  // L10609
  override 激活后触发(_Debug: string): void {
    const owner = this.拥有者!;
    const mode = this.world.mode;
    owner.OwnedGameplayTags.add('状态.反弹中');
    if (owner.HasMatchingGameplayTag('可交互.角色.玩家')) {
      const player = mode.玩家角色;
      const cfg = effectStruct(PATH_时间变速, -1.0, 1.0, -1, true);
      const name = 函数库_技能.获取效果名(this, this.来自技能, cfg.效果类).效果名字;
      // L4807: the dead check is `if (!(false))`, so a valid player always gets the effect (L6543).
      if (player && this.world.isValid(player)) {
        const { effect } = applyEffect(this, { cfg, owner: player, 释放者: player, 来自技能: this.来自技能, 效果名: name, classOf: player });
        if (!effect) return; // L9639: "效果生成失败" ends the event
        effect.命中数据 = this.命中数据;
        effect.激活效果('');
      }
      // L4871
      if (owner.疲劳 <= owner.最大疲劳 && mode.当前环节 === '进行战斗') 函数库_技能.给装备的物品充能(this, mode, '反弹', false, 1);
      // L5330
      mode.更新回合战斗统计('反弹', sciOf(1, 0), 5, 3, '线性衰减', '');
      mode.更新轮回战斗统计('反弹', 1);
      this.fx.shake('CatapultHero/BP/摄像机晃动_零点六');
    }
    // L5624/L5670
    const list = owner.拥有的效果;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e || !this.world.isValid(e) || !e.HasMatchingGameplayTag('效果.时机.反弹时')) continue;
      e.触发时机 = '效果.时机.反弹时';
      e.命中数据 = this.命中数据;
      e.持续中触发('效果.时机.反弹时');
    }
    // L9720: unstoppable enemies are redirected (L4501 → L3312), then the squash (L9926)
    if (owner.HasMatchingGameplayTag('可交互.角色.AI.仇恨') && owner.HasMatchingGameplayTag('状态.不可阻挡')) this.redirect(owner);
    this.squash();
  }

  /** L4501 → L3312 (LAUNCH-082): reflect off the hit normal, avoid loops, +1 疲劳 below the limit and re-impulse. */
  private redirect(owner: BP_ManeActor): void {
    owner.上一次碰撞位置 = { ...owner.当前碰撞位置 };
    owner.当前碰撞位置 = { ...this.命中数据.impactPoint };
    const a = owner.上一次碰撞位置, b = owner.当前碰撞位置;
    this.入射方向 = { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
    const out = 函数库_工具.计算反弹角度(this, this.命中数据.normal, this.入射方向, false).反弹方向;
    const l = Math.hypot(out.x, out.y);
    const n2 = l * l > 0.0001 ? { x: out.x / l, y: out.y / l, z: 0 } : { x: 0, y: 0, z: 0 };
    const r = owner.避免循环反弹(n2);
    this.循环反弹 = r.循环反弹;
    this.当前反弹角度 = r.输出角度;
    owner.反弹角度历史.push({ ...this.当前反弹角度 });
    if (!(owner.疲劳 < owner.最大疲劳)) return;
    owner.疲劳 = owner.疲劳 + 1.0;
    const k = MapRangeClamped(owner.当前物理速度, 0.0, 3000.0, 800.0, 1500.0);
    const v = this.当前反弹角度;
    函数库_技能.根据体重添加冲击(this, owner, { x: v.x * 100 * k, y: v.y * 100 * k, z: v.z * 100 * k });
  }

  /** L9926 → L15 → L58: 可控反弹动画 on a touched BP_ManeActor (the dead check is `if (!(false))`: dead ones too). */
  private squash(): void {
    const target = this.命中数据.actor;
    if (!(target instanceof BP_ManeActor) || !this.world.isValid(target)) return;
    const cfg = effectStruct(PATH_可控反弹动画, -1.0, 1.0, -1, true);
    const name = 函数库_技能.获取效果名(this, this.来自技能, cfg.效果类).效果名字;
    // QUIRK (L604): the 装上/卸下 tag test reads the class of this effect's owner, not the target's.
    const { effect } = applyEffect(this, { cfg, owner: target, 释放者: this.拥有者, 来自技能: this.来自技能, 效果名: name, classOf: this.拥有者! });
    if (!effect) return;
    effect.命中数据 = this.命中数据;
    effect.激活效果('');
  }

  // L11223 → L11144
  override 销毁前触发(): void {
    this.拥有者?.OwnedGameplayTags.remove('状态.反弹中');
  }
}
