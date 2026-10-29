import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { FileBlob, Workbook, SpreadsheetFile } from '@oai/artifact-tool';

const workDir = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(workDir, '../../附魔格50种');
const inputFile = path.join(outputDir, '附魔格50种_数据.json');
const outputFile = path.join(outputDir, '附魔格50种.xlsx');
const previewDir = path.join(workDir, 'xlsx_previews');
const previewOnly = process.argv.includes('--preview-only');
const inputText = await fs.readFile(inputFile, 'utf8');
const inputHash = createHash('sha256').update(inputText).digest('hex');
const expectedInputHash=process.argv.find(arg=>arg.startsWith('--expected-input-sha='))?.slice('--expected-input-sha='.length);
if(expectedInputHash && expectedInputHash!==inputHash) throw new Error('Final input hash does not match the approved design');
const data = JSON.parse(inputText);

// The JSON is the design authority. A missing or incomplete input stops this build.
if (!Array.isArray(data.enchants) || data.enchants.length !== 50) throw new Error('Expected exactly 50 final enchant records');
if (!Array.isArray(data.combos) || data.combos.length !== 8) throw new Error('Expected 8 final combinations');
if (!Array.isArray(data.rules) || data.rules.length !== 18) throw new Error('Expected 18 final common rules');
if (!Array.isArray(data.sources) || !data.sources.length) throw new Error('Missing source records');
const ids = data.enchants.map(x => x.id);
if (new Set(ids).size !== 50) throw new Error('Duplicate enchant IDs');
if (new Set(data.enchants.map(x => x.name)).size !== 50) throw new Error('Duplicate enchant names');
const required = ['id','tier','rarity','name','category','effect','short_effect','target','limits','tradeoff','play_pattern','item_ids','talent_ids','prototype','risk','mechanism_basis','review_note','design_enabled','runtime_status','implementation_gap'];
for (const row of data.enchants) for (const key of required) if (row[key] === undefined || row[key] === null) throw new Error(`Missing ${row.id}.${key}`);
if(data.enchants.some(row=>row.design_enabled!==true || row.runtime_status!=='not_yet_verified')) throw new Error('Expected all 50 design-enabled entries with unverified runtime status');
if(!data.offer_config?.probability_examples?.length) throw new Error('Missing first-release offer configuration');
const sources = new Map(data.sources.map(s => [s.id, s]));
const enchants = new Map(data.enchants.map(s => [s.id, s]));
const names = (recordIds, map = sources) => recordIds.map(id => {
  const found = map.get(id);
  if (!found) throw new Error(`Unresolved reference: ${id}`);
  return `${found.name}（${id}）`;
}).join('；');
for (const e of data.enchants) { names(e.item_ids); names(e.talent_ids); names(e.mechanism_ids ?? []); }

