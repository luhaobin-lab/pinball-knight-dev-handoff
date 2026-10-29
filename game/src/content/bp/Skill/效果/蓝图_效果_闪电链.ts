/**
 * 蓝图_效果_闪电链 — chain lightning: 0.1 s after activation, hit the first live 仇恨 actor within 512 with Shock damage
 * from 伤害数据.来自角色, then hand a new link (跳跃次数 − 1) to that actor (draft damage-crit-weakspot DAMAGE-102/103).
 * Demo: CatapultHero/BP/Skill/效果/蓝图_效果_闪电链 (dump/blueprints-pseudo/…/效果/蓝图_效果_闪电链.txt).
 * Parent: 蓝图_效果. CDO tags (manifest): 效果.时机.创建时. Batch: core-damage.
 */
import { 蓝图_效果 } from '../../../../core/ability/effect.ts';
import { 函数库_工具, 函数库_技能 } from '../../../../core/bp/index.ts';
import { make伤害, make效果配置 } from '../../../../core/bp/structs.ts';
import { FTrunc } from '../../../../core/math/kismet.ts';
import { Array_Shuffle } from '../../../../core/rng/ue.ts';
import { BP_ManeActor } from '../../../../core/sim/actor.ts';
import { BP_Actor_Card } from '../../../../core/sim/card.ts';
import type { BpObject } from '../../../../core/sim/object.ts';
import type { AssetPath, Tag, Vec3, HitResult } from '../../../../core/sim/types.ts';

