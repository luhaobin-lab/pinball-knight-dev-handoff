/**
 * 蓝图_可拾取物 — pickup overlap gate and predicted-pickup hooks.
 * Demo: CatapultHero/BP/Skill/效果/可拾取物/蓝图_可拾取物 (L85, L385, L462, L737, L811, L1014).
 * Parent: 蓝图_效果. Owner: env-hazards (WAVE_B §3.5); required by the wave-A player passive.
 */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import type { BpObject } from '../../../../../core/sim/object.ts';
import type { AssetPath } from '../../../../../core/sim/types.ts';
import { make效果配置 } from '../../../../../core/bp/structs.ts';

/** Native preview-circle state read by the pickup's hooks; it is not a new simulated actor. */
export interface 拾取预览圈 { 有加速: boolean }

export class 蓝图_可拾取物 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/可拾取物/蓝图_可拾取物';
  初始化完毕 = false;
  拾取后触发效果 = make效果配置();
  待拾取 = false;
  来自预览圈: 拾取预览圈 | null = null;
  已拾取 = false;
  拾取时音效: AssetPath | null = null;
  /** SCS 激活范围.SphereRadius, inherited by the vortex. */
  readonly 拾取半径 = 50;

  获取待拾取状态(): { 待拾取了: boolean } { return { 待拾取了: this.待拾取 }; }
  拾取时触发(): void {}
  移除待拾取子触发(): void {}
  进入待拾取子触发(): void {}

  // L385: spawn effects are already positioned by their source before activation.
  override 激活后触发(_Debug: string): void {
    this.销毁延迟 = 0.75;
    this.初始化完毕 = true;
    this.fx.vfx('CatapultHero/粒子/粒子_加速点未激活', this, { attach: true });
  }

  /** L462 → L85: engine BeginOverlap adapter. Only the hero, once, during phase 3. */
  玩家重叠(other: BpObject): void {
    const mode = this.world.mode;
    if (!this.valid || other !== mode.玩家角色 || this.已拾取 || !this.初始化完毕 || mode.当前环节 !== '进行战斗') return;
    this.已拾取 = true;
    this.fx.sound(this.拾取时音效, this.拥有者?.K2_GetActorLocation());
    this.来自技能?.拾取物实体.delete(this);
    this.拾取时触发();
  }

  // L737 / L811: add/remove only on the transition, keeping the original hook order.
  移除待拾取触发(): void {
    if (!this.待拾取) return;
    this.待拾取 = false;
    this.移除待拾取子触发();
    this.来自预览圈 = null;
  }
  进入待拾取触发(circle: 拾取预览圈): void {
    if (this.待拾取) return;
    this.待拾取 = true;
    this.来自预览圈 = circle;
    this.进入待拾取子触发();
  }

  // L1014: subclasses may deliberately override this without calling the parent (the vortex does).
  override 销毁前触发(): void {
    this.已拾取 = true;
    this.来自技能?.拾取物实体.delete(this);
    const list = this.world.mode.场上可拾取物;
    const i = list.indexOf(this);
    if (i >= 0) list.splice(i, 1);
    super.销毁前触发();
  }
}
