import fs from 'node:fs';import path from 'node:path';import {execFileSync}from'node:child_process';import {createHash}from'node:crypto';
import{ROOT,buildCheckout,serve,launchChrome,runTool,watchPage,waitReady}from'../lib/harness.mjs';
const out=process.argv.includes('--out')?path.resolve(process.argv[process.argv.indexOf('--out')+1]):'D:/TAPTAPGAME_codex/studio/shots/parity-boss-natural';fs.mkdirSync(out,{recursive:true});
const seed=Number(process.argv.find(s=>s.startsWith('--seed='))?.split('=')[1]??3);
const report={head:execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),diff:execFileSync('git',['diff','--stat'],{cwd:ROOT,encoding:'utf8'}),seed,scope:'Ordinary route, shipped shared scripted policy, fixed 60Hz browser frames; no force rows, stats, HP or RNG.',errors:[],shots:[],cleanup:false};
try{await runTool(async cleanup=>{
 const dist=await buildCheckout();report.build=dist;const js=fs.readdirSync(path.join(dist,'assets')).find(s=>s.endsWith('.js'));report.bundle=createHash('sha256').update(fs.readFileSync(path.join(dist,'assets',js))).digest('hex');
 const server=await serve(dist);cleanup(server.close);const{browser,gpu}=await launchChrome();report.gpu=gpu;cleanup(()=>browser.close());const context=await browser.newContext({viewport:{width:1920,height:1080}});cleanup(()=>context.close());const page=await context.newPage();watchPage(page,report.errors,'natural-boss');
 await page.addInitScript(()=>{let q=new Map(),id=1,t=0;window.requestAnimationFrame=fn=>{q.set(id,fn);return id++;};window.cancelAnimationFrame=id=>q.delete(id);window.__step=(n=1)=>{for(let i=0;i<n;i++){t+=1000/60;const a=q;q=new Map();for(const fn of a.values())fn(t);}};});
 await page.goto(server.url+`?inspect=1&capture=1&bot=scripted&seed=${seed}`);await waitReady(page,30000);
 await page.evaluate(()=>{const g=window.__shell.game,send=g.send.bind(g);window.__commands=[];g.send=c=>{const at=g.view.time,r=send(c);window.__commands.push({at,command:c,result:r});return r;};window.__step(1);});
 const seen=new Set(),start=performance.now();
 for(let i=0;i<1000;i++){
  if(performance.now()-start>90000)throw Error('90s wall budget');
  const s=await page.evaluate(()=>{for(let frame=0;frame<30;frame++){window.__step(1);if(window.__shell.game.view.screen==='runEnd')window.__shell.policy=null;}const sh=window.__shell,g=sh.game,v=g.view,b=g.world.mode.场上所有.find(a=>a?.名字==='守门人');return{time:v.time,screen:v.screen,phase:v.phase,floor:v.run?.floor,hero:v.hero&&{hp:v.hero.hp,dead:v.hero.dead},boss:b&&{id:b.id,hp:b.当前生命,phase2:b.HasMatchingGameplayTag('状态.二阶段'),casting:b.当前能力?.能力名,skills:b.拥有的主动能力.map(a=>a?.能力名)},terrain:v.terrain.filter(t=>t.kind==='lava').length,modal:v.modal&&{kind:v.modal.kind,result:v.modal.result,demoComplete:v.modal.demoComplete},renderedBoss:b&&!!sh.controller.stage?.actor(b.id)?.group.visible};});
  let role=s.screen==='title'?'title':s.screen==='map'&&s.floor===0?'map-entry':s.boss&&s.renderedBoss?(s.boss.phase2?'boss-phase2':s.terrain>0?'boss-lava':'boss-phase1'):s.screen==='runEnd'&&s.modal?.kind==='runEnd'?'run-end':null;
  if(role==='run-end')await page.evaluate(()=>{window.__shell.policy=null;window.__step(30);});
  if(role&&!seen.has(role)){seen.add(role);const file=path.join(out,role+'.png');await page.screenshot({path:file});report.shots.push({role,file,state:s});console.log(JSON.stringify({role,time:s.time}));}
  if(role==='run-end'){report.terminal=s;break;}
 }
 report.commands=await page.evaluate(()=>window.__commands);report.framesBound=30000;
 report.phase2=seen.has('boss-phase2');report.bossNatural=seen.has('boss-phase1')||seen.has('boss-lava');
 if(!report.bossNatural)throw Error('natural boss never reached');
 });report.cleanup=true;
}catch(e){report.failure=e.stack??String(e);report.cleanup=true;process.exitCode=1;}
fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({out,head:report.head,phase2:report.phase2,errors:report.errors.length,failure:report.failure,cleanup:report.cleanup}));
