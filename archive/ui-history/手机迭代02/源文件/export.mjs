import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const localPlaywright='game/node_modules/playwright/index.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||pathToFileURL(localPlaywright).href);
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const report={createdAt:new Date().toISOString(),logicalCanvas:[800,360],exportScale:4,method:'Chrome renders local HTML/CSS with real text; high resolution uses deviceScaleFactor 4, not post-upscaling.',pages:[],errors:[]};
const sha=b=>createHash('sha256').update(b).digest('hex');
let pages;
try{
 for(const scale of [1,4]){
  const context=await browser.newContext({viewport:{width:800,height:360},deviceScaleFactor:scale});
  await context.route(/^https?:/,r=>r.abort());
  const page=await context.newPage();
  page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(pathToFileURL(path.join(root,'界面预览.html')).href);
  pages=await page.evaluate(()=>window.uiPreview.pages);
  for(const [id,label] of pages){
   await page.goto(pathToFileURL(path.join(root,'界面预览.html')).href+'?screen='+id);
   await page.waitForFunction(()=>window.uiPreview);
   await page.evaluate(async()=>{
    await document.fonts.ready;
    await Promise.all([...document.images].map(i=>i.decode()));
    const bg=getComputedStyle(document.querySelector('.backdrop')).backgroundImage;
    await Promise.all([...bg.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(async m=>{const i=new Image();i.src=m[1];await i.decode();}));
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
   });
   const folder=scale===4?'渲染图':'手机尺寸';
   const file=path.join(folder,id+'_'+label+'.png');
   const bytes=await page.screenshot({path:path.join(root,file)});
   const metrics=await page.evaluate(()=>({screen:window.uiPreview.screen,fonts:[...new Set([...document.querySelectorAll('*')].filter(e=>e.children.length===0&&e.textContent.trim()).map(e=>getComputedStyle(e).fontSize))],loadedImages:[...document.images].every(i=>i.complete&&i.naturalWidth>0)}));
   if(bytes.readUInt32BE(16)!==800*scale||bytes.readUInt32BE(20)!==360*scale)throw new Error('Wrong output size '+file);
   report.pages.push({file,bytes:bytes.length,width:800*scale,height:360*scale,sha256:sha(bytes),...metrics});
  }
  await context.close();
 }
 const cards=pages.map(([id,name])=>`<a href="渲染图/${id}_${name}.png"><img src="手机尺寸/${id}_${name}.png" alt="${name}"><div><b>${id}</b> ${name.replaceAll('_',' · ')}</div></a>`).join('');
 const overview=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>手机UI第二轮 · 十二页总览</title><style>*{box-sizing:border-box}body{margin:0;background:#10120f;color:#e6dfca;font:16px/1.5 'PingFang SC',sans-serif}main{padding:32px;max-width:1600px;margin:auto}header{display:flex;justify-content:space-between;align-items:end;margin-bottom:24px}h1{font-size:28px;margin:0}p{color:#a9ad9c;margin:8px 0 0}a{color:inherit;text-decoration:none}header a{color:#d9ceb2;border-bottom:1px solid #736a52}section{display:grid;grid-template-columns:repeat(3,1fr);gap:20px 16px}section a{background:#1c2018;border:1px solid #3e4636}img{display:block;width:100%;height:auto}section div{padding:12px 16px}b{color:#9ba58c;font-size:14px;margin-right:12px}footer{font-size:14px;color:#9ba58c;margin-top:24px}@media(max-width:900px){section{grid-template-columns:1fr 1fr}}@media(max-width:560px){section{grid-template-columns:1fr}header{display:block}}</style><main><header><div><h1>手机界面 · 第二轮</h1><p>12页 / 20:9 / 真实文字组件 + Sunburst场景素材</p></div><a href="集中审核.html">进入新旧对比评审 →</a></header><section>${cards}</section><footer>高清图3200×1440；逻辑画布800×360。价格与培养费用未定，相关动作禁用。概念样例，不是游戏存档；真机与新用户测试未执行。</footer></main></html>`;
 await fs.writeFile(path.join(root,'总览.html'),overview);
 const page=await browser.newPage({viewport:{width:1600,height:1100},deviceScaleFactor:1});
 await page.goto(pathToFileURL(path.join(root,'总览.html')).href);
 await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
 await page.screenshot({path:path.join(root,'十二页总览.png'),fullPage:true});
 await fs.writeFile(path.join(root,'核对/导出记录.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({screens:pages.length,images:report.pages.length,errors:report.errors,dimensions:[800,360,3200,1440]}));
 if(report.errors.length)process.exitCode=1;
}finally{await browser.close();}
