/** Source L15/L4227/L46: charged collision, nearest enemy, split-inclusive loop and two pure spread evaluations per deferred shot. */
import { 蓝图_效果_蓄能碰撞XX时XX } from '../蓝图_效果_蓄能碰撞XX时XX.ts';
import { 蓝图_发射物 } from '../../../../../core/ability/projectile.ts';
import { 函数库_技能, 函数库_工具 } from '../../../../../core/bp/index.ts';
import { 科学数变普通, type 科学数 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import type { AssetPath, Rotator } from '../../../../../core/sim/types.ts';
import type { 枚举_伤害类型 } from '../../../../demo/types.ts';
export class 蓝图_效果_朝敌人投射_碰撞 extends 蓝图_效果_蓄能碰撞XX时XX {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_朝敌人投射（碰撞）';
  角度抖动_0 = 0; 连击计数_0_0 = 0; 触发次数_0 = 0;
  override 激活后触发(Debug: string): void { super.激活后触发(Debug); this.无延迟连击 = true; }
  override 额外子触发(结算数值: 科学数, 触发次数: number): void {
    const s = this.来自技能, source = s?.拥有者, hero = this.world.mode.玩家角色;
    if (!s || !source || !hero || !this.world.mode.敌方场上.length) return;
    this.触发次数_0 = 触发次数; source.创建发射物组(this.触发次数_0, false);
    const split = () => Math.trunc(科学数变普通(获取科学映射词条(source.词条, '投射分裂').输出值));
    for (let i = 0; i <= split(); i++) {
      const origin = hero.K2_GetActorLocation();
      let nearest = null, dist = Infinity;
      for (const enemy of this.world.mode.敌方场上) {
        if (!enemy || !this.world.isValid(enemy)) continue;
        const at = enemy.K2_GetActorLocation(), d = (at.x - origin.x) ** 2 + (at.y - origin.y) ** 2 + (at.z - origin.z) ** 2;
        if (d < dist) { nearest = enemy; dist = d; }
      }
      const cfg = s.发射物[0]; if (!nearest || !cfg?.类型) continue;
      const transform = () => {
        const o = hero.K2_GetActorLocation(), target = 函数库_工具.扩散命中中心(this, nearest, { x: 0, y: 0, z: 0 }, .65, { x: 0, y: 0, z: 0 });
        const x = target.x - o.x, y = target.y - o.y;
        const angle = x * x + y * y > .0001 ? Math.fround(Math.atan2(y, x) * 180 / Math.PI) : 0;
        return { at: { x: o.x, y: o.y, z: 5 }, yaw: Math.fround(angle + (i - Math.max(split() - 1, 0) / 2) * 7.5) };
      };
      const first = transform();
      const shot = this.world.spawn<蓝图_发射物>(cfg.类型, x => {
        x.来自角色 = source; x.来自技能 = s; x.速度 = cfg.速度; x.持续时长 = cfg.持续时长; x.触发间隔 = cfg.触发间隔;
        (x as 蓝图_发射物 & { ActorRotation: Rotator }).ActorRotation = { Pitch: 0, Yaw: first.yaw, Roll: 0 };
      }, first.at);
      const last = transform(); shot.K2_SetActorLocation(last.at);
      (shot as 蓝图_发射物 & { ActorRotation: Rotator }).ActorRotation = { Pitch: 0, Yaw: last.yaw, Roll: 0 };
      const key = 函数库_技能.获取技能参数(this, s, 2, false, '').词条;
      const names = ['物理', '流血', '剧毒', '燃烧', '爆炸', '气刃', '电击', '抓钩'];
      const values: 枚举_伤害类型[] = ['物理', '流血', '中毒', '燃烧', '爆炸', '剑气', '电击', '抓钩'];
      shot.伤害类型 = values[names.indexOf(key)] ?? ('枚举_伤害类型_MAX' as 枚举_伤害类型);
      shot.伤害数值 = 结算数值; shot.触发次数 = this.触发次数_0; source.创建发射物(shot, this.触发次数_0, false);
    }
  }
}
