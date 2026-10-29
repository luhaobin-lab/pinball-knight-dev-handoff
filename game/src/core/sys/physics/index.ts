/**
 * Module `physics` (WAVE_A Appendix W2, card core-physics): the enemies' and props' physics (impulses, mass, the speed
 * cap, corpse settling, radial shocks, space queries) and the deterministic solver behind them (solver.ts).
 * Sources: draft launch-movement §5.9, §J (LAUNCH-074…084), §K (LAUNCH-085…088); pseudo BP_ManeActor (更新角色质量
 * #2055, 物理判断 #4693), BP_Actor_Other (物理终止检测 L13504, 实时检测 L8393), 蓝图_主角色控制器 (跟随, 移动到),
 * 函数库_工具 and 函数库_技能 (functions below, line numbers in comments).
 *
 * Trace channels (DefaultEngine.ini, launch-movement §5.9): ETraceTypeQuery 3 = 可伤害, 4 = 地形; core-sim's traces
 * take the channel name (SPEC-GAP until it honours channels: 可伤害 should ignore the room geometry).
 */
import { 函数库_技能, 函数库_工具 } from '../../bp/index.ts';
import { makeHitResult, structOf } from '../../bp/structs.ts';
import type { PhysicsFns } from '../../bp/systems.ts';
import type { SysModule } from '../../api/compose.ts';
import { 科学数变普通 } from '../../math/sci.ts';
import { 获取科学映射词条 } from '../../math/stats.ts';
import { FClamp } from '../../math/kismet.ts';
import { FRand, RandomFloatInRange, type Rand15 } from '../../rng/ue.ts';
import { BP_ManeActor } from '../../sim/actor.ts';
import { isHiddenInGame } from '../../sim/engine.ts';
import type { BpObject } from '../../sim/object.ts';
import type { HitResult, Vec3 } from '../../sim/types.ts';
import { AddForce, AddImpulse, GetPhysicsLinearVelocity, IsSimulatingPhysics, LaunchCharacter, Normal2D, SetMassOverrideInKg, SetPhysicsLinearVelocity, speedOf } from './capsule.ts';
import { track, watch } from './solver.ts';
import { boxTraceActors, dynamicTerrainBoxes, setTerrainCollision, sphereTraceActors } from './terrain.ts';
import { moveEffectOverlaps } from './boss-overlap.ts';
import { finalSweptMove } from './swept-move.ts';
import { initialiseTerrainOverlaps, initialiseEnvironmentOverlaps } from './terrain-overlap.ts';
import { registerEffectSphere, simulateEffectSphere, impulseEffectSphere, forceEffectSphere, effectBodyShapes } from './effect-body.ts';
import { registerPickupBox,impulsePickupBox,pickupBoxShapes } from './pickup-box.ts';

/** ETraceTypeQuery → trace channel (TraceTypeQuery1 Visibility, 2 Camera, then the custom trace channels in order). */
export const TRACE_CHANNELS: Readonly<Record<number, string>> = { 0: 'Visibility', 1: 'Camera', 2: 'mouse', 3: '可伤害', 4: '地形', 5: '物品', 6: '迷雾' };
const channelOf = (q: number): string => TRACE_CHANNELS[q] ?? 'Visibility';

const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const scale = (a: Vec3, k: number): Vec3 => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const sameVec = (a: Vec3, b: Vec3): boolean => a.x === b.x && a.y === b.y && a.z === b.z;
const live = (xs: readonly (BpObject | null)[]): BpObject[] => xs.filter((x): x is BpObject => x !== null);

/** KismetMathLibrary::RotateAngleAxis about +Z (degrees as float32, like the Demo's implicit cast). */
export function rotateZ(v: Vec3, deg: number): Vec3 {
  const r = Math.fround(deg) * (Math.PI / 180);
  const c = Math.cos(r), s = Math.sin(r);
  return { x: v.x * c - v.y * s, y: v.x * s + v.y * c, z: v.z };
}

/**
 * KismetMathLibrary::RandomUnitVector = FMath::VRand(): rejection sampling of FRand·2−1 per axis until
 * 0 < |v|² ≤ 1 (KINDA_SMALL_NUMBER 1e-4), then normalised. SPEC-GAP (CORE-M-120): the Demo's exact draw count is not
 * disassembled; this is the engine source's algorithm on the combat stream (CORE-M-129 row 145).
 */
export function RandomUnitVector(g: Rand15): Vec3 {
  for (;;) {
    const x = FRand(g) * 2 - 1, y = FRand(g) * 2 - 1, z = FRand(g) * 2 - 1;
    const l = x * x + y * y + z * z;
    if (l <= 1 && l >= 1e-4) {
      const k = 1 / Math.sqrt(l);
      return { x: x * k, y: y * k, z: z * k };
    }
  }
}

