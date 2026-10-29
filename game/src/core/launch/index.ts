/**
 * The Demo's launch, collision and ricochet system (src/core/README.md, "Launch"): build a world, compute the aim
 * preview, plan the launch it replays, sample it over time. Units are uu (64 per tile); x east, y south.
 */
export { type Vec2, vec } from './math.ts';
export { UU_PER_TILE, uuToTiles, tilesToUu, tilePointToUu, uuPointToTiles } from './units.ts';
export {
  createLaunchWorld,
  sweepProbe,
  hasTag,
  TAG,
  DYNAMIC_MESH_CLASS,
  type LaunchWorld,
  type LaunchWorldDef,
  type FloorGrid,
  type SolidBoxDef,
  type SolidCircleDef,
  type BodyDef,
  type PickupDef,
  type GravityDef,
  type LaunchActor,
  type Hit,
  type Probe,
} from './world.ts';
export { STARTER_HERO, SOUL_HUNTER, LAUNCH_RULES, HIT_STOP, hitStopDilation, PREVIEW_PULSE, type HeroLaunchStats } from './settings.ts';
export { sampleTrajectory, type Trajectory, type PathPoint, type StopReason } from './path.ts';
export {
  computeLaunchPreview,
  aimVector,
  canBounceOff,
  isHostile,
  type LaunchPreview,
  type PreviewCircle,
  type PreviewTerminal,
  type PreviewOptions,
  type MarkerKind,
  type PulseLayout,
} from './preview.ts';
export {
  planLaunch,
  samplePlayback,
  contactAttack,
  movementRange,
  mainLegSpeed,
  terminalLegSpeed,
  legDuration,
  type LaunchPlayback,
  type PlaybackLeg,
  type PlaybackSample,
  type LaunchContact,
  type ContactKind,
} from './playback.ts';
