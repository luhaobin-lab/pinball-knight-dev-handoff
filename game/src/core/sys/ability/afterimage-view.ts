import type {AfterimageView}from'../../api/view.ts';
import type {World}from'../../sim/world.ts';
import type {BpObject}from'../../sim/object.ts';
import type {AnimationSnapshot}from'../../sim/presentation-state.ts';
type Image=BpObject&{拥有者?:BpObject|null;ug_afterimage?:{createdAt:number;dissolve:number;animation?:AnimationSnapshot;facing:1|-1;ownerHeight:number}|null};
export function afterimageView(world:World):AfterimageView[]{
  const objects=(world as World&{objects?():readonly BpObject[]}).objects?.()??[];
  return objects.flatMap(o=>{const p=o as Image,s=p.ug_afterimage;
    return o.valid&&o.def.path==='CatapultHero/BP/Skill/效果/蓝图_效果_残影'&&s?[{id:o.id,owner:p.拥有者?.id??null,position:o.K2_GetActorLocation(),createdAt:s.createdAt,dissolve:s.dissolve,sequence:s.animation?.sequence??null,animationAge:world.clock.now-s.createdAt,animationSeconds:s.animation?.seconds??0,facing:s.facing,ownerHeight:s.ownerHeight}]:[];
  });
}
