/** Elite 力场, ENEMY--083; pseudo L4668/L5313/L5571/L5704, projectile formula #20. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import type { 蓝图_发射物 } from '../../../../../core/ability/projectile.ts';
import { 函数库_技能, 函数库_工具 } from '../../../../../core/bp/index.ts';
import { make效果配置, type 效果配置 } from '../../../../../core/bp/structs.ts';
import { BP_ManeActor } from '../../../../../core/sim/actor.ts';
import type { AssetPath, Tag, Vec3 } from '../../../../../core/sim/types.ts';
import type { World } from '../../../../../core/sim/world.ts';

/** Inline deferred-spawn pattern repeated in the six elite source graphs; no activation until fields are set. */
export function attachEliteEffect(source: 蓝图_效果, owner: BP_ManeActor, cfg: 效果配置, before?: (e: 蓝图_效果) => void): 蓝图_效果 | null {
  const w = source.world;
  if (!w.isValid(owner) || owner.死掉了) return null;
  const name = 函数库_技能.获取效果名(source, source.来自技能, cfg.效果类).效果名字;
  const pre = 函数库_工具.附加效果前处理(source, cfg, owner, name);
  if (pre.不需附加新效果) return null; // every elite source exits on the existing-instance branch
  if (!cfg.效果类) return null;
  const e = w.spawn<蓝图_效果>(cfg.效果类, x => {
    x.拥有者 = owner; x.释放者 = source.拥有者; x.来自技能 = source.来自技能;
    x.持续时长 = cfg.持续时间; x.触发间隔 = cfg.触发间隔; x.持续回合 = cfg.持续回合; x.叠加层数 = cfg.叠加层数; x.临时 = false;
  });
  e.效果名字 = name;
  if (source.来自技能?.是天赋) e.OwnedGameplayTags.add('能力.类型.天赋');
  owner.拥有的效果.push(e); e.K2_AttachToActor(owner);
  before?.(e); e.激活效果('');
  return e;
}

interface FieldProjectiles {
  deflectInSphere(world: World, center: Vec3, radius: number, dt: number, ignore: readonly (蓝图_发射物 | null)[]): void;
}

export class 蓝图_效果_偏转力场 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/敌人/蓝图_效果_偏转力场';
  立场激活 = true;
  作用范围 = 0;
  捕获的发射物: (蓝图_发射物 | null)[] = [];

  override 激活后触发(_Debug: string): void {
    this.作用范围 = 函数库_技能.获取技能参数(this, this.来自技能, 0, false, '').参数值 + (this.拥有者?.高度 ?? 0);
    this.力场切换();
  }
  力场切换(): void {
    this.立场激活 = this.world.mode.当前层回合 % 2 === 0;
    this.fx.ui({ op: 'update', widget: '精英力场', data: { actor: this.拥有者?.id, radius: this.作用范围, active: this.立场激活 } });
  }
  偏转投射物(dt: number): void {
    if (!this.立场激活 || !this.拥有者) return;
    (this.world.sys.projectile as unknown as FieldProjectiles).deflectInSphere(this.world, this.拥有者.K2_GetActorLocation(), Math.fround(this.作用范围), dt, this.捕获的发射物);
  }
  override ReceiveTick(dt: number): void {
    super.ReceiveTick(dt);
    if (this.拥有者 && !this.拥有者.死掉了) this.偏转投射物(Math.fround(dt));
  }
  override 持续中触发(tag: Tag): void {
    if (tag === '效果.时机.死亡前') {
      this.立场激活 = false;
      this.fx.ui({ op: 'update', widget: '精英力场', data: { actor: this.拥有者?.id, active: false } });
      return;
    }
    if (tag !== '效果.时机.新一天时') return;
    this.力场切换();
    if (!this.立场激活 || !this.拥有者) return;
    const hit = 函数库_工具.以目标为中心追踪(this, this.拥有者, Math.fround(this.作用范围), 3, 0, [], false, { x: 0, y: 0, z: 0 });
    for (const h of hit.OutHits) {
      const actor = h.actor;
      if (!(actor instanceof BP_ManeActor)) continue;
      actor.当前护甲值 = { 系数: 0, 指数: 0 };
      const x = h.impactPoint.x - hit.目标所在位置.x, y = h.impactPoint.y - hit.目标所在位置.y;
      const n = Math.hypot(x, y), k = n * n > 0.0001 ? 60000 / n : 0;
      函数库_技能.给有物理添加冲量(this, actor, { x: x * k, y: y * k, z: 0 });
      attachEliteEffect(this, actor, make效果配置({ 效果类: 'CatapultHero/BP/Skill/效果/蓝图_效果_退出回合开始检查', 持续时间: -1, 持续回合: -1, 唯一: true, 叠加上限: 1 }));
    }
  }
}
