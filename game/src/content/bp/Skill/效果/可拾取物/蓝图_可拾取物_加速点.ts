/**
 * 回弹漩涡: cache gravity while aiming, disable it at combat entry, consume once on the hero's overlap.
 * Demo: CatapultHero/BP/Skill/效果/可拾取物/蓝图_可拾取物_加速点, labels L10/48/72/113/318/333/371/409.
 * Parent: 蓝图_可拾取物. Owner: env-hazards. Native component defaults: strength 1.4, radius 500, enabled.
 */
import { 蓝图_可拾取物 } from './蓝图_可拾取物.ts';
import { SetActorHiddenInGame } from '../../../../../core/sim/engine.ts';
import type { Tag } from '../../../../../core/sim/types.ts';

export class 蓝图_可拾取物_加速点 extends 蓝图_可拾取物 {
  static override readonly path = 'CatapultHero/BP/Skill/效果/可拾取物/蓝图_可拾取物_加速点';
  尺寸 = 160;
  弹射引力 = { bEnabled: true, Strength: 1.4, Radius: 500 };
  未激活特效开启 = false;

  // L48 calls the parent. L72 only deactivates the visual; it does NOT call the parent's destroy hook.
  override 激活后触发(Debug: string): void { super.激活后触发(Debug); this.未激活特效开启 = true; }
  override 销毁前触发(): void { this.未激活特效开启 = false; }

  override 持续中触发(timing: Tag): void {
    if (timing === '效果.时机.进入战斗时') this.弹射引力.bEnabled = false;
    else if (timing === '效果.时机.新一天时' || timing === '效果.时机.结束层时') this.销毁效果();
  }
  override 进入待拾取子触发(): void { if (this.来自预览圈) this.来自预览圈.有加速 = true; }
  override 移除待拾取子触发(): void { if (this.来自预览圈) this.来自预览圈.有加速 = false; }
  override 拾取时触发(): void {
    this.未激活特效开启 = false;
    SetActorHiddenInGame(this, true);
    this.弹射引力.bEnabled = false;
  }
}
