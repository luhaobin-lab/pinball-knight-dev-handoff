/**
 * The shell's one seam onto the core API (`src/core/api`, ARCHITECTURE Appendix A.8–A.9 with WAVE_A §3): every shell
 * module imports the game's types from here. Positions are uu with x east, y south (the src/core/launch frame), z up.
 */
export type { Command, CommandOf, CommandResult, CommandSpec, CommandType, ItemPlace, PageName } from '../core/api/commands.ts';
export type {
  ActorKind,
  AfterimageView,
  FieldEffectView,
  FogView,
  ActorView,
  CardView,
  ChoiceOptionView,
  GameView,
  HeroSelectView,
  HeroView,
  SkillPreview,
  InventoryView,
  LootCellView,
  MapCellView,
  MapView,
  ModalView,
  MultiChoiceSource,
  RoomPlan,
  RunView,
  Screen,
  TitleView,
  TerrainView,
  ProjectileView,
} from '../core/api/view.ts';
export type { PresentEvent, PresentEventKind } from '../core/api/events.ts';
export type { Game, GameOptions, SaveBlob } from '../core/api/types.ts';
export { createGame } from '../core/api/game.ts';
export type { LaunchPlayback, LaunchPreview } from '../core/launch/index.ts';
export { samplePlayback } from '../core/launch/index.ts';
