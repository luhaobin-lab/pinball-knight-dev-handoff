import fs from'node:fs';import path from'node:path';import assert from'node:assert/strict';import{execFileSync}from'node:child_process';
import{ROOT,buildCheckout,serve,launchChrome,runTool,watchPage,waitReady}from'../lib/harness.mjs';
const out=process.argv[2];assert.ok(out?.startsWith('D:/TAPTAPGAME_codex/studio/'));assert.ok(!fs.existsSync(out));fs.mkdirSync(out,{recursive:true});
const r={head:execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),scope:'Normal boot then explicit source chooser boundary, paid and free talent options; actual mouse pick. Not natural paid-event acquisition.',errors:[],shots:[],cleanup:false};
try{await runTool(async cleanup=>{const dist=await buildCheckout(),s=await serve(dist);cleanup(s.close);const{browser}=await launchChrome();cleanup(()=>browser.close());const page=await browser.newPage({viewport:{width:1920,height:1080}});watchPage(page,r.errors,'choice price');
 await page.goto(s.url+'?inspect=1&seed=1');await waitReady(page,30000);
 await page.evaluate(()=>{const g=window.__shell.game;g.runUntilInput();g.send({type:'title.newRun'});g.runUntilInput();g.send({type:'hero.start'});g.runUntilInput();});
 for(const free of[false,true]){
  const before=await page.evaluate(free=>{const sh=window.__shell,g=sh.game,w=g.world,empty=w.mode.OwnedGameplayTags.clone();for(const t of empty.toArray())empty.remove(t);
   w.sys.talents.UI_主界面.开启多选一(w.mode,false,empty,empty,['力量'],true,free,false,1,0,0,null,null);g.advance(.3);sh.frame(0);return{gold:w.mode.金币,option:g.view.modal.options[0]};},free);
  await page.waitForTimeout(300);
  const point=await page.evaluate(()=>{const sh=window.__shell;let p=sh.stack.top;while(p?.inner||p?.page||p?.menu)p=p.inner??p.page??p.menu;const r=p.cardRects()[0],c=sh.pageLayer.canvas,b=c.getBoundingClientRect(),f=sh.pageFrame;return{x:b.left+(f.x+r.x+r.w/2)*b.width/c.width,y:b.top+(f.y+r.y+r.h/2)*b.height/c.height};});
  await page.mouse.move(point.x,point.y);const file=path.join(out,free?'free.png':'paid.png');await page.screenshot({path:file});await page.mouse.click(point.x,point.y);
  const after=await page.evaluate(()=>{const sh=window.__shell;sh.game.advance(.25);sh.frame(0);return{gold:sh.game.world.mode.金币,modal:sh.game.view.modal?.kind};});
  assert.equal(after.gold,before.gold-(before.option.price??0));assert.equal(before.option.price===undefined,free);r.shots.push({free,file,before,after});
 }
 assert.deepEqual(r.errors,[]);r.complete=true;
});r.cleanup=true;}catch(e){r.failure=String(e.stack??e);r.cleanup=true;process.exitCode=1;}
fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(r,null,2));console.log(JSON.stringify({out,complete:r.complete,failure:r.failure,errors:r.errors}));