const book = Workbook.create();
const font = 'Arial';
const ink = '#243247';
const navy = '#243850';
const muted = '#617286';
const ruleColor = '#D5DDE7';
const rareStyle = {
  普通: { fill:'#EEF1F4', color:'#465463' },
  精良: { fill:'#E1F0E7', color:'#28583A' },
  稀有: { fill:'#E4EDFA', color:'#254D81' },
  史诗: { fill:'#EEE6F7', color:'#65428A' },
  传说: { fill:'#F8EBCD', color:'#815715' },
};
const columnName = i => {
  let s='';
  for (i++; i>0; i=Math.floor((i-1)/26)) s=String.fromCharCode(65+(i-1)%26)+s;
  return s;
};
function visualUnits(text) {
  let total=0;
  for (const char of String(text)) total += /[\u0000-\u00ff]/.test(char) ? 0.55 : 1;
  return total;
}
function estimatedLineCount(text, widthPx) {
  const capacity = Math.max(3, (widthPx-20)/14.8);
  return String(text ?? '').split('\n').reduce((sum, part) => sum + Math.max(1, Math.ceil(visualUnits(part)*1.08/capacity)),0);
}
const specs=[];
const extraBlocks=[];
function addSheet({name, title, subtitle, headers, values, widths, tabColor, tableName, freezeColumns=2, rareColumn=null, statusColumn=null}) {
  if (headers.length !== widths.length || values.some(r => r.length !== headers.length)) throw new Error(`Column mismatch: ${name}`);
  const sh=book.worksheets.add(name);
  const end=5+values.length;
  const last=columnName(headers.length-1);
  sh.showGridLines=false;
  sh.tabColor=tabColor;
  sh.getRange(`A1:${last}${end}`).format.font={name:font,size:11,color:ink};
  sh.getRange(`A1:${last}${end}`).format.fill='#FFFFFF';
  sh.getRange(`A1:${last}${end}`).format.verticalAlignment='center';
  sh.getRange(`A1:${last}1`).format.rowHeightPx=12;
  sh.getRange(`A2:${last}2`).format.rowHeightPx=34;
  sh.getRange(`A3:${last}3`).format.rowHeightPx=26;
  sh.getRange(`A4:${last}4`).format.rowHeightPx=12;
  sh.getRange('A2').values=[[title]];
  sh.getRange('A2').format.font={name:font,size:16,bold:true,color:navy};
  sh.getRange('A2').format.wrapText=false;
  sh.getRange('A3').values=[[subtitle]];
  sh.getRange('A3').format.font={name:font,size:11,color:muted};
  sh.getRange('A3').format.wrapText=false;
  sh.getRange(`A4:${last}4`).format.borders={bottom:{style:'thin',color:ruleColor}};
  sh.getRange(`A5:${last}${end}`).values=[headers,...values];
  const table=sh.tables.add(`A5:${last}${end}`,true,tableName);
  table.style='TableStyleLight9';
  table.showTotals=false;
  table.showFilterButton=true;
  sh.getRange(`A5:${last}5`).format={fill:navy,font:{name:font,size:11,bold:true,color:'#FFFFFF'},horizontalAlignment:'center',verticalAlignment:'center',wrapText:true};
  sh.getRange(`A5:${last}5`).format.rowHeightPx=34;
  sh.getRange(`A6:${last}${end}`).format.wrapText=true;
  sh.getRange(`A6:${last}${end}`).format.verticalAlignment='top';
  sh.getRange(`A6:${last}${end}`).format.borders={insideHorizontal:{style:'thin',color:'#E6EBF1'}};
  sh.getRange(`A6:B${end}`).format.font={name:font,size:11,color:ink,bold:true};
  const heights=[];
  for(let c=0;c<widths.length;c++) sh.getRange(`${columnName(c)}1:${columnName(c)}${end}`).format.columnWidthPx=widths[c];
  for(let r=0;r<values.length;r++) {
    const row=r+6;
    const maxLines=Math.max(...values[r].map((v,c)=>estimatedLineCount(v,widths[c])));
    const height=Math.max(name==='通用规则'?70:76, maxLines*20+18);
    heights.push(height);
    sh.getRange(`A${row}:${last}${row}`).format.rowHeightPx=height;
    sh.getRange(`A${row}:${last}${row}`).format.fill=r%2===0?'#FFFFFF':'#F7F9FC';
  }
  if(rareColumn!==null) {
    const col=columnName(rareColumn);
    for(const [rarity,style] of Object.entries(rareStyle)) sh.getRange(`${col}6:${col}${end}`).conditionalFormats.add('containsText',{text:rarity,format:{fill:style.fill,font:{color:style.color,bold:true}}});
    sh.getRange(`${col}6:${col}${end}`).format.horizontalAlignment='center';
  }
  if(statusColumn!==null) {
    const col=columnName(statusColumn);
    sh.getRange(`${col}6:${col}${end}`).conditionalFormats.add('containsText',{text:'需扩',format:{fill:'#FFF1D6',font:{color:'#8A5B16'}}});
  }
  sh.freezePanes.freezeRows(5);
  sh.freezePanes.freezeColumns(freezeColumns);
  specs.push({name,headers,values,widths,end,last,heights,tableName,freezeColumns});
  return sh;
}

