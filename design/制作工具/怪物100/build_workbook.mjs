import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Workbook, SpreadsheetFile, FileBlob } from '@oai/artifact-tool';

const W=path.dirname(fileURLToPath(import.meta.url));
const O=path.resolve(W,'../../怪物100种设计');
const P=path.join(W,'xlsx_previews');
const data=JSON.parse(await fs.readFile(path.join(O,'怪物100种_数据.json'),'utf8'));
const rules=JSON.parse(await fs.readFile(path.join(O,'怪物层级与生成规则.json'),'utf8'));
const audit=JSON.parse(await fs.readFile(path.join(O,'字段与能力依据.json'),'utf8'));
const alg=JSON.parse(await fs.readFile(path.join(O,'行为算法说明.json'),'utf8'));
const report=JSON.parse(await fs.readFile(path.join(O,'离线检查结果.json'),'utf8'));
const monsters=data.monsters;
if(monsters.length!==100||monsters.filter(m=>m.rank==='normal').length!==80||monsters.filter(m=>m.rank==='elite').length!==20)throw new Error('Expected 80 normal + 20 elite');
const book=Workbook.create();
const font='Arial',ink='#263649',navy='#293C55',muted='#657389',line='#D9E0E8';
const sheets=new Map();
const specs=[];
const col=n=>{let s='';for(n++;n>0;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
const units=t=>[...String(t??'')].reduce((n,c)=>n+(/[\u0000-\u00ff]/.test(c)?.52:1),0);
const lines=(t,width)=>String(t??'').split('\n').reduce((n,s)=>n+Math.max(1,Math.ceil(units(s)/Math.max(3,(width-18)/14))),0);
const exact=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const normalizeBlank=v=>Array.isArray(v)?v.map(normalizeBlank):v===''?null:v;
const rank=m=>m.rank==='elite'?'精英':'普通';
const params=m=>Object.entries(m.behavior.params).map(([k,v])=>`${k} = ${typeof v==='string'?v:JSON.stringify(v)}`).join('\n');
const cycle=m=>m.cycle.map((s,i)=>`${i+1}. ${s.phase} ${s.turns}回合：${s.intent}`).join('\n')+(m.event_branches?.length?'\n事件分支（不循环）：\n'+m.event_branches.map(b=>`${b.event}${b.hp_ratio!==undefined?' < '+b.hp_ratio:''}，仅一次：`+b.sequence.map(s=>`${s.phase} ${s.turns}回合：${s.intent}`).join(' → ')+`；终态=${b.terminal}`).join('\n'):'');
function addTable({name,title,note,headers,values,widths,tableName,start=5,freeze=2,color=navy,numeric=[]}){
  const sh=book.worksheets.add(name);sheets.set(name,sh);sh.showGridLines=false;sh.tabColor=color;
  const last=col(headers.length-1),end=start+values.length;
  const used=sh.getRange(`A1:${last}${end}`);
  used.format.font={name:font,size:11,color:ink};used.format.fill='#FFFFFF';used.format.verticalAlignment='center';
  sh.getRange(`A1:${last}1`).format.rowHeightPx=12;
  sh.getRange(`A2:${last}2`).format.rowHeightPx=32;sh.getRange('A2').values=[[title]];sh.getRange('A2').format.font={name:font,size:16,bold:true,color:navy};
  sh.getRange('A3').values=[[note]];sh.getRange('A3').format.font={name:font,size:11,color:muted};sh.getRange(`A3:${last}3`).format.rowHeightPx=28;
  sh.getRange(`A${start-1}:${last}${start-1}`).format.borders={bottom:{style:'thin',color:line}};
  sh.getRange(`A${start}:${last}${end}`).values=[headers,...values];
  const tab=sh.tables.add(`A${start}:${last}${end}`,true,tableName);tab.style='TableStyleLight9';tab.showFilterButton=true;tab.showTotals=false;
  sh.getRange(`A${start}:${last}${start}`).format={fill:navy,font:{name:font,size:11,bold:true,color:'#FFFFFF'},wrapText:true,horizontalAlignment:'center',verticalAlignment:'center'};
  sh.getRange(`A${start}:${last}${start}`).format.rowHeightPx=48;
  sh.getRange(`A${start+1}:${last}${end}`).format.wrapText=true;
  sh.getRange(`A${start+1}:${last}${end}`).format.verticalAlignment='top';
  sh.getRange(`A${start+1}:${last}${end}`).format.borders={insideHorizontal:{style:'thin',color:'#E6EBF1'}};
  widths.forEach((width,c)=>sh.getRange(`${col(c)}1:${col(c)}${end}`).format.columnWidthPx=width);
  const heights=[];
  values.forEach((row,i)=>{
    const rownum=start+i+1;
    const height=Math.max(42,Math.max(...row.map((v,c)=>lines(v,widths[c])))*20+16);
    heights.push(height);sh.getRange(`A${rownum}:${last}${rownum}`).format.rowHeightPx=height;
    sh.getRange(`A${rownum}:${last}${rownum}`).format.fill=i%2?'#F6F8FA':'#FFFFFF';
  });
  for(const c of numeric){const r=sh.getRange(`${col(c)}${start+1}:${col(c)}${end}`);r.setNumberFormat('#,##0');r.format.horizontalAlignment='right';}
  sh.freezePanes.freezeRows(start);sh.freezePanes.freezeColumns(freeze);
  specs.push({name,start,end,last,headers,values,heights,widths});return sh;
}

const roles={frontline:'前排',ranged:'远程',controller:'控制',support:'支援',breeder:'繁衍'};
const mainValues=monsters.map(m=>[m.id,m.name,rank(m),m.family_name,m.unlock_floor,m.min_wave,m.base_stats.hp,m.base_stats.attack,m.base_stats.heal,m.base_stats.fortify,m.behavior.damage_ratio,m.base_budget_cost,m.reserved_entity_slots,m.identity,m.source_visual_row,m.parent_id??'',m.theme,roles[m.role],m.damage_type,m.damage_source,m.behavior.move_tiles,m.behavior.range_tiles,m.generation_tags.join(" / "),JSON.stringify(m.damage_source_by_action)]);
const main=addTable({name:'怪物总表',title:'无尽地牢怪物100种',note:'80普通、20精英。基型数值未乘层数、波次或精英系数；均为项目测试值。源外观仅为复用线索，未验收100套美术或运行效果。',
  headers:['编号','怪物名称','分类','行为家族','解锁层','最早波','基型生命','基型伤害','治愈基值','强固基值','主动作倍率','预算基值','附属位预留','主要特点','源外观RowName','精英父型','主题','定位','伤害类型','伤害来源','移动上限_格','行为范围_格','编队标签','分支伤害来源'],
  values:mainValues,widths:[112,145,68,112,72,72,82,82,82,82,86,84,88,370,150,120,80,80,85,85,100,100,230,330],tableName:'MonsterCatalog',numeric:[4,5,6,7,8,9,10,11,12,20,21]});
main.getRange('C6:C105').conditionalFormats.add('containsText',{text:'精英',format:{fill:'#F3E8EC',font:{bold:true,color:'#813D55'}}});
for(const c of ['K','L','U','V'])main.getRange(`${c}6:${c}105`).setNumberFormat('0.00');

const mechanismValues=monsters.map(m=>[m.id,m.name,m.difference+(m.elite_delta?'\n精英新增：'+m.elite_delta:''),cycle(m),m.behavior.target_rule+'\n'+m.behavior.lock_rule,params(m),m.counterplay,m.limits+'\n硬禁配：'+(m.forbidden_with_families.join('、')||'按全局约束')+'\n组合风险：'+m.combo_risks.join('；'),m.implementation+'\n验收：'+m.acceptance,m.stat_rationale??'沿用已核字段，参考现有6类测试基型；取值为待实战调优的项目配置。']);
addTable({name:'机制细则',title:'攻击循环、反制与逐条验收',note:'cycle仅描述生前循环；死亡或阈值事件单独列出且只触发一次。范围单位为房间大格（256世界单位），不是新实体属性。',
  headers:['编号','怪物名称','同族机制差异','动作循环与事件分支','目标与锁定','行为参数','玩家反制','边界、禁配与风险','实施任务与验收场景','数值取舍'],
  values:mechanismValues,widths:[112,145,370,620,510,440,360,550,650,350],tableName:'MonsterMechanics',color:'#4D6078'});

const projection=addTable({name:'数值推演',title:'按层数与波次推演属性',note:'黄色单元格可调整。未解锁行仍显示假设同层数值；已达门槛仍须满足预算、配队和空间限制；主动作伤害不含临时增益、目标减伤或其他分支。',
  headers:['编号','怪物名称','层/波门槛','分类','实际生命','基础伤害','主动作参考伤害','一次治愈','一次强固','有效预算','总实体预留','解锁层标准波生命'],
  values:monsters.map(m=>[m.id,m.name,'',rank(m),null,null,null,null,null,null,null,null]),widths:[112,145,120,68,105,100,135,105,105,100,115,150],tableName:'MonsterProjection',start:8,color:'#A3793D',numeric:[4,5,6,7,8,9,10,11]});
projection.getRange('A4:K6').format.rowHeightPx=30;
projection.getRange('A4').values=[['地牢层']];projection.getRange('B4').values=[[1]];
projection.getRange('D4').values=[['波次']];projection.getRange('E4').values=[[3]];
projection.getRange('G4').values=[['核查上限']];projection.getRange('H4').values=[[100]];
projection.getRange('A5').values=[['层生命倍率']];projection.getRange('D5').values=[['层伤害倍率']];projection.getRange('G5').values=[['波生命倍率']];projection.getRange('J5').values=[['波伤害倍率']];
projection.getRange('A6').values=[['输入状态']];
projection.getRange('B6').formulas=[['=IF(AND(ISNUMBER(B4),ISNUMBER(E4),B4>=1,B4<=H4,B4=INT(B4),E4>=1,E4<=6,E4=INT(E4)),"有效","输入无效")']];
projection.getRange('B4').format.fill='#FFF0C2';projection.getRange('E4').format.fill='#FFF0C2';
projection.dataValidations.add({range:'B4',rule:{type:'whole',operator:'between',formula1:1,formula2:100}});
projection.dataValidations.add({range:'E4',rule:{type:'whole',operator:'between',formula1:1,formula2:6}});
const g=rules.growth,e=rules.elite;
const settings=[['第2层生命倍率',g.floor2_hp],['第2层伤害倍率',g.floor2_attack],['每几层一个增长步进',g.floors_per_growth_step],['每步生命倍率',g.hp_growth_per_step],['每步伤害倍率',g.attack_growth_per_step],['精英生命倍率',e.hp_factor],['精英伤害倍率',e.attack_factor],['精英预算倍率',e.cost_factor],['第1层生命倍率',g.floor1_hp],['第1层伤害倍率',g.floor1_attack],['强固分担伤害比例',rules.combat.fortify_absorption_fraction]];
projection.getRange('A118').values=[['可调测试配置']];projection.getRange('A118').format.font={name:font,size:14,bold:true,color:navy};
projection.getRange('A120:B130').values=settings;projection.getRange('A120:A130').format.columnWidthPx=200;projection.getRange('A120:B130').format.rowHeightPx=32;
projection.getRange('B120:B130').format.fill='#FFF0C2';projection.getRange('B120:B130').setNumberFormat('0.00');
projection.getRange('F119:K119').values=[[1,2,3,4,5,6]];
projection.getRange('E119').values=[['波次']];projection.getRange('E120:E122').values=[['生命波倍率'],['伤害波倍率'],['编队预算']];
projection.getRange('F120:K122').values=[rules.waves.hp_factor,rules.waves.attack_factor,rules.waves.budget];projection.getRange('F120:K122').format.fill='#FFF0C2';projection.getRange('F120:K122').setNumberFormat('0.00');
projection.getRange('B5').formulas=[['=IF($B$6="有效",IF(B4=1,$B$128,$B$120*POWER($B$123,(B4-2)/$B$122)),"输入无效")']];
projection.getRange('E5').formulas=[['=IF($B$6="有效",IF(B4=1,$B$129,$B$121*POWER($B$124,(B4-2)/$B$122)),"输入无效")']];
projection.getRange('H5').formulas=[['=IF($B$6="有效",INDEX($F$120:$K$120,1,E4),"输入无效")']];
projection.getRange('K5').formulas=[['=IF($B$6="有效",INDEX($F$121:$K$121,1,E4),"输入无效")']];
for(const cell of ['B5','E5','H5','K5'])projection.getRange(cell).setNumberFormat('0.0000');
const lookup=(c,r)=>`INDEX('怪物总表'!$${c}$6:$${c}$105,MATCH(A${r},'怪物总表'!$A$6:$A$105,0))`;
projection.getRange('B9:B108').formulas=monsters.map((m,i)=>[`=${lookup('B',i+9)}`]);
const pForms=monsters.map((m,i)=>{const r=i+9;return [
  `=IF($B$6="有效",IF(AND($B$4>=${lookup('E',r)},$E$4>=${lookup('F',r)}),"已达门槛","未达门槛"),"输入无效")`,
  `=${lookup('C',r)}`,
  `=IF($B$6="有效",ROUND(${lookup('G',r)}*$B$5*$H$5*IF(D${r}="精英",$B$125,1),0),"输入无效")`,
  `=IF($B$6="有效",ROUND(${lookup('H',r)}*$E$5*$K$5*IF(D${r}="精英",$B$126,1),0),"输入无效")`,
  `=IF($B$6="有效",ROUND(F${r}*${lookup('K',r)},0),"输入无效")`,
  `=IF($B$6="有效",ROUND(${lookup('I',r)}*$B$5,0),"输入无效")`,
  `=IF($B$6="有效",ROUND(${lookup('J',r)}*$B$5,0),"输入无效")`,
  `=${lookup('L',r)}*IF(D${r}="精英",$B$127,1)`,
  `=1+${lookup('M',r)}`,
  `=ROUND(${lookup('G',r)}*IF(${lookup('E',r)}=1,$B$128,$B$120*POWER($B$123,(${lookup('E',r)}-2)/$B$122))*IF(D${r}="精英",$B$125,1),0)`
];});
projection.getRange('C9:L108').formulas=pForms;
projection.getRange('J9:J108').setNumberFormat('0.00');
projection.getRange('C9:C108').conditionalFormats.add('containsText',{text:'未达门槛',format:{font:{color:'#8A939E'}}});
projection.getRange('B6').conditionalFormats.add('containsText',{text:'输入无效',format:{fill:'#F8DEDE',font:{color:'#A12727',bold:true}}});
projection.getRange('A133').values=[['调参边界']];projection.getRange('B133').values=[['整数取整可能让相邻层某一属性暂时相同。层系数持续增加；数值曲线不保证无限可通关。']];
projection.getRange('B133').format.wrapText=false;

const level=addTable({name:'层级与出场',title:'第1至100层的成长与解锁',note:'解锁数仅核层门槛；每波还受最早波次、预算、主题与禁配限制。主题提高权重，不排除其他主题。第3层以后均待实战调优。',
  headers:['地牢层','主题','生命层倍率','伤害层倍率','已解锁普通','已解锁精英','下层开场/本层末波生命','第1波预算','第2波预算','第3波预算','第4波预算','第5波预算','第6波预算'],
  values:Array.from({length:100},(_,i)=>[i+1,rules.generation.theme_order[Math.floor(i/3)%3],null,null,null,null,null,...rules.waves.budget]),
  widths:[85,100,125,125,120,120,175,100,100,100,100,100,100],tableName:'FloorProgression',freeze:1,color:'#657A5B',numeric:[0,2,3,4,5,6,7,8,9,10,11,12]});
const lForms=Array.from({length:100},(_,i)=>{const r=i+6;return [
  `=IF(A${r}=1,'数值推演'!$B$128,'数值推演'!$B$120*POWER('数值推演'!$B$123,(A${r}-2)/'数值推演'!$B$122))`,
  `=IF(A${r}=1,'数值推演'!$B$129,'数值推演'!$B$121*POWER('数值推演'!$B$124,(A${r}-2)/'数值推演'!$B$122))`,
  `=COUNTIFS('怪物总表'!$C$6:$C$105,"普通",'怪物总表'!$E$6:$E$105,"<="&A${r})`,
  `=COUNTIFS('怪物总表'!$C$6:$C$105,"精英",'怪物总表'!$E$6:$E$105,"<="&A${r})`,
  i<99?`=C${r+1}*'数值推演'!$F$120/(C${r}*'数值推演'!$K$120)`:'="n.a."'
];});
level.getRange('C6:G105').formulas=lForms;level.getRange('C6:D105').setNumberFormat('0.0000');level.getRange('G6:G105').setNumberFormat('0.0%');
level.getRange('H6:M105').formulas=Array.from({length:100},()=>Array.from({length:6},(_,j)=>`='数值推演'!${col(5+j)}$122`));

const genRows=[
 ['GEN01','层数取值',rules.growth.formula_hp+'；'+rules.growth.formula_attack,rules.growth.support_growth,rules.growth.balance_boundary],
 ['GEN02','精英抽签','按波概率抽请求，先检查每层2次/不连续；在可与另一普通怪同队的合法池抽精英。',rules.generation.failed_elite_request,rules.elite.ratio_note],
 ['GEN03','编队填充',rules.generation.allocation_order,rules.generation.unused_budget,'先按家族权重，再按同族候选等权/重复修正；不按玩家攻击或装备价值补强。'],
 ['GEN04','实体与预算',rules.generation.reserved_entity_slots+'\n'+rules.generation.tag_classification,'每波总预留≤6、初始成员≥2、精英≤1。','后代/卵/残骸/路障不算新增正式怪种，也不额外掉落。'],
 ['GEN05','组合限制',JSON.stringify(rules.generation.combined_family_caps)+'；禁配='+JSON.stringify(rules.generation.forbidden_family_pairs),'逐条forbidden_with_families也须双向检查。','硬禁配先拦截，真实共同安全区仍须运行验收。'],
 ['GEN06','随机保存',rules.rng.key+'；'+rules.rng.algorithm+'；'+rules.rng.seed_hash,rules.rng.reload,'商品/附魔随机不消耗怪物域。'],
 ['GEN07','空间验收',rules.generation.spatial_gate,rules.generation.fallback_note,'真实演员半径和完整反弹路径必须参与检查。'],
 ['GEN08','奖励分摊',rules.combat.reward_accounting,rules.combat.descendant_rewards,'未在本表新造100套单怪金币/经验/物品掉落。'],
 ['GEN09','动作与预警',rules.combat.same_action_multiple_hit_policy,rules.combat.warning_window,rules.combat.origin_geometry_lock],
 ['GEN10','初始化',rules.combat.fortify_initialization,rules.combat.modifier_initialization_note,rules.combat.source_scaling_override],
 ['GEN11','清波时机',rules.combat.wave_clear_gate,'死亡根怪移除前先登记pending，不允许一个短暂的空场触发胜利。','can_clear_wave只检查调用方提供的实体/待出生ID；真实原子事务和事件消费者仍待实施。']
 ];
addTable({name:'行为与生成算法',title:'20类行为算法与生成合同',note:'算法参考可运行层数计算、编队生成、奖励分摊和一次事件调度。真实投射、碰撞、伤害与存档仍需接入游戏。',
 headers:['编号','算法','状态与执行步骤','失败与回退','适配与边界'],values:[...alg.map(a=>[a.family_id,a.name,a.algorithm+'\n持久状态：'+a.state,a.failure,a.adapter]),...genRows],
 widths:[100,145,770,550,640],tableName:'BehaviorAlgorithms',color:'#526E77'});

const evidence=(xs)=>xs.map(x=>x.path?x.path+(x.lines?':'+x.lines.join('-'):''):(x.source_sheet??'源表')+' 第'+(x.source_row??x.source_rows?.join('-')??'')+'行').join('\n');
const fieldRows=[];
for(const x of audit.approved_base_fields)fieldRows.push(['实体数值',x.design_key,x.exact_keys.join(' / '),x.meaning,evidence(x.evidence),'字段有来源；本表各怪取值是新设计测试值。']);
fieldRows.push(['项目适配','fortify_absorption_fraction','科学词条.强固减伤%',audit.fortify_adaptation.proposed_project_adapter,evidence(audit.fortify_adaptation.evidence),'源英雄0.5；源敌人28行缺键。不能称敌人原值或100%护盾。']);
for(const x of audit.existing_entity_fields_not_new_design_stats)fieldRows.push(['既有字段',x.zh,x.exact_key,x.classification,evidence(x.evidence),x.aggregation??'新增行为必须按来源ID接线。']);
for(const a of audit.ability_boundaries)fieldRows.push(['能力边界',a.id,'源接口/消费者',a.source_definition,evidence(a.evidence),a.implementation_gap]);
for(const row of [...new Set(monsters.map(m=>m.source_visual_row))].sort()){
  const s=audit.source_inventory.all_rows.find(x=>x.row_name===row);
  fieldRows.push(['视觉候选',row,s.display_name,'正式源记录存在；不代表该100设计已有独立美术或已验收动作。',`敌人总表 第${s.sheet_row}行\nbattle-scene/src/content/demo/data/数据表_敌人_普通.ts:${s.runtime_line}`,'源首领标签、旧随机技能与旧成长均须移除/覆盖。']);
}
fieldRows.push(['伤害枚举','本表采用','物理 / 爆炸 / 抓钩','牵引主动作伤害0；地面余波不新增酸/冰抗性。','battle-scene/src/content/demo/types.ts:160-163','完整枚举与源文件哈希见字段与能力依据.json。']);
addTable({name:'字段与来源',title:'已有属性、能力与来源边界',note:'数值、行为参数和来源线索分别列出。42条归档记录包含测试、宝箱与地形，不是42种正式可用怪物。',
 headers:['类别','设计字段/名称','原字段或类型','含义与适配','当前源定位','证据边界'],values:fieldRows,widths:[105,200,300,650,650,520],tableName:'FieldEvidence',color:'#7A8493',freeze:2});

const checks=report.checks.map(c=>[c.name,c.pass?'通过':'未通过',typeof c.detail==='string'?c.detail:JSON.stringify(c.detail),c.scope??'离线设计/配置检查']);
const gates=[
 ['真实战斗','待实施','100条AI、预告、投射、碰撞、伤害/治疗/强固逐条通过其验收场景。','运行验收'],
 ['共同安全落点','待实施','使用实际英雄半径、完整反弹与整个敌方阶段验证；配置合法不能替代。','操作验收'],
 ['断点与奖励','待实施','死亡、召唤、复生、重载、重复命令不复制奖励，不恢复旧次数。','存档验收'],
 ['深层强度','待实测','同套构筑跨层比较回合数、受击与体力净耗；不能以公式单调当作平衡。','玩家体验']
];
addTable({name:'检查与验收',title:'离线检查结果与运行验收',note:`本次覆盖${report.encounters_checked}个编队样本。下方运行项目尚未执行，不能用通过项替代。`,headers:['项目','状态','结果/要求','证据范围'],values:[...checks,...gates],widths:[490,95,900,180],tableName:'ValidationMatrix',freeze:1,color:'#7E6F59'});

book.recalculate();
function expected(m,f,w){const a=f===1?1:g.floor2_hp*Math.pow(g.hp_growth_per_step,(f-2)/g.floors_per_growth_step),b=f===1?1:g.floor2_attack*Math.pow(g.attack_growth_per_step,(f-2)/g.floors_per_growth_step),elite=m.rank==='elite';const hp=Math.floor(m.base_stats.hp*a*rules.waves.hp_factor[w-1]*(elite?e.hp_factor:1)+.5),atk=Math.floor(m.base_stats.attack*b*rules.waves.attack_factor[w-1]*(elite?e.attack_factor:1)+.5);return [hp,atk,Math.floor(atk*m.behavior.damage_ratio+.5),Math.floor(m.base_stats.heal*a+.5),Math.floor(m.base_stats.fortify*a+.5)];}
const tested=[];
for(const [f,w] of [[1,3],[2,6],[20,6],[100,1]]){
  projection.getRange('B4').values=[[f]];projection.getRange('E4').values=[[w]];book.recalculate();
  const values=projection.getRange('E9:I108').values;
  for(let i=0;i<100;i++)if(!exact(values[i],expected(monsters[i],f,w)))throw new Error(`Projection mismatch ${monsters[i].id} F${f} W${w}: ${JSON.stringify(values[i])} expected ${JSON.stringify(expected(monsters[i],f,w))}`);
  tested.push({floor:f,wave:w,monsters:100,pass:true});
}
projection.getRange('B4').values=[[0]];book.recalculate();if(projection.getRange('B6').values[0][0]!=='输入无效')throw new Error('Invalid-floor input was accepted');
projection.getRange('B4').values=[[1]];projection.getRange('E4').values=[[3]];book.recalculate();
main.getRange('A6:X105').values=[...mainValues].reverse();book.recalculate();
const reordered=projection.getRange('E9:I108').values;
for(let i=0;i<100;i++)if(!exact(reordered[i],expected(monsters[i],1,3)))throw new Error('Stable ID lookup failed after source reorder '+monsters[i].id);
main.getRange('A6:X105').values=mainValues;book.recalculate();
const errors=await book.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:100},summary:'formula error scan'});
await fs.writeFile(path.join(W,'formula_error_scan.ndjson'),errors.ndjson);
if(/"(?:cell|address)"/.test(errors.ndjson)&&/#REF!|#DIV\/0!|#VALUE!|#NAME\?|#NUM!|#SPILL!|#CALC!/.test(errors.ndjson))throw new Error('Formula errors found');
await fs.mkdir(P,{recursive:true});
const previews=[
 ['怪物总表','A1:N11','01_怪物总表'],['怪物总表','A83:N89','02_精英记录'],
 ['机制细则','A1:D8','03_机制循环'],['机制细则','F58:I60','04_分裂机制边界'],
 ['数值推演','A1:L16','05_数值推演'],['数值推演','A118:K130','06_可调参数'],
 ['层级与出场','A1:G16','07_层数曲线'],['行为与生成算法','A1:E9','08_行为算法'],
 ['字段与来源','A1:F10','09_字段依据'],['检查与验收','A1:D12','10_检查结果']
];
for(const [sheetName,range,file] of previews){const blob=await book.render({sheetName,range,scale:1,format:'png'});await fs.writeFile(path.join(P,file+'.png'),new Uint8Array(await blob.arrayBuffer()));}
const longest=specs.find(s=>s.name==='机制细则');const longestIndex=longest.heights.indexOf(Math.max(...longest.heights));
const lr=longest.start+longestIndex+1;const longPreview=await book.render({sheetName:'机制细则',range:`C${lr}:I${lr}`,scale:1,format:'png'});await fs.writeFile(path.join(P,'11_最长机制行.png'),new Uint8Array(await longPreview.arrayBuffer()));
const outFile=path.join(O,'怪物100种_设计总表.xlsx');const out=await SpreadsheetFile.exportXlsx(book);await out.save(outFile);
const reopened=await SpreadsheetFile.importXlsx(await FileBlob.load(outFile));
for(const s of specs.filter(s=>!['数值推演','层级与出场'].includes(s.name))){const vals=reopened.worksheets.getItem(s.name).getRange(`A${s.start+1}:${s.last}${s.end}`).values;if(!exact(normalizeBlank(vals),normalizeBlank(s.values)))throw new Error('Saved workbook values differ on '+s.name);}
const rp=reopened.worksheets.getItem('数值推演');rp.getRange('B4').values=[[20]];rp.getRange('E4').values=[[6]];reopened.recalculate();
const rv=rp.getRange('E9:I108').values;for(let i=0;i<100;i++)if(!exact(rv[i],expected(monsters[i],20,6)))throw new Error('Reopened formula failed '+monsters[i].id);
const result={status:'pass',rows:100,normal:80,elite:20,sheets:specs.length,projection_cases:tested,invalid_input_rejected:true,stable_id_after_source_reorder:true,saved_values_match:true,reopened_input_recalculation_passed:true,previews:previews.map(x=>x[2]),longest_mechanism_row:lr,max_row_height_px:Math.max(...specs.flatMap(s=>s.heights)),scope:'Artifact Tool calculation and saved-XLSX readback; native Excel and game runtime not exercised'};
await fs.writeFile(path.join(W,'workbook_validation.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({output:outFile,...result}));
