/**
 * 蓝图_效果_爆炸 — an explosion: after 序号 × 0.15 s, shake, VFX, a radius-96 sweep that hits every 仇恨 actor with
 * Poison (DoT) or Explosion damage from 释放者, and at most one chained explosion 0.2 s later
 * (draft damage-crit-weakspot DAMAGE-100/101).
 * Demo: CatapultHero/BP/Skill/效果/蓝图_效果_爆炸 (dump/blueprints-pseudo/…/效果/蓝图_效果_爆炸.txt).
 * Parent: 蓝图_效果. CDO tags (manifest): 效果.时机.创建时. Batch: core-damage.
 */
import { 蓝图_效果 } from '../../../../core/ability/effect.ts';
import { 函数库_工具, 函数库_技能 } from '../../../../core/bp/index.ts';
import { make伤害, make效果配置, type HitResult } from '../../../../core/bp/structs.ts';
import { Array_Shuffle } from '../../../../core/rng/ue.ts';
import { BP_ManeActor } from '../../../../core/sim/actor.ts';
import { BP_Actor_Card } from '../../../../core/sim/card.ts';
import type { AssetPath, Vec3 } from '../../../../core/sim/types.ts';

const VFX: Partial<Record<string, AssetPath>> = { 中毒: 'CatapultHero/粒子/粒子_Hit_大肠喷射', 爆炸: 'CatapultHero/粒子/粒子_Hit_爆炸' };

export class 蓝图_效果_爆炸 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/蓝图_效果_爆炸';
  计数 = 0;
  敌人数组: (BP_ManeActor | null)[] = [];
  爆炸位置: Vec3 = { x: 0, y: 0, z: 0 };
  连锁次数 = 0;
  连锁爆炸 = false;
  序号 = 0;
  连锁几率 = 0;
  ug_OutHits: HitResult[] = [];
  ug_index = 0;
  ug_last: BP_ManeActor | null = null;

  // L8133
  override 激活后触发(_Debug: string): void {
    this.K2_DetachFromActor();
    this.delay('L8133', Math.fround(this.序号 * 0.15), () => this.explode());
  }

  // L4085…L5822
  private explode(): void {
    const w = this.world;
    this.fx.shake('摄像机晃动_零点二:500');
    const p = this.爆炸位置;
    this.fx.vfx(VFX[this.伤害数据.伤害类型] ?? null, { x: p.x, y: p.y, z: 5 });
    this.ug_OutHits = w.trace.sphere(p, { x: p.x, y: p.y, z: p.z + 100 }, 96, '3', this.释放者 ? [this.释放者] : []);
    Array_Shuffle(w.rng.combat, this.ug_OutHits); // CORE-M-129 row 65
    for (let i = 0; i < this.ug_OutHits.length; i++) { // L4993
      this.ug_index = i;
      const a = this.ug_OutHits[i].actor;
      this.ug_last = a instanceof BP_ManeActor ? a : null; // the Cast output (None on failure) the chain reads later
      if (!(a instanceof BP_ManeActor) || !a.HasMatchingGameplayTag('可交互.角色.AI.仇恨')) continue;
      if (!this.敌人数组.includes(a)) this.敌人数组.push(a);
      a.更新运动数据();
      const t = this.伤害数据.伤害类型;
      if (t !== '中毒' && t !== '爆炸') continue; // other types deal nothing
      const loc = this.ug_OutHits[i].location;
      const d = make伤害({
        伤害来源: this.伤害数据.伤害来源, 伤害类型: t, 伤害数值: this.伤害数据.伤害数值, 所需回合: 3, 触发次数: this.触发次数,
        击中点位置: loc, 击中点法线: { x: loc.x - a.当前位置.x, y: loc.y - a.当前位置.y, z: loc.z - a.当前位置.z }, 断开骨骼名: 'None',
        来自技能: this.来自技能, 来自角色: this.释放者, 来自发射物: this.伤害数据.来自发射物, 目标角色: a,
      });
      if (t === '中毒') this.释放者?.造成持续伤害(d, false, false); // L6069
      else this.释放者?.造成即时伤害(d, false, false); // L7147
      // L6904
      this.释放者?.附加效果后(this);
      if (!(函数库_工具.传统概率判断(this, this.连锁几率).触发 || this.连锁爆炸)) continue;
      if (!(this.连锁次数 > 0)) continue;
      // QUIRK: one Delay latch, so one chain link however many targets were hit (DAMAGE-101).
      this.delay('L6904', 0.2, () => this.chain());
    }
    // L5822: the PointLight branch is dead ('None' != '普通' is always true).
  }

  // Linkage 15: the chained explosion on the last cast actor at the last hit's location.
  private chain(): void {
    const w = this.world;
    const target = this.ug_last;
    const c = make效果配置({ 效果类: 蓝图_效果_爆炸.path, 持续时间: 2, 触发间隔: 1, 持续回合: -1, 叠加层数: 1, 唯一: false, 检查效果名: false, 叠加上限: 100 });
    const { 效果名字 } = 函数库_技能.获取效果名(this, this.来自技能, c.效果类);
    if (!w.isValid(target)) return; // the dead check is `if (!(false))`: skipped
    const pre = 函数库_工具.附加效果前处理(this, c, target, 效果名字);
    if (pre.不需附加新效果) return;
    const e = w.spawn<蓝图_效果_爆炸>(蓝图_效果_爆炸.path, x => {
      x.拥有者 = target; x.释放者 = this.释放者; x.来自技能 = this.来自技能;
      x.持续时长 = c.持续时间; x.触发间隔 = c.触发间隔; x.持续回合 = c.持续回合; x.叠加层数 = c.叠加层数; x.临时 = false;
    });
    if (!w.isValid(e)) return;
    e.效果名字 = 效果名字;
    const cls = (this.释放者?.constructor as { path?: AssetPath } | undefined)?.path;
    if (cls === BP_Actor_Card.path && !e.临时) { e.OwnedGameplayTags.add('效果.时机.装上'); e.OwnedGameplayTags.add('效果.时机.卸下'); }
    else if (w.isValid(this.来自技能) && this.来自技能.是天赋) e.OwnedGameplayTags.add('能力.类型.天赋');
    if (!target.拥有的效果.includes(e)) target.拥有的效果.push(e);
    e.K2_AttachToActor(target);
    e.伤害数据 = { ...this.伤害数据 };
    e.爆炸位置 = this.ug_OutHits[this.ug_index]?.location ?? this.爆炸位置;
    e.连锁爆炸 = true;
    e.连锁次数 = this.连锁次数 - 1;
    e.激活效果('');
  }
}