const counts=Object.entries(data.counts).map(([k,v])=>`${({1:'普通',2:'精良',3:'稀有',4:'史诗',5:'传说'})[k]}${v}`).join('，');
addSheet({
  name:'附魔总表', title:'附魔格设计 50 种（首版全量配置）',
  subtitle:`${counts}，全部纳入首版。免费二选一，ROLL最多3次；10/20/40金币及概率是测试值，运行尚未验证。`,
  headers:['编号','附魔名称','稀有度','作用方向','效果摘要（提案）','怎样使用','代价与取舍','首版交付状态'],
  values:data.enchants.map(e=>[e.id,e.name,e.rarity,e.category,e.short_effect,e.play_pattern,e.tradeoff,e.prototype]),
  widths:[72,128,76,110,340,300,260,205], tabColor:navy, tableName:'EnchantmentCatalog',rareColumn:2,statusColumn:7,
});
addSheet({
  name:'触发细则', title:'触发目标、上限与取舍',
  subtitle:'50条均为首版必交付。搭配来源与机制依据分列；未适配项在“本次校正”中列出，不能据此删减首版。',
  headers:['编号','附魔名称','完整效果','生效目标','触发上限与清理','风险与接线边界','搭配装备','搭配天赋','机制依据','本次校正'],
  values:data.enchants.map(e=>[e.id,e.name,e.effect,e.target,e.limits,e.risk,names(e.item_ids),names(e.talent_ids),e.mechanism_basis,`${e.review_note}\n首版接入缺口：${e.implementation_gap}。`]),
  widths:[72,128,520,300,440,380,300,280,440,440],tabColor:'#536D89',tableName:'EnchantmentDetails',
});
addSheet({
  name:'组合示例', title:'8 组组合示例',
  subtitle:'示例强调摆放和事件顺序；列出的装备与天赋为搭配来源，不能视为已完成战斗验证。',
  headers:['组合名称','使用附魔','怎样摆放与运行','主要取舍','参考装备','参考天赋','交付状态'],
  values:data.combos.map(c=>[c.name,names(c.enchant_ids,enchants),c.flow,c.tradeoff,names(c.items),names(c.talents),c.scope]),
  widths:[160,245,490,360,310,270,205],tabColor:'#4C765C',tableName:'BuildExamples',freezeColumns:1,statusColumn:6,
});
addSheet({
  name:'通用规则',title:'附魔槽与事件通用规则',
  subtitle:`${data.version}　${data.date}。先明确槽位、事件来源、触发次数和状态清理，再接入单条效果。`,
  headers:['规则编号','主题','完整规则'],values:data.rules,
  widths:[90,185,1000],tabColor:'#957540',tableName:'CommonRules',freezeColumns:2,
});
addSheet({
  name:'装备天赋来源',title:'装备、天赋与术语依据',
  subtitle:`${data.sources.length}条来源。名称和原文来自现有完整CSV，原文数字为录制情境；保留原表记录定位。`,
  headers:['类别','来源编号','名称','视频可见原文','原工作簿、工作表与记录定位'],
  values:data.sources.map(s=>[s.kind,s.id,s.name,s.description,s.reference]),
  widths:[75,90,175,620,650],tabColor:'#7A8999',tableName:'SourceCatalog',freezeColumns:3,
});

