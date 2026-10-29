// Optional local document QA. Set PLAYWRIGHT_MODULE to an installed Playwright module.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const modulePath=process.env.PLAYWRIGHT_MODULE || '/Users/haobinlu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const { chromium }=await import(pathToFileURL(modulePath).href);
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(path.join(root,'阅读入口.html')).href);
 await page.screenshot({path:path.join(root,'05_验证与评审/阅读页_首屏.png')});
 await page.locator('#numbers').scrollIntoViewIfNeeded();
 await page.screenshot({path:path.join(root,'05_验证与评审/阅读页_数值.png')});
 await page.getByRole('heading',{name:'格子附魔：免费二选一',exact:true}).evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));
 await page.screenshot({path:path.join(root,'05_验证与评审/阅读页_附魔.png')});
 const desktop=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,sections:document.querySelectorAll('section').length,images:[...document.images].map(i=>({src:i.getAttribute('src'),loaded:i.complete&&i.naturalWidth>0}))}));
 await page.setViewportSize({width:800,height:1000});await page.goto(pathToFileURL(path.join(root,'阅读入口.html')).href);
 const narrow=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth}));
 const report={desktop,narrow,errors,status:errors.length===0&&desktop.images.every(i=>i.loaded)&&desktop.scrollWidth<=desktop.width&&narrow.scrollWidth<=narrow.width?'pass':'fail',scope:'Document rendering only, not game QA'};
 await fs.writeFile(path.join(root,'05_验证与评审/阅读页面验证.json'),JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report));
 if(report.status!=='pass')process.exitCode=1;
}finally{await browser.close();}
