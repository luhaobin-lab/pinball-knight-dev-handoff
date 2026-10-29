/**
 * 蓝图_效果_可控反弹时交互 — the contact of every main leg of the controlled launch (主动激活.可控反弹): replay the
 * circle's blocking hit (手动触发碰撞 → 碰撞时 → 弹性处理 → 反弹中), then the knight's melee attack on a hostile body or
 * the hunter's ranged attack on anything else while enemies are on the field, then the mirrored contact on a touched
 * body; a deferred gravity bounce spawns 反弹中 directly. Outside the chain (反弹时 without 状态.可控弹射) a hostile
 * contact tires the hero and attacks.
 * Demo: CatapultHero/BP/Skill/效果/蓝图_效果_可控反弹时交互; draft launch-movement LAUNCH-045…061, §9.2.
 * Parent: 蓝图_效果. CDO tags (manifest): 新一天时, 创建时, 主动激活.可控反弹, 碰撞时, 行动结束后, 反弹时. Batch: core-launch-sys.
 */
import { 蓝图_效果 } from '../../../../core/ability/effect.ts';
import { BP_ManeActor } from '../../../../core/sim/actor.ts';
import type { HitResult } from '../../../../core/sim/types.ts';
import { makeHitResult } from '../../../../core/bp/structs.ts';
import { 函数库_工具, 函数库_技能 } from '../../../../core/bp/index.ts';
import { FTrunc } from '../../../../core/math/kismet.ts';
import { applyEffect, effectStruct, launchNative, PATH_反弹中 } from './蓝图_效果_可控弹射.ts';

const neg = (v: { x: number; y: number; z: number }) => ({ x: -v.x, y: -v.y, z: -v.z });

export class 蓝图_效果_可控反弹时交互 extends 蓝图_效果 {
  static override readonly path = 'CatapultHero/BP/Skill/效果/蓝图_效果_可控反弹时交互';
  碰撞墙壁触发: boolean = false;

  // L3849 (LAUNCH-056)
  override 激活后触发(_Debug: string): void {
    this.world.mode.玩家角色!.可攻击 = true;
    this.碰撞墙壁触发 = 函数库_技能.获取技能参数(this, this.来自技能, 1, false, '').参数值 === 1.0;
  }

  // L4056
  override 销毁前触发(): void {
    this.world.mode.玩家角色!.可攻击 = false;
  }

  // L4116: switch on the timing
  override 持续中触发(触发时机: string): void {
    if (触发时机 === '效果.时机.反弹时') this.onBounceOutsideChain();
    else if (触发时机 === '效果.时机.主动激活.可控反弹') this.onChainContact();
  }

  /** L4261 → L4428 (LAUNCH-045). */
  private onChainContact(): void {
    const player = this.world.mode.玩家角色!;
    const native = launchNative(this);
    const old = 函数库_工具.存在同类效果(this, player.拥有的效果, PATH_反弹中);
    if (old.存在相同被动) old.存在的效果?.销毁效果();
    const circle = () => native.PreviewCircle(player, FTrunc(native.GetLegacyPreviewPlaybackIndex(player)));
    const c = circle();
    if (!c) return;
    if (c.OutHit.blockingHit) {
      player.手动触发碰撞(c.OutHit);
      const touched = player.当前碰到谁了;
      if (!(touched instanceof BP_ManeActor)) {
        // L9342: walls, decorations (LAUNCH-058)
        if (!this.world.isValid(touched)) return;
        if (this.碰撞墙壁触发 && this.world.mode.敌方场上.length > 0) player.发动攻击(this.来自技能, makeHitResult(), true);
        return;
      }
      // L5427 (LAUNCH-057)
      if (!this.碰撞墙壁触发 && touched.HasMatchingGameplayTag('可交互.角色.AI.仇恨')) player.发动攻击(this.来自技能, makeHitResult(), false);
      // L9652: the mirrored contact (LAUNCH-054); the hit is re-read from the circle.
      const h = circle()?.OutHit ?? c.OutHit;
      const mirrored: HitResult = makeHitResult({ ...h, normal: neg(h.normal), impactNormal: neg(h.impactNormal), actor: player });
      touched.手动触发碰撞(mirrored);
      return;
    }
    // L8207: deferred gravity bounce (LAUNCH-053)
    if (!c.bUsesDeferredGravityBounce) return;
    player.当前命中目标 = c.OutHit;
    player.当前碰到谁了 = null;
    const cfg = effectStruct(PATH_反弹中, 0.2, 1.0, -1, true);
    const name = 函数库_技能.获取效果名(this, player.空技能, cfg.效果类).效果名字;
    if (!this.world.isValid(player) || player.死掉了) return; // L10
    const { effect, refreshed } = applyEffect(this, { cfg, owner: player, 释放者: player, 来自技能: player.空技能, 效果名: name, classOf: player });
    if (refreshed || !effect) return; // L79 → L10501 / L3524
    effect.命中数据 = circle()?.OutHit ?? c.OutHit;
    effect.激活效果('Deferred gravity bounce');
  }

  /** L6439 (LAUNCH-061): only outside the controlled chain. Its non-ManeActor branch (L7577) needs W && !W: dead. */
  private onBounceOutsideChain(): void {
    const player = this.world.mode.玩家角色!;
    const touched = player.当前碰到谁了;
    if (!(touched instanceof BP_ManeActor)) return;
    const ok = player.可攻击 && !player.攻击中 && touched.角色类型 !== player.角色类型
      && touched.OwnedGameplayTags.hasAny(['可交互.角色.玩家', '可交互.角色.AI.仇恨'])
      && !player.HasMatchingGameplayTag('状态.可控弹射') && !this.碰撞墙壁触发;
    if (!ok) return;
    player.疲劳 = player.疲劳 + 1.0;
    player.发动攻击(this.来自技能, makeHitResult(), false);
  }
}
