"""Make an offline reading copy and numeric plots from the authoritative text/JSON."""
from pathlib import Path
import html, json, re, shutil
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager

R=Path(__file__).resolve().parents[1]
B=json.loads((R/'03_数值与配置/balance.json').read_text())
enchants=json.loads((R/'03_数值与配置/enchants.json').read_text())
assert len(enchants['enchants'])==50 and all(e['design_enabled'] for e in enchants['enchants'])
report=json.loads((R/'05_验证与评审/最终离线检查.json').read_text())
out=R/'05_验证与评审/图表';out.mkdir(exist_ok=True)
plt.rcParams.update({'font.family':'DejaVu Sans','axes.spines.top':False,'axes.spines.right':False,'figure.facecolor':'#faf8f3','axes.facecolor':'#faf8f3','axes.labelcolor':'#2a373d','text.color':'#2a373d','xtick.color':'#2a373d','ytick.color':'#2a373d'})
font_path=Path('/System/Library/Fonts/Hiragino Sans GB.ttc')
if font_path.exists():
    font_manager.fontManager.addfont(str(font_path))
    plt.rcParams['font.family']=font_manager.FontProperties(fname=str(font_path)).get_name()
fig,ax=plt.subplots(figsize=(11.5,4.4))
values=report['mean_total_enemy_hp_by_wave']['1']+[450]+report['mean_total_enemy_hp_by_wave']['2']+[680]
labels=[f'1-{i}' for i in range(1,7)]+['Boss 1']+[f'2-{i}' for i in range(1,7)]+['Boss 2']
ax.plot(range(14),values,'o-',color='#244f5c',lw=2.5)
ax.axvspan(6.5,8.5,color='#b9d9c4',alpha=.4)
for i in [6,13]:ax.scatter(i,values[i],s=85,color='#a84b3b',zorder=4)
ax.set_xticks(range(14),labels);ax.set_ylabel('敌方总生命');ax.set_title('两层生命节奏：开场回落，然后逐步加压',loc='left',pad=15)
ax.text(.01,.96,'普通波：生成编队生命总和的均值。Boss：配置生命。\n这里只反映生命量，不代表实战难度或胜率。',transform=ax.transAxes,va='top',fontsize=10,color='#5b686d')
ax.grid(axis='y',alpha=.15);fig.tight_layout();fig.savefig(out/'两层生命节奏.png',dpi=170);plt.close(fig)
ledger=report['novice_ledger'];xs=[0]+[x['attempt'] for x in ledger]
fig,axes=plt.subplots(1,2,figsize=(11.5,4.2))
for ax,key,base,label,color in [(axes[0],'attack',30,'基础攻击','#a84b3b'),(axes[1],'hp',180,'生命上限','#244f5c')]:
    vals=[base]+[x[key] for x in ledger];ax.plot(xs,vals,'o-',color=color,lw=2.5);ax.set_title(label,loc='left');ax.set_xlabel('尝试次数（每次清三波后死亡）');ax.set_xticks([0,2,4,6,8,10]);ax.grid(axis='y',alpha=.15)
fig.suptitle('永久成长账本：不计装备、出售或精英额外收益',x=.08,ha='left',fontsize=12)
fig.tight_layout();fig.savefig(out/'失败成长账本.png',dpi=170);plt.close(fig)

def table(headers,rows):
    return '<table><thead><tr>'+''.join('<th>'+html.escape(str(x))+'</th>' for x in headers)+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+html.escape(str(x))+'</td>' for x in row)+'</tr>' for row in rows)+'</tbody></table>'
def textdoc(path):
    text=path.read_text();blocks=[]
    for para in text.strip().split('\n\n'):
        first=para.splitlines()[0]
        if re.match(r'^\d+[.、] ',first):
            rest='\n'.join(para.splitlines()[1:]);blocks.append('<h3>'+html.escape(first)+'</h3>'+('<p>'+html.escape(rest).replace('\n','<br>')+'</p>' if rest else ''))
        else:blocks.append('<p>'+html.escape(para).replace('\n','<br>')+'</p>')
    return ''.join(blocks)

