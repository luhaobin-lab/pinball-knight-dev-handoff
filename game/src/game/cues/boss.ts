import type { CueHandler } from '../cues';
/** Gatekeeper source events mapped to the approved procedural sound/impact library. Terrain lifetime is view-driven. */
const handlers: readonly CueHandler[] = [
  {kind:'sound',priority:110,match:a=>/音效_基础_大眼爆炸A$/.test(a),play:(e,t)=>t.sound('charge',t.place(e))},
  {kind:'sound',priority:110,match:a=>/音效_基础_大眼爆炸B$|音效_铁锤重击$|音效_肉弹战车$/.test(a),play:(e,t)=>t.sound('hit',t.place(e))},
  {kind:'vfx',priority:110,match:a=>/粒子_Hit_冲击波$|粒子_Hit_Dust_0[23]$/.test(a),play:(e,t)=>{const p=t.place(e);if(p)t.spores?.(p,{x:0,z:1});}},
  {kind:'shake',priority:110,match:a=>/摄像机晃动_零点六$/.test(a),play:(_e,t)=>t.shake('crit')},
];
export default handlers;
