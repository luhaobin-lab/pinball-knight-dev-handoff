import {it,expect,vi} from 'vitest';
import {createGame} from '../../src/core/api/game.ts';
import {registry} from '../../src/content/bp/index.ts';
import{科学数变普通}from'../../src/core/math/sci.ts';
import{获取科学映射词条}from'../../src/core/math/stats.ts';
import trace from './fixtures/seed5-used-card.json';
import { cells } from '../../src/core/sys/inventory/grid.ts';
const boot=()=>{const g=createGame({seed:5,content:registry,filter:'ported',debug:{skipPrologue:true}});g.runUntilInput();g.send({type:'title.newRun'});g.runUntilInput();g.send({type:'hero.start'});g.runUntilInput();return g;};
it('exhausting a real item uses the parent drop reset, leaving its previous cell free while deferred destruction remains source-owned',()=>{
 const g=boot(),w=g.world,c=w.cult.创建牌到侧栏('粘稠体液',1,null,[],0,new Map()).卡牌实例!;
 const row=g.view.inventory.equip.find(x=>x.id===c.id)!.place!.row,drop=vi.spyOn(w.sys.inventory.BP_Actor_Card!,'被放下'),parent=vi.spyOn(w.sys.inventory.BP_ManeActor!,'被放下');
 const uses=科学数变普通(获取科学映射词条(c.词条,'生命').输出值);for(let i=0;i<uses;i++)expect(g.send({type:'item.use',item:c.id}).ok).toBe(true);
 expect(c.死掉了).toBe(true);expect(drop).not.toHaveBeenCalled();expect(parent).toHaveBeenCalledOnce();
 expect(w.cult.已装备牌).not.toContain(c);expect(w.cult.背包里牌).not.toContain(c);expect(cells(w.cult.修炼物品格_已装备!)[row]!.拥有的物品).toBe(null);expect(w.mode.延迟销毁牌).toContain(c);
 const next=w.cult.创建牌到侧栏('空附魔石',1,null,[],0,new Map()).卡牌实例!;expect(g.send({type:'item.move',item:next.id,to:{grid:'equip',row,col:0}})).toEqual({ok:true});
});
it('preserves captured use46→move57 consumption/deferred-cleanup/row6 scenario with explicit source acquisition under the expanded pool',()=>{
 // Historical e543f13 natural commands remain byte-for-byte in fixtures/seed5-used-card.json.
 // Full172item admission changes its command13 loot IDs. Rebuild the exact source lifecycle boundary, not its RNG route.
 expect(trace.seed).toBe(5);expect(trace.commands[46]!.command.type).toBe('item.use');
 const g=boot(),w=g.world,c=w.cult.创建牌到侧栏('粘稠体液',1,null,[],0,new Map()).卡牌实例!;
 expect(g.send({type:'item.move',item:c.id,to:{grid:'equip',row:6,col:0}})).toEqual({ok:true});
 const gold=w.mode.金币,uses=科学数变普通(获取科学映射词条(c.词条,'生命').输出值);
 for(let n=0;n<uses;n++)expect(g.send({type:'item.use',item:c.id})).toEqual({ok:true});
 expect(c.死掉了).toBe(true);expect(w.mode.延迟销毁牌).toContain(c);expect(w.cult.已装备牌).not.toContain(c);expect(w.cult.背包里牌).not.toContain(c);
 // Recompute grid while the source delayed-death object is still tracked, then run the real clock at60Hz.
 w.cult.修炼物品格_已装备!.更新格子信息(0);expect(cells(w.cult.修炼物品格_已装备!)[6]!.拥有的物品).toBeNull();
 for(let n=0;n<60;n++)g.advance(1/60);
 const next=w.cult.创建牌到侧栏('空附魔石',1,null,[],0,new Map()).卡牌实例!;
 expect(g.send({type:'item.move',item:next.id,to:{grid:'backpack',row:6,col:0}})).toEqual({ok:true});
 expect(g.view.inventory.backpack.find(x=>x.id===next.id)?.place?.row).toBe(6);
 expect(g.send({type:'item.move',item:next.id,to:{grid:'equip',row:6,col:0}})).toEqual({ok:true});
 expect(g.view.inventory.equip.find(x=>x.id===next.id)?.place?.row).toBe(6);expect(g.view.inventory.backpack.some(x=>x.id===next.id)).toBe(false);expect(w.mode.金币).toBe(gold);
});
