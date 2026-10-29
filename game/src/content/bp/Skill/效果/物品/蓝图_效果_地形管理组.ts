/**
 * 蓝图_效果_地形管理组 — the group behind a terrain skill: on activation it picks the legal terrain cells of
 * 来自技能.地形选取 and spawns one 格子类 effect (a 蓝图_效果_地形) per cell, keeps them in 拥有的地形, forwards 主动激活
 * to them, clears them at floor end, rate-limits terrain damage (地形造成伤害, 0.5 s) and destroys itself when the last
 * cell is gone. Used by 蓝图_能力 terrain picks, 酸液池 and the wave-B terrains.
 * Demo: CatapultHero/BP/Skill/效果/物品/蓝图_效果_地形管理组 (dump/blueprints-pseudo/CatapultHero/BP/Skill/效果/物品/蓝图_效果_地形管理组.txt)
 * Parent: 蓝图_效果. CDO tags (manifest): 效果.时机.主动激活, 效果.时机.结束层时, 效果.时机.行动结束后, 效果.时机.新一天时.
 * Rows: 数据表_技能_修炼物品:黑檀树种, 数据表_技能_修炼物品:腐蚀池, 数据表_技能_默认:自然之力.
 * Batch: core-physics.
 */
import { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_技能, 函数库_工具 } from '../../../../../core/bp/index.ts';
import { make伤害, 效果配置From } from '../../../../../core/bp/structs.ts';
import type { 科学数 } from '../../../../../core/math/sci.ts';
import type { BP_ManeActor } from '../../../../../core/sim/actor.ts';
import { BP_Actor_Card } from '../../../../../core/sim/card.ts';
import { structOf } from '../../../../../core/bp/structs.ts';
import type { Tag } from '../../../../../core/sim/types.ts';
import type { AssetPath, 枚举_伤害来源, 枚举_伤害类型, 结构_地形选取配置 } from '../../../../demo/types.ts';
import { 蓝图_效果_地形, terrainKey } from '../蓝图_效果_地形.ts';

/** BP_Actor_Equip is legacy (WAVE_A §4: legacy equipment is dead); its class test can only match a card. */
const EQUIP_CLASS = 'CatapultHero/BP/Actor/BP_Actor_Equip';

