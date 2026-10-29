/**
 * UI_警告提示 (BP/UI/UI_警告提示.txt): the confirmation dialog. Wave A shows two of its three types (PROTOTYPE_SCOPE §2):
 *
 * - type 0, the pause dialog (HUD button UI_背包栏_3d.Button_27): "结束本次探险？", button 1 重置房间（+10腐化）, or
 *   保存并退出 in phases 9 (map) and 18 (item box) and in the prologue, button 2 放弃探险;
 * - type 2, the resume prompt (GM L29825): "上一次的记忆还未丢失，是否回忆？", buttons 回忆 and 遗忘.
 *
 * Type 1 (the endless warning) is unreachable in the Demo (no non-camp portal) and is not built.
 */

export type WarningType = 0 | 2;

export interface WarningModel {
  readonly type: WarningType;
  /**
   * Type 0 only: 当前环节 ∈ {9, 18} ∨ 新手关中？ (L1312), which turns button 1 into 保存并退出 (and its answer into
   * QuitGame, L585). The binder reads it from the run view.
   */
  readonly saveQuit: boolean;
}

/** What the dialog says: 提示内容 and the two button labels 按钮文本1 / 按钮文本2 (L1312). */
export interface WarningText {
  readonly text: string;
  readonly buttons: readonly [string, string];
}

/** 重置房间 costs 10 Corruption: the literal 10 of MakeLiteralInt (L1312; SCM §1). */
export const RESET_ROOM_CORRUPTION = 10;

export function warningText(m: WarningModel): WarningText {
  if (m.type === 2) return { text: '上一次的记忆还未丢失，是否回忆？', buttons: ['回忆', '遗忘'] };
  return { text: '结束本次探险？', buttons: [m.saveQuit ? '保存并退出' : `重置房间（+${RESET_ROOM_CORRUPTION}腐化）`, '放弃探险'] };
}

/**
 * `answer` → the command `warning.answer { button }` (0 = 按钮1, 1 = 按钮2); `close` → `menu.close`.
 * QUIRK (L3762): 关闭按钮 switches on the literal 0, so it closes the dialog for every type, the resume prompt too.
 */
export type WarningIntent = { readonly kind: 'answer'; readonly button: 0 | 1 } | { readonly kind: 'close' };
