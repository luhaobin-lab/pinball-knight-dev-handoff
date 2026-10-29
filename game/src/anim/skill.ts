/** Source C01/C05 Skill:9flipbookframes@10fps, atlas columns1..9. References are decoded from copiedIoStore
 * at studio/reference-session-20261027/skill-poses. These model-space poses retarget the observed raised hand/
 * weapon and halo to the existing beetle rig; they do not add a cast or modify the core override duration.
 */
export type SkillPose='knight'|'hunter';
export const SKILL_FPS=10;
export const SKILL_FRAMES=9;
export function skillPose(sequence:string):SkillPose|null{
  if(/Actor_C01_(SQ_)?Skill$/.test(sequence))return'knight';
  if(/Actor_C05_(SQ_)?Skill$/.test(sequence))return'hunter';
  return null;
}
export function skillFrame(age:number,seconds=.9):number{return age>=0&&age<seconds-1e-7?Math.min(8,Math.floor(age*SKILL_FPS+1e-7)):-1;}
/** Rig retarget values, sampled directly as nine discrete poses. There is no extra interpolation/easing. */
export const SKILL_ARM=[-.15,-.5,-1.05,-1.45,-1.5,-1.45,-1.25,-.65,-.15]as const;
/** Observed source halo diameter/height overatlas64px: shrinking ring, diamond, narrowstar, burst and twodot poses. */
export const SKILL_HALO=[{kind:0,width:25,height:7},{kind:0,width:24,height:5},{kind:0,width:22,height:4},
  {kind:1,width:5,height:9},{kind:1,width:9,height:5},{kind:1,width:10,height:3},
  {kind:2,width:11,height:11},{kind:2,width:8,height:8},{kind:3,width:5,height:10}]as const;