docs=sorted((R/'02_设计文档').glob('*.txt'))
extras=[R/'01_研究与依据/游玩心流与模块取舍.txt',R/'01_研究与依据/DungeonBound公开机制研究.txt',R/'06_AI实施交接/实施顺序与验收.txt',R/'05_验证与评审/设计决策与失败场景.txt']
sections=[];nav=[]
for i,p in enumerate(docs+extras):
    title=p.stem
    sid=f'doc{i}';nav.append(f'<a href="#{sid}">{html.escape(title)}</a>')
    sections.append(f'<section id="{sid}"><div class="eyebrow">文档 {i+1:02d}</div><h2>{html.escape(title)}</h2><a class="source" href="{p.relative_to(R).as_posix()}">打开原始文本</a>{textdoc(p)}</section>')

items=json.loads((R/'03_数值与配置/items.json').read_text());talents=json.loads((R/'03_数值与配置/talents.json').read_text())
numeric=table(['波次','预算','HP倍率','攻击倍率','金币','经验'],[[i+1]+[B['waves'][k][i] for k in ['budget','hp_factor','attack_factor','gold','xp']] for i in range(6)])
numeric+=table(['物品ID','名称','占行','基础购入价','来源'],[[i['id'],i['name'],i['height_rows'],i['base_price'],i['source_row_id']] for i in items])
effect_names={'base_attack_flat':'基础伤害','max_hp_fraction':'最大生命','bounce_distance_flat':'弹射距离','damage_reduction':'伤害减免','xp_fraction':'获得经验','weapon_crit_chance':'武器暴击率','turn_start_armor_hp_fraction':'最大生命转为回合开始强固','turn_start_heal_hp_fraction':'最大生命转为回合开始治疗','armor_item_charge_fraction':'强固物品充能','elite_boss_damage_fraction':'精英/Boss伤害','bleed_item_charge_fraction':'流血物品充能'}
def effect_text(t):
    v=t['per_rank'];amount=('+'+str(v)) if t['effect'] in ['base_attack_flat','bounce_distance_flat'] else '+'+f'{v*100:g}'+'%'
    return amount+' '+effect_names[t['effect']]
numeric+=table(['天赋','每级新效果','等级上限','角色最低等级'],[[t['name'],effect_text(t),t['rank_cap'],t['hero_level_min']] for t in talents])
enchant_rows=[]
for floor in [1,2,5,10]:
    factor=1+B['enchant']['floor_factor_growth']*(floor-1)
    weights=[base*factor**tier for tier,base in enumerate(B['enchant']['tier_base_weights'])]
    enchant_rows.append([floor]+[f'{weight/sum(weights)*100:.4f}%' for weight in weights])
numeric+='<h3>格子附魔：免费二选一</h3><p>服务出现仍走原随机算法，普通出征可能整层没有附魔。遇到节点后，每个选项先按档级权重抽档，再从该档定义中等权抽取；两个选项ID不同。所有50种纳入首版开发范围，当前装备不影响抽选。</p>'
numeric+=table(['地牢层','普通','精良','稀有','史诗','传说'],enchant_rows)
numeric+='<p>上表是每个选项的边际档级概率，不是单节点必得概率。低层所有档级都有机会；跨重抽、跨节点允许重复，没有高阶保底。具体概率是可调整测试值，第三层以后尚未做游戏平衡验证。</p>'
numeric+=table(['服务项目','当前规则'],[['初次领取','免费二选一；每节点领取一次，可跳过'],['重抽费用',' / '.join(str(x)+'金币' for x in B['enchant']['refresh_costs'])+'；首价是可调测试值'],['重抽次数',f"每节点最多{B['enchant']['refresh_limit']}次，替换整组两个选项；领取后关闭重抽"],['已有格符文','确认后覆盖；同一格只保存一个符文'],['跨出征','Boss成功保留原行，下次继承；死亡/放弃全部清空']])
numeric+='<p><a href="03_数值与配置/enchants.json">打开50种完整定义与适配状态</a>。全部启用是开发范围，不等于50种已在游戏中验证通过。</p>'

