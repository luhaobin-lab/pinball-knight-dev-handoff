/**
 * 蓝图_货币 — the soul-shard pickup (灵魂碎片) that 掉落货币 scatters from killed enemies: it registers in 场上可拾取物, becomes
 * collectable 0.3 s after spawning, and on overlap with the hero (or a death zone) is collected: +1 Stamina (修改体力点),
 * the 灵魂碎片 round stat, the pickup vfx, destroy.
 * Demo: CatapultHero/BP/Skill/效果/可拾取物/蓝图_货币 (dump/blueprints-pseudo/CatapultHero/BP/Skill/效果/可拾取物/蓝图_货币.txt)
 * Parent: native CatapultHero.GameplayTagActor. CDO tags (manifest): none.
 * Rows: none.
 * Batch: core-rewards.
 */
import { 函数库_工具 } from '../../../../../core/bp/index.ts';
import { sciOf, 科学数零 } from '../../../../../core/math/sci.ts';
import { Array_AddUnique, Array_RemoveItem } from '../../../../../core/sim/engine.ts';
import type { 蓝图_动作游戏模式 } from '../../../../../core/sim/mode.ts';
import { BpObject } from '../../../../../core/sim/object.ts';
import type { AssetPath } from '../../../../demo/types.ts';

export class 蓝图_货币 extends BpObject {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/可拾取物/蓝图_货币';
  游戏模式: 蓝图_动作游戏模式 | null = null;
  初始化完毕: boolean = false;
  弹力强度: number = 0;

  // L827
  override ReceiveBeginPlay(): void {
    this.游戏模式 = this.world.mode;
    Array_AddUnique(this.游戏模式.场上可拾取物, this);
    this.delay('L827', 0.3, () => { this.初始化完毕 = true; }); // Linkage 658
  }

  /**
   * The Box overlap (L1079): collected when `other` has 可交互.角色.玩家 or 环境.房间.死亡区 and the pickup is initialised.
   * The physics / launch layer calls it for the actor the box touches (SPEC-GAP: pickup physics is not simulated).
   */
  开始重叠(other: BpObject | null): void {
    if (!this.valid || !other || !this.world.isValid(other)) return;
    const hit = other.OwnedGameplayTags.hasAny(['可交互.角色.玩家', '环境.房间.死亡区']); // L681 (non-tag actors: false)
    if (!(hit && this.初始化完毕)) return;
    Array_RemoveItem(this.游戏模式?.场上可拾取物 ?? [], this);
    this.被拾取();
  }

  // L15
  被拾取(): void {
    if (!this.valid) return; // A destroyed UE actor cannot receive another overlap delegate.
    const mode = this.world.mode;
    mode.更新回合战斗统计('灵魂碎片', sciOf(1, 0), 10, 5, '平滑衰减', '');
    const p = this.K2_GetActorLocation();
    函数库_工具.修改体力点(this, sciOf(1, 0), 科学数零, mode.玩家角色, null, true, p);
    this.fx.vfx('CatapultHero/粒子/粒子_货币拾取', { x: p.x, y: p.y, z: p.z + 14 });
    this.K2_DestroyActor();
  }

  // The other 接口_工具 / 接口_拾取物 events are empty (L808–L826).
}
