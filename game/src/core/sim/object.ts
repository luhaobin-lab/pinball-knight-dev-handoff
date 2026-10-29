/**
 * BpObject: every Demo object (ARCHITECTURE §4.1, Appendix A.5). Identity, class manifest, validity, location with
 * attachment, owned tags, the latent helpers (delegating to `world.latent`) and the presentation emitter `fx`.
 * Contract file of core-contracts.
 */
import { TagSet } from './tags.ts';
import type { AnimCallbacks, AnimOptions, TimelineCallbacks, TimelineMode, World } from './world.ts';
import type { AssetPath, BgmState, ClassDef, LogLine, PopupPayload, Tag, TextRef, UiOp, Vec3 } from './types.ts';

/** Presentation nodes → PresentEvents (ARCHITECTURE §4.9). Arguments are Demo asset paths or widget names. */
export interface Fx {
  vfx(asset: AssetPath | null, at: Vec3 | BpObject, opts?: { attach?: boolean; scale?: number }): void;
  sound(asset: AssetPath | null, at?: Vec3, opts?: { volume?: number; pitch?: number }): void;
  shake(asset: string, at?: Vec3): void;
  flipbook(on: BpObject, asset: AssetPath, opts?: { loop?: boolean }): void;
  flash(on: BpObject, seconds: number): void;
  headUp(on: BpObject, text: TextRef): void;
  popup(p: PopupPayload): void;
  log(line: LogLine): void;
  ui(op: UiOp): void;
  bgm(state: BgmState): void;
}

export abstract class BpObject {
  /** The Demo asset path; set by every concrete class. */
  declare static readonly path: AssetPath;

  readonly id: number;
  readonly world: World;
  readonly def: ClassDef;
  valid = true;
  location: Vec3 = { x: 0, y: 0, z: 0 };
  attachParent: BpObject | null = null;
  /** Offset from attachParent while attached (UE keeps the world transform at attach time). */
  private attachOffset: Vec3 = { x: 0, y: 0, z: 0 };
  readonly OwnedGameplayTags: TagSet;
  readonly fx: Fx;

  constructor(world: World, def: ClassDef) {
    this.world = world;
    this.def = def;
    this.id = world.nextId();
    this.OwnedGameplayTags = new TagSet(def.tags);
    this.fx = world.bus.fxFor(this);
  }

  ReceiveBeginPlay(): void {}
  ReceiveTick(_dt: number): void {}
  setTickEnabled(on: boolean): void { this.world.latent.setTickEnabled(this, on); }

  /** Follows attachParent. */
  K2_GetActorLocation(): Vec3 {
    if (!this.attachParent) return { ...this.location };
    const p = this.attachParent.K2_GetActorLocation();
    return { x: p.x + this.attachOffset.x, y: p.y + this.attachOffset.y, z: p.z + this.attachOffset.z };
  }
  K2_SetActorLocation(p: Vec3): void {
    if (this.attachParent) {
      const q = this.attachParent.K2_GetActorLocation();
      this.attachOffset = { x: p.x - q.x, y: p.y - q.y, z: p.z - q.z };
    }
    this.location = { ...p };
  }
  K2_AttachToActor(parent: BpObject): void {
    const here = this.K2_GetActorLocation();
    const q = parent.K2_GetActorLocation();
    this.attachParent = parent;
    this.attachOffset = { x: here.x - q.x, y: here.y - q.y, z: here.z - q.z };
  }
  K2_DetachFromActor(): void {
    this.location = this.K2_GetActorLocation();
    this.attachParent = null;
  }
  K2_DestroyActor(): void { this.world.destroy(this); }
  /** HasMatchingGameplayTag: an owned tag equals the query or is a child of it. */
  HasMatchingGameplayTag(t: Tag): boolean { return this.OwnedGameplayTags.has(t); }

  delay(node: string, seconds: number, then: () => void): void { this.world.latent.delay(this, node, seconds, then); }
  retriggerableDelay(node: string, seconds: number, then: () => void): void { this.world.latent.retriggerableDelay(this, node, seconds, then); }
  nextTick(node: string, then: () => void): void { this.world.latent.nextTick(this, node, then); }
  setTimer(handle: string, rate: number, looping: boolean, fn: () => void, initialStartDelay = 0): void {
    this.world.latent.setTimer(this, handle, rate, looping, fn, initialStartDelay);
  }
  clearTimer(handle: string): void { this.world.latent.clearTimer(this, handle); }
  timeline(name: string, mode: TimelineMode, cb?: TimelineCallbacks): void { this.world.latent.timeline(this, name, mode, cb); }
  playAnim(on: BpObject, sequence: string, cb?: AnimCallbacks, opts?: AnimOptions): void { this.world.latent.playAnim(this, on, sequence, cb, opts); }
}
