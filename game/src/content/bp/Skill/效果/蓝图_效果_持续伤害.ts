/**
 * 蓝图_效果_持续伤害 — one DoT instance (Bleed / Poison / Burn): pool, per-round quarter, the per-type aggregate in
 * 拥有者.总持续伤害映射 and the end-of-round tick into 当前回合持续伤害结算 (combat-statuses COMBAT-072…080).
 * Demo: CatapultHero/BP/Skill/效果/蓝图_效果_持续伤害 (dump/blueprints-pseudo/…/效果/蓝图_效果_持续伤害.txt).
 * Parent: 蓝图_效果. CDO tags (manifest): 效果.类型.减益, 效果.时机.新一天时, 效果.时机.主动激活.结算持续伤害.
 * Batch: core-damage.
 */
import type { 蓝图_发射物 } from '../../../../core/ability/projectile.ts';
import { 蓝图_效果 } from '../../../../core/ability/effect.ts';
import { make伤害 } from '../../../../core/bp/structs.ts';
import { sciOf, 科学数乘除, 科学数加减, 科学数变普通, 科学数零, type 科学数 } from '../../../../core/math/sci.ts';
import type { AssetPath, Tag } from '../../../../core/sim/types.ts';
import type { 枚举_伤害来源, 枚举_伤害类型, 结构_持续伤害, 结构_科学数 } from '../../../demo/types.ts';

const PARTICLE: Partial<Record<枚举_伤害类型, AssetPath>> = {
  流血: 'CatapultHero/粒子/粒子_流血', 中毒: 'CatapultHero/粒子/粒子_中毒', 燃烧: 'CatapultHero/粒子/粒子_燃烧',
};
const data = (v: 科学数): 结构_科学数 => ({ 系数: v.系数, 指数: v.指数, 值: 科学数变普通(v) });

export class 蓝图_效果_持续伤害 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/蓝图_效果_持续伤害';
  特效: AssetPath | null = null;
  持续伤害总值: 科学数 = 科学数零;
  新增值: 科学数 = 科学数零;
  类型: 枚举_伤害类型 = '流血';
  来源: 枚举_伤害来源 = '攻击';
  每回合伤害: 科学数 = 科学数零;
  诞生数据 = '';
  剩余伤害: 科学数 = 科学数零;
  可合并 = false;
  是读档 = false;
  来自发射物: 蓝图_发射物 | null = null;

  // L5652 → L5555 → L10
  override 激活后触发(_Debug: string): void {
    const o = this.拥有者;
    if (!o) return;
    this.持续伤害总值 = 科学数加减(this.新增值, this.持续伤害总值, false);
    this.剩余伤害 = this.持续伤害总值; // on a merge this restores the full total
    this.每回合伤害 = 科学数乘除(this.持续伤害总值, sciOf(this.持续回合 + 1, 0), true);
    const cur = o.总持续伤害映射.get(this.类型);
    if (!cur) { // L800
      const p = PARTICLE[this.类型] ?? null;
      this.fx.vfx(p, o, { attach: true });
      this.特效 = p;
      o.总持续伤害映射.set(this.类型, { 粒子特效: this.特效, 来源数: 1, 剩余值: data(this.持续伤害总值) });
    } else {
      const 剩余值 = data(科学数加减(cur.剩余值, this.新增值, false));
      o.总持续伤害映射.set(this.类型, { 粒子特效: cur.粒子特效, 来源数: this.可合并 ? cur.来源数 : cur.来源数 + 1, 剩余值 }); // L1710
    }
    o.更新剩余持续伤害(); // L759
  }

  // L5657 → L2162: the tick only reacts to the settlement trigger (新一天时 only counts the rounds down).
  override 持续中触发(触发时机: Tag): void {
    if (触发时机 !== '效果.时机.主动激活.结算持续伤害') return;
    const o = this.拥有者;
    if (!o) return;
    o.更新运动数据();
    const at = { x: o.当前位置.x + o.高度, y: o.当前位置.y, z: o.当前位置.z };
    const key = this.类型; // GetEnumeratorUserFriendlyName
    const prev = o.当前回合持续伤害结算.get(key);
    o.当前回合持续伤害结算.set(key, prev
      ? make伤害({ 伤害来源: prev.伤害来源, 伤害类型: prev.伤害类型, 伤害数值: 科学数加减(this.每回合伤害, prev.伤害数值, false), 所需回合: 3, 触发次数: 1, 击中点位置: at, 击中点法线: { x: -1, y: 0, z: 0 }, 断开骨骼名: 'None', 来自技能: null, 来自角色: o, 目标角色: o })
      : make伤害({ 伤害来源: this.来源, 伤害类型: this.类型, 伤害数值: this.每回合伤害, 所需回合: 3, 触发次数: 1, 击中点位置: at, 击中点法线: { x: 1, y: 0, z: 0 }, 断开骨骼名: 'None', 来自技能: this.来自技能, 来自角色: o, 目标角色: o }));
    this.剩余伤害 = 科学数加减(this.剩余伤害, this.每回合伤害, true); // no floor at 0
    const agg = o.总持续伤害映射.get(this.类型);
    if (!agg) return;
    o.总持续伤害映射.set(this.类型, { ...agg, 剩余值: data(科学数加减(agg.剩余值, this.每回合伤害, true)) });
    o.更新剩余持续伤害();
  }

  // L4238
  override 销毁前触发(): void {
    const o = this.拥有者;
    if (!o) return;
    if (this.world.mode.当前环节 === '创建房间') return this.stopVfx(); // L4305: room rebuild, VFX only
    o.持续伤害实例映射.delete(this.诞生数据);
    const agg: 结构_持续伤害 | undefined = o.总持续伤害映射.get(this.类型);
    if (!agg) return this.stopVfx();
    if (agg.来源数 - 1 === 0) {
      if (agg.粒子特效) this.fx.vfx(null, o, { attach: true }); // 生成速率 0 + Deactivate
      o.总持续伤害映射.delete(this.类型);
      o.更新剩余持续伤害(); // L2121
      return;
    }
    // L5139: QUIRK — no UI refresh on this branch.
    o.总持续伤害映射.set(this.类型, { ...agg, 来源数: agg.来源数 - 1, 剩余值: data(科学数加减(agg.剩余值, this.剩余伤害, true)) });
  }

  private stopVfx(): void {
    if (this.特效 && this.拥有者) this.fx.vfx(null, this.拥有者, { attach: true });
  }
}
