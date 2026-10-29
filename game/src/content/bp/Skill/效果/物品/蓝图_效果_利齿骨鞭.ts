/** Source L2342/L1765/L35: charged parent ->500uu vertical sphere, shuffled hits, equipment Bleed and blood cue. */
import { 蓝图_效果_蓄能碰撞XX时XX } from '../蓝图_效果_蓄能碰撞XX时XX.ts';
import { make伤害 } from '../../../../../core/bp/structs.ts';
import type { 科学数 } from '../../../../../core/math/sci.ts';
import { Array_Shuffle } from '../../../../../core/rng/ue.ts';
import { BP_ManeActor } from '../../../../../core/sim/actor.ts';
import type { AssetPath, HitResult } from '../../../../../core/sim/types.ts';
export class 蓝图_效果_利齿骨鞭 extends 蓝图_效果_蓄能碰撞XX时XX {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_利齿骨鞭';
  充能计数 = 0; Out_Hits: HitResult[] = []; 敌人数组: BP_ManeActor[] = [];
  override 激活后触发(Debug: string): void { super.激活后触发(Debug); }
  override 额外子触发(结算数值: 科学数, 触发次数: number): void {
    const owner = this.拥有者, s = this.来自技能; if (!owner || !s?.拥有者) return;
    owner.更新运动数据(); const at = owner.当前位置;
    this.fx.vfx('CatapultHero/粒子/粒子_轨迹_撕裂范围', { x: at.x, y: at.y, z: at.z + 32 }, { scale: 1 });
    this.Out_Hits = this.world.trace.sphere(at, { x: at.x, y: at.y, z: at.z + 100 }, 500, '可伤害', [owner]);
    Array_Shuffle(this.world.rng.combat, this.Out_Hits);
    for (let i = 0; i < this.Out_Hits.length; i++) {
      const enemy = this.Out_Hits[i]!.actor;
      if (!(enemy instanceof BP_ManeActor) || !enemy.HasMatchingGameplayTag('可交互.角色.AI.仇恨')) continue;
      enemy.更新运动数据(); const p = enemy.当前位置;
      s.拥有者.造成持续伤害(make伤害({ 伤害来源: '装备', 伤害类型: '流血', 伤害数值: 结算数值, 所需回合: 3, 触发次数,
        击中点位置: { x: p.x, y: p.y, z: p.z + 2 }, 击中点法线: { x: at.x - p.x, y: at.y - p.y, z: at.z - p.z }, 来自技能: s, 来自角色: s.拥有者, 目标角色: enemy }), true, false);
      this.fx.vfx('CatapultHero/粒子/粒子_Blood_02', { x: p.x, y: p.y, z: p.z + 2 });
    }
  }
}
