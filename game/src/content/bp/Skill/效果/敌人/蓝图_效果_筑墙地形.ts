/** F-WALLT L1171/L15/L1670; source BoxExtent32,32,100, spawn.5s/finish.8s from raw flipbooks. */
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { structOf } from '../../../../../core/bp/structs.ts';
import { RandomFloatInRange } from '../../../../../core/rng/ue.ts';
import type { BpObject } from '../../../../../core/sim/object.ts';
import type { AssetPath, Tag, Vec3 } from '../../../../../core/sim/types.ts';
import type { 结构_地形格 } from '../../../../demo/types.ts';
import { 蓝图_效果_地形 } from '../蓝图_效果_地形.ts';

interface CollisionHook { setTerrainCollision(o: BpObject, enabled: boolean, half: Vec3): void }
const HALF: Vec3 = { x: 32, y: 32, z: 100 };
const zeroCell = (t: 结构_地形格): boolean => t.序号 === 0 && Object.values(t.整数坐标).every(v => v === 0) && Object.values(t.真实坐标).every(v => v === 0);

export class 蓝图_效果_筑墙地形 extends 蓝图_效果_地形 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/敌人/蓝图_效果_筑墙地形';
  所在地形格: 结构_地形格 = structOf('结构_地形格');
  计数 = 0;
  序号_0 = 0;
  private collision(on: boolean): void { (this.world.sys.physics as unknown as CollisionHook).setTerrainCollision(this, on, HALF); }
  override 激活后触发(_Debug: string): void {
    super.激活后触发('');
    this.销毁延迟 = 2;
    const q = 函数库_技能.查找地形格(this, this.world.mode, this.所在位置, { x: 0, y: 0, z: 0 }, true, 32);
    if (!q.找到了) { this.销毁效果(); return; }
    // Source quirk: ignores q.Output and removes a zero struct, not the actual location.
    this.所在地形格 = structOf('结构_地形格');
    const walk = this.world.mode.当前房间实例?.可走地形格;
    if (walk) for (let i = walk.length - 1; i >= 0; i--) if (zeroCell(walk[i]!)) walk.splice(i, 1);
    this.delay('L1171', Math.fround(RandomFloatInRange(this.world.rng.combat, 0, 0.2)), () => {
      this.fx.sound('CatapultHero/声音/石头掉落', this.K2_GetActorLocation());
      this.fx.flipbook(this, 'CatapultHero/精灵片/FX/地形02/FX_地形02_SQ_Swpn');
      this.delay('spawn flipbook', 0.5, () => { this.collision(true); this.fx.flipbook(this, 'CatapultHero/精灵片/FX/地形02/FX_地形02_SQ_Idle', { loop: true }); });
    });
  }
  private breakRock(): void {
    const walk = this.world.mode.当前房间实例?.可走地形格;
    if (walk && !walk.some(zeroCell)) walk.push(this.所在地形格);
    this.delay('L1670', Math.fround(RandomFloatInRange(this.world.rng.combat, 0, 0.2)), () => {
      this.fx.sound('CatapultHero/声音/石头爆炸', this.K2_GetActorLocation());
      this.collision(false);
      this.fx.flipbook(this, 'CatapultHero/精灵片/FX/地形02/FX_地形02_SQ_Finsh');
      this.delay('finish flipbook', 0.8, () => this.fx.ui({ op: 'update', widget: '地形隐藏', data: { id: this.id } }));
    });
  }
  override 销毁前触发(): void { super.销毁前触发(); this.breakRock(); }
  override 持续中触发(tag: Tag): void {
    super.持续中触发(tag);
    if (tag === '效果.时机.死亡前' || tag === '效果.时机.结束层时') this.breakRock();
  }
}
