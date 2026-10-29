import { it, expect } from 'vitest';
import { createGame } from '../../src/core/api/game';
import { registry } from '../../src/content/bp';
import { GetCustomSave } from '../../src/core/sys/save/ems';
import { scriptedPolicy } from '../../src/bot/policies';
import { botRng } from '../../src/bot/rng';
import type { BotGame } from '../../src/bot/api';
import type { Command } from '../../src/core/api/commands';

it('actual second expedition loot uses EMS acquisition round instead of the old world-field fallback zero',()=>{
 const g=createGame({seed:6,content:registry,filter:'ported',debug:{skipPrologue:true}}),policy=scriptedPolicy(),rng=botRng(6,0);
 for(const type of ['title.newRun','hero.start']as const){g.runUntilInput();expect(g.send({type}).ok).toBe(true);}g.runUntilInput();
 expect(GetCustomSave(g.world).轮回次数).toBe(0);expect(g.send({type:'menu.open'}).ok).toBe(true);expect(g.send({type:'warning.answer',button:1}).ok).toBe(true);
 let checked=false;
 for(let step=0;step<100;step++){
  g.runUntilInput();const round=GetCustomSave(g.world).轮回次数,items=[...g.world.cult.已装备牌,...g.world.cult.背包里牌,...g.world.cult.未拾取牌].filter(c=>c?.valid&&c.名字!=='锁定格');
  if(round===1&&items.length){expect(items.every(c=>c!.获取轮次===1)).toBe(true);expect(items.every(c=>!c!.是遗产)).toBe(true);for(const c of items)for(const a of c!.附魔存档)expect(a.获取轮次).toBe(1);checked=true;break;}
  const cmd=policy.choose({game:g as unknown as BotGame,legal:g.legal(),rng,step});expect(cmd).toBeTruthy();expect(g.send(cmd as Command).ok).toBe(true);
 }
 expect(checked).toBe(true);
});