function appendBlock(sheetName,title,headers,values,widths,label) {
  const spec=specs.find(s=>s.name===sheetName);
  const sh=book.worksheets.getItem(sheetName);
  const previousEnds=extraBlocks.filter(b=>b.sheetName===sheetName).map(b=>b.end);
  const start=Math.max(spec.end,...previousEnds)+3;
  const header=start+2;
  const end=header+values.length;
  const last=columnName(headers.length-1);
  sh.getRange(`A${start}:${last}${end}`).format.font={name:font,size:11,color:ink};
  sh.getRange(`A${start}:${last}${end}`).format.fill='#FFFFFF';
  sh.getRange(`A${start}:${last}${start}`).format.rowHeightPx=32;
  sh.getRange(`A${start}`).values=[[title]];
  sh.getRange(`A${start}`).format.font={name:font,size:16,bold:true,color:navy};
  sh.getRange(`A${start}`).format.wrapText=false;
  sh.getRange(`A${header}:${last}${end}`).values=[headers,...values];
  sh.getRange(`A${header}:${last}${header}`).format={fill:navy,font:{name:font,size:11,bold:true,color:'#FFFFFF'},horizontalAlignment:'center',verticalAlignment:'center',wrapText:true};
  sh.getRange(`A${header}:${last}${header}`).format.rowHeightPx=34;
  for(let i=0;i<values.length;i++) {
    const row=header+1+i;
    const h=Math.max(76,Math.max(...values[i].map((v,c)=>estimatedLineCount(v,widths[c])))*20+18);
    sh.getRange(`A${row}:${last}${row}`).format={fill:i%2?'#F7F9FC':'#FFFFFF',wrapText:true,verticalAlignment:'top'};
    sh.getRange(`A${row}:${last}${row}`).format.rowHeightPx=h;
    sh.getRange(`A${row}:${last}${row}`).format.borders={bottom:{style:'thin',color:'#E6EBF1'}};
  }
  extraBlocks.push({sheetName,title,headers,values,start,header,end,last,label});
}
if(!Array.isArray(data.tier_definitions)||data.tier_definitions.length!==5) throw new Error('Missing five tier definitions');
appendBlock('通用规则','五档定位',['档级','稀有度与数量','设计定位'],data.tier_definitions.map(t=>[t.tier,`${t.rarity}（${t.count}种）`,t.purpose]),[90,185,1000],'09_五档定位');
if(!Array.isArray(data.worked_examples)||data.worked_examples.length===0) throw new Error('Missing worked examples');
appendBlock('组合示例','满足条件后的局部算术例',['算例','前提条件','计算过程','成立边界'],data.worked_examples.map(w=>[w.name,w.conditions,w.calculation,w.boundary]),[160,245,490,360],'08_组合算术例');
appendBlock('组合示例','按层抽档概率示例（配置测试值）',['地牢层','普通','精良','稀有','史诗','传说'],data.offer_config.probability_examples.map(p=>[p.floor,...p.tier_probabilities]),[160,245,490,360,310,270],'18_分层附魔概率');
const probabilityBlock=extraBlocks[extraBlocks.length-1];
probabilityBlock.note=`基础权重 ${data.offer_config.rarity_base_weights.join('/')}；层系数=1+${data.offer_config.floor_factor_growth}×(层数−1)；第i档权重乘层系数的i次方后归一化，i从0开始。`;
book.worksheets.getItem('组合示例').getRange(`A${probabilityBlock.start+1}`).values=[[probabilityBlock.note]];
book.worksheets.getItem('组合示例').getRange(`A${probabilityBlock.start+1}`).format={font:{name:font,size:11,color:muted},wrapText:false};
book.worksheets.getItem('组合示例').getRange(`A${probabilityBlock.start+1}:F${probabilityBlock.start+1}`).format.rowHeightPx=26;
book.worksheets.getItem('组合示例').getRange(`B${probabilityBlock.header+1}:F${probabilityBlock.end}`).setNumberFormat('0.00000%');
book.worksheets.getItem('组合示例').getRange(`A${probabilityBlock.header+1}:F${probabilityBlock.end}`).format.horizontalAlignment='right';
const lowAudit=JSON.parse(await fs.readFile(path.join(workDir,'audit_low_mid.json'),'utf8'));
const highAudit=JSON.parse(await fs.readFile(path.join(workDir,'audit_high.json'),'utf8'));
const auditCount=key=>(lowAudit.decision_counts[key]??0)+(highAudit.overall_counts[key]??0);
if(auditCount('保留')+auditCount('改写')+auditCount('移除')!==50) throw new Error('Audit decisions do not cover all 50 records');
appendBlock('通用规则','设定复核结论',['项目','数量或范围','复核结论'],[
  ['条目处置','50种附魔',`原稿${auditCount('保留')}条保留、${auditCount('改写')}条改写、${auditCount('移除')}条移除旧机制后重做。`],
  ['主要校正','基础机制','移除纯回响独立数值包、王座第二护盾、DOT提前兑现、催化主动按钮等。恢复治愈处理持续伤害与固定灌注的原有含义。'],
  ['生命周期','成功保留，死亡清空',data.review_summary.lifecycle_update],
  ['首版范围',50,data.review_summary.first_release_scope],
  ['获取与ROLL','免费2选1',data.review_summary.offer_update],
  ['同格替换','确认后覆盖',data.review_summary.replacement_update],
  ['结论边界','设定与来源','保留已接受的六个方向。新条件、对象、数值和上限仍是附魔提案；设定相容不代表已实现或已完成实战平衡验证。'],
],[90,185,1000],'12_设定复核结论');

