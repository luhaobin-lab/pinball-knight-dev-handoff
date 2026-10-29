import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {execFileSync}from'node:child_process';
import {ROOT,buildCheckout,serve,launchChrome,runTool,watchPage,waitReady}from'../lib/harness.mjs';
const out=process.argv[2];assert.ok(out?.startsWith('D:/TAPTAPGAME_codex/studio/'));assert.ok(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const items=['底力面具','投手之握','淬毒利刃','巨人盾斧','浴火长袍','聚气果','粘稠体液','寻宝锄','月光蕨','克隆触手','追风短剑','分身短弓'];
const r={head:execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),dirty:execFileSync('git',['status','--porcelain'],{cwd:ROOT,encoding:'utf8'}).trim(),scope:'Ordinary boot and shared policy navigate the unmodified run until natural offers. Actual mouse selects offered item/talent; no forced inventory, HP, RNG, item, skill or pool.',errors:[],scenarios:[],cleanup:false};
try{await runTool(async cleanup=>{
 const build=await buildCheckout();r.build=build;const server=await serve(build);cleanup(server.close);const{browser,gpu}=await launchChrome();r.gpu=gpu;cleanup(()=>browser.close());const context=await browser.newContext({viewport:{width:1920,height:1080}});cleanup(()=>context.close());
 for(const mode of ['item','talent']){
  const page=await context.newPage();watchPage(page,r.errors,mode);
  await page.addInitScript(()=>{let q=new Map(),id=1,t=0;window.requestAnimationFrame=f=>{q.set(id,f);return id++;};window.cancelAnimationFrame=i=>q.delete(i);window.__step=(n=1)=>{for(let i=0;i<n;i++){t+=1000/60;const a=q;q=new Map();for(const f of a.values())f(t);}};});
  await page.goto(`${server.url}?inspect=1&seed=${mode==='item'?6:1}&bot=scripted`);await waitReady(page,30000);
  const found=await page.evaluate(({mode,items})=>{
   const s=window.__shell,g=s.game,send=g.send.bind(g);window.__commands=[];g.send=c=>{const out=send(c);window.__commands.push({time:g.view.time,command:c,result:out});return out;};
   for(let i=0;i<24000;i++){
    const v=g.view,m=v.modal,legal=g.legal();
    const candidate=mode==='item'&&m?.kind==='loot'?m.cells.find(c=>items.includes(c.row)&&legal.some(l=>l.type==='loot.take'&&l.params.item.includes(c.item))):mode==='talent'&&m?.kind==='multiChoice'?m.options.find(o=>o.row==='幻影斩'):null;
    if(candidate){s.stats.stopped=true;window.__step(6);return{candidate,floor:v.run?.floor,gold:g.world.mode.金币,time:v.time,option:mode==='talent'?m.options.indexOf(candidate):null};}
    if(v.screen==='runEnd')return null;window.__step();
   }return null;
  },{mode,items});assert.ok(found,`${mode}: natural source offer not reached`);
  const point=await page.evaluate(({mode,found})=>{const s=window.__shell;let p=s.stack.top;while(p?.inner||p?.menu||p?.page)p=p.inner??p.menu??p.page;
   const rect=mode==='talent'?p.cardRects()[found.option]:p.regions.list.find(x=>x.target.kind==='item'&&x.target.item.id===String(found.candidate.item))?.rect;
   if(!rect)throw Error('Visible offer rectangle missing '+p.id);const c=s.pageLayer.canvas,b=c.getBoundingClientRect(),f=s.pageFrame;
   return{x:b.left+(f.x+rect.x+rect.w/2)*b.width/c.width,y:b.top+(f.y+rect.y+rect.h/2)*b.height/c.height};},{mode,found});
  await page.mouse.move(point.x,point.y);await page.evaluate(()=>window.__step(12));await page.screenshot({path:path.join(out,mode+'-offered.png')});
  await page.mouse.click(point.x,point.y);await page.evaluate(()=>window.__step(45));
  const after=await page.evaluate(()=>{const s=window.__shell,g=s.game,v=g.view;return{gold:g.world.mode.金币,inventory:[...v.inventory.equip,...v.inventory.backpack].map(i=>({id:i.id,row:i.row})),skills:v.hero?.skills,commands:window.__commands,errors:s.stats.rejected};});
  if(mode==='item')assert.ok(after.inventory.some(i=>i.id===found.candidate.item&&i.row===found.candidate.row));else assert.ok(after.skills.some(s=>s.row==='幻影斩'&&s.slot===1));
  await page.screenshot({path:path.join(out,mode+'-acquired.png')});r.scenarios.push({mode,found,point,after});await page.close();
 }
 assert.deepEqual(r.errors,[]);r.complete=true;
});r.cleanup=true;}catch(e){r.failure=String(e.stack??e);r.cleanup=true;process.exitCode=1;}
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(r,null,2));console.log(JSON.stringify({out,complete:r.complete,failure:r.failure,errors:r.errors,scenarios:r.scenarios.map(x=>({mode:x.mode,row:x.found.candidate.row,floor:x.found.floor}))}));
