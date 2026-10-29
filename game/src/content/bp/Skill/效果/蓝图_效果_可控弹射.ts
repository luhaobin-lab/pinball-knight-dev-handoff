/**
 * 蓝图_效果_可控弹射 — the hero's controlled launch: replays the preview chain leg by leg (main legs at
 * min(2000 + 300·疲劳, 6000) uu/s, each ending in 主动激活.可控反弹 on the owner's effects, then the terminal leg at
 * 0.3 × the last speed), scores 乱舞 on destroy and ends the action.
 * Demo: CatapultHero/BP/Skill/效果/蓝图_效果_可控弹射 (dump/blueprints-pseudo/…/效果/蓝图_效果_可控弹射.txt);
 * draft launch-movement LAUNCH-028…042, LAUNCH-069…073. Parent: 蓝图_效果. Batch: core-launch-sys.
 *
 * Also the content-side access to the native launch library (`launchNative`) and the inline apply-effect node group
 * (`applyEffect`) the launch blueprints share.
 */
import { 蓝图_效果 } from '../../../../core/ability/effect.ts';
import type { 蓝图_能力 } from '../../../../core/ability/ability.ts';
import type { BpObject } from '../../../../core/sim/object.ts';
import type { BP_ManeActor } from '../../../../core/sim/actor.ts';
import type { BpCtor, HitResult, Vec3 } from '../../../../core/sim/types.ts';
import type { 效果配置 } from '../../../../core/bp/structs.ts';
import { 函数库_工具 } from '../../../../core/bp/index.ts';
import { sciOf } from '../../../../core/math/sci.ts';
import { FTrunc } from '../../../../core/math/kismet.ts';

export const PATH_反弹中 = 'CatapultHero/BP/Skill/效果/蓝图_效果_反弹中';
export const PATH_动态网格 = 'CatapultHero/BP/环境/蓝图_动态网格';

/** One 碰撞预览圈 (LaunchPreviewPathComponent included), as src/core/sys/launch/native.ts serves it. */
export interface PreviewCircleView {
  readonly 序号: number;
  readonly 当前起点位置: Vec3;
  readonly 当前终点位置: Vec3;
  readonly 反弹方向: Vec3;
  readonly OutHit: HitResult;
  readonly bUsesDeferredGravityBounce: boolean;
}

/** The native LaunchTrajectoryLibrary (module `launch`). */
export interface LaunchNative {
  DisplayedCircleCount(hero: BpObject): number;
  PreviewCircle(hero: BpObject, i: number): PreviewCircleView | null;
  CollisionPoints(hero: BpObject): Vec3[];
  ResetLegacyPreviewPlayback(actor: BpObject): void;
  GetLegacyPreviewPlaybackIndex(actor: BpObject): number;
  StartLegacyPreviewLeg(actor: BP_ManeActor, circle: number, speed: number, curveRow: string, terminal: boolean): boolean;
  WaitForLegacyLaunchLeg(requester: BpObject, actor: BP_ManeActor, then: (reachedEnd: boolean) => void): void;
  AdvanceLegacyPreviewPlayback(actor: BP_ManeActor): void;
  CancelLegacyLaunchLeg(actor: BP_ManeActor, requester: BpObject): void;
}

/** world.sys.launch.LaunchTrajectoryLibrary (SPEC-GAP contract: native libraries are not in the generated facade yet). */
export function launchNative(o: BpObject): LaunchNative {
  const n = (o.world.sys.launch as { readonly LaunchTrajectoryLibrary?: LaunchNative }).LaunchTrajectoryLibrary;
  if (!n) throw new Error('LaunchTrajectoryLibrary: module launch is missing');
  return n;
}

/** GetObjectClass(o) == 蓝图_动态网格_C. */
export const isDynamicMesh = (o: unknown): boolean => !!o && typeof o === 'object' && (o as BpObject).def?.path === PATH_动态网格;

/** 结构_效果 as the blueprints MakeStruct it. */
export function effectStruct(效果类: string, 持续时间: number, 触发间隔: number, 持续回合: number, 唯一: boolean): 效果配置 {
  return { 效果类, 持续时间, 触发间隔, 持续回合, 叠加层数: 1, 唯一, 检查效果名: false, 叠加上限: 1 };
}

const ITEM_OWNER_CLASSES = new Set(['CatapultHero/BP/Actor/BP_Actor_Card', 'CatapultHero/BP/Actor/BP_Actor_Equip']);

