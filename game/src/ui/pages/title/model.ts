/**
 * UI_营地主菜单 (BP/UI/UI_营地主菜单.txt): the Demo's main menu, shown over the camp scene (phase 14). Visibility
 * (更新主菜单信息 L2178, PROTOTYPE_SCOPE §2): 序幕 always; 新的冒险 only when the save has 新手关过？; 继续冒险 never
 * (Collapsed in the widget and again by code); 退出, 设置 and the two community links always; the 深渊级别 row and
 * the camp quest list (任务列表) stay Collapsed.
 */

export interface TitleModel {
  /** Save flag 新手关过？ (set by finishing or skipping the prologue; GameOptions.debug.skipPrologue sets it). */
  readonly prologueDone: boolean;
}

export type TitleButton = 'prologue' | 'newRun' | 'quit' | 'settings' | 'discord' | 'kook';

/** The URLs of L2545 / L2587 (KismetSystemLibrary.LaunchURL). */
export const LINKS = { discord: 'https://discord.gg/ZvQ3GGZkrk', kook: 'https://kook.vip/oHGVOw' } as const;

/** Labels (序章文本, 开始冒险文本 set to 新的冒险 by L2003, 退出文本, TextBlock_83). */
export const TITLE_TEXT = { prologue: '序幕', newRun: '新的冒险', quit: '退出', contact: '联系我们' } as const;

/** The buttons the menu shows, in VerticalBox_0 order then the others. */
export function titleButtons(m: TitleModel): TitleButton[] {
  return ['prologue', ...(m.prologueDone ? (['newRun'] as const) : []), 'quit', 'settings', 'discord', 'kook'];
}

/**
 * Intents → commands: `prologue` → `title.prologue`, `newRun` → `title.newRun`, `settings` → `title.settings`, `quit`
 * → `title.quit`; `link` opens the URL in the shell (no command).
 */
export type TitleIntent =
  | { readonly kind: 'prologue' }
  | { readonly kind: 'newRun' }
  | { readonly kind: 'settings' }
  | { readonly kind: 'quit' }
  | { readonly kind: 'link'; readonly url: string };

export function titleIntent(b: TitleButton): TitleIntent {
  switch (b) {
    case 'discord':
    case 'kook':
      return { kind: 'link', url: LINKS[b] };
    default:
      return { kind: b };
  }
}
