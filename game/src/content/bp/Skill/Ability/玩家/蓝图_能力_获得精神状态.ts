/**
 * 蓝图_能力_获得精神状态 — the ability of every 数据表_技能_精神状态 row (and the item "next combat" rows): records the
 * save entry, applies or merges 效果配置[0] on the hero, runs 读档处理 and 激活效果 (always, no 创建时 gate) and
 * 附加效果后, then ends (SCM-072…074). Demo: CatapultHero/BP/Skill/Ability/玩家/蓝图_能力_获得精神状态 (L10…L7815).
 * Parent: 蓝图_能力. Batch: core-stamina.
 */
import { 蓝图_能力 } from '../../../../../core/ability/ability.ts';
import type { 蓝图_效果 } from '../../../../../core/ability/effect.ts';
import { 函数库_工具, 函数库_技能 } from '../../../../../core/bp/index.ts';
import { make效果配置 } from '../../../../../core/bp/structs.ts';
import type { AssetPath } from '../../../../../core/sim/types.ts';

/** 结构_存档_精神 at run time (the Demo keeps the ability object in 能力实例). */
interface 精神存档条目 {
  能力实例: 蓝图_能力 | null; 唯一ID: string; 能力等级: number; 能力品质: number; 剩余回合: number; 叠加层数: number;
}

export class 蓝图_能力_获得精神状态 extends 蓝图_能力 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/Ability/玩家/蓝图_能力_获得精神状态';
  添加的实例: 蓝图_效果 | null = null;
  临时效果数组: (蓝图_效果 | null)[] = [];

  private get 精神存档(): Map<string, 精神存档条目> {
    return this.world.mode.玩家角色!.精神存档 as unknown as Map<string, 精神存档条目>;
  }

  /** L7805 / L7810 / L7815: empty overrides. */
  override 被选中(): void {}
  override 检查子条件(): void {}
  override 子初始化(): void {}

  /** L7616. */
  override 执行技能(是读档: boolean): void {
    if (是读档) {
      // Loading: only an entry with stacks re-creates the effect.
      if ((this.精神存档.get(this.能力名)?.叠加层数 ?? 0) > 0) this.附加();
      else this.释放结束(false); // L2552
      return;
    }
    // L10
    this.移除来自同名能力效果();
    const cfg0 = this.效果配置[0] ?? make效果配置();
    this.精神存档.set(this.能力名, { 能力实例: this, 唯一ID: this.唯一ID, 能力等级: this.等级, 能力品质: this.品质, 剩余回合: cfg0.持续回合, 叠加层数: cfg0.叠加层数 });
    this.附加(false);
  }

  /** L400 → L1285 → L2568 / L2089 → L2552. When loading with a saved entry, 持续回合 and 叠加层数 come from the save. */
  private 附加(是读档 = true): void {
    const hero = this.world.mode.玩家角色;
    const cfg0 = this.效果配置[0] ?? make效果配置();
    const saved = this.精神存档.get(this.能力名);
    const fromSave = 是读档 && saved !== undefined;
    const cfg = { ...cfg0, 持续回合: fromSave ? saved.剩余回合 : cfg0.持续回合, 叠加层数: fromSave ? saved.叠加层数 : cfg0.叠加层数 };
    const { 效果名字 } = 函数库_技能.获取效果名(this, this, cfg.效果类);
    if (!this.world.isValid(hero) || hero.死掉了) return; // → L7815 without 释放结束
    // L1285
    const pre = 函数库_工具.附加效果前处理(this, cfg, hero, 效果名字);
    let inst: 蓝图_效果 | null = pre.效果实例;
    if (!pre.不需附加新效果) {
      // L2568: deferred spawn with 拥有者 = 释放者 = hero, 来自技能 = self.
      if (!cfg.效果类) return; // SPEC-GAP: spawning None fails ("效果生成失败", L7395)
      const e = this.world.spawn<蓝图_效果>(cfg.效果类, x => {
        x.拥有者 = hero;
        x.释放者 = hero;
        x.来自技能 = this;
        x.持续时长 = cfg.持续时间;
        x.触发间隔 = cfg.触发间隔;
        x.持续回合 = cfg.持续回合;
        x.叠加层数 = cfg.叠加层数;
        x.临时 = false;
      });
      if (!this.world.isValid(e)) return; // L7395
      e.效果名字 = 效果名字;
      // The 装上/卸下 tags need the hero to be BP_Actor_Equip / BP_Actor_Card: never. L7480:
      if (this.是天赋) e.OwnedGameplayTags.add('能力.类型.天赋');
      if (!hero.拥有的效果.includes(e)) hero.拥有的效果.push(e); // L7185 AddUnique
      e.K2_AttachToActor(hero);
      inst = e;
    }
    // L2089: 接口_工具.读档处理, then 激活效果(能力名) and 附加效果后.
    if (inst) {
      const tool = inst as unknown as { 读档处理?: (b: boolean) => void };
      if (typeof tool.读档处理 === 'function') tool.读档处理(是读档);
      inst.激活效果(this.能力名);
    }
    hero.附加效果后(inst);
    this.释放结束(false); // L2552
  }

  /** Only abilities tagged 能力.时机.主动.覆盖: destroy every hero effect whose source ability has this 能力名 (a copy). */
  移除来自同名能力效果(): void {
    if (!this.HasMatchingGameplayTag('能力.时机.主动.覆盖')) return;
    this.临时效果数组 = [...this.world.mode.玩家角色!.拥有的效果];
    for (const e of this.临时效果数组) {
      if (!this.world.isValid(e?.来自技能)) continue;
      if (e.来自技能.能力名 === this.能力名) e.销毁效果();
    }
  }
}
