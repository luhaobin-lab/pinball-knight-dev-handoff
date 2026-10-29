/**
 * Public API of the UI lane: the Ink & Bone combat HUD (src/ui/README.md).
 */
export { createCombatHud, type CombatHud, type CombatHudOptions, type HudTarget, type PopupAt, type PopupRequest } from './hud/combat-hud';
export type { CombatHudState, HeroState, ItemCard, Quality, QuestLine, Rank, SkillSlot, StatusCell, StatusKind, TurnStats } from './hud/state';
export type { EnemyMark, IntentKind } from './hud/marks';
export { BAR_OFFSET, HEAD_HEIGHT } from './hud/marks';
export type { PopupKind } from './hud/popups';
export type { IconKind } from './icons/items';
export { ICON_KINDS } from './icons/items';
export type { ItemType } from './style/palette';
export { abbreviate } from './text/abbrev';
export { breakLines, format, parseRich, type LaidLine, type StyledRun } from './text/layout';
export { FONT_LICENSE } from './text/font';
