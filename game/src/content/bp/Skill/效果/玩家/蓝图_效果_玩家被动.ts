/**
 * 蓝图_效果_玩家被动 — the hero passive every hero row carries (SCM-013/016/050/061/103, TURN-052): −5 Stamina at every
 * hero action end then 执行AI行动 when enemies are on the field; the Fatigue/Energized grant on every Stamina change;
 * Pain on a hit of 30 % of max HP or more; the floor-end 15 % HP and Stamina restore; turn-start 加速点 in 杀敌 missions.
 * Demo: CatapultHero/BP/Skill/效果/玩家/蓝图_效果_玩家被动 (pseudo L15…L9560).
 * Parent: 蓝图_效果. CDO tags (manifest): 新一天时, 死亡前, 新一层时, 房间完毕时, 行动结束后, 释放技能后, 减少体力后,
 * 增加体力后, 受到伤害后, 结束层时, 进入战斗时. Row: 数据表_技能_默认.玩家被动. Batch: core-stamina.
 */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import type { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { 函数库_工具, 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make治疗, make效果配置 } from '../../../../../core/bp/structs.ts';
import { FCeil } from '../../../../../core/math/kismet.ts';
import { 科学数乘除, 科学数加减, 科学数变普通, 科学数零 } from '../../../../../core/math/sci.ts';
import type { BP_ManeActor } from '../../../../../core/sim/actor.ts';
import type { TagSet } from '../../../../../core/sim/tags.ts';
import type { AssetPath, Tag, Vec3 } from '../../../../../core/sim/types.ts';

const 饥饱Path: AssetPath = 'CatapultHero/BP/Skill/效果/玩家/精神状态/蓝图_效果_精神状态_饥饱';
const 加速点Path: AssetPath = 'CatapultHero/BP/Skill/效果/可拾取物/蓝图_可拾取物_加速点';
const 零向量: Vec3 = { x: 0, y: 0, z: 0 };

export class 蓝图_效果_玩家被动 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/玩家/蓝图_效果_玩家被动';
  破绽记数 = 1;
  受过伤害 = false; // 受过伤害？
  连击重置计数 = 0;
  无伤重置计数 = 0;
  蓄力获取累计 = 0;
  腐化计数 = 1;
  额外疲劳 = 0;
  空技能: 蓝图_能力 | null = null;
  触发过濒死 = false; // 触发过濒死？ (dead: only reset)
  待破绽数量 = 2;
  敌方场上: (BP_ManeActor | null)[] = [];
  已有破绽数量 = 2;
  临时数值 = 0;
  加速点数量 = 1;

  /** L9353 / L9352: empty. The 时间轴 timeline (time dilation and a shockwave) is never played (dead). */
  override 激活后触发(_Debug: string): void {}
  override 销毁前触发(): void {}

  /** L1748 (no parent call). */
  override 持续中触发(触发时机: Tag): void {
    switch (触发时机) {
      case '效果.时机.新一层时': this.触发过濒死 = false; return; // L1570
      case '效果.时机.新一天时': this.回合开始(); return; // L2287
      case '效果.时机.房间完毕时': this.fx.ui({ op: 'update', widget: 'UI_背包栏_3d.更新技能栏' }); return; // L1667
      case '效果.时机.行动结束后': this.行动结束(); return; // L4345
      case '效果.时机.减少体力后':
      case '效果.时机.增加体力后': this.饥饱判断(); return; // L4536
      case '效果.时机.受到伤害后': this.疼痛判断(); return; // L5129
      case '效果.时机.结束层时': this.结束层(); return; // L782
      default: return;
    }
  }

  /** L4345 → L1533 → L1437 (SCM-013, TURN-052): no phase or combat gate. */
  private 行动结束(): void {
    const owner = this.拥有者!;
    函数库_工具.修改体力点(this, { 系数: -5, 指数: 0 }, 科学数零, owner, owner, false, 零向量);
    if (!this.world.mode.场上有敌人) return;
    // SPEC-GAP: CapsuleComponent.SetSimulatePhysics(false) has no core counterpart (no capsule physics in the core).
    this.world.mode.执行AI行动();
  }

  /**
   * L4536 (SCM-061): no 饥饱 on the owner (exact class, flagged instances count) and (pct ≤ 0.25 or an overflow):
   * 饥饿 at pct ≤ 0.25, else 饱腹.
   */
  private 饥饱判断(): void {
    const owner = this.拥有者!;
    const has = 函数库_工具.存在同类效果(this, owner.拥有的效果, 饥饱Path).存在相同被动;
    if (!(!has && (owner.魔力百分比 <= 0.25 || owner.溢出的体力.系数 > 0))) return;
    this.world.mode.玩家角色?.获得精神状态(owner.魔力百分比 <= 0.25 ? '饥饿' : '饱腹', false);
  }

  /** L5129 (SCM-103): r = (当前受伤数值 − X) / 当前最大生命 with X = armour left, or 0 for DoT types. */
  private 疼痛判断(): void {
    const owner = this.拥有者!;
    const dot = this.world.mode.持续伤害类型.includes(this.伤害数据.伤害类型);
    const r = 科学数变普通(科学数乘除(科学数加减(owner.当前受伤数值, dot ? 科学数零 : owner.当前护甲值, true), owner.当前最大生命, true));
    if (r >= 0.3) this.world.mode.玩家角色?.获得精神状态('疼痛', false);
  }

  /** L782 → L411 (SCM-016): heal 15 % if hurt, then restore min(1 − pct, 0.15) of max Stamina with a popup. */
  private 结束层(): void {
    const owner = this.拥有者!;
    if (owner.生命百分比 < 1.0) {
      owner.获得治疗(make治疗({
        是暴击: false, 生命护甲: false, 治疗整数: 科学数零, 治疗百分比: { 系数: 0.15, 指数: 0 }, 触发次数: 1,
        特效位置: { ...零向量 }, 来自技能: this.来自技能, 释放者: owner,
      }), false, false);
    }
    if (!(owner.魔力百分比 < 1.0)) return;
    函数库_工具.修改体力点(this, 科学数零, { 系数: Math.min(1.0 - owner.魔力百分比, 0.15), 指数: 0 }, owner, owner, true, 零向量);
  }

  /** L2287 → L2776: the (no-op) morale call; in 杀敌 missions the 加速点 pickups around the hero (TURN-025). */
  private 回合开始(): void {
    const mode = this.world.mode;
    const hero = mode.玩家角色;
    const 任务类型 = (this.world.isValid(mode.当前任务实例) ? (mode.当前任务实例 as unknown as { 类型?: TagSet }).类型 : undefined);
    const 杀敌 = 任务类型?.has('能力.类型.任务.杀敌') ?? false;
    const 探索 = 任务类型?.has('能力.类型.任务.探索') ?? false;
    this.临时数值 = 任务类型 ? (探索 ? -5 : 杀敌 ? 0 : -3) : 0; // L4317 without a mission
    if (hero) {
      const 神智 = -1 + 0 + hero.总持续伤害映射.size * -1 + FCeil(Math.min(科学数变普通(hero.当前魔力), 0) / 3);
      hero.精神系统(神智, -1 + this.临时数值, '被动回合开始', true);
    }
    if (!杀敌 || !hero) return;
    const { 选到的点 } = 函数库_工具.范围选取点(this, hero.K2_GetActorLocation(), 320, 1200, 64, this.加速点数量, true, 64);
    for (let i = 0; i < 选到的点.length; i++) this.生成加速点(选到的点[i]!);
    // L1582 → L1247
    this.fx.ui({ op: 'update', widget: 'UI_背包栏_3d.更新技能栏' });
    // SPEC-GAP: CapsuleComponent.SetSimulatePhysics(true) has no core counterpart.
    this.fx.vfx('CatapultHero/粒子/粒子_Tip_01', this.拥有者!, { attach: true });
  }

  /** L3739 loop body → L5797 → L6152 → L8527: a 加速点 effect on the hero, detached and moved to the point. */
  private 生成加速点(at: Vec3): void {
    const cfg = make效果配置({ 效果类: 加速点Path, 持续时间: -1, 触发间隔: 1, 持续回合: 0, 叠加层数: 1, 唯一: false, 检查效果名: false, 叠加上限: 1 });
    const { 效果名字 } = 函数库_技能.获取效果名(this, this.来自技能, cfg.效果类);
    const hero = this.world.mode.玩家角色;
    if (!this.world.isValid(hero) || hero.死掉了) return;
    const pre = 函数库_工具.附加效果前处理(this, cfg, hero, 效果名字);
    if (pre.不需附加新效果) return;
    const 来自技能 = this.来自技能;
    const e = this.world.spawn<蓝图_效果>(加速点Path, x => {
      x.拥有者 = hero;
      x.释放者 = hero;
      x.来自技能 = 来自技能;
      x.持续时长 = cfg.持续时间;
      x.触发间隔 = cfg.触发间隔;
      x.持续回合 = cfg.持续回合;
      x.叠加层数 = cfg.叠加层数;
      x.临时 = false;
    });
    if (!this.world.isValid(e)) return; // L9271 "效果生成失败"
    e.效果名字 = 效果名字;
    // The 装上/卸下 tags need the hero to be BP_Actor_Card / BP_Actor_Equip: never.
    if (this.world.isValid(来自技能) && 来自技能.是天赋) e.OwnedGameplayTags.add('能力.类型.天赋'); // L9119
    if (!hero.拥有的效果.includes(e)) hero.拥有的效果.push(e); // L8527 AddUnique
    e.K2_AttachToActor(hero);
    e.K2_DetachFromActor();
    e.K2_SetActorLocation(at);
    e.激活效果('');
  }
}
