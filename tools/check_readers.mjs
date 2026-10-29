// Run after `cd game && npm ci && npx playwright install chromium`.
// This validates offline artifact readers, not gameplay or mobile device quality.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(path.join(root,'game/package.json'));
const {chromium}=require('playwright');
const executablePath=process.env.CHROME_PATH || process.env.BATTLE_CHROME_PATH;
const browser=await chromium.launch({headless:true,...(executablePath?{executablePath}:{})});
const pages=['index.html','art/ui-v10/集中审核.html','art/icons-v6/index.html','design/GDD_基础规则/阅读入口.html','design/怪物100种设计/阅读入口.html','research/video-research/研究说明与证据索引.html'];
const results=[];
try{
 for(const file of pages){
  const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(pathToFileURL(path.join(root,file)).href);
  const images=await page.locator('img[src]').evaluateAll(async list=>{
   return Promise.all(list.map(async img=>{img.loading='eager';try{await img.decode();return {src:img.getAttribute('src'),loaded:true}}catch{return {src:img.getAttribute('src'),loaded:false}}}));
  });
  const hrefs=await page.locator('a[href]').evaluateAll(list=>list.map(a=>a.getAttribute('href')));
  const missingLinks=[];
  for(const href of hrefs){
   if(!href||href.startsWith('#')||/^[a-z]+:/i.test(href))continue;
   const target=path.resolve(path.dirname(path.join(root,file)),decodeURIComponent(href.split('#')[0].split('?')[0]));
   try{await fs.access(target)}catch{missingLinks.push(href)}
  }
  results.push({file,images:images.length,failedImages:images.filter(i=>!i.loaded),missingLinks,errors});await page.close();
 }
}finally{await browser.close();}
const pass=results.every(r=>!r.failedImages.length&&!r.errors.length&&!r.missingLinks.length);
const report={pass,scope:'Offline artifact readers only; not gameplay/device usability validation',results};
await fs.writeFile(path.join(root,'docs/离线阅读页迁移验证.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));process.exitCode=pass?0:1;
