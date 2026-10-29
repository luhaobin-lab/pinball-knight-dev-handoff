/** Source L277 condition, L681 unlock -> EternalBox refresh -> SaveCustom -> release. */
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import type { World } from '../../../../../core/sim/world.ts';
interface Save { GetCustomSave(w: World): { 已解锁机制: string[]; 关卡地图切换: number } }
export class 蓝图_能力_破损的神像 extends 蓝图_能力 {
  static override readonly path = 'CatapultHero/BP/Skill/Ability/道具/蓝图_能力_破损的神像';
  override 检查子条件(): void {
    const s = (this.world.sys.save as unknown as Save).GetCustomSave(this.world);
    this.子条件通过 = this.world.mode.当前环节 === '选择地图' && s.关卡地图切换 === 0 && !s.已解锁机制.includes('永恒神像');
    if (!this.子条件通过) this.fx.ui({ op: 'open', widget: 'UI_抬头提醒', data: { text: '还无法使用。' } });
  }
  override 执行技能(_read: boolean): void {
    const s = (this.world.sys.save as unknown as Save).GetCustomSave(this.world);
    if (!s.已解锁机制.includes('永恒神像')) s.已解锁机制.push('永恒神像');
    (this.world.sys.camp as { refreshStatue?(w: World, animate: boolean): void }).refreshStatue?.(this.world, true);
    this.fx.ui({ op: 'update', widget: 'save.persist' }); this.释放结束(false);
  }
  override 子初始化(): void {}
  override 被选中(): void {}
}