export class 蓝图_效果_闪电链 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/蓝图_效果_闪电链';
  计数 = 0;
  当前弹跳起点: BP_ManeActor | null = null;
  当前弹跳终点: BP_ManeActor | null = null;
  Delta_Seconds = 0;
  每段距离 = 20;
  跳跃次数 = 1;
  起点: Vec3 = { x: -1, y: -1, z: -1 };
  非角色释放者: BpObject | null = null;
  ug_fieldVisual:{kind:'lightning';phase:'active'|'hidden';startedAt:number;phaseAt:number;segments:number;source:number;end:Vec3}|null=null;

  // L7585
  override 激活后触发(_Debug: string): void {
    this.delay('L7585', 0.1, () => this.hop());
  }

  override 持续中触发(_触发时机: Tag): void {} // L7716
  override 销毁前触发(): void {if(this.ug_fieldVisual)this.ug_fieldVisual.phase='hidden';} // L7640: source VFX deactivation
  override ReceiveTick(dt:number):void{
    super.ReceiveTick(dt);const target=this.当前弹跳终点;
    // L7332 updates the Niagara endpoint only while target is valid; an invalid target keeps its previous endpoint.
    if(this.ug_fieldVisual&&this.world.isValid(target)){const p=target.K2_GetActorLocation();this.ug_fieldVisual.end={x:p.x,y:p.y,z:p.z-target.高度+2};}
  }

  private hop(): void {
    const w = this.world;
    const o = this.拥有者;
    if (w.isValid(this.非角色释放者)) {
      this.起点 = this.非角色释放者.K2_GetActorLocation();
    } else { // L1363
      if (!o) return;
      o.更新运动数据();
      this.起点 = o.当前位置;
    }
    // L196
    const s = this.起点;
    // Source SphereTraceMulti channel3 is 可伤害, which ignores terrain. Reuse the physics channel adapter so a
    // radius512 sphere near a real room wall cannot hide every damageable actor behind that wall's overlap.
    const physics = w.sys.physics as typeof w.sys.physics & { sphereMulti?(ctx: BpObject, from: Vec3, to: Vec3, radius: number, q: number, ignore: readonly BpObject[]): HitResult[] };
    const hits = physics.sphereMulti
      ? physics.sphereMulti(this, s, { x: s.x, y: s.y, z: s.z + 100 }, 512, 3, o ? [o] : [])
      : w.trace.sphere(s, { x: s.x, y: s.y, z: s.z + 100 }, 512, '3', o ? [o] : []); // Existing isolated damage test worlds supply the trace directly.
    Array_Shuffle(w.rng.combat, hits); // CORE-M-129 row 66
    for (let i = 0; i < hits.length; i++) { // L528
      const a = hits[i].actor;
      if (a instanceof BP_ManeActor && a.HasMatchingGameplayTag('可交互.角色.AI.仇恨') && !a.死掉了) { this.当前弹跳终点 = a; break; }
      this.当前弹跳终点 = null; // L7304
    }
    // L1514
    const t = this.当前弹跳终点;
    if (!w.isValid(t)) return;
    t.更新运动数据();
    const end = { x: t.当前位置.x, y: t.当前位置.y, z: t.当前位置.z + 2 };
    const from = { x: s.x, y: s.y, z: s.z + 2 };
    const segs = FTrunc(Math.hypot(end.x - from.x, end.y - from.y) / this.每段距离);
    this.ug_fieldVisual={kind:'lightning',phase:'active',startedAt:w.clock.now,phaseAt:w.clock.now,segments:segs,source:w.isValid(this.非角色释放者)?this.非角色释放者.id:o!.id,end:{...end}};
    this.fx.vfx('CatapultHero/粒子/粒子_闪电链_01', from, { scale: segs });
    this.fx.sound('CatapultHero/音效/闪电击中', end, { volume: 0.6, pitch: 1 });
    const dx = from.x - end.x;
    const dy = from.y - end.y;
    const len = Math.hypot(dx, dy);
    const n = len > 0.0001 ? { x: dx / len, y: dy / len, z: 0 } : { x: 0, y: 0, z: 0 };
    const d = this.伤害数据;
    d.来自角色?.造成即时伤害(make伤害({
      伤害来源: d.伤害来源, 伤害类型: '电击', 伤害数值: d.伤害数值, 所需回合: 3, 触发次数: d.触发次数, 击中点位置: end, 击中点法线: n,
      断开骨骼名: 'None', 来自技能: d.来自技能, 来自角色: d.来自角色, 来自发射物: d.来自发射物, 目标角色: t,
    }), false, false);
    if (!(this.跳跃次数 - 1 > 0)) return;
    this.relay(t);
  }

  // L3877…L6519. QUIRK (DAMAGE-103): the dead guard is `if (!(false))`, so a killed target still relays.
  private relay(t: BP_ManeActor): void {
    const w = this.world;
    const c = make效果配置({ 效果类: 蓝图_效果_闪电链.path, 持续时间: 1, 触发间隔: 1, 持续回合: -1, 叠加层数: 1, 唯一: false, 检查效果名: false, 叠加上限: 1 });
    const { 效果名字 } = 函数库_技能.获取效果名(this, this.来自技能, c.效果类);
    if (!w.isValid(t)) return;
    if (函数库_工具.附加效果前处理(this, c, t, 效果名字).不需附加新效果) return;
    const e = w.spawn<蓝图_效果_闪电链>(蓝图_效果_闪电链.path, x => {
      x.拥有者 = t; x.释放者 = this.拥有者; x.来自技能 = this.来自技能;
      x.持续时长 = c.持续时间; x.触发间隔 = c.触发间隔; x.持续回合 = c.持续回合; x.叠加层数 = c.叠加层数; x.临时 = false;
    });
    if (!w.isValid(e)) return;
    e.效果名字 = 效果名字;
    const cls = (this.拥有者?.constructor as { path?: AssetPath } | undefined)?.path;
    if (cls === BP_Actor_Card.path && !e.临时) { e.OwnedGameplayTags.add('效果.时机.装上'); e.OwnedGameplayTags.add('效果.时机.卸下'); }
    else if (w.isValid(this.来自技能) && this.来自技能.是天赋) e.OwnedGameplayTags.add('能力.类型.天赋');
    if (!t.拥有的效果.includes(e)) t.拥有的效果.push(e);
    e.K2_AttachToActor(t);
    e.伤害数据 = { ...this.伤害数据 };
    e.跳跃次数 = this.跳跃次数 - 1;
    e.激活效果('');
  }
}
