/** 目视.txt L3923: five midpoint candidates at -40/-20/0/20/40°, >=3 free + phase2 + mission + <=2 enemies.
 * L2110 summons at intent time; L1767 executes only the boss animation and ends on its completion.
 */
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import { 函数库_技能 } from '../../../../../core/bp/index.ts';
import { structOf } from '../../../../../core/bp/structs.ts';
import type { BP_Actor_Other } from '../../../../../core/sim/other.ts';
import type { AssetPath, Vec3 } from '../../../../../core/sim/types.ts';

export class 蓝图_能力_守门人_目视 extends 蓝图_能力 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/Ability/敌人/蓝图_能力_守门人_目视';
  召唤出来的: (BP_Actor_Other | null)[] = [];
  新召唤: (BP_Actor_Other | null)[] = [];
  查找位置: Vec3[] = [];
  执行效果(): void {}
  override 检查子条件(): void {
    this.查找位置.length = 0;
    const owner = this.拥有者, mode = this.游戏模式, hero = mode?.玩家角色;
    if (!owner || !mode || !hero) { this.子条件通过 = false; return; }
    const h = hero.K2_GetActorLocation(), b = owner.K2_GetActorLocation();
    const half = { x: (b.x - h.x) * 0.5, y: (b.y - h.y) * 0.5, z: (b.z - h.z) * 0.5 };
    for (let i = 0; i <= 4; i++) {
      const rad = (i - 2) * 20 * Math.PI / 180;
      const p = { x: h.x + half.x * Math.cos(rad) - half.y * Math.sin(rad), y: h.y + half.x * Math.sin(rad) + half.y * Math.cos(rad), z: h.z + half.z };
      if (函数库_技能.查找地形格(this, mode, p, { x: 0, y: 0, z: 0 }, true, 16).找到了) {
        if (!this.查找位置.some(q => q.x === p.x && q.y === p.y && q.z === p.z)) this.查找位置.push(p); // unsnapped source point
      }
    }
    const task = mode.当前任务实例 as (typeof mode.当前任务实例 & { 未完成?: boolean }) | null;
    this.子条件通过 = this.查找位置.length >= 3 && owner.HasMatchingGameplayTag('状态.二阶段') && task?.未完成 === true && mode.敌方场上.length <= 2;
  }
  override 被选中(): void {
    const mode = this.游戏模式; if (!mode) return;
    for (const p of this.查找位置) {
      const q = 函数库_技能.召唤角色到场上(this, mode, 'CatapultHero/数据表/角色/数据表_敌人_普通', '眼球', p, true, false, false);
      const eye = q.召唤出来的; if (!eye) continue;
      if (!this.召唤出来的.includes(eye)) this.召唤出来的.push(eye);
      const first = eye.拥有的主动能力[0] ?? null;
      eye.可释放能力.push(first); if (first) first.无吟唱 = true;
      eye.选择技能();
      if (!mode.可行动角色.includes(eye)) mode.可行动角色.push(eye);
      eye.目标位置 = mode.玩家角色?.K2_GetActorLocation() ?? { x: 0, y: 0, z: 0 };
      eye.更新运动数据(); eye.更新朝向();
      const cfg = structOf('结构_地形选取配置');
      eye.切换指示箭头(false, '固定方向', 60, [], [], cfg, null);
      eye.切换指示箭头(true, '固定方向', 60, [], [], cfg, null);
      if (q.出生动画) this.playAnim(eye, q.出生动画, {});
    }
  }
  override 执行技能(_load: boolean): void {
    const owner = this.拥有者, anim = this.技能动画[0];
    if (owner && anim) this.playAnim(owner, anim, { completed: () => { this.释放结束(false); owner.结束行动(null, ''); } });
  }
}
