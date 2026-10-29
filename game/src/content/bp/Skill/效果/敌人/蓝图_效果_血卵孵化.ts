/**
 * 蓝图_效果_血卵孵化: the blood egg's hatch (大肠孵化, enemies-intestine). A passive with 持续回合 from its row; when it expires
 * (销毁效果 with 销毁延迟 1.0) it waits U[0.1, 0.3] s, summons a hidden 大肠 at the egg (elite if the egg is), kills the egg
 * ("{执行者}孵化出了{召唤物}。"), and 0.6 s later shows the 大肠, enables its collision, plays its Born sequence and ends its
 * action.
 * Demo: CatapultHero/BP/Skill/效果/敌人/蓝图_效果_血卵孵化 (dump/blueprints-pseudo/…/效果/敌人/蓝图_效果_血卵孵化.txt).
 * Parent: 蓝图_效果. CDO tags (manifest): 效果.时机.新一天时, 效果.时机.创建时. Batch: core-ai.
 */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_战斗日志, 函数库_技能 } from '../../../../../core/bp/index.ts';
import { f32 } from '../../../../../core/math/kismet.ts';
import { 科学数零 } from '../../../../../core/math/sci.ts';
import { RandomFloatInRange } from '../../../../../core/rng/ue.ts';
import { SetActorHiddenInGame } from '../../../../../core/sim/engine.ts';
import type { BP_Actor_Other } from '../../../../../core/sim/other.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';

const ENEMY_TABLE: AssetPath = 'CatapultHero/数据表/角色/数据表_敌人_普通';

export class 蓝图_效果_血卵孵化 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/敌人/蓝图_效果_血卵孵化';

  // L1619
  override 激活后触发(_Debug: string): void {
    this.销毁延迟 = 1.0;
  }

  // L1643: combat draw (CORE-M-129 #90), then the hatch.
  override 销毁前触发(): void {
    const d = f32(RandomFloatInRange(this.world.rng.combat, 0.1, 0.3));
    this.delay('L1643', d, () => this.hatch());
  }

  // L1777: both branches end (剩余回合 is checked, nothing happens).
  override 持续中触发(_触发时机: Tag): void {}

  // L1822
  override ReceiveTick(_DeltaSeconds: number): void {}

  /** L26 (after the Delay of 销毁前触发). */
  private hatch(): void {
    const egg = this.拥有者;
    if (!egg) return;
    egg.更新运动数据();
    const mode = this.游戏模式 ?? this.world.mode;
    const s = 函数库_技能.召唤角色到场上(this, mode, ENEMY_TABLE, '大肠', egg.当前位置, false, true, egg.是精英);
    egg.当前生命 = 科学数零;
    const who = 函数库_战斗日志.日志__获取角色名(this, egg).Output;
    const born = 函数库_战斗日志.日志__获取角色名(this, s.召唤出来的).Output;
    egg.指定死亡文本 = { zh: `${who.zh}孵化出了${born.zh}。`, en: `${who.en}孵化出了${born.en}。` };
    egg.检查死亡(false, false);
    this.delay('L26', 0.6, () => this.reveal(s.召唤出来的, s.有出生动画, s.出生动画)); // → L1146
  }

  /** L1146: show the 大肠, collision on, Born sequence, then L1521. */
  private reveal(maggot: BP_Actor_Other | null, hasBorn: boolean, born: AssetPath | null): void {
    if (!maggot) return;
    SetActorHiddenInGame(maggot, false);
    maggot.开启碰撞();
    if (hasBorn && born) {
      this.playAnim(maggot, born, { completed: () => this.settle(maggot), cancelled: () => this.settle(maggot) }); // L1614 / L1609
      return;
    }
    this.settle(maggot);
  }

  /** L1521 → L15 */
  private settle(maggot: BP_Actor_Other): void {
    maggot.结束行动(null, '');
    maggot.更新运动数据();
    this.销毁效果();
  }
}
