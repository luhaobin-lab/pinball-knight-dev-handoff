/** Source L4127/L46: any item completion feeds base damage * count into no-delay combo, then aimed burning shots * stacks. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 蓝图_发射物 } from '../../../../../core/ability/projectile.ts';
import { 函数库_工具 } from '../../../../../core/bp/index.ts';
import { sciOf, 科学数乘除, 科学数变普通, type 科学数 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import type { AssetPath, Tag, Rotator } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_眼球杖 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_眼球杖';
  角度抖动 = 0; 触发次数_0 = 0;
  override 激活后触发(Debug: string): void { super.激活后触发(Debug); this.无延迟连击 = true; }
  override 持续中触发(时机: Tag): void {
    const owner = this.来自技能?.拥有者;
    if (时机 === '效果.时机.有物品完成充能' && owner) this.连击处理(科学数乘除(获取科学映射词条(owner.词条, '基础伤害').输出值, sciOf(this.触发次数, 0), false));
  }
  override 额外子触发(结算数值: 科学数, 触发次数: number): void {
    const s = this.来自技能, owner = s?.拥有者, hero = this.world.mode.玩家角色; if (!s || !owner || !hero) return;
    this.触发次数_0 = 触发次数; owner.创建发射物组(this.触发次数_0, false);
    const split = () => Math.trunc(科学数变普通(获取科学映射词条(owner.词条, '投射分裂').输出值));
    for (let i = 0; i <= split(); i++) {
      const origin = hero.K2_GetActorLocation(); let target = null, distance = Infinity;
      for (const enemy of this.world.mode.敌方场上) { if (!enemy || !this.world.isValid(enemy)) continue; const at = enemy.K2_GetActorLocation(), d = (at.x-origin.x)**2+(at.y-origin.y)**2+(at.z-origin.z)**2; if (d < distance) { target = enemy; distance = d; } }
      const cfg = s.发射物[0]; if (!target || !cfg?.类型) continue;
      const transform = () => {
        const at = hero.K2_GetActorLocation(), p = 函数库_工具.扩散命中中心(this, target, { x: 0, y: 0, z: 0 }, .65, { x: 0, y: 0, z: 0 });
        const x=p.x-at.x, y=p.y-at.y, yaw=x*x+y*y>.0001?Math.fround(Math.atan2(y,x)*180/Math.PI):0;
        return { at: { x: at.x, y: at.y, z: 5 }, yaw: Math.fround(yaw+(i-Math.max(split()-1,0)/2)*7.5) };
      };
      const first = transform();
      const shot = this.world.spawn<蓝图_发射物>(cfg.类型, x => { x.来自角色=owner; x.来自技能=s; x.速度=cfg.速度; x.持续时长=cfg.持续时长; x.触发间隔=cfg.触发间隔;
        (x as 蓝图_发射物 & { ActorRotation: Rotator }).ActorRotation={ Pitch:0,Yaw:first.yaw,Roll:0 }; }, first.at);
      const last = transform(); shot.K2_SetActorLocation(last.at); (shot as 蓝图_发射物 & { ActorRotation: Rotator }).ActorRotation={ Pitch:0,Yaw:last.yaw,Roll:0 };
      shot.伤害数值=科学数乘除(结算数值,sciOf(this.叠加层数,0),false); shot.伤害类型='燃烧'; shot.触发次数=this.触发次数_0; owner.创建发射物(shot,this.触发次数_0,false);
    }
  }
}
