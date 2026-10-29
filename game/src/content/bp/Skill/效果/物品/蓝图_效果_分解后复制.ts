/** Source L89: first selected target, same quality/different name/non-stash; copies permanent stats but passes empty enchants. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { 复制词条映射, type 词条映射 } from '../../../../../core/math/stats.ts';
import type { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import type { 修炼物品格子组 } from '../../../../../core/sim/cult-grid.ts';
import type { 结构_存档_能力 } from '../../../../demo/types.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_分解后复制 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_分解后复制';
  词条名 = '元素伤害%'; 所有牌: (BP_Actor_Card | null)[] = []; 选到: BP_Actor_Card | null = null; 子条件通过 = false;
  词条修正存档: 词条映射 = new Map(); 所在格子组: 修炼物品格子组 | null = null; 品质 = 0; 附魔存档: 结构_存档_能力[] = []; 获取轮次 = 0;
  override 持续中触发(时机: Tag): void {
    const s = this.来自技能; if (时机 !== '效果.时机.分解后' || !s?.拥有者) return;
    const selected = 函数库_技能.技能条件筛选物品(this, this.world.cult, s, -1).筛选后;
    this.子条件通过 = selected.length > 0; const target = selected[0];
    if (!target || !this.world.isValid(target) || target.所在格子组标签 === 'UI.修炼物品在仓库'
      || target.名字 === s.拥有者.名字 || target.品质 !== s.拥有者.品质) return;
    this.选到 = target; this.所在格子组 = target.所在格子组; this.获取轮次 = target.获取轮次; this.品质 = target.品质;
    this.附魔存档 = [...target.附魔存档]; this.词条修正存档 = 复制词条映射(target.词条);
    this.world.cult.创建牌到侧栏(target.名字, this.品质, null, [], this.获取轮次, this.词条修正存档);
  }
}
