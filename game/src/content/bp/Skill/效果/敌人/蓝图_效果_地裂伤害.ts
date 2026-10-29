/** F-FISSD L1222/L150/L704/L1903: 0.1*ring delay + .4 spawn, single box hit, .6 finish + .6 delay + .6 destroy. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { make伤害 } from '../../../../../core/bp/structs.ts';
import { sciOf, type 科学数 } from '../../../../../core/math/sci.ts';
import { FRand, RandomFloatInRange } from '../../../../../core/rng/ue.ts';
import { BP_ManeActor } from '../../../../../core/sim/actor.ts';
import type { BpObject } from '../../../../../core/sim/object.ts';
import type { AssetPath, HitResult, Vec3 } from '../../../../../core/sim/types.ts';
import type { World } from '../../../../../core/sim/world.ts';

interface BoxQuery { boxTraceActors(world: World, from: Vec3, to: Vec3, half: Vec3, ignore: readonly (BpObject | null)[]): HitResult | null }
export class 蓝图_效果_地裂伤害 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/敌人/蓝图_效果_地裂伤害';
  伤害数值: 科学数 = sciOf(0);
  序号 = 0;
  灯光初始值 = 0;
  灯光随机 = 0;
  灯光强度 = 0;
  是暴击 = false;
  ug_started = false;
  override 激活后触发(_Debug: string): void {
    this.销毁延迟 = 0.6;
    this.灯光初始值 = RandomFloatInRange(this.world.rng.combat, 0.1, 0.2);
    this.灯光随机 = FRand(this.world.rng.combat); // CORE-M-129 rows82: retain both draws even for cosmetic light.
    this.delay('L1222', Math.fround(this.序号 * 0.1), () => {
      if (this.ug_started) return; this.ug_started = true;
      this.fx.sound('CatapultHero/音效/音效_基础_大眼爆炸A', this.K2_GetActorLocation());
      this.fx.flipbook(this, 'CatapultHero/精灵片/FX/地形01/FX_地形01_SQ_Swpn');
      this.delay('L185', 0.4, () => {
        this.生效伤害();
        this.fx.flipbook(this, 'CatapultHero/精灵片/FX/地形01/FX_地形01_SQ_Finsh_FG');
        this.delay('L704', 0.6, () => {
          this.灯光强度 = 0;
          this.fx.ui({ op: 'update', widget: '地裂隐藏', data: { id: this.id } });
          this.delay('L1025', 0.6, () => this.销毁效果());
        });
      });
    });
  }
  生效伤害(): void {
    const at = this.K2_GetActorLocation();
    this.fx.sound('CatapultHero/音效/音效_基础_大眼爆炸B', at);
    this.fx.shake('CatapultHero/摄像机晃动/摄像机晃动_零点二', at);
    this.灯光强度 = 1.5;
    const hit = (this.world.sys.physics as unknown as BoxQuery).boxTraceActors(this.world, at, { ...at, z: at.z + 100 }, { x: 32, y: 32, z: 32 }, [this.释放者]);
    const actor = hit?.actor;
    if (!hit || !(actor instanceof BP_ManeActor) || actor.角色类型 === this.拥有者?.角色类型 || actor.受伤中) return;
    actor.更新运动数据();
    this.释放者?.造成即时伤害(make伤害({
      伤害来源: '被动', 伤害类型: '物理', 是暴击: this.是暴击, 伤害数值: this.伤害数值, 所需回合: 3, 触发次数: 1,
      击中点位置: hit.location, 击中点法线: { x: hit.location.x - actor.当前位置.x, y: hit.location.y - actor.当前位置.y, z: hit.location.z - actor.当前位置.z },
      来自技能: this.来自技能, 来自角色: this.释放者, 目标角色: actor,
    }), false, false);
  }
}