export class 蓝图_效果_地形管理组 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/物品/蓝图_效果_地形管理组';
  拥有的地形: (蓝图_效果_地形 | null)[] = [];
  伤害间隔: number = 0;
  地形选取: 结构_地形选取配置 = structOf('结构_地形选取配置');
  回合结束自动激活: number = 99;
  销毁结束技能释放: boolean = false;

  // line 1 (清空地形): 销毁效果 on a copy of 拥有的地形 (each destroy removes itself from the live array).
  清空地形(): void {
    const copy = [...this.拥有的地形];
    for (let i = 0; i < copy.length; i++) {
      const t = copy[i] ?? null;
      if (this.world.isValid(t)) t.销毁效果();
    }
  }

  // 自定义地形激活: one 格子类 effect per legal cell, attached to and owned by 释放者.
  自定义地形激活(地形选取: 结构_地形选取配置): void {
    this.地形选取 = 地形选取;
    函数库_工具.获取释放的角色(this, this.释放者, this.游戏模式); // result unused (as in the Demo)
    const { 选取到的格子 } = 函数库_工具.选择合法地形(this, 地形选取, this.游戏模式);
    // L206: outer loop over the groups, L395: inner loop over each group's 真实坐标 (both re-read the length).
    for (let j = 0; j < 选取到的格子.length; j++) {
      for (let i = 0; i < 选取到的格子[j]!.真实坐标.length; i++) {
        const { 效果名字 } = 函数库_技能.获取效果名(this, this.来自技能, this.地形选取.格子类.效果类);
        const caster = this.释放者;
        // L769: no valid 释放者 → "死了" (debug print) and the next cell. The 死掉了 test after it is behind a literal false.
        if (!this.world.isValid(caster)) continue;
        // L1024
        const cfg = 效果配置From(this.地形选取.格子类);
        const pre = 函数库_工具.附加效果前处理(this, cfg, caster, 效果名字);
        if (pre.不需附加新效果) continue; // "有了" (debug print)
        // L1202: deferred spawn with the exposed fields.
        const cls = this.地形选取.格子类.效果类;
        if (!cls) continue; // L3670: "效果生成失败"
        const e = this.world.spawn<蓝图_效果>(cls, x => {
          x.拥有者 = caster;
          x.释放者 = caster;
          x.来自技能 = this.来自技能;
          x.持续时长 = this.地形选取.格子类.持续时间;
          x.触发间隔 = this.地形选取.格子类.触发间隔;
          x.持续回合 = this.地形选取.格子类.持续回合;
          x.叠加层数 = this.地形选取.格子类.叠加层数;
          x.临时 = false;
        });
        if (!this.world.isValid(e)) continue;
        e.效果名字 = 效果名字;
        const casterClass = caster.def.path;
        if ((casterClass === EQUIP_CLASS || casterClass === BP_Actor_Card.path) && !e.临时) {
          e.OwnedGameplayTags.add('效果.时机.装上');
          e.OwnedGameplayTags.add('效果.时机.卸下');
        } else if (this.world.isValid(this.来自技能) && this.来自技能.是天赋) {
          // L3518
          e.OwnedGameplayTags.add('能力.类型.天赋');
        }
        // L2376
        if (!caster.拥有的效果.includes(e)) caster.拥有的效果.push(e);
        e.K2_AttachToActor(caster);
        e.K2_DetachFromActor(); // (不需附加新效果 is false here, so the select picks the new effect)
        if (!(e instanceof 蓝图_效果_地形)) continue;
        if (!this.拥有的地形.includes(e)) this.拥有的地形.push(e);
        e.序号 = 选取到的格子[j]!.序号;
        e.中心格 = i === 0;
        const p = 选取到的格子[j]!.真实坐标[i]!;
        e.所在位置 = { x: p.X, y: p.Y, z: p.Z };
        e.K2_SetActorLocation(e.所在位置);
        e.地形管理组 = this;
        e.激活效果('');
        if (this.地形选取['开启预览框?']) continue;
        // L3454
        e.持续中触发('效果.时机.主动激活');
      }
    }
    // L842
    if (this.来自技能) this.来自技能.地形管理组 = this;
  }

  // 地形造成伤害: at most one terrain hit per 0.5 s for the whole group (伤害间隔 counts down in ReceiveTick).
  地形造成伤害(持续伤害: boolean, 伤害来源: 枚举_伤害来源, 伤害类型: 枚举_伤害类型, 不变速: boolean, 是暴击: boolean, 是弱点: boolean, 所需回合: number, 目标角色: BP_ManeActor | null, 伤害数值: 科学数, 指定特效: boolean, 特效实例: AssetPath | null): void {
    if (!(this.伤害间隔 <= 0.0)) return; // L1455
    this.伤害间隔 = 0.5;
    const d = make伤害({
      伤害来源, 伤害类型, 不变速, 是暴击, 是弱点, 伤害数值, 所需回合, 触发次数: 1,
      击中点位置: 目标角色?.K2_GetActorLocation() ?? { x: 0, y: 0, z: 0 },
      击中点法线: { x: 1, y: 0, z: 0 }, 断开骨骼名: 'None',
      来自技能: this.来自技能, 来自角色: this.拥有者, 来自发射物: null, 目标角色,
    });
    if (持续伤害) this.拥有者?.造成持续伤害(d, 指定特效, false);
    else this.拥有者?.造成即时伤害(d, 指定特效, false); // L853
    // L690
    if (指定特效 && 目标角色) this.fx.vfx(特效实例, 目标角色.K2_GetActorLocation());
  }

  // L492
  override 激活后触发(_Debug: string): void {
    if (this.来自技能) this.自定义地形激活(this.来自技能.地形选取);
  }

  // L538: replaces the base tick (no per-frame countdown of the group itself).
  override ReceiveTick(DeltaSeconds: number): void {
    if (this.伤害间隔 < 0.0) return;
    this.伤害间隔 = this.伤害间隔 - Math.fround(DeltaSeconds);
  }

  // L694: 主动激活 is forwarded to every cell (live loop, L325); 结束层时 clears them.
  override 持续中触发(触发时机: Tag): void {
    if (触发时机 === '效果.时机.主动激活') {
      for (let i = 0; i < this.拥有的地形.length; i++) {
        const t = this.拥有的地形[i] ?? null;
        if (this.world.isValid(t)) t.持续中触发('效果.时机.主动激活');
      }
      return;
    }
    if (触发时机 === '效果.时机.结束层时') this.清空地形();
  }

  // L855
  删除地形(销毁的地形: 蓝图_效果_地形 | null): void {
    const m = this.游戏模式?.地形环境;
    if (m && 销毁的地形) {
      const k = terrainKey(m, 销毁的地形.所在位置);
      if (k !== undefined) m.delete(k);
    }
    for (let i = this.拥有的地形.length - 1; i >= 0; i--) if (this.拥有的地形[i] === 销毁的地形) this.拥有的地形.splice(i, 1);
    if (!(this.拥有的地形.length <= 0)) return;
    if (this.销毁结束技能释放) this.来自技能?.释放结束(false);
    // L1173
    this.销毁效果();
  }
}
