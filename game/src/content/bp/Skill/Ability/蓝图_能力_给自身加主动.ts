/** Talent -> slotted active, source 给自身加主动 L299/L1550. Preview child is not an owned active. */
import { 蓝图_能力 } from '../../../../core/ability/ability.ts';
import { 函数库_工具 } from '../../../../core/bp/index.ts';
import type { 结构_技能 } from '../../../demo/types.ts';

const TABLE = 'CatapultHero/数据表/技能/数据表_技能_默认';

export class 蓝图_能力_给自身加主动 extends 蓝图_能力 {
  static override readonly path = 'CatapultHero/BP/Skill/Ability/蓝图_能力_给自身加主动';
  创建的主动: 蓝图_能力 | null = null;
  Data_Table = TABLE;

  override 子初始化(): void {
    if (this.创建的主动) 函数库_工具.销毁目标和子物体(this, this.创建的主动);
    const row = this.world.data.table(this.Data_Table)?.rows[this.能力名] as 结构_技能 | undefined;
    if (!row?.能力.能力类 || !this.拥有者) return;
    const a = this.world.spawn<蓝图_能力>(row.能力.能力类, a => {
      a.唯一ID = `${this.拥有者!.唯一ID}//数据表_技能_默认//${this.能力名}`;
      a.能力名 = this.能力名; a.拥有者 = this.拥有者; a.等级 = this.等级; a.品质 = 1; a.种子 = 0;
    });
    this.创建的主动 = a; a.技能配置 = row; a.初始化(); a.子初始化(); a.K2_AttachToActor(this);
  }

  override 执行技能(_read: boolean): void {
    const owner = this.拥有者;
    if (!owner) return;
    const match = 函数库_工具.存在相同主动(this, owner, this.能力名), existing = match.对应能力;
    if (match.有存在 && existing) { existing.上一次等级 = existing.等级; existing.等级 = this.等级; existing.初始化(); existing.子初始化(); }
    else owner.添加技能({ DataTable: TABLE, RowName: this.能力名 }, this.等级, 0);
    this.fx.ui({ op: 'update', widget: 'UI_背包栏_3d', data: { op: '重置技能栏' } });
    this.释放结束(false);
  }

  override 检查子条件(): void { this.子条件通过 = (this.拥有者?.拥有的主动能力.length ?? 0) < 5; }
  override 被选中(): void {}
}
