import { expect,it } from 'vitest';
import { createGame } from '../../src/core/api/game.ts';
import { registry } from '../../src/content/bp/index.ts';
it('Player L16870→L1591 finishes initialization on the real new-adventure path',()=>{
 const game=createGame({seed:4,content:registry,filter:'ported',debug:{skipPrologue:true}});
 game.runUntilInput();game.send({type:'title.newRun'});game.runUntilInput();game.send({type:'hero.start'});game.runUntilInput();
 expect(game.world.mode.玩家角色?.初始化完毕).toBe(true);
});
