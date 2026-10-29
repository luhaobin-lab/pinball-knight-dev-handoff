/** Source 幻影斩 effect L15 -> latent898/2880/3084/3247. No fabricated teleport or direct damage. */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { BP_Actor_Other } from '../../../../../core/sim/other.ts';
import type { Vec3 } from '../../../../../core/sim/types.ts';
import { 函数库_工具, 函数库_技能 } from '../../../../../core/bp/index.ts';
import { makeHitResult } from '../../../../../core/bp/structs.ts';
import { Array_Random } from '../../../../../core/rng/ue.ts';
import { 蓝图_效果_残影 } from '../蓝图_效果_残影.ts';

export class 蓝图_效果_幻影斩 extends 蓝图_效果 {
  static override readonly path = 'CatapultHero/BP/Skill/效果/玩家/蓝图_效果_幻影斩';
  间隔 = 0;
  检测停止_Q = false;
  已完结 = false;
  目标位置: Vec3 = { x: 0, y: 0, z: 0 };
  起始位置: Vec3 = { x: 0, y: 0, z: 0 };
  瞬身次数 = 5;
  捕捉到角色: BP_Actor_Other[] = [];
  private stopping = false;

  override 激活后触发(_debug: string): void {
    const o = this.拥有者; if (!o) return;
    this.销毁延迟 = 1;
    const weapons = this.world.cult.已装备牌.filter(c => c && this.world.isValid(c) && c.HasMatchingGameplayTag('可交互.修炼牌.武器'));
    this.瞬身次数 = weapons.length + 函数库_技能.获取技能参数(this, this.来自技能, 0, false, '').参数值;
    this.间隔 = .3; o.更新朝向(); o.疲劳 = 0; o.疲劳了 = false; o.移动中 = true; o.切换穿透状态(true);
    o.移到目标地点('闪避曲线', '卡牌高度位移曲线', 3000, 0);
    this.delay('898', o.移动所需时长, () => {
      this.目标位置 = o.K2_GetActorLocation(); this.起始位置 = { ...this.目标位置 }; o.关闭碰撞(); this.hop();
    });
  }

  private hop(): void {
    const o = this.拥有者; if (!o || this.stopping) return;
    const hits = 函数库_工具.以目标为中心追踪(this, null, Math.fround(this.来自技能?.技能距离 ?? 0), 3, 0, [], true, this.目标位置).OutHits;
    this.捕捉到角色 = [...new Set(hits.map(h => h.actor).filter((a): a is BP_Actor_Other => a instanceof BP_Actor_Other && !a.死掉了 && a.HasMatchingGameplayTag('可交互.角色.AI.仇恨')))];
    if (this.捕捉到角色.length) {
      const target = this.捕捉到角色[Array_Random(this.world.rng.combat, this.捕捉到角色)]!;
      const points = 函数库_技能.获取目标范围空地(this, 60, 0, 12, target, false, false, 0).查询到的位置;
      const p = points[Array_Random(this.world.rng.combat, points)] ?? { x: 0, y: 0, z: 0 };
      o.目标位置 = { x: p.x, y: p.y, z: o.高度 };
    } else {
      const points = 函数库_工具.范围选取点(this, this.起始位置, 0, 200, 90, 3, false, 16).选到的点;
      o.目标位置 = { ...(points[Array_Random(this.world.rng.combat, points)] ?? { x: 0, y: 0, z: 0 }) };
    }
    o.移到目标地点('卡牌平面位移曲线', '卡牌高度位移曲线', 8000, 0);
    this.delay('2880', o.移动所需时长, () => {
      if (this.stopping) return;
      o.发动攻击(this.来自技能, makeHitResult(), false);
      函数库_技能.给装备的物品充能(this, this.world.mode, '幻影斩', false, 0);
      this.delay('3084', this.间隔, () => { if (this.stopping) return; this.瞬身次数--; if (this.瞬身次数 >= 1) this.hop(); else this.销毁效果(); });
    });
  }

  override 销毁前触发(): void {
    if (this.stopping) return; this.stopping = true;
    this.delay('3247', 0, () => {
      const o = this.拥有者; if (!o) return;
      o.切换穿透状态(false); o.结束行动(null, ''); o.开启碰撞(); o.更新运动数据();
      if (this.来自技能 && this.world.isValid(this.来自技能)) this.来自技能.释放结束(false);
    });
  }
  override ReceiveTick(dt: number): void {
    super.ReceiveTick(dt);
    const o = this.拥有者; if (!o) return;
    if (o.死掉了) { if (!this.stopping) this.销毁效果(); return; }
    const image = this.world.spawn(蓝图_效果_残影, e => { e.拥有者 = o; e.释放者 = o; e.来自技能 = this.来自技能; e.持续时长 = -1; }, o.K2_GetActorLocation());
    image.激活后触发('');
    // Source stop gate begins closed; only explicit 检测停止 opens it (the boolean variable is not its exec pin).
  }
  检测停止(): void {
    const o = this.拥有者; if (!o || o.当前目标 && this.world.isValid(o.当前目标) && !o.当前目标.死掉了) return;
    if (o.当前物理速度 >= 3) return;
    const p = o.K2_GetActorLocation();
    if (!this.world.trace.sphere(p, { ...p, z: p.z + 100 }, 120, '可伤害', [o]).length) this.销毁效果();
  }
  override 持续中触发(_tag: string): void {}
  ReceiveDestroyed(): void { this.已完结 = true; }
}