/**
 * SphereTraceMulti on a trace channel. SPEC-GAP until core-sim's traces honour channels: the responses are applied
 * here (DefaultEngine.ini: Pawn capsules block 可伤害 and ignore 地形; the room geometry blocks 地形 and ignores
 * 可伤害), so a static solid before a body can still hide it on 可伤害.
 */
export function sphereMulti(ctx: BpObject, from: Vec3, to: Vec3, radius: number, q: number, ignore: readonly (BpObject | null)[]): HitResult[] {
  const channel = channelOf(q);
  if (channel === '可伤害' && from.x === to.x && from.y === to.y && typeof (ctx.world as { objects?: unknown }).objects === 'function') {
    return sphereTraceActors(ctx.world, from, to, Math.fround(radius), ignore);
  }
  const hits = ctx.world.trace.sphere(from, to, Math.fround(radius), channel, live(ignore));
  if (channel === '地形') return hits.filter(h => !(h.actor instanceof BP_ManeActor));
  if (channel === '可伤害') return hits.filter(h => h.actor instanceof BP_ManeActor);
  return hits;
}

/** Gate of 物理终止检测 (an ubergraph Gate local that survives the Delay, §7.4: `ug_`). */
type Settling = BP_ManeActor & { ug_物理终止门?: boolean };

