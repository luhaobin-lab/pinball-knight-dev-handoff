/** 首领_守门人.txt L843–6799: first lethal hit restores HP; next 新一天时 runs the 4 s rebirth barrier. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_工具, 函数库_科学数 } from '../../../../../core/bp/index.ts';
import { make效果配置 } from '../../../../../core/bp/structs.ts';
import { sciOf } from '../../../../../core/math/sci.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
import { attachSourceEffect } from '../../../../../core/ability/apply.ts';

const IMMUNITY = 'CatapultHero/BP/Skill/效果/蓝图_效果_免疫状态_转阶';
export class 蓝图_效果_首领_守门人 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/敌人/蓝图_效果_首领_守门人';
  触发次数_0 = 0;
  触发上限 = 1;
  override 激活后触发(_debug: string): void {}
  override 销毁前触发(): void {}
  首领开局动画(): void {
    this.fx.sound('Dark_Defeat_2'); this.拥有者?.被揭示();
    this.delay('L6453', 0.75, () => {
      if (this.游戏模式?.当前环节 !== '死亡结算') this.fx.ui({ op: 'open', widget: 'UI_首领状态条', data: { actor: this.拥有者?.id } });
    });
  }
  override 持续中触发(tag: Tag): void {
    const owner = this.拥有者, mode = this.游戏模式;
    if (!owner || !mode) return;
    if (tag === '效果.时机.新一天时') {
      if (mode.当前层回合 === 1 && !owner.HasMatchingGameplayTag('状态.二阶段')) this.首领开局动画();
      if (!owner.HasMatchingGameplayTag('状态.二阶段') || this.触发次数_0 >= this.触发上限) return;
      this.触发次数_0 += 1;
      mode.加入回合开始(this);
      this.playAnim(owner, `CatapultHero/精灵片/AnimSequences/Actor_M03_Reborn`, { completed: () => {
        mode.退出回合开始(this);
        const match = 函数库_工具.存在同类效果(this, owner.拥有的效果, IMMUNITY);
        if (match.存在相同被动) match.存在的效果?.销毁效果();
      } }); // OnCancelled source L6508 is empty.
      owner.精灵动画序列 = ['Actor_M03_Idle02', 'Actor_M03_Die', 'Actor_M03_Attack02'].map(name => `CatapultHero/精灵片/AnimSequences/${name}`);
      this.fx.ui({ op: 'update', widget: '精灵动画蓝图', data: { actor: owner.id, 动画序列: owner.精灵动画序列 } });
      函数库_科学数.添加科学映射值(this, owner.词条, '连击', '二阶段', sciOf(1), true);
      this.delay('L1794', 1.8, () => {});
      return;
    }
    if (tag !== '效果.时机.死亡前') return;
    owner.打断技能(false);
    if (this.触发次数_0 >= this.触发上限) {
      this.fx.ui({ op: 'close', widget: 'UI_首领状态条', data: { actor: owner.id } }); return;
    }
    owner.OwnedGameplayTags.add('状态.二阶段'); owner.当前能力 = null;
    owner.当前生命 = { ...owner.当前最大生命 };
    const immunity = attachSourceEffect(this, owner, this.来自技能, make效果配置({ 效果类: IMMUNITY, 持续时间: -1, 持续回合: -1, 触发间隔: 1, 叠加层数: 1, 唯一: true }));
    if (!immunity) return;
    immunity.激活效果(''); owner.当前行动力 = 0;
    函数库_工具.修改体力点(this, sciOf(999), sciOf(0), owner, null, false, { x: 0, y: 0, z: 0 });
    owner.体力惩罚计数 = 0;
    if (!this.world.isValid(owner.当前能力)) owner.结束行动(null, '');
  }
}