body='''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>地牢搜打撤 GDD v0.2</title><style>
:root{--ink:#24383f;--muted:#637276;--accent:#9a493b;--paper:#faf8f3;--line:#deded4}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--paper);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif;line-height:1.85;overflow-wrap:anywhere}nav{position:fixed;left:0;top:0;bottom:0;width:258px;padding:30px 23px;border-right:1px solid var(--line);overflow:auto}nav strong{font-size:19px}nav a{display:block;font-size:13px;color:var(--muted);text-decoration:none;padding:8px 0;border-bottom:1px solid #e8e6de}nav a:hover{color:var(--accent)}main{max-width:1170px;padding:55px 58px 90px;margin-left:258px}h1{font-size:42px;letter-spacing:-1px;line-height:1.25;margin:15px 0 20px}h2{font-size:28px;line-height:1.4;margin:8px 0 10px}h3{font-size:20px;margin:30px 0 10px}p{font-size:16px;margin:17px 0;white-space:normal}.eyebrow{font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--accent)}.lead{font-size:19px;max-width:850px}.note{border-left:3px solid var(--accent);background:#f1ede5;padding:16px 22px;font-size:14px;margin:28px 0}.facts{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin:32px 0}.facts div{border-top:2px solid var(--ink);padding-top:12px}.facts b{font-size:26px;display:block}.facts span{color:var(--muted);font-size:13px}section{border-top:1px solid var(--line);margin-top:55px;padding-top:42px;scroll-margin-top:20px}.source,a{color:#226578}.source{font-size:13px}img{width:100%;height:auto;margin:12px 0}figcaption{font-size:13px;color:var(--muted)}figure{margin:28px 0}table{border-collapse:collapse;width:100%;font-size:13px;margin:25px 0}th{text-align:left;background:#e8ece7}td,th{padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:top}tr:nth-child(even){background:#f3f1ea}td:last-child{word-break:break-word}footer{margin-top:60px;color:var(--muted);font-size:13px}@media(max-width:1000px){nav{position:static;width:auto;border-right:0;border-bottom:1px solid var(--line)}nav a{display:inline-block;margin-right:15px}main{margin:0;padding:30px 22px}.facts{grid-template-columns:1fr 1fr}h1{font-size:34px}table{display:block;overflow:auto}}@media print{nav{display:none}main{margin:0;padding:0}section{break-before:page}.source{display:none}}
</style><nav><strong>地牢搜打撤</strong><p style="font-size:12px">GDD v0.2 · 50种附魔与免费重抽修订</p><a href="#overview">阅读起点</a><a href="#curves">难度与成长曲线</a><a href="#numbers">核心配置表</a>'''+''.join(nav)+'''<a href="05_验证与评审/检查结果.txt">最终离线检查</a><a href="先读我.txt">文件夹说明</a></nav><main><header id="overview"><div class="eyebrow">Design proposal / prototype</div><h1>带着战利品回来，<br>带着成长再次出发。</h1><p class="lead">两层弹射搜打撤原型。战斗、摸箱、商人和加工交替推进；Boss收尾。失败失去随身装备，金币、经验与永久培养留下。</p><div class="facts"><div><b>2 × 6</b><span>两层，每层六波小怪＋Boss</span></div><div><b>14 / 11</b><span>基础物品 / 改版天赋节点</span></div><div><b>6 / 6</b><span>怪物行为 / 房间模板</span></div><div><b>50</b><span>格子附魔；免费二选一，付费重抽</span></div></div><div class="note">这是设计稿、配置和可重跑算法参考。新参数已做离线检查；真实战斗、UI、存档崩溃恢复和玩家心流还需要在实现后验证。原始表格和游戏代码未修改。</div></header><section id="curves"><div class="eyebrow">Pacing and progression</div><h2>先让装备发挥，再把压力抬起来</h2><figure><img src="05_验证与评审/图表/两层生命节奏.png" alt="两层怪物生命总量曲线"><figcaption>普通波取生成样本的总HP均值，Boss取配置HP；这不是实战难度或胜率。绿色区是第二层开场缓和段。</figcaption></figure><figure><img src="05_验证与评审/图表/失败成长账本.png" alt="重复失败后的基础攻击与生命增长"><figcaption>每次仅通过前三波后死亡，保留45金币与90经验，按明确策略升级力量/体质。没有计入装备、出售或精英额外收益；证明经济可达性，不承诺必然通关。</figcaption></figure></section><section id="numbers"><div class="eyebrow">Configuration overview</div><h2>初始测试参数</h2><p>完整参数以03_数值与配置中的JSON为准。这里是读取JSON生成的便览。</p>'''+numeric+'</section>'+''.join(sections)+'''<footer>研究来源、审计、算法、配置和评审都在同一文件夹。先审核心循环与工作决定，再看数值；确认后可直接交给AI按06目录分阶段实施。</footer></main></html>'''
(R/'阅读入口.html').write_text(body)
print(R/'阅读入口.html')
