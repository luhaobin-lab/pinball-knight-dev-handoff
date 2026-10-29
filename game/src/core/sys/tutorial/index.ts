/** Source seven-floor tutorial,13live tip rows, and the separate legacy GM entry; ordinary flow starts through the title. */
import type { Systems } from '../../bp/systems.ts';
import { showTip,hideTip,visibleTip,tutorialSave } from './tips.ts';
import type { World } from '../../sim/world.ts';
import { legacyEntry } from './legacy-entry.ts';
const allowsItem=(w:World,name:string)=>tutorialSave(w).新手关中&&['生命药剂_新手关','伤害附魔A','灼热眼珠'].includes(name);
const allowsEnemy=(w:World,name:string)=>tutorialSave(w).新手关中&&name==='新手关眼球包2';

export const tutorial: Systems['tutorial'] & {showTip:typeof showTip;hideTip:typeof hideTip;visibleTip:typeof visibleTip;allowsItem:typeof allowsItem;allowsEnemy:typeof allowsEnemy} = {
  showTip,hideTip,visibleTip,allowsItem,allowsEnemy,
  蓝图_动作游戏模式:{进入新手关:legacyEntry},
  commands:{'tutorial.continue':w=>{if(!visibleTip(w))return{ok:false};hideTip(w,true);return{ok:true};},'tutorial.close':w=>{if(!visibleTip(w))return{ok:false};hideTip(w,false);return{ok:true};}},
  legal:w=>visibleTip(w)?[{type:'tutorial.continue'},{type:'tutorial.close'}]:[],
  view:w=>({tutorial:visibleTip(w)}),
};