/**
 * The inline apply node group: 附加效果前处理 (an existing unique instance is returned as `refreshed`), else deferred
 * spawn with 拥有者 / 释放者 / 来自技能 and the struct's timings, 效果名字, the 装上/卸下 tags when `classOf` is an item
 * actor (else 能力.类型.天赋 for a talent skill), AddUnique to the owner's 拥有的效果, attach.
 */
export function applyEffect(ctx: BpObject, a: {
  cfg: 效果配置; owner: BP_ManeActor; 释放者: BP_ManeActor | null; 来自技能: 蓝图_能力 | null; 效果名: string; classOf: BpObject;
}): { effect: 蓝图_效果 | null; refreshed: boolean } {
  const pre = 函数库_工具.附加效果前处理(ctx, a.cfg, a.owner, a.效果名);
  if (pre.不需附加新效果) return { effect: pre.效果实例, refreshed: true };
  const world = ctx.world;
  const cfg = a.cfg;
  const cls = cfg.效果类;
  if (!cls) return { effect: null, refreshed: false };
  const e = world.spawn<蓝图_效果>(cls, o => {
    o.拥有者 = a.owner; o.释放者 = a.释放者; o.来自技能 = a.来自技能;
    o.持续时长 = cfg.持续时间; o.触发间隔 = cfg.触发间隔; o.持续回合 = cfg.持续回合; o.叠加层数 = cfg.叠加层数; o.临时 = false;
  });
  if (!world.isValid(e)) return { effect: null, refreshed: false }; // "效果生成失败"
  e.效果名字 = a.效果名;
  const ownerClass = (a.classOf.constructor as BpCtor).path ?? a.classOf.def.path;
  if (ITEM_OWNER_CLASSES.has(ownerClass) && !e.临时) {
    e.OwnedGameplayTags.add('效果.时机.装上');
    e.OwnedGameplayTags.add('效果.时机.卸下');
  } else if (a.来自技能 && world.isValid(a.来自技能) && a.来自技能.是天赋) {
    e.OwnedGameplayTags.add('能力.类型.天赋');
  }
  if (!a.owner.拥有的效果.includes(e)) a.owner.拥有的效果.push(e);
  e.K2_AttachToActor(a.owner);
  return { effect: e, refreshed: false };
}

/** Live index loop over an actor's effects with a timing tag (IsValid, re-read length). */
export function fireOwned(owner: BP_ManeActor, tag: string, set?: (e: 蓝图_效果) => void): void {
  const list = owner.拥有的效果;
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    if (!e || !owner.world.isValid(e) || !e.HasMatchingGameplayTag(tag)) continue;
    e.触发时机 = tag;
    set?.(e);
    e.持续中触发(tag);
  }
}

/** 乱舞 (L4532–L4827): Σ nearest-other distance (seeded 999999) × (0.015 + 0.02·n), truncated; 0 below 2 points. */
export function movementRangeOf(points: readonly Vec3[]): number {
  const n = points.length;
  if (n < 2) return 0;
  let spread = 0;
  for (let j = 0; j < n; j++) {
    let nearest = 999999.0;
    for (let i = 0; i < n; i++) {
      if (i === j) continue;
      const d = Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y, points[i].z - points[j].z);
      if (nearest > d) nearest = d;
    }
    spread += nearest;
  }
  return FTrunc(spread * (0.015 + 0.02 * n));
}

export class 蓝图_效果_可控弹射 extends 蓝图_效果 {
  static override readonly path = 'CatapultHero/BP/Skill/效果/蓝图_效果_可控弹射';
  计算初始速: boolean = true;
  已完结: boolean = false;
  Points: Vec3[] = [];
  Time: number = 0;
  反弹方向: Vec3 = { x: 0, y: 0, z: 0 };
  完成反弹: boolean = false;
  最终弹射值: number = 0;
  反弹次数: number = 0;
  记录碰撞点: Vec3[] = [];
  平均点: Vec3 = { x: 0, y: 0, z: 0 };
  散布分数: number = 0;
  最短碰撞点: number = 0;

  private get hero(): BP_ManeActor { return this.拥有者!; }

  // L7723 → L7672 → L5525 → L6029 → L7039 (LAUNCH-028)
  override 激活后触发(_Debug: string): void {
    const native = launchNative(this);
    const player = this.world.mode.玩家角色!;
    const owner = this.hero;
    const shown = native.DisplayedCircleCount(player);
    // L5525: 当前起点位置 of displayed circles 1..n−1, then 当前终点位置 of circle max(n − 1, 0) (= the leg ends).
    this.记录碰撞点 = shown > 0 ? native.CollisionPoints(player) : [{ x: 0, y: 0, z: 0 }];
    owner.当前碰撞位置 = { ...owner.当前位置 };
    owner.OwnedGameplayTags.add('状态.可控弹射');
    owner.更新朝向();
    owner.疲劳 = 0.0;
    native.ResetLegacyPreviewPlayback(owner);
    this.反弹次数 = Math.max(shown - 1, 0);
    this.最终弹射值 = shown === 0 ? 96.0 : player.最终弹射值; // ln 312 / L7596
    // L7039
    owner.疲劳了 = false;
    owner.可攻击 = true;
    owner.移动中 = true;
    this.fx.vfx('CatapultHero/粒子/粒子_轨迹', owner, { attach: true });
    this.selectLeg();
  }

