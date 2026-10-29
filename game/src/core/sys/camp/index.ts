/** Camp chapter hub and source Eternal Statue's independent persistent stash. */
import type { Systems } from '../../bp/systems.ts';
import type { World } from '../../sim/world.ts';
import type { BP_Actor_Card } from '../../sim/card.ts';
import type { BpObject } from '../../sim/object.ts';
import type { CommandSpec } from '../../api/commands.ts';
import { inHub, unlocked, openStash, closeStash, liveStash, slotOf, storeCard, moveToStash, removeFromStash, STASH } from './stash.ts';
interface Statue extends BpObject { 已解锁: boolean; 显示: boolean; 更新解锁状态(animate: boolean): void; 玩家交互(): void }
interface Portal extends BpObject {关卡名:string;延迟:number;未点击:boolean;尺寸:number;WPO:number;激活传送门(direct:boolean):void;玩家交互():void}
interface Background extends BpObject {永恒之盒:Statue;显示:boolean;可交互:boolean;开启关卡选择背景():void;关闭关卡选择页面():void}
type CultHost = World['cult'] & { ug_eternalBox?: Statue;ug_campPortals?:Portal[] };
function refreshStatue(w: World, animate: boolean): void {
  const host = w.cult as CultHost;
  if(!w.isValid(host.关卡选择背景))host.关卡选择背景=w.spawn<Background>('CatapultHero/BP/环境/营地/蓝图_装饰品_关卡选择');
  const bg=host.关卡选择背景 as Background;host.ug_eternalBox=bg.永恒之盒;
  if(!animate){bg.开启关卡选择背景();for(const p of host.ug_campPortals??[])p.K2_DestroyActor();host.ug_campPortals=[];
   const options=(w.sys.map as {地图存档(w:World):{当前关卡选项:readonly string[]}}).地图存档(w).当前关卡选项;
   const at=[{x:-238,y:0,z:0},{x:208,y:-447,z:0},{x:208,y:447,z:0}]; // UI_关卡选项 L300
   options.forEach((name,i)=>{const p=w.spawn<Portal>('CatapultHero/BP/环境/营地/蓝图_传送门',p=>{p.关卡名=name;p.延迟=1+i*.5;},at[i]??at[0]);p.K2_AttachToActor(bg);p.激活传送门(false);host.ug_campPortals!.push(p);});
  }
  host.ug_eternalBox!.显示 = inHub(w); host.ug_eternalBox!.更新解锁状态(animate);
}
function enterChapter(w:World,name:string):boolean{return w.sys.map.commands?.['map.option']?.(w,{type:'map.option',option:name}).ok??false;}
function traveling(w:World):boolean{return inHub(w)&&((w.cult as CultHost).ug_campPortals??[]).some(p=>p.valid&&!p.未点击);}
export interface CampUi {
  refreshStatue(w: World, animate: boolean): void;
  openStash(w: World): boolean; closeStash(w: World): boolean;
  moveToStash(w: World, c: BP_Actor_Card, row: number, col: number): boolean;
  enterChapter(w:World,name:string):boolean;
  traveling(w:World):boolean;
}

export const camp: Systems['camp'] & CampUi = {
  refreshStatue, openStash, closeStash, moveToStash,enterChapter,traveling,
  commands:{'camp.statue':w=>{const box=(w.cult as CultHost).ug_eternalBox;if(!inHub(w)||!box)return{ok:false};box.玩家交互();return{ok:true};},
   'camp.travel':(w,c)=>{const p=(w.cult as CultHost).ug_campPortals?.find(p=>p.valid&&p.未点击&&p.关卡名===c.option);if(!p||!inHub(w))return{ok:false};p.玩家交互();return{ok:true};}},
  修炼系统: {
    仓库牌: storeCard,
    切换仓库页(c, close) { if (close) closeStash(c.world); else openStash(c.world); },
    页面切换(c, kind, close) {
      if (kind === '仓库页') return { 成功: close || !c.仓库页关闭了 ? closeStash(c.world) : openStash(c.world) };
      const craft = c.world.sys.craft as { openCraft(w: World): boolean; closeCraft(w: World): boolean };
      if (kind === '制造页') return { 成功: close ? craft.closeCraft(c.world) : craft.openCraft(c.world) };
      return { 成功: false }; // Other pages retain their existing frontend-owned entry until their own card.
    },
  },
  BP_Actor_Card: { 从仓库中移除: removeFromStash },
  legal(w):CommandSpec[] {
    if(traveling(w))return[];
    if (!w.cult.仓库页关闭了) return [
      { type: 'page.close' },
      { type: 'item.move', params: { item: [...w.cult.已装备牌, ...w.cult.背包里牌, ...liveStash(w)].filter(c => c?.valid && c.名字 !== '锁定格').map(c => c!.id),
        'to.grid': ['stash'], 'to.row': Array.from({ length: STASH.rows }, (_, i) => i), 'to.col': Array.from({ length: STASH.cols }, (_, i) => i) } },
    ];
    return inHub(w) && w.cult.盒子关闭了 ? [{type:'camp.statue'},...((w.cult as CultHost).ug_campPortals?.some(p=>p.未点击)?[{type:'camp.travel' as const,params:{option:(w.cult as CultHost).ug_campPortals!.filter(p=>p.未点击).map(p=>p.关卡名)}}]:[]),...(unlocked(w)?[{ type: 'page.open' as const, params: { page: ['stash'] } }]:[])] : [];
  },
  view(w) {
    const host = w.cult as CultHost;
    return { camp: inHub(w) ? { statue: { id: host.ug_eternalBox?.id ?? 0, unlocked: unlocked(w) }, title: '永恒神像',portals:(host.ug_campPortals??[]).filter(p=>p.valid).map(p=>({id:p.id,option:p.关卡名,size:p.尺寸,wpo:p.WPO,enabled:p.未点击})) } : null,
      stash: w.cult.仓库页关闭了 ? null : { rows: STASH.rows, cols: STASH.cols,
        cells: liveStash(w).map(c => ({ id: c.id, name: c.名字, quality: c.品质, size: c.尺寸, ...slotOf(c) })) } };
  },
};
