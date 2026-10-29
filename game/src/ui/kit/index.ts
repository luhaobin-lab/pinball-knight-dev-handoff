/**
 * The page kit (ARCHITECTURE §9, WAVE_A A06): pages, the page stack and the Ink & Bone widgets. Pages receive plain
 * view models and emit intents; `src/game` turns intents into Commands. Nothing here imports `src/core`.
 */
export type { Page, Region, UiKey, UiPointer } from './page';
export { Regions } from './page';
export { DIM, PageStack, type OpenOptions } from './stack';
export { alignBox, box, canvasBox, DESIGN_UNITS, padBox, px, SCREEN, toGrid, type Box, type CanvasLayout, type HAlign, type Margin, type Space, type VAlign } from './umg';
export { bar, Button, diamondBadge, drawButton, Grid, icon, iconFit, inkBox, list, panel, rule, type ButtonFace, type ButtonState, type PanelKind, type PixelSprite } from './widgets';
export { drawRich, label, layoutRich, richLabel, type RichBlock, type RichOptions, type TextAlign } from './rich';
export { layoutKeyword, layoutTooltip, placeTooltip, TIP, type TooltipModel } from './tooltip';
export { Menu, MENU, menuRects, type MenuRow } from './menu';
export { BADGE, badgeRects, currencyChip, drawCard, qualityFrame, type CardFace } from './card';
export { QUALITY_STYLE, RICH_DEFAULT, RICH_TALENT, TEXT, type Quality, type RichStyle, type RichStyles } from './style';
export { STR, STR_KEYS } from './strings';
export { WIDGETS } from './demo';
