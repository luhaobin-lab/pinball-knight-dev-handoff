/**
 * Presentation events (ARCHITECTURE §6.4, Appendix A.9): what the shell plays. Each carries its game time `t`; the
 * shell never answers them and presentation never feeds back into rules. Contract file of core-contracts.
 */
import type { AssetPath, BgmState, PopupKind, Vec3 } from '../sim/types.ts';
import type { ActorKind } from './view.ts';

export type PresentEvent = { readonly t: number } & (
  | { kind: 'actor.spawn'; id: number; row: string; table: string; cls: AssetPath; actorKind: ActorKind; at: Vec3; radius: number; height: number; elite: boolean; hidden: boolean }
  | { kind: 'actor.despawn'; id: number } | { kind: 'actor.reveal'; id: number } | { kind: 'actor.hide'; id: number; hidden: boolean }
  | { kind: 'actor.anim'; id: number; sequence: string; seconds: number; loop: boolean }
  | { kind: 'actor.flash'; id: number; seconds: number } | { kind: 'actor.squash'; id: number; speed: number; normal: Vec3 }
  | { kind: 'actor.hit'; id: number; from: number | null; crit: boolean; weak: boolean } | { kind: 'actor.die'; id: number }
  | { kind: 'launch.start'; hero: number; at?: Vec3; direction?: Vec3 }
  | { kind: 'launch.contact'; index: number; contact: 'enemy' | 'wall' | 'gravity'; actor: number | null; hero?: number; at?: Vec3; normal?: Vec3; speed?: number; reacts?: boolean }
  | { kind: 'launch.end'; hero: number; at?: Vec3 }
  | { kind: 'popup'; popup: PopupKind; value: number | string; target: number | null; at: Vec3 | null; crit?: boolean; weak?: boolean; damageType?: string; stack?: number }
  | { kind: 'vfx'; asset: AssetPath | null; at: Vec3 | null; attach: number | null; normal?: Vec3 }
  | { kind: 'sound'; asset: AssetPath | null; at: Vec3 | null; volume: number; pitch: number }
  | { kind: 'shake'; asset: string; at: Vec3 | null }
  | { kind: 'time.dilation'; curve: 'hitStop' | 'death' | 'deathResist' | 'ratingReward' | 'none'; from: number }
  | { kind: 'headUp'; id: number; text: string }
  | { kind: 'log'; rich: string }
  | { kind: 'bgm'; state: BgmState }
  | { kind: 'ui'; op: 'open' | 'close' | 'update'; widget: string; data?: unknown }
);

export type PresentEventKind = PresentEvent['kind'];
