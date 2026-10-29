/** 岩浆地板.txt L1812/L2653/L4055: latent lava erupts on expiry, not on selection or 主动激活. */
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { sciOf, 科学数乘除 } from '../../../../../core/math/sci.ts';
import { 获取科学映射词条 } from '../../../../../core/math/stats.ts';
import { FRand, RandomFloatInRange } from '../../../../../core/rng/ue.ts';
import { BP_ManeActor } from '../../../../../core/sim/actor.ts';
import type { BpObject } from '../../../../../core/sim/object.ts';
import type { AssetPath, HitResult, Tag, Vec3 } from '../../../../../core/sim/types.ts';
import type { World } from '../../../../../core/sim/world.ts';
import { 蓝图_效果_地形 } from '../蓝图_效果_地形.ts';

interface BoxQuery { boxTraceActors(w: World, from: Vec3, to: Vec3, half: Vec3, ignore: readonly (BpObject | null)[]): HitResult | null }
const FX = 'CatapultHero/精灵片/FX/地形01/';
export class 蓝图_效果_岩浆地板 extends 蓝图_效果_地形 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/敌人/蓝图_效果_岩浆地板';
  灯光初始值 = 0;
  灯光随机 = 0;
  灯光强度 = 0;
  ug_spawned = false;
  /** Source BG/FG visibility and flipbook changes, recorded at the original callbacks for pure view projection. */
  ug_visual: { state: 'hidden'|'spawning'|'warning'|'erupting'|'closing'; since: number } = { state:'hidden', since:0 };
  override 激活后触发(debug: string): void {
    super.激活后触发(debug);
    this.地形激活 = true;
    this.销毁延迟 = Math.fround(this.序号 * 0.1 + 1);
    this.灯光初始值 = RandomFloatInRange(this.world.rng.combat, 0.1, 0.2);
    this.灯光随机 = FRand(this.world.rng.combat);
    this.delay('L1812', Math.fround(this.序号 * 0.1), () => {
      this.fx.sound('音效_基础_大眼爆炸A', this.K2_GetActorLocation());
      if (this.ug_spawned) return; this.ug_spawned = true; // source DoOnce L970
      this.ug_visual = { state:'spawning', since:this.world.clock.now };
      this.fx.flipbook(this, `${FX}FX_地形01_SQ_Swpn`);
      // Raw FX_地形01_SQ_Swpn: 4 frames / 10 fps.
      this.delay('L1030', 0.4, () => {
        if (this.地形激活) this.ug_visual = { state:'warning', since:this.world.clock.now };
        this.fx.flipbook(this, `${FX}FX_地形01_SQ_Idle`, { loop: true });
      });
    });
  }
  override 持续中触发(_tag: Tag): void {} // L4274: 新一天时 tests 地形激活 then returns; no parent call.
  override 销毁前触发(): void {
    // L15 Sequence: branch first, then parent L359; setting false before branch would suppress every eruption.
    if (this.地形激活) {
      if (this.剩余回合 > 0) {
        this.ug_visual = { state:'closing', since:this.world.clock.now };
        this.fx.flipbook(this, `${FX}FX_地形01_SQ_Finsh`);
      }
      else this.触发();
    }
    super.销毁前触发();
  }
  触发(): void {
    this.地形激活 = false;
    this.游戏模式?.加入回合开始(this);
    this.delay('L4055', Math.fround(this.序号 * 0.1), () => {
      this.fx.flipbook(this, `${FX}FX_地形01_SQ_Finsh`);
      this.造成伤害(); // L1545 has literal false: no BG-finish wait before damage.
      this.ug_visual = { state:'erupting', since:this.world.clock.now };
      this.fx.flipbook(this, `${FX}FX_地形01_SQ_Finsh_FG`);
      // Raw FG finish: 6 frames / 10 fps. This blocks round start until the visible blast finishes.
      this.delay('L385', 0.6, () => {
        this.灯光强度 = 0;
        this.ug_visual = { state:'hidden', since:this.world.clock.now };
        this.fx.ui({ op: 'update', widget: '岩浆地板隐藏', data: { id: this.id } });
        this.游戏模式?.退出回合开始(this);
      });
    });
  }
  造成伤害(): void {
    const at = this.K2_GetActorLocation();
    this.fx.sound('音效_基础_大眼爆炸B', at); this.fx.shake('摄像机晃动_零点二', at);
    this.灯光强度 = 1.5;
    const hit = (this.world.sys.physics as unknown as BoxQuery).boxTraceActors(this.world, at, { ...at, z: at.z + 100 }, { x: 32, y: 32, z: 32 }, [this.释放者]);
    const actor = hit?.actor;
    if (!(actor instanceof BP_ManeActor) || !actor.HasMatchingGameplayTag('可交互.角色.玩家')) return;
    actor.更新运动数据();
    if (!this.world.isValid(this.地形管理组)) return;
    const p = 函数库_技能.获取技能参数(this, this.来自技能, 0, false, '');
    const stat = 获取科学映射词条(this.释放者?.词条 ?? new Map(), p.词条).输出值;
    this.地形管理组!.地形造成伤害(false, '主动', '爆炸', false, false, false, 0, actor, 科学数乘除(stat, sciOf(p.参数值), false), false, null);
  }
}
