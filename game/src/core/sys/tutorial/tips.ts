/** UI_新手提示 L32/L949: overwrite one visible tip, mark at display, preserve per-tip source gates; no pause or queue. */
import { 数据表_词条_新手提示,demoEnums } from '../../../content/demo/tables.ts';
import type { World } from '../../sim/world.ts';
import type { TutorialView } from '../../api/view.ts';
import type { 蓝图_动作游戏模式 } from '../../sim/mode.ts';
import { sciOf } from '../../math/sci.ts';
interface TutorialSave {已触发新手提示:string[];主线任务:Map<string,boolean>;当前轮回任务进度:Map<string,number>;新手关中:boolean;新手关过:boolean}
export const tutorialSave=(w:World):TutorialSave=>(w.sys.save as typeof w.sys.save&{GetCustomSave(w:World):TutorialSave}).GetCustomSave(w);
type Host=蓝图_动作游戏模式&{ug_tutorial?:TutorialView|null};
export const visibleTip=(w:World):TutorialView|null=>(w.mode as Host).ug_tutorial??null;
const names=demoEnums.枚举_新手提示类型.values;
export function showTip(w:World,n:number):void{
  const debug=(w as World&{options?:{debug?:{skipPrologue?:boolean}}}).options?.debug;if(debug?.skipPrologue)return;
  const name=names.find(v=>v.value===n)?.display;if(!name)return;const save=tutorialSave(w);if(save.已触发新手提示.includes(name))return;
  const m=w.mode,h=m.玩家角色;if(!h)return;
  if(n===1&&m.当前总层数!==2)return;
  if(n===2&&!(m.当前总层数===2&&m.当前层回合>1))return;
  if(n===3&&m.当前总层数!==4)return;
  if(n===5&&m.当前总层数!==6)return;
  if(n===7)return; // no live source callsite or table row; potential page is unreachable in Demo
  if(n===9&&!(m.当前总层数===2&&m.当前层回合>2))return;
  if(n===10){if(m.当前总层数!==2)return;h.失去生命_护甲(sciOf(0,0),sciOf(Math.max(h.生命百分比-.8,0),0),false);}
  if(n===14&&(h.死掉了||w.modal.current?.kind!=='panel'||w.modal.current.result!=='failure'))return;
  const row=(数据表_词条_新手提示.rows as Record<string,{游戏中名:{zh:string};说明:{zh:string};媒体:string|null}>)[name];if(!row)return;
  if(m.玩家控制器)m.玩家控制器.在Widget上=true;save.已触发新手提示.push(name);
  (m as Host).ug_tutorial={tip:n,name,title:row.游戏中名.zh,text:row.说明.zh,media:row.媒体};m.fx.ui({op:'open',widget:'UI_新手提示',data:{tip:n,name}});w.cult.切换屏蔽(true,false,2);
}
export function hideTip(w:World,unblock=false):void{(w.mode as Host).ug_tutorial=null;if(unblock){w.cult.切换屏蔽(false,false,2);if(w.mode.玩家控制器)w.mode.玩家控制器.在Widget上=false;}w.mode.fx.ui({op:'close',widget:'UI_新手提示'});}
