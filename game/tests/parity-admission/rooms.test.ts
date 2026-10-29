import { describe,it,expect } from 'vitest';
import { registry,createRegistry } from '../../src/content/bp';
import { createWorld } from '../../src/core/sim/runtime';
import { createGame } from '../../src/core/api/game';
import { 数据表_敌人_普通,数据表_地图格 } from '../../src/content/demo';
import { G2_SCOPE } from '../../src/core/sim/stage-scope';
import { scriptedPolicy } from '../../src/bot/policies';
import { botRng } from '../../src/bot/rng';
import type { BotGame } from '../../src/bot/api';
import type { Command } from '../../src/core/api/commands';

describe('reviewed ordinary room/enemy admission',()=>{
 it('admits all14normal source tiles and13nonprologue enemy rows without altering source skills',()=>{
  const w=createWorld({content:registry,filter:'ported'});
  expect(G2_SCOPE.tiles).toEqual(['空','营地','第一层','宝箱房','属性房','探索房','简单战斗','普通战斗','首领战斗','抉择房','恢复点','锻造房','精英战斗','传奇房']);
  for(const row of ['抉择房','恢复点','锻造房','精英战斗','传奇房'])expect(w.isRowPorted(数据表_地图格.asset,row)).toBe(true);
  for(const row of ['眼球','大肠','大肠血卵','守门人','结晶','水母脑','齐刘海','眼球包','眼球_融合','大肠团','结晶簇','章鱼脑','盗宝黏菌'])expect(w.isRowPorted(数据表_敌人_普通.asset,row)).toBe(true);
  expect(w.isRowPorted(数据表_敌人_普通.asset,'血球')).toBe(false);
 });
 it('still rejects a missing new enemy dependency instead of accepting a registered generic actor alone',()=>{
  const missing='CatapultHero/BP/Skill/效果/敌人/蓝图_效果_黏菌逃跑';expect(registry.get(missing)).toBeDefined();
  const content=createRegistry(registry.paths().filter(p=>p!==missing).map(p=>registry.get(p)!)),w=createWorld({content,filter:'ported'});
  expect(w.isRowPorted(数据表_敌人_普通.asset,'盗宝黏菌')).toBe(false);expect(w.isRowPorted(数据表_敌人_普通.asset,'眼球')).toBe(true);
 });
 it('actual ordinary run naturally enters a newly admitted room using unchanged source map options',()=>{
  const g=createGame({seed:1,content:registry,filter:'ported',debug:{skipPrologue:true}}),p=scriptedPolicy(),rng=botRng(1,0);const newTiles=new Set(['抉择房','恢复点','锻造房','精英战斗','传奇房']);let reached:string|null=null;
  for(let step=0;step<150;step++){
   g.runUntilInput();if(g.view.screen==='room'&&newTiles.has(g.world.mode.当前层地图格配置表.RowName)){reached=g.world.mode.当前层地图格配置表.RowName;break;}
   const cmd=p.choose({game:g as unknown as BotGame,legal:g.legal(),rng,step});if(!cmd)break;expect(g.send(cmd as Command).ok).toBe(true);
  }
  expect(reached).not.toBeNull();expect(g.world.mode.当前总层数).toBeGreaterThan(1);
 });
});
