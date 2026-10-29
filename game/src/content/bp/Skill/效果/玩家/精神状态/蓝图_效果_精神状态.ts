/**
 * 蓝图_效果_精神状态 — base of every mental state (SCM-070, SCM-076): the HUD cell `UI_增减益格` (created on the hero,
 * refreshed on re-activation), the negative-state warning, the flying cell, and the save entry reset on destroy.
 * Demo: CatapultHero/BP/Skill/效果/玩家/精神状态/蓝图_效果_精神状态 (pseudo L10…L2264).
 * Parent: 蓝图_效果. CDO tags: none. Interface 接口_工具 (读档处理). Batch: core-stamina.
 */
import type { 蓝图_能力 } from '../../../../../../core/ability/ability.ts';
import { 蓝图_效果 } from '../../../../../../core/ability/effect.ts';
import type { AssetPath } from '../../../../../../core/sim/types.ts';
import type { FText } from '../../../../../demo/types.ts';

/** The state of a `UI_增减益格` widget the logic reads (its validity) and the HUD draws (through `fx.ui`). */
export interface 增减益格 {
  名字: FText;
  内容: FText;
  图标: AssetPath | null;
  visible: boolean;
  /** 显示额外数据: the remaining-turns badge. */
  额外数据: boolean;
}

/** 结构_存档_精神 at run time (the Demo keeps the ability object in 能力实例). */
interface 精神存档条目 {
  能力实例: 蓝图_能力 | null; 唯一ID: string; 能力等级: number; 能力品质: number; 剩余回合: number; 叠加层数: number;
}

const 空文本: FText = { zh: '', en: '' };

export class 蓝图_效果_精神状态 extends 蓝图_效果 {
  static override readonly path: AssetPath = 'CatapultHero/BP/Skill/效果/玩家/精神状态/蓝图_效果_精神状态';
  精神类型 = 0;
  类型名 = '乐观';
  是读档 = false; // 是读档？
  /** UI_增减益格 (a widget variable; widget fields are not generated). It stays valid after RemoveFromParent. */
  对应增减益格: 增减益格 | null = null;

  /** L1418 → L186 / L597 → L525. Only on an owner tagged 可交互.角色.玩家 (the hero). */
  override 激活后触发(_Debug: string): void {
    if (!this.拥有者?.HasMatchingGameplayTag('可交互.角色.玩家')) return;
    if (this.HasMatchingGameplayTag('效果.类型.减益.精神')) this.fx.ui({ op: 'update', widget: '区域判断.负面全屏警告' });
    const 技能 = this.来自技能;
    const cell = this.对应增减益格;
    if (cell) {
      // L186
      cell.名字 = 技能?.额外描述[0] ?? 空文本;
      cell.内容 = 技能?.描述 ?? 空文本;
      cell.图标 = 技能?.图标 ?? null;
      this.更新增减益格();
    } else {
      // L597: added to 区域判断.精神状态栏; Visible when loading or on the map page (phase 9), else Collapsed.
      this.对应增减益格 = {
        名字: 技能?.额外描述[0] ?? 空文本, 内容: 技能?.描述 ?? 空文本, 图标: 技能?.图标 ?? null,
        visible: this.是读档 || this.world.mode.当前环节 === '选择地图', 额外数据: false,
      };
      this.fx.ui({ op: 'open', widget: 'UI_增减益格', data: this.cellData() });
    }
    // L525 → L10: the flying cell from 释放者 to the bar, except on the map page.
    if (this.world.mode.当前环节 !== '选择地图') {
      this.fx.ui({ op: 'open', widget: 'UI_精神飞翔格', data: { effect: this.id, from: this.释放者?.id ?? null } });
    }
  }

  /** L1656 → L2194. */
  override 销毁前触发(): void {
    this.精神状态销毁处理();
  }

  /** L2235: empty (no parent call). */
  override 持续中触发(_触发时机: string): void {}

  /** L2240: ReceiveDestroyed re-runs the 销毁前触发 graph of this class (L1656), not the subclass override. */
  ReceiveDestroyed(): void {
    this.精神状态销毁处理();
  }

  /** L2245 (接口_工具). */
  读档处理(是读档: boolean): void {
    this.是读档 = 是读档;
  }

  /** UI_增减益格.更新增减益格 (presentation). */
  更新增减益格(): void {
    if (this.对应增减益格) this.fx.ui({ op: 'update', widget: 'UI_增减益格', data: this.cellData() });
  }

  /** UI_增减益格.显示额外数据(true): the remaining-turns badge (SCM-134). A None cell is a no-op. */
  显示额外数据(显示: boolean): void {
    if (!this.对应增减益格) return;
    this.对应增减益格.额外数据 = 显示;
    this.更新增减益格();
  }

  private cellData(): unknown {
    return { effect: this.id, ...this.对应增减益格, 叠加层数: this.叠加层数, 剩余回合: this.剩余回合 };
  }

  private 精神状态销毁处理(): void {
    const hero = this.world.mode.玩家角色;
    const 能力名 = this.来自技能?.能力名 ?? '';
    if (hero) {
      const save = hero.精神存档 as unknown as Map<string, 精神存档条目>;
      if (save.has(能力名)) {
        save.set(能力名, { 能力实例: null, 唯一ID: this.来自技能?.唯一ID ?? '', 能力等级: 1, 能力品质: 1, 剩余回合: 0, 叠加层数: 0 });
        hero.保存精神状态();
      }
    }
    // L2194 RemoveFromParent (the widget object stays valid).
    if (this.对应增减益格) this.fx.ui({ op: 'close', widget: 'UI_增减益格', data: { effect: this.id } });
  }
}