  /** L884: main leg i while i ≤ 反弹次数, else the terminal leg. */
  private selectLeg(): void {
    const native = launchNative(this);
    const owner = this.hero;
    const player = this.world.mode.玩家角色!;
    const i = native.GetLegacyPreviewPlaybackIndex(owner);
    if (i > this.反弹次数) {
      // L884 → L1196 (LAUNCH-039)
      owner.OwnedGameplayTags.remove('状态.可控弹射');
      const old = 函数库_工具.存在同类效果(this, owner.拥有的效果, PATH_反弹中);
      if (old.存在相同被动) old.存在的效果?.销毁效果();
      const n = normal(this.反弹方向);
      owner.目标位置 = { x: n.x * this.最终弹射值 + owner.目标位置.x, y: n.y * this.最终弹射值 + owner.目标位置.y, z: n.z * this.最终弹射值 + owner.目标位置.z };
      const speed = Math.fround(owner.移动当前速度 * 0.3);
      if (!native.StartLegacyPreviewLeg(owner, FTrunc(this.反弹次数), speed, '可控终末确定曲线', true)) return this.failNextFrame();
      // Linkage 3058 (LAUNCH-042)
      native.WaitForLegacyLaunchLeg(this, owner, reached => {
        if (reached) owner.移动当前速度 = 0.0;
        this.销毁效果();
      });
      return;
    }
    // L1882 (LAUNCH-030)
    const circle = native.PreviewCircle(player, FTrunc(i));
    if (circle) {
      owner.目标位置 = { ...circle.当前终点位置 };
      this.反弹方向 = { ...circle.反弹方向 };
    }
    const speed = Math.fround(Math.min(owner.疲劳 * 300.0 + 2000.0, 6000.0));
    if (!native.StartLegacyPreviewLeg(owner, FTrunc(i), speed, '可控反弹曲线', false)) return this.failNextFrame();
    // Linkage 15 (LAUNCH-035)
    native.WaitForLegacyLaunchLeg(this, owner, reached => {
      if (!reached) { this.销毁效果(); return; } // L854
      owner.更新运动数据();
      fireOwned(owner, '效果.时机.主动激活.可控反弹'); // L111–L2929
      native.AdvanceLegacyPreviewPlayback(owner); // L865
      this.selectLeg();
    });
  }

  /** L3003: DelayUntilNextFrame, then 销毁效果 (LAUNCH-034). */
  private failNextFrame(): void {
    this.nextTick('L3003', () => this.销毁效果());
  }

  // L7728: 乱舞 (LAUNCH-069)
  override 销毁前触发(): void {
    const v = this.记录碰撞点.length < 2 ? 0 : movementRangeOf(this.记录碰撞点);
    this.world.mode.更新回合战斗统计('乱舞', sciOf(v, 0), v, 1, '不衰减', '');
    this.散布分数 = 0.0;
    this.记录碰撞点 = [];
  }

  // L7840: dead (no CDO timing tags)
  override 持续中触发(_触发时机: string): void {
    this.销毁效果();
  }

  // L7851: the speed gate behind 检测停止 is dead (LAUNCH-073)
  override ReceiveTick(_DeltaSeconds: number): void {}

  // L7880 → L5358 → L3244 (LAUNCH-070/071)
  ReceiveDestroyed(): void {
    const owner = this.拥有者;
    if (owner) launchNative(this).CancelLegacyLaunchLeg(owner, this);
    if (this.已完结 || !owner) return;
    this.已完结 = true;
    owner.更新运动数据();
    owner.更新朝向();
    if (this.来自技能 && this.world.isValid(this.来自技能)) this.来自技能.释放结束(false);
    owner.结束行动(null, `${this.来自技能?.能力名 ?? ''}//${this.效果名字}`);
  }
}

/** Normal(v, 0.0001). */
function normal(v: Vec3): Vec3 {
  const l2 = v.x * v.x + v.y * v.y + v.z * v.z;
  if (l2 < 0.0001) return { x: 0, y: 0, z: 0 };
  const l = Math.sqrt(l2);
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}
