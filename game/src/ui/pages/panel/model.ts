/** View model of the combat-end panel (UI_战斗结束统计页 with UI_角色战斗统计 per character). */
export interface CharacterStats {
  /** Design-frame px of the stats row's left middle (the widget's alignment 0, 0.5), from the character's screen point. */
  readonly at: { readonly x: number; readonly y: number };
  /** 左指引线 visibility (the Demo shows it when the row sits right of the character). */
  readonly guide: boolean;
  /** Source right guide when the hero lies to the right of the source play-area threshold. */
  readonly rightGuide?: boolean;
  /** 完成充能值 / 造成伤害值 / 治愈生命值 / 生成护甲值; an absent value hides its chip. */
  readonly charge?: number | string;
  readonly damage?: number | string;
  readonly heal?: number | string;
  readonly armor?: number | string;
}

export interface PanelModel {
  /** 任务成功？: 标题 胜利 / 失败. */
  readonly success: boolean;
  /** 重新挑战 is Visible only when !(任务成功？ || 腐化满过？ || 新手关中？) (L4159); the shell computes it. */
  readonly canRetry: boolean;
  readonly stats: readonly CharacterStats[];
}

export type PanelIntent = { readonly kind: 'continue' } | { readonly kind: 'retry' };
