import { describe,it,expect } from 'vitest';
import { createGame } from '../../src/core/api/game';
import { registry } from '../../src/content/bp';
import { scriptedPolicy } from '../../src/bot/policies';
import { botRng } from '../../src/bot/rng';
import type { BotGame } from '../../src/bot/api';
import type { Command } from '../../src/core/api/commands';
// Original failure trace (thin-item pool fd6 predecessor) remains in
// studio/reports/parity-admission-rooms-dev01/report.json. Actor IDs are source-allocation dependent.
describe('shop policy reads source public prices and outcome',()=>{
 it('seed1 natural shop skips unaffordable silver forge and leaves after affordable no-matching-card rejection',()=>{
  const g=createGame({seed:1,content:registry,filter:'ported',debug:{skipPrologue:true}}),policy=scriptedPolicy(),rng=botRng(1,0);for(let step=0;step<40;step++){g.runUntilInput();if(g.view.phase==='进入商店')break;const cmd=policy.choose({game:g as unknown as BotGame,legal:g.legal(),rng,step});expect(cmd).toBeTruthy();expect(g.send(cmd as Command).ok).toBe(true);}
  expect(g.view.phase).toBe('进入商店');const silver=g.view.field.find(a=>a.row==='锻造锤_品质白银')!;expect(silver.shopPrice).toBeGreaterThan(g.view.run!.金币);const chosen:string[]=[];
  for(let step=0;step<8&&g.view.phase==='进入商店';step++){
   const cmd=policy.choose({game:g as unknown as BotGame,legal:g.legal(),rng,step})as Command;
   expect(cmd?.type).toBe('interact');if(cmd.type==='interact')chosen.push(g.view.field.find(a=>a.id===cmd.actor)!.row);
   expect(g.send(cmd).ok).toBe(true);g.runUntilInput();
  }
  expect(chosen).not.toContain('锻造锤_品质白银');expect(chosen).toContain('锻造锤_品质青铜');expect(chosen).toContain('商人');expect(g.view.phase).not.toBe('进入商店');
 });
});
