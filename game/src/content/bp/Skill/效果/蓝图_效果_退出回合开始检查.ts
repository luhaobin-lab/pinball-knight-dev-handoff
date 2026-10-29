/**
 * 蓝图_效果_退出回合开始检查: a turn-start barrier participant (turn-flow TURN-035). Any trigger joins 回合开始实例;
 * 0.2 s after activation a gate opens, and the first tick with the owner's physics speed < 5 destroys the effect,
 * which leaves the barrier (销毁前触发, or ReceiveDestroyed when not yet finished). Used by 蓝图_效果_偏转力场.
 * Demo: CatapultHero/BP/Skill/效果/蓝图_效果_退出回合开始检查. Parent: 蓝图_效果. CDO tags (manifest): 新一天时.
 * Batch: core-turn.
 */
import { 蓝图_效果 } from '../../../../core/ability/effect.ts';
import type { AssetPath, Tag } from '../../../../core/sim/types.ts';

export class 蓝图_效果_退出回合开始检查 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/蓝图_效果_退出回合开始检查';
  计算初始速: boolean = true; // 计算初始速？
  已完结: boolean = false; // 已完结？
  /** The Gate node's state (closed until 检测停止 opens it). */
  ug_gateOpen: boolean = false;

  // L180
  override 激活后触发(_Debug: string): void {
    this.setTickEnabled(true); // SPEC-GAP: actor tick is on by default in UE; the port enables it explicitly
    this.delay('L180', 0.2, () => this.检测停止());
  }

  /** L451 → L100: opens the gate. */
  检测停止(): void { this.ug_gateOpen = true; }

  // L235
  override 销毁前触发(): void {
    this.已完结 = true;
    this.world.mode.退出回合开始(this);
  }

  // L284
  override 持续中触发(_触发时机: Tag): void {
    this.world.mode.加入回合开始(this);
  }

  // L337
  override ReceiveTick(DeltaSeconds: number): void {
    super.ReceiveTick(DeltaSeconds);
    if (!this.ug_gateOpen) return;
    if (!(this.拥有者 && this.拥有者.当前物理速度 < 5)) return;
    this.销毁效果(); // L322
    this.ug_gateOpen = false; // L158
  }

  /** L456: ReceiveDestroyed leaves the barrier if 销毁前触发 never ran. Called by the runtime on destroy. */
  ReceiveDestroyed(): void {
    if (!this.已完结) this.销毁前触发();
  }
}