export const physics: SysModule & PhysicsFns & { sphereMulti: typeof sphereMulti; boxTraceActors: typeof boxTraceActors; dynamicTerrainBoxes: typeof dynamicTerrainBoxes; setTerrainCollision: typeof setTerrainCollision; moveEffectOverlaps: typeof moveEffectOverlaps; finalSweptMove: typeof finalSweptMove; initialiseTerrainOverlaps:typeof initialiseTerrainOverlaps;
  registerEffectSphere: typeof registerEffectSphere; simulateEffectSphere: typeof simulateEffectSphere; impulseEffectSphere: typeof impulseEffectSphere; forceEffectSphere: typeof forceEffectSphere; effectBodyShapes: typeof effectBodyShapes;
  registerPickupBox:typeof registerPickupBox;impulsePickupBox:typeof impulsePickupBox;pickupBoxShapes:typeof pickupBoxShapes;initialiseEnvironmentOverlaps:typeof initialiseEnvironmentOverlaps } = {
  sphereMulti, boxTraceActors, dynamicTerrainBoxes, setTerrainCollision, moveEffectOverlaps, finalSweptMove, initialiseTerrainOverlaps,
  registerEffectSphere, simulateEffectSphere, impulseEffectSphere, forceEffectSphere, effectBodyShapes,
  registerPickupBox,impulsePickupBox,pickupBoxShapes,initialiseEnvironmentOverlaps,
  BP_ManeActor: {
    // #2055 (LAUNCH-076): body mass = 质量, clamped to [初始质量 × 0.5, 300] unless 无限制.
    更新角色质量(self, 无限制) {
      const 质量 = 科学数变普通(获取科学映射词条(self.词条, '质量').输出值);
      SetMassOverrideInKg(self, 无限制 ? 质量 : FClamp(质量, self.初始质量 * 0.5, 300.0));
    },

    // #4693 (LAUNCH-078): read the physics speed; above 最大物理速度 clamp to it in combat, to 200 otherwise.
    物理判断(self) {
      const v = GetPhysicsLinearVelocity(self);
      self.当前物理速度 = Math.hypot(v.x, v.y, v.z);
      self.速度方向 = Normal2D(v, 0.0001);
      if (!(Math.hypot(v.x, v.y, v.z) > self.最大物理速度)) return;
      const cap = self.游戏模式?.当前环节 !== '进行战斗' ? 200.0 : self.最大物理速度;
      SetPhysicsLinearVelocity(self, scale(self.速度方向, cap));
    },
  },

  BP_Actor_Other: {
    // L13504: Delay 0.2, then the Gate opens; 实时检测 (L8393, every tick) settles the corpse once it is below 5 uu/s.
    // The Gate branch of 实时检测 runs here, at each frame boundary, so the ai module's 实时检测 must not repeat it.
    物理终止检测(self) {
      self.delay('L13504', 0.2, () => {
        const s = self as Settling;
        s.ug_物理终止门 = true;
        watch(self.world, {
          frame: () => {
            if (!self.valid || !s.ug_物理终止门) return false;
            if (!(speedOf(self) < 5.0)) return true;
            // L8403
            self.关闭碰撞();
            self.setTickEnabled(false);
            self.更新运动数据();
            // PaperFlipbook translucency sort −5 and the sprite 1 uu lower: presentation (the corpse lies under the living).
            s.ug_物理终止门 = false; // L980 → L990: the Gate closes
            return false;
          },
        });
      });
    },
  },

  蓝图_主角色控制器: {
    // AddMovementInput on the possessed pawn: CharacterMovement is inactive (bAutoActivate false), so nothing moves.
    // No live caller (grep of every pseudo file).
    跟随() {},
    // SimpleMoveToLocation (navigation; no live caller): SPEC-GAP, the pawn is placed at the goal; the cursor VFX plays.
    移动到(self, Location) {
      const pawn = self.玩家角色;
      if (pawn) pawn.K2_SetActorLocation({ ...Location, z: pawn.K2_GetActorLocation().z });
      self.fx.vfx(self.光标特效, Location);
    },
  },

  函数库_工具: {
    // line 278: the BP_ManeActors of the hits that are enemies of 释放者, unique, in hit order.
    获取碰撞体包含的敌人(ctx, 释放者, 碰撞信息) {
      const 敌人们: (BP_ManeActor | null)[] = [];
      for (let i = 0; i < 碰撞信息.length; i++) {
        const a = 碰撞信息[i]!.actor;
        if (!(a instanceof BP_ManeActor)) continue;
        if (!函数库_工具.是敌人(ctx, 释放者, a).是敌人) continue;
        if (!敌人们.includes(a)) 敌人们.push(a);
      }
      return { 敌人们 };
    },

    // line 1579: a sphere trace from 200 uu above the centre down to it (an overlap query in the plane).
    以目标为中心追踪(ctx, 目标, Radius, TraceChannel, _DrawDebugType, ActorsToIgnore, 指定坐标, 指定坐标_2) {
      if (指定坐标) {
        const OutHits = sphereMulti(ctx, add(指定坐标_2, { x: 0, y: 0, z: 200 }), 指定坐标_2, Radius, TraceChannel, ActorsToIgnore);
        return { 目标所在位置: { ...指定坐标_2 }, OutHits };
      }
      // L313. QUIRK: the ref array of the caller gains 目标 (Array_AddUnique on the by-ref ActorsToIgnore).
      if (!ActorsToIgnore.includes(目标)) ActorsToIgnore.push(目标);
      const at = 目标?.K2_GetActorLocation() ?? { x: 0, y: 0, z: 0 };
      const OutHits = sphereMulti(ctx, add(at, { x: 0, y: 0, z: 200 }), at, Radius, TraceChannel, ActorsToIgnore);
      return { 目标所在位置: 目标?.K2_GetActorLocation() ?? { x: 0, y: 0, z: 0 }, OutHits };
    },

    // line 1603: AddForce(Normal2D(actor − centre) × 冲击力) on every BP_ManeActor in range (no immovable / hidden test).
    以目标为中心施加持续力(ctx, 目标, 范围, 冲击力, DrawDebugType, ActorsToIgnore, 指定坐标, 指定坐标_2) {
      const 命中角色: (BP_ManeActor | null)[] = [];
      const t = 函数库_工具.以目标为中心追踪(ctx, 目标, 范围, 3, DrawDebugType, ActorsToIgnore, 指定坐标, 指定坐标_2);
      for (const h of t.OutHits) {
        const a = h.actor;
        if (!(a instanceof BP_ManeActor)) continue;
        if (!命中角色.includes(a)) 命中角色.push(a);
        a.开启碰撞();
        const centre = 指定坐标 ? 指定坐标_2 : t.目标所在位置;
        const p = a.K2_GetActorLocation();
        AddForce(a, scale(Normal2D({ x: p.x - centre.x, y: p.y - centre.y, z: p.z - centre.z }), 冲击力));
        track(ctx.world, a);
      }
      return { 命中数据: t.OutHits, 命中角色 };
    },

    // line 1859 (LAUNCH-086): a radial AddImpulse(Normal2D(actor − centre) × 冲击力), or a random direction; skips
    // 可交互.角色.AI.不可动 and hidden actors. RandomUnitVector is drawn for every pushed actor, used or not (row 145).
    以目标为中心释放冲击(ctx, 目标, 范围, 冲击力, 随机方向, DrawDebugType, ActorsToIgnore, 指定坐标, 指定坐标_2) {
      const 命中角色: (BP_ManeActor | null)[] = [];
      const t = 函数库_工具.以目标为中心追踪(ctx, 目标, 范围, 3, DrawDebugType, ActorsToIgnore, 指定坐标, 指定坐标_2);
      for (const h of t.OutHits) {
        const a = h.actor as BpObject | null;
        // InterfaceCast<GameplayTagAssetInterface>: every BpObject owns tags; static geometry (null) does not.
        const immovable = a !== null && a.HasMatchingGameplayTag('可交互.角色.AI.不可动');
        if (immovable || (a !== null && isHiddenInGame(a))) continue;
        // L1208
        if (!(a instanceof BP_ManeActor)) continue;
        if (!命中角色.includes(a)) 命中角色.push(a);
        a.开启碰撞();
        const p = a.K2_GetActorLocation();
        const random = RandomUnitVector(ctx.world.rng.combat);
        const centre = 指定坐标 ? 指定坐标_2 : t.目标所在位置;
        const dir = Normal2D(随机方向 ? random : { x: p.x - centre.x, y: p.y - centre.y, z: p.z - centre.z }, 0.0001);
        AddImpulse(a, scale(dir, 冲击力));
        track(ctx.world, a);
      }
      return { 命中数据: t.OutHits, 命中角色 };
    },

    // line 2767 (LAUNCH-087, dead): LaunchCharacter(forward × 冲击力), which the inactive CharacterMovement ignores.
    冲击目标(_ctx, 目标, _释放者, 冲击力) {
      if (目标 instanceof BP_ManeActor) LaunchCharacter(目标, { x: 冲击力, y: 0, z: 0 });
    },
  },

  函数库_技能: {
    // line 486: is there room for 角色 (radius 高度 × 范围修正) at 检查位置? A sphere trace up 600 uu, ignoring 角色.
    角色检查目标位置空间(ctx, 角色, 范围修正, 检查位置, 位置扫描) {
      const r = (角色?.高度 ?? 0) * 范围修正;
      const hits = sphereMulti(ctx, 检查位置, add(检查位置, { x: 0, y: 0, z: 600 }), r, 位置扫描, [角色]);
      const OutHit = hits[0] ?? makeHitResult();
      return { OutHit, 有足够空间: hits.length === 0 };
    },

    // line 544: 数量 points on a circle of radius 检测距离 + 目标.高度 around the target (z 5), every 360/数量 degrees
    // (+ a jitter), kept when a sphere of 查询者尺寸 there hits nothing on the 地形 channel. The jitter draw is made
    // whether or not 角度抖动 is set (row 150).
    获取目标范围空地(ctx, 查询者尺寸, 检测距离, 数量, 目标角色, 角度抖动, 显示指示) {
      const 查询到的位置: Vec3[] = [];
      const 位置对应角度: number[] = [];
      if (!ctx.world.isValid(目标角色)) return { 查询到的位置, 位置对应角度 };
      const draw = RandomFloatInRange(ctx.world.rng.combat, 0.0, 90.0);
      const jitter = 角度抖动 ? draw : 0.0;
      const step = Math.trunc(360 / 数量);
      for (let i = 0; i <= 数量 - 1; i++) {
        const p = 目标角色.K2_GetActorLocation();
        const angle = i * step + jitter;
        const at = add(rotateZ({ x: 检测距离 + 目标角色.高度, y: 0, z: 0 }, angle), { x: p.x, y: p.y, z: 5.0 });
        const hit = sphereMulti(ctx, at, add(at, { x: 0, y: 0, z: 100 }), 查询者尺寸, 4, []).length > 0;
        if (hit) continue;
        // L1603: Array_AddUnique compares vectors and doubles by value.
        if (!查询到的位置.some(q => sameVec(q, at))) 查询到的位置.push(at);
        if (!位置对应角度.includes(angle)) 位置对应角度.push(angle);
      }
      if (显示指示) {
        目标角色.切换指示箭头(true, '多向投射', Math.fround(查询者尺寸), 查询到的位置, 位置对应角度, structOf('结构_地形选取配置'), null);
      }
      return { 查询到的位置, 位置对应角度 };
    },

    // line 616: AddImpulse only when the capsule simulates physics.
    给有物理添加冲量(ctx, 目标, Impulse) {
      if (!目标 || !IsSimulatingPhysics(目标)) return;
      AddImpulse(目标, Impulse);
      track(ctx.world, 目标);
    },

    // line 659 (LAUNCH-075): 开启碰撞, then the impulse × 初始冲量 (= 质量 / 50).
    根据体重添加冲击(ctx, 目标, Impulse) {
      if (!目标) return;
      目标.开启碰撞();
      函数库_技能.给有物理添加冲量(ctx, 目标, scale(Impulse, 目标.初始冲量));
    },
  },
};
