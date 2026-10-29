import type{CueHandler}from'../cues';
/** These persistent source effects are drawn from actual live effect views, never a second generic point spark. */
const handlers:readonly CueHandler[]=[
 {kind:'vfx',priority:120,match:a=>/\/(粒子_黑洞|粒子_闪电链_01)$/.test(a),play(){}},
];
export default handlers;
