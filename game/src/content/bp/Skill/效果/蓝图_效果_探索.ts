/**
 * Item-box reveal, not the exploration-room fog. Source: 蓝图_效果_探索.txt L630/L850/L1023/L2141.
 * Logical reveal and the free price happen at activation; index * .75 delays only the display sequence.
 * Its .75s dissolve timeline is imported from the Demo. G2 pulls this dependency forward from core-room.
 */
import { 蓝图_效果 } from '../../../../core/ability/effect.ts';
import { BP_Actor_Card } from '../../../../core/sim/card.ts';
import { SetActorHiddenInGame } from '../../../../core/sim/engine.ts';
import type { 蓝图_房间 } from '../../../../core/sim/room.ts';
import type { Tag } from '../../../../core/sim/types.ts';
import type { AssetPath } from '../../../demo/types.ts';

export class 蓝图_效果_探索 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/蓝图_效果_探索';
  所在房间: 蓝图_房间 | null = null;
  序号 = 0;
  免费 = false;

  override 激活后触发(_Debug: string): void {
    const card = this.拥有者;
    if (!(card instanceof BP_Actor_Card)) { this.销毁效果(); return; } // L839
    // L630 before L850: do not turn this into a timed gameplay lock.
    card.已揭示 = true;
    if (this.免费) { card.当前价格 = 0; card.更新外观数据(); }
    this.delay('L850', Math.fround(this.序号 * 0.75), () => {
      if (!this.world.isValid(card)) { this.销毁效果(); return; }
      this.fx.ui({ op: 'update', widget: '探索显示', data: { effect: this.id, actor: card.id, play: true } });
      this.fx.ui({ op: 'update', widget: 'UI_卡牌信息', data: { actor: card.id, animation: '显示' } });
      SetActorHiddenInGame(card, false);
      this.timeline('时间轴', 'PlayFromStart', {
        update: (_t, tracks) => this.fx.ui({ op: 'update', widget: '探索显示', data: {
          effect: this.id, actor: card.id, dissolve: Math.fround((tracks['新建轨道_0'] ?? 0) * 10),
        } }),
        finished: () => this.完成显示(card),
      });
    });
  }

  private 完成显示(card: BP_Actor_Card): void {
    if (!this.world.isValid(card)) { this.销毁效果(); return; }
    const enchants = card.获取附魔能力().获取到的数组; // L1023, before the quality branch
    if (card.品质 > 1) {
      this.fx.ui({ op: 'update', widget: 'UI_卡牌信息', data: { actor: card.id, animation: '触发闪烁' } });
      if (enchants.length > 0) {
        const width = [108, 212, 316][card.尺寸 - 1] ?? 0;
        const count = [20, 40, 60][card.尺寸 - 1] ?? 0;
        this.fx.vfx('CatapultHero/粒子/粒子_附魔', this.K2_GetActorLocation());
        // SPEC-GAP (presentation): these Niagara parameters travel as cue data; the renderer's exact box/dissolve
        // material and ActorSequence mapping remain polish work. No additional gameplay delay is introduced.
        this.fx.ui({ op: 'update', widget: '探索附魔粒子', data: { actor: card.id, box: [width, 220, 0], count } });
        this.fx.sound('CatapultHero/声音/原素材/洗礼');
      }
    }
    this.销毁效果(); // L839: the card remains; only the temporary reveal effect is destroyed.
  }

  override 持续中触发(_触发时机: Tag): void {}
  override 销毁前触发(): void {}
}
