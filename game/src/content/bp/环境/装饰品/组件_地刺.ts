import { BpObject } from '../../../../core/sim/object.ts';
import type { AssetPath, Vec3 } from '../../../../core/sim/types.ts';
/** Source ActorComponent: exact cell iteration/offset and four flipbook states. */
export class 组件_地刺 extends BpObject {
  static override readonly path: AssetPath = 'CatapultHero/BP/环境/装饰品/组件_地刺';
  尺寸 = { X: 0, Y: 0 }; 已激活 = false; 已生效 = false;
  序列组件: Vec3[] = []; ug_phase: 'ready'|'firing'|'sleeping' = 'ready'; ug_since = 0;
  创建地刺(): void {
    for(let x=0;x<Math.trunc(this.尺寸.X);x++) for(let y=0;y<Math.trunc(this.尺寸.Y);y++) {
      this.序列组件.push({ x:32-x*64, y:-32+y*64, z:1.2+x*.15 }); this.已激活=true;
    }
    this.ug_phase='ready'; this.ug_since=this.world.clock.now;
  }
  生效地刺(): void { this.已生效=true; this.ug_phase='firing'; this.ug_since=this.world.clock.now; }
  休眠地刺(): void { this.已激活=false; this.已生效=false; this.ug_phase='sleeping'; this.ug_since=this.world.clock.now; }
  激活地刺(): void { this.已激活=true; this.ug_phase='ready'; this.ug_since=this.world.clock.now; }
}
