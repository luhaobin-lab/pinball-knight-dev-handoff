/**
 * 蓝图_效果_酸液池 — one acid cell of 大肠酸液 (and the other acid rows): on 主动激活 the acid arcs from the caster
 * (centre cell) and lands after 0.35 + 0.1 × 序号 s, spawns (0.4 s flipbook), then becomes active and deals
 * 参数[0] × the caster's 词条 as poison DoT (伤害来源 主动, 类型 中毒, 3 turns) through the 地形管理组 to every enemy of the
 * caster within 20 uu of the cell; while active, an enemy entering it takes the same hit. The group rate-limits hits.
 * Demo: CatapultHero/BP/Skill/效果/敌人/蓝图_效果_酸液池 (dump/blueprints-pseudo/CatapultHero/BP/Skill/效果/敌人/蓝图_效果_酸液池.txt)
 * Parent: 蓝图_效果_地形. CDO tags (manifest): 效果.时机.新一天时, 效果.时机.死亡前, 效果.时机.主动激活.
 * Rows: 数据表_技能_修炼物品:腐蚀池, 数据表_技能_默认:大肠酸液, 数据表_技能_默认:反弹酸液, 数据表_技能_默认:首领_弑神幼虫_酸雨, 数据表_技能_默认:死亡酸液.
 * Batch: core-physics.
 */
import { 函数库_技能, 函数库_工具 } from '../../../../../core/bp/index.ts';
import { sciOf, 科学数乘除 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import { BP_ManeActor } from '../../../../../core/sim/actor.ts';
import type { BpObject } from '../../../../../core/sim/object.ts';
import type { World } from '../../../../../core/sim/world.ts';
import type { HitResult, Tag } from '../../../../../core/sim/types.ts';
import type { AssetPath } from '../../../../demo/types.ts';
import { 蓝图_效果_地形 } from '../蓝图_效果_地形.ts';

/** FX_地形07_SQ_Swpn: 4 frames at 10 fps (dump/raw/Game/CatapultHero/精灵片/FX/地形07/FX_地形07_SQ_Swpn.json). */
export const ACID_SPAWN_SECONDS = 0.4;

export class 蓝图_效果_酸液池 extends 蓝图_效果_地形 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/敌人/蓝图_效果_酸液池';
  计数: number = 0;
  来自角色: BP_ManeActor | null = null;
  ug_visual: { state:'hidden'|'spawning'|'active'|'closing'; since:number } = {state:'hidden',since:0};

  敌我判断(): void {}

  // 结算伤害: 参数[0] × 来自技能.拥有者.词条[参数[0].词条] as DoT (来源 1 主动, 类型 2 中毒, 所需回合 3).
  结算伤害(伤害的目标: BP_ManeActor | null): void {
    const p = 函数库_技能.获取技能参数(this, this.来自技能, 0, false, '');
    const stat = 获取科学映射词条(this.来自技能?.拥有者?.词条 ?? new Map(), p.词条).输出值;
    const amount = 科学数乘除(sciOf(p.参数值, 0), stat, false);
    this.地形管理组?.地形造成伤害(true, '主动', '中毒', false, false, false, 3, 伤害的目标, amount, false, null);
  }

  // L1651: replaces 蓝图_效果_地形's (no parent call), so an acid cell does not enter 地形环境.
  override 激活后触发(_Debug: string): void {
    this.销毁延迟 = 1.0;
    this.来自角色 = 函数库_工具.获取释放的角色(this, this.拥有者, this.游戏模式).释放的角色;
    (this.world.sys.physics as {initialiseTerrainOverlaps(w:World,object:BpObject):void}).initialiseTerrainOverlaps(this.world,this);
  }

  // L1758
  override 销毁前触发(): void {
    if (!this.地形激活) return;
    super.销毁前触发();
    this.ug_visual={state:'closing',since:this.world.clock.now};
    // Niagara 生成速率 0, BG plays FX_地形07_SQ_Die once (presentation). L1540: the Delay after it is behind a literal false.
    this.fx.flipbook(this, 'CatapultHero/精灵片/FX/地形07/FX_地形07_SQ_Die');
  }

  // L1953
  override 持续中触发(触发时机: Tag): void {
    super.持续中触发(触发时机);
    if (触发时机 !== '效果.时机.主动激活') return; // 新一天时 (L2105) does nothing
    // L2116
    this.激活后触发('');
    const landing = Math.fround(this.序号 * 0.1 + 0.35);
    if (this.中心格) {
      // The acid arc 粒子_抛物线_酸液 from the caster to the cell (life = the landing delay).
      this.fx.vfx('CatapultHero/粒子/粒子_抛物线_酸液', this.来自角色?.K2_GetActorLocation() ?? this.所在位置);
      this.delay('L2116', landing, () => {
        // Ubergraph entry 1168
        const at = this.K2_GetActorLocation();
        this.fx.sound('mSlimeAttackC', at, { volume: 1.0, pitch: 1.0 });
        this.fx.vfx('CatapultHero/粒子/粒子_酸液爆炸', { x: at.x, y: at.y, z: 50.0 });
        this.spawnPool();
      });
      return;
    }
    // L3041
    this.delay('L3041', landing, () => this.spawnPool());
  }

  /** L861 → L626 → L15: the pool spawns, idles, and becomes active: one 20-uu sphere trace hits the enemies on it. */
  private spawnPool(): void {
    this.ug_visual={state:'spawning',since:this.world.clock.now};
    this.fx.flipbook(this, 'CatapultHero/精灵片/FX/地形07/FX_地形07_SQ_Swpn');
    this.delay('L861', ACID_SPAWN_SECONDS, () => {
      // L626
      this.fx.flipbook(this, 'CatapultHero/精灵片/FX/地形07/FX_地形07_SQ_Idle', { loop: true });
      // L15
      this.地形激活 = true;
      this.ug_visual={state:'active',since:this.world.clock.now};
      const hits = this.world.trace.sphere(this.所在位置, this.所在位置, 20.0, '可伤害', []);
      const { 敌人们 } = 函数库_工具.获取碰撞体包含的敌人(this, this.来自角色, hits);
      for (let i = 0; i < 敌人们.length; i++) this.结算伤害(敌人们[i] ?? null);
      // L514
      this.来自技能?.特殊结算(this);
    });
  }

  // L3530 → L3258: an enemy of the caster that enters the active pool.
  BndEvt__蓝图_效果_酸液池_PaperSprite_K2Node_ComponentBoundEvent_2_ComponentBeginOverlapSignature__DelegateSignature(_OverlappedComponent: unknown, OtherActor: BpObject | null, _OtherComp: unknown, _OtherBodyIndex: number, _bFromSweep: boolean, _SweepResult: HitResult): void {
    if (!this.地形激活) return;
    if (!this.world.isValid(this.来自角色)) return;
    if (!(OtherActor instanceof BP_ManeActor)) return;
    if (!(函数库_工具.是敌人(this, this.来自角色, OtherActor).是敌人 && OtherActor.初始化完毕)) return;
    this.结算伤害(OtherActor);
  }
}
