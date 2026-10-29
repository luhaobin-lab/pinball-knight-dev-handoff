import type { Rect } from '../../core/surface';
import { SCREEN, toPx, type Box } from '../../hud/layout';

/**
 * UI_警告提示 resolved from the dump (D:/TAPTAPGAME_ref/dump/widgets/CatapultHero/BP/UI/UI_警告提示.json) in the
 * 1920×1080 design (× 0.5 on our grid). The widget fills the screen; BackgroundBlur_186 centres SizeBox_0.
 */

const W = 1920;
const H = 1080;

/** SizeBox_0 672×594, centred (BackgroundBlurSlot HAlign/VAlign Center); Border_17 draws 锻造页_Sprite7 on it. */
const panel: Box = { x: (W - 672) / 2, y: (H - 594) / 2, w: 672, h: 594 };

/** SizeBox_1 440×212 in Overlay_12 (padding bottom 60, centred): 提示内容, centred and wrapped. */
const text: Box = { x: panel.x + (panel.w - 440) / 2, y: panel.y + (panel.h - 60 - 212) / 2, w: 440, h: 212 };

/**
 * VerticalBox_39 (padding left 2, bottom 54; HAlign Center, VAlign Bottom): SizeBox_86 405×63 (按钮1), Spacer_69
 * (UE's default 1×1 spacer), SizeBox_87 405×63 (按钮2).
 */
const BUTTON = { w: 405, h: 63, gap: 1 } as const;
const column = { x: panel.x + 2 + (panel.w - 2 - BUTTON.w) / 2, bottom: panel.y + panel.h - 54 };
const button = (i: 0 | 1): Box => ({ x: column.x, y: column.bottom - (2 - i) * BUTTON.h - (1 - i) * BUTTON.gap, w: BUTTON.w, h: BUTTON.h });

/** 关闭按钮 (39×39 brush) in Overlay_12: padding top 72, right 6, HAlign Right. */
const close: Box = { x: panel.x + panel.w - 6 - 39, y: panel.y + 72, w: 39, h: 39 };

export const WARNING_LAYOUT: { readonly panel: Rect; readonly text: Rect; readonly buttons: readonly [Rect, Rect]; readonly close: Rect } = {
  panel: toPx(panel, SCREEN),
  text: toPx(text, SCREEN),
  buttons: [toPx(button(0), SCREEN), toPx(button(1), SCREEN)],
  close: toPx(close, SCREEN),
};