// Verify the in-memory matrices before export. These are catalog records, not simulated balance results.
const verification=[];
for(const spec of specs) {
  const sh=book.worksheets.getItem(spec.name);
  const actual=sh.getRange(`A6:${spec.last}${spec.end}`).values;
  if(JSON.stringify(actual)!==JSON.stringify(spec.values)) throw new Error(`Value mismatch after writing ${spec.name}`);
  const inspection=await book.inspect({kind:'region',sheetId:spec.name,range:`A5:${spec.last}${Math.min(spec.end,8)}`,maxChars:900,tableMaxRows:4,tableMaxCols:5,tableMaxCellChars:70});
  verification.push(`${spec.name}: ${spec.values.length} rows; values matched; table ${spec.tableName}; freeze rows 5 / columns ${spec.freezeColumns}`);
  console.log(inspection.ndjson);
}
for(const block of extraBlocks) {
  const actual=book.worksheets.getItem(block.sheetName).getRange(`A${block.header+1}:${block.last}${block.end}`).values;
  if(JSON.stringify(actual)!==JSON.stringify(block.values)) throw new Error(`Appendix value mismatch: ${block.title}`);
  verification.push(`${block.sheetName} / ${block.title}: ${block.values.length} rows; values matched`);
}
book.recalculate();
const errors=await book.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:100},summary:'Final workbook error scan'});
console.log(errors.ndjson);

