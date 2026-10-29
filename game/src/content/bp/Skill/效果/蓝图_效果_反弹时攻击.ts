/**
 * 蓝图_效果_反弹时攻击 — while it lives, its owner may attack: a 碰撞时 in 进行战斗 with a living actor of another
 * 角色类型 that is a player or hostile makes the owner 发动攻击 (melee); 行动结束后 asks it to end.
 * Demo: CatapultHero/BP/Skill/效果/蓝图_效果_反弹时攻击 (L25, L63, L138, L275); draft launch-movement LAUNCH-099.
 * Parent: 蓝图_效果. CDO tags (manifest): 碰撞时, 新一天时, 创建时, 行动结束后. Batch: core-launch-sys.
 */
import { 蓝图_效果 } from '../../../../core/ability/effect.ts';
import { BP_ManeActor } from '../../../../core/sim/actor.ts';
import { makeHitResult } from '../../../../core/bp/structs.ts';

export class 蓝图_效果_反弹时攻击 extends 蓝图_效果 {
  static override readonly path = 'CatapultHero/BP/Skill/效果/蓝图_效果_反弹时攻击';

  override 激活后触发(_Debug: string): void {
    this.拥有者!.可攻击 = true;
  }

  override 销毁前触发(): void {
    this.拥有者!.可攻击 = false;
    this.来自技能?.释放结束(false);
  }

  override 持续中触发(触发时机: string): void {
    if (触发时机 === '效果.时机.碰撞时') this.onContact();
    else if (触发时机 === '效果.时机.行动结束后') this.销毁效果(); // L10 → the override below
  }

  /** QUIRK (L982): the class overrides 销毁效果 with an empty body, so its own 销毁效果 calls never remove it. */
  override 销毁效果(): void {}

  // L275
  private onContact(): void {
    const owner = this.拥有者!;
    if (this.world.mode.当前环节 !== '进行战斗') return;
    const t = owner.当前碰到谁了;
    if (!(t instanceof BP_ManeActor)) return;
    if (owner.可攻击 && !owner.攻击中 && t.角色类型 !== owner.角色类型 && t.OwnedGameplayTags.hasAny(['可交互.角色.玩家', '可交互.角色.AI.仇恨'])) {
      owner.发动攻击(this.来自技能, makeHitResult(), false);
    }
  }
}
