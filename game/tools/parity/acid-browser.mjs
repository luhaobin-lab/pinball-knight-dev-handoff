import fs from 'node:fs';import path from 'node:path';import{execFileSync}from'node:child_process';import{createHash}from'node:crypto';
import{ROOT,buildCheckout,serve,launchChrome,runTool,watchPage,waitReady}from'../lib/harness.mjs';
const out=process.argv.includes('--out')?path.resolve(process.argv[process.argv.indexOf('--out')+1]):'D:/TAPTAPGAME_codex/studio/shots/parity-acid-runtime';fs.mkdirSync(out,{recursive:true});
const seed=Number(process.argv.find(s=>s.startsWith('--seed='))?.split('=')[1]??4);
const report={head:execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),dirty:execFileSync('git',['status','--porcelain'],{cwd:ROOT,encoding:'utf8'}),seed,scope:'Ordinary route/shared scripted policy; natural intestine acid selection and activation. No spawn, forced damage, HP or RNG.',errors:[],shots:[],cleanup:false};
try{await runTool(async cleanup=>{
 const dist=await buildCheckout();report.build=dist;const js=fs.readdirSync(path.join(dist,'assets')).find(x=>x.endsWith('.js'));report.bundle=createHash('sha256').update(fs.readFileSync(path.join(dist,'assets',js))).digest('hex');
 const server=await serve(dist);cleanup(server.close);const{browser,gpu}=await launchChrome();report.gpu=gpu;cleanup(()=>browser.close());const ctx=await browser.newContext({viewport:{width:1920,height:1080}});cleanup(()=>ctx.close());const page=await ctx.newPage();watchPage(page,report.errors,'acid-natural');
 await page.addInitScript(()=>{let queue=new Map(),id=1,t=0;window.requestAnimationFrame=fn=>{queue.set(id,fn);return id++;};window.cancelAnimationFrame=id=>queue.delete(id);window.__step=(n=1)=>{for(let i=0;i<n;i++){t+=1000/60;const q=queue;queue=new Map();for(const fn of q.values())fn(t);}};});
 await page.goto(server.url+`?inspect=1&capture=1&bot=scripted&seed=${seed}`);await waitReady(page,30000);
 await page.evaluate(()=>{const g=window.__shell.game,send=g.send.bind(g);window.__commands=[];g.send=c=>{const r=send(c);window.__commands.push({t:g.view.time,command:c,result:r});return r;};});
 const seen=new Set(),start=performance.now();let firstActive=null;
 for(let step=0;step<2000;step++){
  if(performance.now()-start>80_000)throw Error('bounded 80s wall budget');
  const state=await page.evaluate(()=>{window.__step(6);const s=window.__shell,g=s.game,v=g.view,acid=v.terrain.filter(t=>t.kind==='acid');return{time:v.time,screen:v.screen,modal:v.modal?.kind??null,phase:v.phase,floor:v.run?.floor,hero:v.hero&&{hp:v.hero.hp,dot:v.hero.dot,position:v.hero.position},acid,rendered:s.controller.stage?.terrainStage.group.userData,fields:v.field.map(a=>({row:a.row,kind:a.kind,position:a.position})),commands:window.__commands.length};});
  const active=state.acid.some(a=>a.state==='active');if(active&&firstActive===null)firstActive=state.time;
  let role=state.acid.some(a=>a.state==='spawning')?'acid-spawning':active?'acid-active':state.acid.some(a=>a.state==='closing')?'acid-closing':null;
  if(!role&&seen.has('acid-active')&&state.acid.length===0)role='acid-cleared';
  if(role&&!seen.has(role)){seen.add(role);const file=path.join(out,role+'.png');await page.screenshot({path:file});const roomVisible=state.screen==='room'&&state.rendered!=null;report.shots.push({role,file,state,roomVisible,evidence:roomVisible?'source state in room; image review required':'source state only; scene transition prevents visible terrain proof'});console.log(JSON.stringify({role,time:state.time,floor:state.floor,dot:state.hero?.dot,roomVisible}));}
  if(role==='acid-cleared'||state.screen==='runEnd'||firstActive!==null&&state.time-firstActive>15){report.final=state;break;}
 }
 report.commands=await page.evaluate(()=>window.__commands);report.complete=seen.has('acid-spawning')&&seen.has('acid-active');if(!report.complete)throw Error('natural acid visual states not reached');
 });report.cleanup=true;
}catch(error){report.failure=error.stack??String(error);report.cleanup=true;process.exitCode=1;}
fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({out,head:report.head,complete:report.complete,errors:report.errors.length,failure:report.failure,cleanup:report.cleanup}));
