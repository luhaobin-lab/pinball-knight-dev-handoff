/** Source L1441/L15: mass grows before money gate; seeded generation selection still runs when explicit name keys override it. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import { sciOf, 科学数比较 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条, 添加科学映射值, type 词条映射 } from '../../../../../core/math/stats.ts';
import { MakeRandomStream, Array_Random } from '../../../../../core/rng/ue.ts';
import type { World } from '../../../../../core/sim/world.ts';
import type { AssetPath, Tag } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_结束层创建物品 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_结束层创建物品';
  词条名 = '元素伤害%'; 计数 = 0; 来自牌: BP_Actor_Card | null = null; 临时牌: BP_Actor_Card | null = null; 词条修正: 词条映射 = new Map();
  override 激活后触发(_Debug: string): void { const card = this.来自技能?.拥有者; if (card instanceof BP_Actor_Card) { this.来自牌 = card; 添加科学映射值(card.词条, '质量', '', sciOf(0, 0), false); } }
  override 持续中触发(时机: Tag): void {
    const s = this.来自技能, owner = s?.拥有者; if (时机 !== '效果.时机.结束层时' || !s || !owner) return;
    const p = (i: number) => 函数库_技能.获取技能参数(this, s, i, false, '').参数值;
    添加科学映射值(owner.词条, '质量', '永久保留', sciOf(1, 0), true);
    if (!科学数比较(获取科学映射词条(owner.词条, '质量').输出值, '>=', sciOf(p(0), 0)) || this.world.mode.金币 < Math.trunc(p(1))) return;
    this.world.mode.增加金币_收入(false, true, Math.imul(Math.trunc(p(1)), -1), owner);
    const quality = owner.HasMatchingGameplayTag('可交互.修炼牌') ? owner.品质 : s.等级;
    const pool = this.world.cult.筛选物品生成(s.目标或_且, s.目标标签, s.排斥标签, quality, 99,
      MakeRandomStream((this.world.mode.本轮种子 + this.world.mode.当前总层数) | 0), true, false, 'None').筛选后物品;
    const names = Object.keys(s.条件.解锁材料); const chosen = names.length ? names : pool;
    const save = this.world.sys.save as typeof this.world.sys.save & { GetCustomSave(w: World): { 轮回次数: number } };
    for (let i = 0; i <= Math.trunc(p(2)) - 1; i++) {
      const run = save.GetCustomSave(this.world).轮回次数;
      const name = chosen[Array_Random(this.world.rng.meta, chosen)] ?? ''; // CORE-M-129 row101: meta, separate from the seeded filter
      this.world.cult.创建牌到侧栏(name, quality, null, [], run, this.词条修正);
    }
    添加科学映射值(owner.词条, '质量', '永久保留', sciOf(0, 0), false);
  }
}
