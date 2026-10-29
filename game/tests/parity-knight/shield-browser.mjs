// Controlled source-talent grant at a naturally reached combat boundary; ordinary mouse/keyboard cast afterward.
import fs from 'node:fs'; import path from 'node:path'; import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { ROOT,studioDir,buildCheckout,serve,launchChrome,runTool,watchPage,waitReady } from '../../tools/lib/harness.mjs';
const arg=process.argv.indexOf('--out'),out=path.resolve(arg<0?path.join(studioDir(),'shots/parity-knight-shield'):process.argv[arg+1]);fs.mkdirSync(out,{recursive:true});
const report={commit:execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),scope:'Explicit real source talent acquisition fixture at natural combat; not natural talent-pool coverage',runs:[],errors:[],cleaned:false};
try{await runTool(async cleanup=>{
 const dist=await buildCheckout(),server=await serve(dist);report.build=dist;cleanup(server.close);
 const{browser}=await launchChrome();cleanup(()=>browser.close());
 for(const input of ['keyboard','mouse']){
  const page=await browser.newPage({viewport:{width:1920,height:1080}});watchPage(page,report.errors,input);
  await page.addInitScript(()=>{let queue=new Map(),id=0,now=0;window.requestAnimationFrame=f=>{queue.set(++id,f);return id};window.cancelAnimationFrame=i=>queue.delete(i);window.__step=()=>{now+=1000/60;const q=queue;queue=new Map();for(const f of q.values())f(now)}});
  await page.goto(`${server.url}?inspect=1&seed=6&bot=scripted`);await waitReady(page,30000);
  let ready=false;for(let batch=0;batch<20&&!ready;batch++)ready=await page.evaluate(()=>{const s=window.__shell,g=s.game;for(let i=0;i<600;i++){if(g.view.screen==='room'&&g.view.field.some(a=>a.kind==='enemy'&&a.hp>0)&&g.legal().some(c=>c.type==='aim.release')&&!g.view.modal){s.stats.stopped=true;return true}window.__step()}return false});assert.ok(ready);
  const before=await page.evaluate(()=>{
   const s=window.__shell,g=s.game,w=g.world,h=w.mode.玩家角色;
   const grant=w.spawn('CatapultHero/BP/Skill/Ability/蓝图_能力_给自身加主动',a=>{a.能力名='举盾';a.拥有者=h;a.等级=1;a.品质=1});
   grant.技能配置=w.data.table('CatapultHero/数据表/天赋/数据表_天赋_专属').rows['举盾'];grant.初始化();grant.子初始化();h.添加天赋(grant,1,false,false);
   s.frame(0);return{hero:g.view.hero,legal:g.legal(),stats:{...s.stats}};
  });assert.ok(before.legal.some(c=>c.type==='skill.press'&&c.params.slot.includes(1)));
  await page.screenshot({path:path.join(out,`${input}-ready.png`)});
  if(input==='keyboard')await page.keyboard.press('Digit1');else{const p=await page.evaluate(()=>{const s=window.__shell,c=s.hud.canvas,b=c.getBoundingClientRect();for(let y=0;y<c.height;y++)for(let x=0;x<300;x++)if(s.hud.hitTest(x,y)==='skill:0')return{x:b.left+(x+10)*b.width/c.width,y:b.top+(y+10)*b.height/c.height};throw Error('missing skill0')});await page.mouse.click(p.x,p.y)}
  const immediate=await page.evaluate(()=>({hero:window.__shell.game.view.hero,casting:window.__shell.game.world.mode.玩家角色.释放技能中,stats:{...window.__shell.stats}}));
  assert.ok(immediate.casting);assert.equal(immediate.hero.armor-before.hero.armor,before.hero.maxHp*.125);assert.equal(immediate.hero.stamina,before.hero.stamina);
  await page.evaluate(()=>{for(let i=0;i<60;i++)window.__step()});
  const after=await page.evaluate(()=>({hero:window.__shell.game.view.hero,casting:window.__shell.game.world.mode.玩家角色.释放技能中,legal:window.__shell.game.legal(),stats:{...window.__shell.stats}}));
  assert.equal(after.casting,false);assert.equal(after.hero.skills.find(a=>a.slot===1).cooldown,3);assert.equal(after.stats.rejected,before.stats.rejected);
  await page.screenshot({path:path.join(out,`${input}-cast.png`)});report.runs.push({input,before,immediate,after});await page.close();
 }
 assert.deepEqual(report.errors,[]);
});report.cleaned=true;}catch(e){report.failure=String(e?.stack??e)}
report.complete=report.cleaned&&!report.failure&&report.runs.length===2;fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({out,complete:report.complete,failure:report.failure,errors:report.errors}));if(!report.complete)process.exitCode=1;
