/** Source L302/L487/L2181: first dodge-effect stacks times round count, original weapon stat; floor clears equipped sources. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能, 函数库_工具 } from '../../../../../core/bp/index.ts';
import { sciOf, 科学数乘除 } from '../../../../../core/math/sci.ts';
import { 科学映射原始值, 添加科学映射值, 移除科学映射值 } from '../../../../../core/math/stats.ts';
import { 蓝图_效果_精神状态_闪避 } from '../玩家/精神状态/蓝图_效果_精神状态_闪避.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_敏锐直觉 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/天赋/蓝图_效果_敏锐直觉';
  词条名 = '元素伤害%'; 计数 = 0; 闪避次数 = 0;
  override 持续中触发(t: Tag): void {
    const s = this.来自技能, o = this.拥有者; if (!s || !o) return; const equip = this.world.cult.已装备牌;
    if (t === '效果.时机.结束层时') { for (let i = 0; i < equip.length; i++) { const c = equip[i]; if (c && 移除科学映射值(c.词条, 函数库_技能.获取技能参数(this, s, 0, false, '').词条, s.唯一ID)) c.更新外观数据(); } }
    else if (t === '效果.时机.新一天时') {
      const r = 函数库_工具.对应类型效果数量(this, o.拥有的效果, 蓝图_效果_精神状态_闪避.path); if (!r.数量) return;
      for (let i = 0; i < equip.length; i++) { const c = equip[i], dodge = r.实例组[0]; if (!c?.OwnedGameplayTags.has('可交互.修炼牌.伤害') || !dodge) continue;
        const p = 函数库_技能.获取技能参数(this, s, 0, false, '');
        const v = 科学数乘除(sciOf(Math.imul(dodge.叠加层数, this.world.mode.回合开始触发数), 0), 科学数乘除(sciOf(p.参数值, 0), 科学映射原始值(c.词条, p.词条, true), false), false);
        添加科学映射值(c.词条, p.词条, s.唯一ID, v, true); c.更新外观数据();
      }
    }
  }
}
