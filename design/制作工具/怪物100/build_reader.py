from pathlib import Path
import json, html

W=Path(__file__).resolve().parent
O=W.parents[1]/'怪物100种设计'
data=json.loads((O/'怪物100种_数据.json').read_text())
rules=json.loads((O/'怪物层级与生成规则.json').read_text())
report=json.loads((O/'离线检查结果.json').read_text())
payload=json.dumps({'data':data,'rules':rules,'report':report},ensure_ascii=False).replace('<','\\u003c')
page=r'''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>无尽地牢 · 怪物100种设计</title>
<style>
:root{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;color:#243449;background:#f4f5f7;line-height:1.65}*{box-sizing:border-box}body{margin:0}main{max-width:1420px;padding:36px 28px 80px;margin:auto}h1{font-size:32px;line-height:1.25;margin:12px 0}h2{font-size:20px;margin:0 0 12px}p{margin:8px 0}a{color:#2b6284}header{margin-bottom:24px}.eyebrow{letter-spacing:.16em;font-size:12px;color:#627088}.lead{max-width:1050px;color:#4e5d70}.links{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}.links a{background:white;padding:8px 14px;border:1px solid #d9e0e8;border-radius:6px;text-decoration:none}.links a:first-child{background:#293c55;color:white}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:24px 0}.metric{padding:15px 20px;background:white;border:1px solid #e0e4e9;border-radius:8px}.metric strong{font-size:28px;display:block}.metric span{color:#627088;font-size:13px}.notice{border-left:4px solid #9a793e;padding:12px 18px;background:#faf5e9;font-size:14px}.controls{background:#fff;padding:18px;display:flex;flex-wrap:wrap;align-items:end;gap:14px;border:1px solid #d9e0e8;border-radius:8px 8px 0 0;margin-top:26px}label{display:grid;font-size:13px;gap:5px;color:#526175}input,select{font:inherit;color:#243449;min-height:42px;border:1px solid #bdc8d5;border-radius:5px;padding:8px 10px;background:white}input[type=number]{width:95px}.search{flex:1;min-width:220px}.hint{font-size:13px;color:#627088;margin:10px 0}.table-wrap{overflow:auto;background:#fff;border:1px solid #d9e0e8;border-top:0}table{border-collapse:collapse;width:100%;font-size:14px}th,td{text-align:left;border-bottom:1px solid #e3e7ed;padding:11px 12px;vertical-align:top}th{background:#293c55;color:#fff;white-space:nowrap;font-weight:500}td.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.id{color:#6a7687;font-size:11px;display:block}td.name{min-width:150px}td.mechanic{min-width:300px}.tag{font-size:11px;padding:2px 7px;border-radius:4px;background:#edf1f5;white-space:nowrap}.tag.elite{background:#f4e5e9;color:#873b56}.locked{color:#88919e}.detail-row td{padding:0;border-bottom:0}.detail-row.open td{border-bottom:1px solid #b6c4d4}.detail-content{padding:18px 24px;background:#f1f5f8;display:grid;grid-template-columns:1fr 1fr;gap:18px}.detail-content h3{font-size:14px;margin:0 0 6px;color:#526175}.detail-content p,.detail-content li{font-size:13px;white-space:pre-wrap;overflow-wrap:anywhere}.detail-content ol{margin:0;padding-left:22px}.wide{grid-column:1/-1}.toggle{font:inherit;border:1px solid #aab9c8;border-radius:5px;background:#fff;color:#294f70;padding:7px 10px;min-height:38px;cursor:pointer;white-space:nowrap}footer{margin-top:28px;color:#526175;font-size:13px}.error{color:#aa3131}.notes{margin-top:26px;padding:22px;background:white;border:1px solid #d9e0e8;border-radius:8px}.notes li{margin:8px 0}code{font-size:12px;overflow-wrap:anywhere}@media(max-width:700px){main{padding:22px 14px 50px}h1{font-size:26px}.metrics{grid-template-columns:1fr 1fr}.detail-content{grid-template-columns:1fr}.controls{gap:10px}.search{flex-basis:100%}}
</style>
<main><header><div class="eyebrow">地牢搜打撤 / 内容设计 / 2026.10.29</div><h1>无尽地牢 · 怪物100种设计</h1><p class="lead">20个行为家族，每族4种普通变体、1种精英。按层级逐步引入机制；同族变体区别于目标选择、攻击形状、行动顺序或恢复窗口。Boss沿用独立模块。</p><div class="links"><a href="怪物100种_设计总表.xlsx">打开完整Excel</a><a href="怪物100种_完整表.csv">CSV完整表</a><a href="怪物100种_数据.json">JSON设计数据</a><a href="怪物层级与生成规则.json">层级与生成规则</a><a href="怪物算法参考.py">算法参考</a><a href="字段与能力依据.json">字段与能力依据</a></div></header>
<section class="metrics"><div class="metric"><strong>80</strong><span>普通怪物定义</span></div><div class="metric"><strong>20</strong><span>精英怪物定义</span></div><div class="metric"><strong>20</strong><span>行为家族</span></div><div class="metric"><strong>1–100</strong><span>离线数值推演层数</span></div></section>
<p class="notice"><b>使用边界：</b>生命、基础伤害、治愈、强固沿用已核实字段；本表取值是项目测试配置。范围、预告、次数和行动周期属于行为参数。所有新AI编排尚未接入运行时；外观源行只作复用线索，没有声称已制作100套独立美术。</p>
<section class="controls"><label class="search">搜索怪物或机制<input id="search" placeholder="名称、编号、机制、反制"></label><label>分类<select id="rank"><option value="">全部</option><option value="normal">普通</option><option value="elite">精英</option></select></label><label>行为家族<select id="family"><option value="">全部家族</option></select></label><label>推演层数<input id="floor" type="number" min="1" max="100" step="1" value="1"></label><label>推演波次<input id="wave" type="number" min="1" max="6" step="1" value="3"></label><label>显示范围<select id="eligibility"><option value="all">全部设计</option><option value="eligible">已达层波门槛</option></select></label></section>
<p id="count" class="hint" aria-live="polite"></p><div class="table-wrap"><table><thead><tr><th>怪物</th><th>分类 / 家族</th><th>解锁</th><th>生命</th><th>基础伤害</th><th>主动作伤害</th><th>治愈</th><th>强固</th><th>机制特点</th><th>完整细则</th></tr></thead><tbody id="rows"></tbody></table></div>
<p class="hint">伤害为无临时增益、目标减伤前的参考值；治疗、强固为一次施放量。未达门槛的行显示假设同层数值；实际生成还受预算、互斥、实体数量和空间验收限制。</p>
<section class="notes"><h2>层级与编队规则</h2><ul><li>第1层生命/伤害倍率均为1，第2层为1.45/1.22；第3层起每5层生命×1.20、伤害×1.08，按分数指数连续增长。深层曲线尚未通过玩家实测。</li><li>每层6波后进入独立Boss战。80:20是设计条数比例；精英出现仍按波次概率抽取，每波最多1只、每层最多2波且不连续。</li><li>精英生命×1.6、基础伤害×1.2、预算成本×1.6。父型基准值保持未乘状态，避免重复乘算。治疗与强固只跟随层生命倍率。</li><li>每波至少2个初始成员且包含前排，总预留实体位不超过6；卵、子体、残骸与路障都占位。后代不独立发金币、经验或物品。</li><li>强固消耗=min(当前强固，本次已计算减伤的伤害×0.5)，剩余伤害扣生命；接入时必须显式初始化既有“强固减伤%”字段。</li><li>新模式不继承源行的Boss标签、随机技能或旧层成长。不得用配置检查通过代替真实碰撞、可达安全落点及逐条能力验收。</li></ul></section>
<footer id="validation"></footer></main><script id="payload" type="application/json">__PAYLOAD__</script><script>
const {data,rules,report}=JSON.parse(document.querySelector('#payload').textContent);
const $=s=>document.querySelector(s),esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
for(const f of data.families)$('#family').insertAdjacentHTML('beforeend',`<option value="${f.id}">${esc(f.name)}</option>`);
const round=x=>Math.floor(x+.5);const expanded=new Set();
function detail(m){const b=m.behavior,cycle=m.cycle.map(s=>`<li><b>${esc(s.phase)} · ${s.turns}回合</b>：${esc(s.intent)}</li>`).join('');
const event=(m.event_branches||[]).map(e=>`<p><b>${esc(e.event)}${e.hp_ratio===undefined?'':` &lt; ${e.hp_ratio}`}</b>，仅触发一次；终态${esc(e.terminal)}</p><ol>${e.sequence.map(s=>`<li>${esc(s.phase)} · ${s.turns}回合：${esc(s.intent)}</li>`).join('')}</ol>`).join('');
const section=(t,v)=>`<div><h3>${t}</h3><p>${esc(v)}</p></div>`;
return `<div class="detail-content">${section('同族差异',m.difference)}${section('数值取舍',m.stat_rationale)}<div><h3>生前动作循环</h3><ol>${cycle}</ol></div><div><h3>一次事件分支</h3>${event||'<p>无；死亡后取消未执行动作。</p>'}</div>${section('目标与锁定',b.target_rule+'\n'+b.lock_rule)}${section('玩家反制',m.counterplay)}${section('行为参数',JSON.stringify(b.params,null,2))}${section('边界与禁配',m.limits+'\n硬禁配：'+(m.forbidden_with_families.join('、')||'按全局约束')+'\n组合风险：'+m.combo_risks.join('；'))}${section('编队与伤害来源',m.generation_tags.join(' / ')+'\n'+JSON.stringify(m.damage_source_by_action))}${section('实施任务',m.implementation)}${section('验收场景',m.acceptance)}${section('基型属性与预算',`HP ${m.base_stats.hp} / 基础伤害 ${m.base_stats.attack} / 治愈 ${m.base_stats.heal} / 强固 ${m.base_stats.fortify}\n主动作倍率 ${b.damage_ratio} / 预算基值 ${m.base_budget_cost} / 附属位预留 ${m.reserved_entity_slots}\n移动上限 ${b.move_tiles}格 / 行为范围 ${b.range_tiles}格；1格=256世界单位`)}${section('来源与精英对应',`外观源行：${m.source_visual_row}；敌人总表第${m.visual_provenance.source_sheet_row}行\n精英父型：${m.parent_id||'无'}\n${m.elite_delta||''}\n数值为项目测试值；能力与美术尚未运行验收。`)}</div>`;}
function render(){const f=Number($('#floor').value),w=Number($('#wave').value);if(!Number.isInteger(f)||f<1||f>100||!Number.isInteger(w)||w<1||w>6){$('#count').textContent='请输入1–100的整数层数、1–6的整数波次。';$('#count').className='hint error';$('#rows').innerHTML='';return;}
const g=rules.growth,h=f===1?g.floor1_hp:g.floor2_hp*g.hp_growth_per_step**((f-2)/g.floors_per_growth_step),a=f===1?g.floor1_attack:g.floor2_attack*g.attack_growth_per_step**((f-2)/g.floors_per_growth_step),q=$('#search').value.trim().toLowerCase();
const records=data.monsters.filter(m=>(!$('#rank').value||m.rank===$('#rank').value)&&(!$('#family').value||m.family_id===$('#family').value)&&(!q||[m.id,m.name,m.identity,m.difference,m.counterplay].join(' ').toLowerCase().includes(q))&&($('#eligibility').value==='all'||f>=m.unlock_floor&&w>=m.min_wave));
$('#count').className='hint';$('#count').textContent=`显示 ${records.length} / 100 条；推演第 ${f} 层、第 ${w} 波。已达层波门槛 ${records.filter(m=>f>=m.unlock_floor&&w>=m.min_wave).length} 条。`;
$('#rows').innerHTML=records.map(m=>{const elite=m.rank==='elite',ok=f>=m.unlock_floor&&w>=m.min_wave,b=m.base_stats,atk=round(b.attack*a*rules.waves.attack_factor[w-1]*(elite?rules.elite.attack_factor:1));const nums=[round(b.hp*h*rules.waves.hp_factor[w-1]*(elite?rules.elite.hp_factor:1)),atk,round(atk*m.behavior.damage_ratio),round(b.heal*h),round(b.fortify*h)];return `<tr data-id="${m.id}" class="${ok?'':'locked'}"><td class="name"><b>${esc(m.name)}</b><span class="id">${m.id}</span></td><td><span class="tag ${elite?'elite':''}">${elite?'精英':'普通'}</span><br>${esc(m.family_name)}</td><td>第${m.unlock_floor}层<br>第${m.min_wave}波起</td>${nums.map(x=>`<td class="num">${x}</td>`).join('')}<td class="mechanic">${esc(m.identity)}</td><td><button class="toggle" data-toggle="${m.id}" aria-expanded="${expanded.has(m.id)}">${expanded.has(m.id)?'收起':'展开'}</button></td></tr><tr class="detail-row ${expanded.has(m.id)?'open':''}" data-details="${m.id}" ${expanded.has(m.id)?'':'hidden'}><td colspan="10">${expanded.has(m.id)?detail(m):''}</td></tr>`}).join('');}
for(const id of ['search','rank','family','floor','wave','eligibility'])$('#'+id).addEventListener('input',render);
$('#rows').addEventListener('click',e=>{const b=e.target.closest('[data-toggle]');if(!b)return;expanded.has(b.dataset.toggle)?expanded.delete(b.dataset.toggle):expanded.add(b.dataset.toggle);render();});
$('#validation').innerHTML=`已通过 ${report.checks_passed} 项离线检查，覆盖 ${report.encounters_checked.toLocaleString()} 个编队样本；检查范围包括字段、配比、父型、层倍率、预算、禁配、事件去重与奖励守恒。<br>真实战斗能力、物理轨迹、存档崩溃恢复、独立美术和深层体验尚未验证。 <a href="离线检查结果.json">查看检查记录</a>`;render();
</script></html>'''
(O/'阅读入口.html').write_text(page.replace('__PAYLOAD__',payload))
readme='''无尽地牢怪物100种设计
日期：2026-10-29

先打开 阅读入口.html，可搜索、按家族筛选、切换层数与波次并展开完整机制。
完整表格：怪物100种_设计总表.xlsx（7张表：总表、机制细则、数值推演、层级出场、算法、来源、验收）。
AI接入：怪物100种_数据.json + 怪物层级与生成规则.json + 行为算法说明.json。
平面交换：怪物100种_完整表.csv，100条完整记录，含一次事件分支与禁配。

数值权威：JSON为本次设计快照。Excel黄色格用于推演；在Excel改动不会自动回写JSON或游戏。
普通80/精英20是内容条数，不是出怪概率。Boss独立，不计入100。
只有生命、基础伤害、治愈、强固4个基型数值；其他已存在增减伤键仅通过明确的临时来源适配。
新名称是工作名，源行只指向外观复用线索；不代表已有100套独立美术。
第1/2层保留旧倍率锚点，第3层起为新慢增长测试提案，未替换游戏运行配置。
所有新AI行为标记未运行验证。必须完成每条acceptance，不能用此处离线检查当作玩法通过。

算法参考可计算层/波属性、编队、奖励分摊、一次事件调度，不执行真实碰撞、投射或伤害。
在本文件夹运行：
python3 怪物算法参考.py
python3 核查设计.py

接入顺序：
1. 原字段适配：初始化强固减伤%和新模式零基线修饰，关闭源行随机技能/首领标签/旧层成长。
2. 新模式内容加载器：使用稳定ID、层波门槛、精英父型与一次倍率规则。
3. 真实战斗适配器：预告快照、动作执行、命中去重、来源位移取消、完整预警回合。
4. 一次事件及后代：存次数、实体位和根奖励账本，不能重复发奖或递归分裂。
5. 空间门：真实英雄半径、弹射路径、墙体和整个敌方响应共同验证安全落点。
6. 逐条场景验收后再做强度测试；旧6怪两层配置仍作为原参考保留。
'''
(O/'先读我.txt').write_text(readme)
print(O/'阅读入口.html')
