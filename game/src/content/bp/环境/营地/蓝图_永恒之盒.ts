import { BpObject } from '../../../../core/sim/object.ts';
import type { World } from '../../../../core/sim/world.ts';
interface Camp { refreshStatue(w: World, animate: boolean): void; openStash(w: World): boolean }
export class 蓝图_永恒之盒 extends BpObject {
  static override readonly path = 'CatapultHero/BP/环境/营地/蓝图_永恒之盒';
  未点击 = true; 已解锁 = false; 延迟 = 0; 显示 = false; 解锁开始: number | null = null;
  override ReceiveBeginPlay(): void { this.未点击 = true; }
  更新解锁状态(animate: boolean): void {
    const s = (this.world.sys.save as { GetCustomSave(w: World): { 已解锁机制: string[]; 新手关中: boolean } }).GetCustomSave(this.world);
    this.已解锁 = s.已解锁机制.includes('永恒神像') && !s.新手关中;
    if (this.已解锁 && animate) { this.解锁开始 = this.world.clock.now; this.fx.flipbook(this, 'CatapultHero/精灵片/角色/血之雕像/血之雕像_SQ_Fill', { loop: false }); }
    this.fx.ui({ op: 'update', widget: 'camp.statue', data: { id: this.id, unlocked: this.已解锁, animate } });
  }
  玩家交互(): void {
    if (!this.world.cult.仓库页关闭了 || !this.world.cult.盒子关闭了) return;
    if (this.未点击 && this.已解锁) {
      (this.world.sys.camp as unknown as Camp).openStash(this.world);
      (this.world.sys.tutorial as { showTip?(w: World, n: number): void }).showTip?.(this.world, 12);
      this.fx.ui({ op: 'open', widget: 'UI_新手提示', data: 12 });
    }
    else if (!this.已解锁) this.fx.ui({ op: 'open', widget: 'UI_抬头提醒', data: { text: '无法祈祷，需要修复。' } });
  }
}
