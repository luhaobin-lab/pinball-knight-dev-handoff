/** BP_ManeActor.txt:4860 only: final SetActorLocation(sweep=true, teleport=true).
 * Ordinary curve samples (4845) do not call this. Teleport preserves velocity; a swept blocking hit has zero impulse.
 * Engine contract: https://dev.epicgames.com/documentation/en-us/unreal-engine/BlueprintAPI/Collision/OnComponentHit
 * SPEC-GAP: the existing world trace uses ideal contacts, without Chaos contact offsets or penetration recovery.
 */
import { BP_ManeActor } from '../../sim/actor.ts';
import { piercingProfile } from '../../sim/collision-profile.ts';
import type { BpObject } from '../../sim/object.ts';
import type { HitResult, Vec3 } from '../../sim/types.ts';
import type { World } from '../../sim/world.ts';
import { collides } from './capsule.ts';
import { moveEffectOverlaps } from './boss-overlap.ts';

export function finalSweptMove(world: World, actor: BP_ManeActor, target: Vec3): HitResult | null {
  const from=actor.K2_GetActorLocation(),ignore:BpObject[]=[actor];
  let hit:HitResult|null=null;
  if(collides(actor)) {
    for(const candidate of world.trace.sphere(from,target,actor.宽度,'Pawn',ignore)){
      const other=candidate.actor;
      if(other instanceof BP_ManeActor&&(!collides(other)||piercingProfile(other)))continue;
      if(!candidate.blockingHit)continue;
      const d={x:target.x-from.x,y:target.y-from.y};
      // Preserve the existing movement convention: initial contact does not prevent moving away from that face.
      if(candidate.time===0&&d.x*candidate.impactNormal.x+d.y*candidate.impactNormal.y>=0)continue;
      hit=candidate;break;
    }
  }
  actor.K2_SetActorLocation(hit?{x:hit.location.x,y:hit.location.y,z:target.z}:target);
  moveEffectOverlaps(world,actor,from,actor.K2_GetActorLocation());
  if(!hit)return null;
  const other=hit.actor instanceof BP_ManeActor?hit.actor:null;
  const zero={x:0,y:0,z:0};
  actor.BndEvt__蓝图_角色_CapsuleComponent_K2Node_ComponentBoundEvent_1_ComponentHitSignature__DelegateSignature(null,other,null,zero,hit);
  if(other?.valid){
    const reverse={...hit,actor,normal:{x:-hit.normal.x,y:-hit.normal.y,z:-hit.normal.z},impactNormal:{x:-hit.impactNormal.x,y:-hit.impactNormal.y,z:-hit.impactNormal.z}};
    other.BndEvt__蓝图_角色_CapsuleComponent_K2Node_ComponentBoundEvent_1_ComponentHitSignature__DelegateSignature(null,actor,null,zero,reverse);
  }
  return hit;
}
