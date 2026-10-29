// Real title/map/choice commands only. Source talent pools and prices are never replaced or injected.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createGame } from '../../src/core/api/game.ts';
import { registry } from '../../src/content/bp/index.ts';
import { G2_SCOPE } from '../../src/core/sim/stage-scope.ts';
import { scriptedPolicy } from '../../src/bot/policies.ts';
import { botRng } from '../../src/bot/rng.ts';
const out=process.argv[2];if(!out?.startsWith('D:/TAPTAPGAME_codex/studio/'))throw Error('Explicit independent studio output directory required');
fs.mkdirSync(out,{recursive:true});
const rows=[],active=new Set([...G2_SCOPE.heroTalents,...G2_SCOPE.bossTalents.filter(x=>x==='蓄力击')]);
for(const hero of ['幽冥骑士','灵魂猎手']){
 for(const seed of [1,2,3,4]){
  const game=createGame({seed,content:registry,filter:'ported',debug:{skipPrologue:true,unlockAllHeroes:true}}),policy=scriptedPolicy(hero),rng=botRng(seed,0);
  const trace=[],offers=[],picks=[];let acquired=null;
  for(let step=0;step<300;step++){
   game.runUntilInput();const v=game.view,legal=game.legal(),m=v.modal;
   if(m?.kind==='runEnd')break;
   if(m?.kind==='multiChoice')offers.push({step,source:m.source,floor:v.run?.floor,options:m.options});
   const affordable=legal.find(c=>c.type==='modal.pick')?.params?.option??[];
   const option=m?.kind==='multiChoice'?m.options.findIndex((o,i)=>active.has(o.row)&&affordable.includes(i)):-1;
   const cmd=option>=0?{type:'modal.pick',option}:policy.choose({game,legal,rng,step});if(!cmd)break;
   const before={step,time:v.time,floor:v.run?.floor,gold:game.world.mode.金币,cmd};
   const result=game.send(cmd);if(!result.ok)throw Error(JSON.stringify({hero,seed,cmd,result}));trace.push(before);
   if(option>=0){
    const chosen=m.options[option];picks.push({...before,row:chosen.row,afterGold:game.world.mode.金币});
    game.runUntilInput();const slot=game.view.hero?.skills.find(s=>active.has(s.row));
    if(slot){acquired={row:slot.row,slot:slot.slot,cost:slot.cost,cooldown:slot.cooldown,paid:before.gold-game.world.mode.金币,floor:game.view.run?.floor};break;}
   }
  }
  rows.push({hero,seed,acquired,offers,picks,trace,end:{screen:game.view.screen,floor:game.view.run?.floor,modal:game.view.modal?.kind},coverage:game.coverage});
  console.log(JSON.stringify({hero,seed,acquired,commands:trace.length}));if(acquired)break;
 }
}
const report={commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),diffSha256:createHash('sha256').update(execFileSync('git',['diff'],{encoding:'utf8'})).digest('hex'),scope:'Natural ordinary source offer -> affordable legal choice -> real skill slot, core commands. Source free offers retain zero cost. Hunter availability is test-unlocked; no skill/HP/loot/offer injection. Not browser proof or original parity.',rows,complete:['幽冥骑士','灵魂猎手'].every(h=>rows.some(r=>r.hero===h&&r.acquired))};
fs.writeFileSync(`${out}/report.json`,JSON.stringify(report,null,2));if(!report.complete)process.exitCode=1;
