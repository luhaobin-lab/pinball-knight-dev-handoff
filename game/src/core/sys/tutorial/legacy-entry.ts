/** GM 进入新手关 source legacy entry. Ordinary title uses MENU 序幕→DEMO出发; do not replace that seven-floor path. */
import type { 蓝图_动作游戏模式 } from '../../sim/mode.ts';
import type { 蓝图_能力 } from '../../ability/ability.ts';
import { 函数库_技能 } from '../../bp/index.ts';
import { UI_关卡地图页面 } from '../../bp/widgets.ts';
import { structOf } from '../../bp/structs.ts';
import { tutorialSave } from './tips.ts';
export function legacyEntry(m:蓝图_动作游戏模式):void{
  m.英雄死亡后初始化();m.当前层地图格配置表={DataTable:'CatapultHero/数据表/地图/数据表_地图格',RowName:'新手关01'};
  const task=structOf('结构_任务条',{图标:'CatapultHero/精灵片/_UI/营地格_Sprite_12',权重:100,最大关卡数:10,最大层数:12,地图格队列:{DataTable:'CatapultHero/数据表/地图/数据表_标签队列',RowName:'初始列_0'},任务等级:1,奖励等级:1,任务需求:[{权重:100,数据表行:{DataTable:'CatapultHero/数据表/技能/数据表_技能_任务',RowName:'新手关通关'}}]});
  m.创建任务(task);m.当前轮回任务=m.当前任务实例;
  m.当前关卡最高层数=Math.trunc(函数库_技能.获取技能参数(m,m.当前轮回任务 as 蓝图_能力|null,0,false,'').参数值);m.激活任务(m.当前轮回任务,false);
  tutorialSave(m.world).新手关中=false;const h=m.玩家角色;if(h){h.已揭示=true;for(let i=1;i<=2;i++)if(h.拥有的主动能力[i])h.拥有的主动能力[i]!.解锁了=false;}
  UI_关卡地图页面.重置地图页(m,false);m.world.cult.切换地图页(false,false);m.world.sys.map.commands?.['map.enter']?.(m.world,{type:'map.enter',cell:'r1c1'});
}
