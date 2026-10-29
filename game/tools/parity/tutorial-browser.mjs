import fs from'node:fs';import path from'node:path';import assert from'node:assert/strict';import{execFileSync}from'node:child_process';import{createHash}from'node:crypto';
import{pathToFileURL}from'node:url';
import{ROOT,buildCheckout,serve,launchChrome,runTool,watchPage,waitReady}from'../lib/harness.mjs';
const out=process.argv[2];assert(out?.startsWith('D:/TAPTAPGAME_codex/studio/'));assert(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const r={head:execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),dirty:execFileSync('git',['status','--porcelain'],{cwd:ROOT,encoding:'utf8'}).trim(),scope:'Ordinary fresh browser without skipPrologue/save. Every gameplay command is dispatched by real mouse. Shared policy is queried read-only for aim direction, bounded to an on-screen point. Fixed60Hz RAF only; no injected content/HP/gold/RNG/phase/completion.',commands:[],shots:[],errors:[],complete:false,cleanup:{server:false,browser:false}};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(r,null,2));
try{await runTool(async cleanup=>{let target;const fileArg=process.argv.indexOf('--file');
 if(fileArg>=0){const file=path.resolve(process.argv[fileArg+1]);assert(fs.statSync(file).isFile());r.packageFile=file;r.buildSha256=createHash('sha256').update(fs.readFileSync(file)).digest('hex');target=pathToFileURL(file).href;r.cleanup.server=true;}
 else{const dist=await buildCheckout();r.buildSha256=createHash('sha256').update(fs.readFileSync(path.join(dist,'index.html'))).digest('hex');const server=await serve(dist);cleanup(async()=>{await server.close();r.cleanup.server=true;});target=server.url;}
 const{browser}=await launchChrome();cleanup(async()=>{await browser.close();r.cleanup.browser=true;});const p=await browser.newPage({viewport:{width:1920,height:1080}});watchPage(p,r.errors,'tutorial');
 await p.addInitScript(()=>{let q=new Map(),id=0,t=0;window.requestAnimationFrame=f=>{q.set(++id,f);return id;};window.cancelAnimationFrame=i=>q.delete(i);window.__step=(n=1)=>{for(let j=0;j<n;j++){t+=1000/60;const old=q;q=new Map();for(const f of old.values())f(t);}};});
 const url=new URL(target);url.searchParams.set('inspect','1');url.searchParams.set('seed','1');url.searchParams.set('bot','scripted');await p.goto(url.href);await waitReady(p,30000);
 await p.evaluate(()=>{const s=window.__shell,g=s.game;s.stats.stopped=true;window.__commands=[];const send=g.send.bind(g);g.send=c=>{const before={time:g.view.time,floor:g.view.run?.floor,phase:g.view.phase,gold:g.world.mode.金币},result=send(c);window.__commands.push({command:c,result,before});return result;};});
 const seen=new Set();let finished=false;
 for(let step=0;step<350;step++){
  const state=await p.evaluate(()=>{const s=window.__shell,g=s.game;const mandatory=()=>g.legal().filter(c=>!['menu.open','page.open','page.close','title.settings','title.quit','map.backpack','item.move','item.use','item.dismantle','item.enchant','item.extract','item.combine','item.modify'].includes(c.type));for(let n=0;n<600&&!mandatory().length;n++)window.__step();window.__step(18);return{view:g.view,legal:g.legal(),commands:window.__commands.length,seenSave:g.save().meta,stats:s.stats};});
  const v=state.view,key=v.tutorial?'tip-'+v.tutorial.tip:v.modal?.kind==='loot'?'loot-'+v.run?.floor:v.modal?.kind==='panel'?'panel-'+v.run?.floor:v.camp?'camp':v.screen==='room'?'room-'+v.run?.floor:v.screen==='title'&&state.commands>0?'title-unlocked':v.screen;
  if(!seen.has(key)){seen.add(key);const file=path.join(out,key+'.png');await p.screenshot({path:file});r.shots.push({key,file,time:v.time,floor:v.run?.floor,phase:v.phase,tip:v.tutorial,field:v.field.map(a=>({row:a.row,id:a.id,hp:a.hp})),loot:v.modal?.kind==='loot'?v.modal.cells:null});save();}
  if(v.screen==='title'&&state.seenSave['新手关过？']===true&&state.commands>0){finished=true;r.end=state;break;}
  const action=await p.evaluate(()=>{const s=window.__shell,g=s.game,v=g.view,legal=g.legal(),has=t=>legal.some(x=>x.type===t);let page=s.stack.top,dx=0;while(page?.inner||page?.menu||page?.page){dx+=page.dx??0;page=page.inner??page.menu??page.page;}
   const layer=s.pageLayer,c=layer.canvas,b=c.getBoundingClientRect(),f=s.pageFrame;
   const ui=(rect,command)=>{if(!rect)throw Error('missing UI rect '+command);return{command,x:b.left+(f.x+dx+rect.x+rect.w/2)*b.width/c.width,y:b.top+(f.y+rect.y+rect.h/2)*b.height/c.height};};
   if(v.tutorial)return ui({x:379,y:386,w:202,h:31},'tutorial.continue');
   if(v.screen==='title')return ui(page.rectOf('prologue'),'title.prologue');
   const m=v.modal;
   if(m?.kind==='panel'&&has('panel.continue'))return ui(page.next.rect,'panel.continue');
   if(m?.kind==='multiChoice'&&has('modal.pick'))return ui(page.cardRects()[0],'modal.pick');
   if(m?.kind==='loot'){const ids=legal.find(l=>l.type==='loot.take')?.params?.item??[],entry=page.regions.list.find(x=>x.target.kind==='item'&&ids.includes(Number(x.target.item.id)));return entry?ui(entry.rect,'loot.take'):has('loot.close')?ui(page.regions.list.find(x=>x.target.kind==='close')?.rect,'loot.close'):null;}
   if(m?.kind==='runEnd'&&has('runEnd.continue')){const a=page.placed.find(x=>page.model.buttons[x.index].cmd?.type==='runEnd.continue');return ui(a?.rect,'runEnd.continue');}
   if(v.camp){if(has('camp.travel'))return ui(page.regions.list.find(x=>x.target==='营地')?.rect,'camp.travel');return null;}
   if(v.screen==='map'){if(has('map.option'))return ui(page.regions.list.find(x=>x.target.kind==='option'&&x.target.id==='营地')?.rect,'map.option');if(has('map.enter'))return ui(page.regions.list.find(x=>x.target.kind==='tile'&&x.target.tile.state==='open')?.rect,'map.enter');}
   const stage=s.controller.stage;if(!stage)return null;const project=(at,command)=>{const t=stage.frame.toTiles(at.x,at.y),q=stage.renderer.projectToScreen({x:t.x,y:0,z:t.z}),bounds=stage.renderer.canvas.getBoundingClientRect();return{command,x:bounds.left+q.x,y:bounds.top+q.y};};
   const ids=legal.find(l=>l.type==='interact')?.params?.actor??[];
   const actors=v.field.filter(a=>ids.includes(a.id));const target=actors.find(a=>a.row==='锻造锤_品质青铜')??actors.find(a=>a.row!=='商人');if(target)return project(target.position,'interact');
   if(has('aim.release')){const cmd=s.policy.next(v,legal);if(cmd?.type!=='aim.release')return null;const h=v.hero.position,d={x:cmd.aim.x-h.x,y:cmd.aim.y-h.y},len=Math.hypot(d.x,d.y)||1;
    for(const length of[180,140,100,80,60]){const at={x:h.x+d.x/len*length,y:h.y+d.y/len*length};if(v.field.some(a=>a.kind!=='hero'&&!a.hidden&&Math.hypot(a.position.x-at.x,a.position.y-at.y)<a.radius+12))continue;const p=project(at,'aim.release');if(p.x>600&&p.x<1900&&p.y>20&&p.y<1060)return p;}throw Error('source aim cannot be placed onscreen');}
   return null;
  });
  if(!action){await p.evaluate(()=>window.__step(30));continue;}
  await p.mouse.move(action.x,action.y);await p.mouse.down();await p.evaluate(()=>window.__step(2));await p.mouse.up();await p.evaluate(()=>window.__step(12));
  const after=await p.evaluate(n=>window.__commands.slice(n),state.commands);if(!after.length)throw Error('mouse did not dispatch '+JSON.stringify(action));if(after.some(c=>!c.result.ok))throw Error('source mouse command rejected '+JSON.stringify(after));if(after[0].command.type!==action.command)throw Error('mouse dispatched different verb '+JSON.stringify({action,after}));
  r.commands.push(...after);r.lastAction=action;save();
 }
 assert(finished,'seven-floor ordinary mouse route did not return to unlocked title within350actions');const final=await p.evaluate(()=>({view:window.__shell.game.view,save:window.__shell.game.save(),commands:window.__commands}));r.final=final;
 assert(final.save.meta['新手关过？']);assert(final.view.title.newRun);assert([...seen].includes('room-7'));assert(r.shots.some(s=>s.key==='runEnd'));
 if(process.argv.includes('--camp-tip')){
  r.campBoundary={scope:'After actual seven-floor completion, ordinary mouse newRun/hero.start; explicit source chapter-hub and real statue/shield acquisition boundary. No tutorial/save/unlock flag injection. Mouse uses statue item, opens statue, continues tip12, and drags shield into source stash.',commands:[]};
  const frame=async(n=35)=>p.evaluate(n=>window.__step(n),n);
  const point=async(x,y)=>p.evaluate(({x,y})=>{const s=window.__shell,c=s.pageLayer.canvas,b=c.getBoundingClientRect();return{x:b.left+(s.pageFrame.x+x)*b.width/c.width,y:b.top+(s.pageFrame.y+y)*b.height/c.height}},{x,y});
  const click=async(x,y)=>{const a=await point(x,y);await p.mouse.move(a.x,a.y);await p.mouse.down();await frame(2);await p.mouse.up();await frame();};
  const pageRect=async kind=>p.evaluate(kind=>{const s=window.__shell,type=kind==='newRun'?'title.newRun':'hero.start';let n=0;for(;n<1800&&!s.game.legal().some(c=>c.type===type);n++)window.__step();if(n===1800)throw Error('no '+type+' '+JSON.stringify(s.game.view));window.__step(20);let page=s.stack.top,dx=0;while(page?.inner||page?.menu||page?.page){dx+=page.dx??0;page=page.inner??page.menu??page.page;}const r=kind==='newRun'?page.rectOf('newRun'):page.startRect;if(!r)throw Error('missing '+kind+' rect on '+page?.id);return{x:r.x+r.w/2+dx,y:r.y+r.h/2}},kind);
  let at=await pageRect('newRun');await click(at.x,at.y);at=await pageRect('start');await click(at.x,at.y);await p.evaluate(()=>{const s=window.__shell;let n=0;for(;n<1800&&!s.game.legal().some(c=>c.type==='map.enter');n++)window.__step();if(n===1800)throw Error('ordinary new run not ready');window.__step(30);});
  r.campBoundary.fixture=await p.evaluate(()=>{const s=window.__shell,g=s.game,w=g.world,save=w.sys.save.GetCustomSave(w);if(!save.新手关过||save.新手关中)throw Error('ordinary completed tutorial required');
   w.sys.map.UI_关卡地图页面.重置关卡页(w.mode,false);w.cult.切换地图页(false,false);
   const broken=w.cult.创建牌到侧栏('破损的神像',1,null,[],save.轮回次数,new Map()).卡牌实例,shield=w.cult.创建牌到侧栏('旧盾',1,null,[],save.轮回次数,new Map()).卡牌实例;
   return{broken:broken.id,shield:shield.id,round:save.轮回次数};});await frame(130);
  const itemPoint=async id=>p.evaluate(id=>{const s=window.__shell,c=s.hud.canvas,b=c.getBoundingClientRect(),top=Math.max(0,Math.floor((c.height-540)/2));for(let y=top+1;y<top+539;y++)for(let x=0;x<300;x++){const hit=(s.backpackOpen?s.backpack.hitTest(x,y-top):null)??s.hud.hitTest(x,y);if(hit===`item:${id}`)return{x:b.left+(x+8)*b.width/c.width,y:b.top+(y+8)*b.height/c.height};}throw Error('missing item '+id)},id);
  at=await itemPoint(r.campBoundary.fixture.broken);await p.mouse.click(at.x,at.y,{button:'right'});await frame(15);
  const use=await p.evaluate(()=>{const m=window.__shell.menuPage.menu,i=m.items.findIndex(x=>x.id==='use');if(i<0||!m.items[i].enabled)throw Error('real statue item use unavailable');const q=m.rows[i];return{x:q.x+q.w/2,y:q.y+q.h/2};});await click(use.x,use.y);await click(624,210);
  const snap=async key=>{const state=await p.evaluate(()=>({view:window.__shell.game.view,legal:window.__shell.game.legal(),save:window.__shell.game.save()})),file=path.join(out,key+'.png');await p.screenshot({path:file});r.shots.push({key,file,state});return state;};
  const tip=await snap('camp-tip12');assert.equal(tip.view.tutorial?.tip,12);assert.ok(tip.view.stash);assert.deepEqual(tip.legal.map(x=>x.type),['tutorial.continue','tutorial.close']);
  await click(480,401);assert.equal(await p.evaluate(()=>window.__shell.game.view.tutorial),null);
  at=await itemPoint(r.campBoundary.fixture.shield);const to=await point(362,108);await p.mouse.move(at.x,at.y);await p.mouse.down();await frame(25);await p.mouse.move(to.x,to.y);await p.mouse.up();await frame(20);
  const stored=await snap('camp-tip12-mouse-drag');assert.ok(stored.view.inventory.stash.some(c=>c.id===r.campBoundary.fixture.shield));assert.ok(stored.save.meta.仓库牌数据.some(c=>c.表名==='旧盾'));
  const all=await p.evaluate(()=>window.__commands);r.campBoundary.commands=all.slice(final.commands.length);assert.ok(r.campBoundary.commands.some(c=>c.command.type==='tutorial.continue'));assert.ok(r.campBoundary.commands.some(c=>c.command.type==='item.move'&&c.command.to.grid==='stash'));assert.ok(r.campBoundary.commands.every(c=>c.result.ok));r.campBoundary.complete=true;
 }
 assert.deepEqual(r.errors,[]);r.complete=true;
});}catch(e){r.failure=String(e.stack??e);process.exitCode=1;}finally{r.cleaned=Object.values(r.cleanup).every(Boolean);r.complete&&=r.cleaned;r.shots=r.shots.map(s=>({...s,sha256:fs.existsSync(s.file)?createHash('sha256').update(fs.readFileSync(s.file)).digest('hex'):null}));save();console.log(JSON.stringify({out,complete:r.complete,failure:r.failure,errors:r.errors,commands:r.commands.length}));}
