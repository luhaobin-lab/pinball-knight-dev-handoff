import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';
import {ROOT,buildCheckout,serve,launchChrome,runTool,watchPage,waitReady} from '../lib/harness.mjs';
const out=path.resolve(process.argv[process.argv.indexOf('--out')+1]);assert(out.startsWith('D:\\TAPTAPGAME_codex\\studio\\'));assert(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const report={head:execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),dirty:execFileSync('git',['status','--short'],{cwd:ROOT,encoding:'utf8'}),scope:'Natural source rooms, seed3, explicit completed-prologue QA; public API route decisions and real mouse fog/launch. No state, HP, RNG or room injection.',errors:[],shots:[],runs:[],cleanup:false};
let page;
const state=()=>page.evaluate(()=>{const s=window.__shell,g=s.game,v=g.view;return{time:v.time,screen:v.screen,phase:v.phase,floor:v.run?.floor,layout:v.room?.layout,hero:v.hero,field:v.field,fog:v.fog&&{visible:v.fog.visible,rows:v.fog.rows.filter(Boolean).length},legal:g.legal(),modal:v.modal,stats:s.stats,commands:window.__commands,events:window.__events,room:v.room};});
const snap=async role=>{const file=path.join(out,role+'.png');await page.screenshot({path:file});const s=await state();report.shots.push({role,file,state:s});console.log(JSON.stringify({role,time:s.time,floor:s.floor,phase:s.phase}));};
const mouse=async(at)=>{const point=await page.evaluate(at=>{const s=window.__shell,stage=s.controller.stage,r=stage.renderer,p=stage.frame.toTiles(at.x,at.y),q=r.projectToScreen({x:p.x,y:0,z:p.z}),b=r.canvas.getBoundingClientRect();return{x:b.left+q.x,y:b.top+q.y};},at);await page.mouse.move(point.x,point.y);await page.evaluate(()=>window.__step(1));await page.mouse.down();await page.evaluate(()=>window.__step(1));await page.mouse.up();await page.evaluate(()=>window.__step(1));return point;};
try{await runTool(async cleanup=>{
 const dist=await buildCheckout();report.build=dist;const js=fs.readdirSync(path.join(dist,'assets')).find(x=>x.endsWith('.js'));report.bundleSha256=createHash('sha256').update(fs.readFileSync(path.join(dist,'assets',js))).digest('hex');const server=await serve(dist);cleanup(server.close);const{browser,gpu}=await launchChrome();report.gpu=gpu;cleanup(()=>browser.close());
 for(const role of ['fog','boss']){
  page=await browser.newPage({viewport:{width:1920,height:1080}});watchPage(page,report.errors,role);
  await page.addInitScript(()=>{let q=new Map(),id=0,t=0;window.requestAnimationFrame=f=>{q.set(++id,f);return id};window.cancelAnimationFrame=i=>q.delete(i);window.__step=(n=1)=>{for(let k=0;k<n;k++){t+=1000/60;const old=q;q=new Map();for(const f of old.values())f(t)}};});
  await page.goto(server.url+'?inspect=1&capture=1&seed=3&bot=scripted&skipPrologue=1');await waitReady(page,30000);
  await page.evaluate(()=>{const s=window.__shell,g=s.game;window.__policy=s.policy;s.policy=null;window.__commands=[];window.__events=[];const send=g.send.bind(g),drain=g.drainEvents.bind(g);g.send=c=>{const t=g.view.time,r=send(c);window.__commands.push({t,c,r});return r;};g.drainEvents=()=>{const e=drain();window.__events.push(...e);return e;};window.__step(1);});
  const started=performance.now();let reached=false;
  for(let step=0;step<220;step++){
   if(performance.now()-started>35000)throw Error(role+' route35s wall budget');
   const s=await page.evaluate(role=>{const sh=window.__shell,g=sh.game,stop=g.runUntilInput(30),v=g.view,l=g.legal();
    if(v.screen==='runEnd')return{ended:true,stop,at:v.time};
    if(role==='boss'&&v.screen==='room'&&v.room?.authoredBoundary&&l.some(x=>x.type==='aim.release'))return{reached:true,stop,at:v.time};
    let c=window.__policy.next(v,l);
    if(role==='fog'&&v.screen==='map'){const cell=v.map?.cells.find(x=>x.enterable&&x.tile==='探索房');if(cell){c={type:'map.enter',cell:cell.id};const r=g.send(c);window.__step(34);return{reached:true,stop,c,r,at:g.view.time};}}
    if(!c)return{missing:true,stop,screen:v.screen,phase:v.phase,legal:l};const r=g.send(c);return{stop,c,r,screen:v.screen,phase:v.phase,floor:v.run?.floor,at:v.time};
   },role);
   fs.appendFileSync(path.join(out,role+'-route.ndjson'),JSON.stringify({step,...s})+'\n');
   if(s.reached){reached=true;break;}if(s.ended||s.missing)throw Error(role+' ended before target '+JSON.stringify(s));assert(s.r.ok,JSON.stringify(s));
  }
  assert(reached,role+' route bound');
  if(role==='fog'){
   await snap('fog-source-growth-start');await page.evaluate(()=>window.__step(18));await snap('fog-source-growth-partial');await page.evaluate(()=>window.__step(68));await snap('fog-source-growth-final');
   const s=await state();assert(s.fog?.visible);const h=s.hero.position;
   const target=[...s.field].filter(x=>x.kind==='neutral').sort((a,b)=>Math.hypot(b.position.x-h.x,b.position.y-h.y)-Math.hypot(a.position.x-h.x,a.position.y-h.y))[0];assert(target);report.fogTarget=target;report.fogAlignment=await page.evaluate(()=>{const s=window.__shell,st=s.controller.stage,h=s.game.view.hero.position,r=st.renderer,p=st.frame.toTiles(h.x,h.y),ground=r.projectToScreen({x:p.x,y:0,z:p.z}),old=r.projectToScreen({x:p.x,y:200/64,z:p.z});const uv=[(h.x+1250)/2500,(h.y+1250)/2500],a=st.fog.mesh.geometry.getAttribute('position'),weights=[(1-uv[0])*(1-uv[1]),uv[0]*(1-uv[1]),(1-uv[0])*uv[1],uv[0]*uv[1]],point={x:0,y:0,z:0};for(let i=0;i<4;i++){point.x+=a.getX(i)*weights[i];point.y+=a.getY(i)*weights[i];point.z+=a.getZ(i)*weights[i];}const reveal=r.projectToScreen(point);return{heroGround:ground,revealCentre:reveal,reskinOffsetPixels:Math.hypot(reveal.x-ground.x,reveal.y-ground.y),unadaptedSourceHeightOffsetPixels:Math.hypot(old.x-ground.x,old.y-ground.y),sourceHeight:200};});
   assert(report.fogAlignment.reskinOffsetPixels<=1,'actual fog mesh projection differs from hero ground');report.fogRejectedMouse=await mouse(target.position);await snap('fog-unrevealed-click');
   const blocked=await state();assert(blocked.events.some(e=>e.kind==='headUp'&&e.text.includes('看不清')),'actual fog rejection event missing');assert.equal(blocked.hero.hp,s.hero.hp);
   // Select an actual empty floor target near the hidden source actor, keeping the ordinary release semantics.
   const aim=await page.evaluate(target=>{const s=window.__shell,g=s.game,v=g.view,h=v.hero.position,stage=s.controller.stage,r=stage.renderer,b=r.canvas.getBoundingClientRect();let best;
    for(let deg=0;deg<360;deg+=5){const a=deg*Math.PI/180,at={x:h.x+Math.cos(a)*360,y:h.y+Math.sin(a)*360};if(v.field.some(x=>Math.hypot(x.position.x-at.x,x.position.y-at.y)<x.radius+8))continue;const preview=g.preview(at);if(!preview?.legs?.length)continue;const t=stage.frame.toTiles(at.x,at.y),screen=r.projectToScreen({x:t.x,y:0,z:t.z});if(screen.x<400||screen.x>b.width-20||screen.y<25||screen.y>b.height-20)continue;const dot=(at.x-h.x)*(target.x-h.x)+(at.y-h.y)*(target.y-h.y);if(!best||dot>best.dot)best={at,dot,preview};}return best;
   },target.position);
   assert(aim,'no valid mouse approach');report.fogApproach=aim;await mouse(aim.at);await page.evaluate(()=>window.__step(45));await snap('fog-reveal-during-move');await page.evaluate(()=>{window.__shell.game.runUntilInput(30);window.__step(2);});await snap('fog-after-move');
   const moved=await state();assert(Math.hypot(moved.hero.position.x-h.x,moved.hero.position.y-h.y)>32,'mouse release did not move hero');assert(moved.commands.some(c=>c.c.type==='aim.release'&&c.r.ok));const bright=await page.evaluate(()=>{const g=window.__shell.game,w=g.world,h=g.view.hero.position;return g.view.field.find(a=>a.kind==='neutral'&&!w.sys.room.inFogAt(w,a.position)&&Math.hypot(a.position.x-h.x,a.position.y-h.y)<250);});assert(bright,'no revealed reachable source prop');const previous=await state();await mouse(bright.position);await page.evaluate(()=>window.__step(30));const opened=await state();report.revealedInteraction={bright,before:previous,after:opened};assert(!opened.events.slice(previous.events.length).some(e=>e.kind==='headUp'&&e.text.includes('看不清')));assert(opened.commands.slice(previous.commands.length).some(x=>x.c.type==='interact'&&x.c.actor===bright.id&&x.r.ok));assert(!opened.field.some(x=>x.id===bright.id),'revealed source mine was not consumed');await snap('fog-revealed-prop-interaction');
  }else{
   await page.evaluate(()=>{window.__shell.game.drainEvents();window.__events=[];window.__step(75);});await snap('boss-natural-source-spawn');const s=await state();assert.deepEqual(s.hero.position,{...s.room.playerSpawn,z:s.hero.position.z});
   const chosen=await page.evaluate(()=>{const s=window.__shell,g=s.game,h=g.view.hero.position,stage=s.controller.stage,r=stage.renderer,b=r.canvas.getBoundingClientRect();const tries=[];for(const d of[{x:-1,y:0},{x:-1,y:1},{x:-1,y:-1},{x:0,y:1},{x:0,y:-1},{x:1,y:0}]){const aim={x:h.x+d.x*100,y:h.y+d.y*100},p=g.preview(aim),t=stage.frame.toTiles(aim.x,aim.y),screen=r.projectToScreen({x:t.x,y:0,z:t.z});if(screen.x>400&&screen.x<b.width-10&&screen.y>15&&screen.y<b.height-10)tries.push({aim,preview:p});}return tries.find(x=>x.preview?.legs.some(l=>l.marker==='wall'))??tries.find(x=>x.preview?.legs.length);});
   assert(chosen);report.bossPreview=chosen;const before=await state();await mouse(chosen.aim);report.contactFrame=await page.evaluate(since=>{for(let i=0;i<180;i++){window.__step(1);const e=window.__events.find(e=>e.kind==='launch.contact'&&e.contact==='wall'&&e.t>=since);if(e)return{frame:i,event:e,position:window.__shell.game.view.hero.position};}return null;},before.time);assert(report.contactFrame,'actualwallcontact within180frames');await snap('boss-natural-boundary-contact');const after=await state();
   report.bossContacts=after.events.filter(e=>e.kind==='launch.contact'&&e.contact==='wall'&&e.t>=before.time);assert(report.bossContacts.length>0,'actual ordinary wall contact missing');
  }
  report.runs.push({role,state:await state()});await page.close();page=null;
 }
 assert.deepEqual(report.errors,[]);report.complete=true;
 });report.cleanup=true;
}catch(e){report.failure=e.stack??String(e);report.cleanup=true;process.exitCode=1;}
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({out,complete:report.complete,errors:report.errors,failure:report.failure}));