await fs.mkdir(previewDir,{recursive:true});
const renders=[];
function schedule(name,first,last,label) {
  const s=specs.find(x=>x.name===name);
  renders.push({sheetName:name,range:`A${first}:${s.last}${Math.min(last,s.end)}`,label});
}
schedule('附魔总表',1,12,'01_附魔总表_开头');
schedule('附魔总表',24,31,'02_附魔总表_中段');
schedule('附魔总表',46,55,'03_附魔总表_高阶');
schedule('触发细则',1,9,'04_触发细则_开头');
schedule('触发细则',47,55,'05_触发细则_高阶');
schedule('组合示例',1,13,'06_组合示例');
schedule('通用规则',1,14,'07_通用规则_上');
schedule('通用规则',15,specs.find(x=>x.name==='通用规则').end,'08_通用规则_下');
schedule('装备天赋来源',1,10,'09_来源_开头');
const sourceSpec=specs.find(x=>x.name==='装备天赋来源');
schedule('装备天赋来源',Math.max(6,sourceSpec.end-6),sourceSpec.end,'10_来源_末尾');
for(const spec of specs) {
  const worst=spec.heights.indexOf(Math.max(...spec.heights))+6;
  if(!renders.some(r=>r.sheetName===spec.name && Number(r.range.match(/\d+/)[0])<=worst && Number(r.range.match(/\d+$/)[0])>=worst)) schedule(spec.name,Math.max(5,worst-1),worst+1,`11_最长行_${spec.name}`);
}
for(const b of extraBlocks) renders.push({sheetName:b.sheetName,range:`A${b.start}:${b.last}${b.end}`,label:b.label});
renders.push({sheetName:'触发细则',range:'G5:J10',label:'13_机制依据与校正_开头'});
renders.push({sheetName:'触发细则',range:'G47:J55',label:'14_机制依据与校正_高阶'});
const firstTerm=data.sources.findIndex(s=>s.id.startsWith('K'))+6;
if(firstTerm>=6) schedule('装备天赋来源',firstTerm,Math.min(firstTerm+7,sourceSpec.end),'15_术语来源');
const detailSpec=specs.find(s=>s.name==='触发细则');
const longestDetail=detailSpec.heights.indexOf(Math.max(...detailSpec.heights))+6;
renders.push({sheetName:'触发细则',range:`A${Math.max(6,longestDetail-1)}:F${longestDetail+1}`,label:'16_最长条目_效果与边界'});
renders.push({sheetName:'触发细则',range:`I${Math.max(6,longestDetail-1)}:J${longestDetail+1}`,label:'17_最长条目_依据与校正'});
const renderLabels=process.argv.find(arg=>arg.startsWith('--preview-labels='))?.slice('--preview-labels='.length).split(',');
const rendersToWrite=renderLabels?renders.filter(r=>renderLabels.includes(r.label)):(process.argv.includes('--subtitle-only')?renders.filter(r=>r.label==='01_附魔总表_开头'):renders);
if(renderLabels && rendersToWrite.length!==new Set(renderLabels).size) throw new Error('Unknown preview label');
for(const render of rendersToWrite) {
  const file=path.join(previewDir,`${render.label}.png`);
  const blob=await book.render({sheetName:render.sheetName,range:render.range,scale:1,format:'png'});
  await fs.writeFile(file,new Uint8Array(await blob.arrayBuffer()));
  console.log(`PREVIEW ${render.label}: ${render.sheetName}!${render.range}`);
}
if(!previewOnly) {
  const output=await SpreadsheetFile.exportXlsx(book);
  await output.save(outputFile);
  try { await fs.rename(`${outputFile}.inspect.ndjson`,path.join(workDir,'xlsx_export.inspect.ndjson')); }
  catch(error) { if(error.code!=='ENOENT') throw error; }
  const reloaded=await SpreadsheetFile.importXlsx(await FileBlob.load(outputFile));
  const normalizeBlanks=matrix=>matrix.map(row=>row.map(value=>value??''));
  const savedMatrixMatches=(actual,expected)=>actual.length===expected.length && actual.every((row,r)=>row.length===expected[r].length && row.every((value,c)=>{
    const wanted=expected[r][c];
    return typeof value==='number' && typeof wanted==='number' && !Number.isInteger(wanted)?Math.abs(value-wanted)<=1e-12:value===wanted;
  }));
  for(const spec of specs) {
    const actual=reloaded.worksheets.getItem(spec.name).getRange(`A5:${spec.last}${spec.end}`).values;
    if(!savedMatrixMatches(normalizeBlanks(actual),normalizeBlanks([spec.headers,...spec.values]))) throw new Error(`Saved workbook values differ: ${spec.name}`);
  }
  for(const block of extraBlocks) {
    const actual=reloaded.worksheets.getItem(block.sheetName).getRange(`A${block.header}:${block.last}${block.end}`).values;
    if(!savedMatrixMatches(normalizeBlanks(actual),normalizeBlanks([block.headers,...block.values]))) throw new Error(`Saved workbook appendix differs: ${block.title}`);
    if(block.note && reloaded.worksheets.getItem(block.sheetName).getRange(`A${block.start+1}`).values[0][0]!==block.note) throw new Error(`Saved workbook appendix note differs: ${block.title}`);
  }
  const readback=await reloaded.inspect({kind:'sheet,table',maxChars:3500,tableMaxRows:2,tableMaxCols:4,tableMaxCellChars:40});
  await fs.writeFile(path.join(workDir,'xlsx_readback.inspect.ndjson'),readback.ndjson+'\n','utf8');
  verification.push(`Saved XLSX imported through Artifact Tool; all five table matrices and ${extraBlocks.length} appendix matrices matched.`);
}
const afterText=await fs.readFile(inputFile,'utf8');
if(createHash('sha256').update(afterText).digest('hex')!==inputHash) throw new Error('Input changed during build; final workbook must be rebuilt');
const report=[
  `Input: ${inputFile}`,
  `Input SHA256: ${inputHash}`,
  `Output: ${previewOnly?'preview only; existing XLSX unchanged':outputFile}`,
  `Workbook sheets: ${specs.length}`,
  `Counts: ${counts}`,
  ...verification,
  `Previews rendered in this run: ${rendersToWrite.length}; planned full preview coverage: ${renders.length}`,
  `Render mode: ${renderLabels?'selected affected ranges':process.argv.includes('--subtitle-only')?'subtitle-only after full visual review':'full'}; export ${previewOnly?'deferred':'completed'}`,
  `Error scan: ${errors.ndjson}`,
  'Source JSON unchanged during build. Visual acceptance requires inspecting the rendered previews.',
].join('\n')+'\n';
await fs.writeFile(path.join(workDir,'xlsx_build_report.txt'),report,'utf8');
console.log(previewOnly?'PREVIEW_ONLY: final export deferred':`SAVED ${outputFile}`);
console.log(`INPUT_SHA256 ${inputHash}`);
