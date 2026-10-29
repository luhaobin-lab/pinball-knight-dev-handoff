"""Validate authored definitions and offline reference constraints; never substitutes for game QA."""
from pathlib import Path
import json, math, csv, hashlib, importlib.util
from collections import Counter

ROOT=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('monster_reference',ROOT/'怪物算法参考.py')
s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
M=s.MONSTERS;R=s.RULES;checks=[]
def check(name,ok,detail='',scope='离线设计与参考算法'):
    checks.append({'name':name,'pass':bool(ok),'detail':detail,'scope':scope})
    if not ok:raise AssertionError(name+': '+str(detail))

expected={f'MON_N{i:03}' for i in range(1,81)}|{f'MON_E{i:03}' for i in range(1,21)}
check('100条稳定ID、80普通/20精英、名称唯一',len(M)==100 and {m['id'] for m in M}==expected and Counter(m['rank'] for m in M)=={'normal':80,'elite':20} and len({m['name'] for m in M})==100)
families={f'F{i:02}' for i in range(1,21)}
check('20家族各4普通与1精英',all(Counter(m['rank'] for m in M if m['family_id']==f)=={'normal':4,'elite':1} for f in families))
allowed_phases={'telegraph','execute','recover','move_melee','support','spawn','guard','relocate'}
required=['id','name','rank','family_id','family_name','parent_id','theme','role','unlock_floor','min_wave','base_stats','base_budget_cost','source_visual_row','identity','difference','behavior','cycle','counterplay','combo_risks','limits','implementation','acceptance','stat_rationale']
for m in M:
    assert all(k in m and m[k] is not None for k in required if k!='parent_id'),m['id']
    assert set(m['base_stats'])=={'hp','attack','heal','fortify'},m['id']
    assert all(type(v) in (int,float) and math.isfinite(v) and v>=0 for v in m['base_stats'].values()) and m['base_stats']['hp']>0,m['id']
    assert type(m['unlock_floor']) is int and 1<=m['unlock_floor']<=22,m['id']
    assert type(m['min_wave']) is int and 1<=m['min_wave']<=6,m['id']
    assert m['family_id'] in families and set(m.get('forbidden_with_families',[]))<=families,m['id']
    assert 1.5<=m['base_budget_cost']<=5.5 and 0<=m['reserved_entity_slots']<=2,m['id']
    b=m['behavior'];assert 0<=b['move_tiles']<=2 and 0<=b['range_tiles']<=5 and 0<=b['damage_ratio']<=2,m['id']
    assert m['cycle'] and all(x['phase'] in allowed_phases and type(x['turns']) is int and x['turns']>=1 and x['intent'] for x in m['cycle']),m['id']
    assert sum(x['turns'] for x in m['cycle'])<=12,m['id']
    assert m['design_enabled'] is True and m['runtime_validation']=='not_yet_verified',m['id']
    assert not m['inherits_source_growth'] and not m['inherits_source_random_skills'] and not m['inherits_source_boss_tags'],m['id']
check('实体数值仅4个已核字段，行为参数与运行状态分离',True,'hp/attack/heal/fortify；范围/计数属于AI参数；全部100条标未运行验证')

audit=json.loads((ROOT/'字段与能力依据.json').read_text())
rows={r['row_name']:r for r in audit['source_inventory']['all_rows']}
check('外观候选均有正式源记录，未使用测试/宝箱行冒充怪物',all(m['source_visual_row'] in rows and rows[m['source_visual_row']]['runtime_present'] and rows[m['source_visual_row']]['classification']!='测试/占位' and rows[m['source_visual_row']]['classification']!='宝箱/地形' for m in M),'记录存在不等于视觉/动画已验收')
check('伤害来源和类型只使用已存在枚举',all(m['damage_type'] in audit['damage_enums']['types'] and m['damage_source'] in audit['damage_enums']['sources'] for m in M))
check('变体按实际编队标签计数，远程变体不冒充前排',all(s.has_tag(s.BY_ID[i],'ranged_damage') and not s.has_tag(s.BY_ID[i],'frontline') for i in ['MON_N038','MON_N064','MON_N066']) and not s.compatible([s.BY_ID['MON_N013'],s.BY_ID['MON_N017']],s.BY_ID['MON_N038'],11),'射线姿态、复生射手、瞬移射手都提前占远程名额；具体字段不是数值属性')
check('伤害分支来源有明确映射且沿用已有枚举',all(all(v in audit['damage_enums']['sources'] for v in m['damage_source_by_action'].values()) for m in M) and s.BY_ID['MON_N038']['damage_source']=='投射物' and s.BY_ID['MON_N066']['damage_source']=='投射物' and s.BY_ID['MON_N064']['damage_source_by_action']['revived_shot']=='投射物')
for m in M:
    if m['rank']=='elite':
        p=s.BY_ID[m['parent_id']]
        assert p['rank']=='normal' and p['family_id']==m['family_id'] and p['base_stats']==m['base_stats'] and p['base_budget_cost']==m['base_budget_cost'],m['id']
        assert m.get('elite_delta') and m['min_wave']>=3,m['id']
check('20精英父型有效，基型值未预乘，额外机制有说明',True,'层/波/精英各乘一次；治疗/强固不额外乘精英或波')
signatures=[]
for m in M:
    b=m['behavior']
    signatures.append(json.dumps({'family':m['family_id'],'params':b['params'],'target':b['target_rule'],'lock':b['lock_rule'],'cycle':m['cycle'],'events':m.get('event_branches',[])},ensure_ascii=False,sort_keys=True))
check('行为定义有独立配置与同族差异，不以生命/伤害值区分',len(set(signatures))==100 and len({m['behavior']['pattern'] for m in M})==100 and all(len(m['difference'])>=12 and len(m['counterplay'])>=10 and len(m['acceptance'])>=15 for m in M),'这是结构检查；实际策略差异仍须逐条场景验证')

event_count=0
for m in M:
    for turn in range(1,3*sum(x['turns'] for x in m['cycle'])+1):assert s.phase_at(m,turn)['phase'] in allowed_phases
    for i,b in enumerate(m.get('event_branches',[])):
        event_count+=1
        assert b['event'] in ['first_lethal_hit','hp_crosses_below'] and b['once'] is True and b['terminal'] in ['despawn','remain_alive','revive'],m['id']
        assert b['sequence'] and all(x['phase'] in allowed_phases and type(x['turns']) is int and x['turns']>=1 for x in b['sequence']),m['id']
        if b['event']=='hp_crosses_below':assert 0<b['hp_ratio']<1,m['id']
        actual_ratio=b['hp_ratio']-0.01 if b['event']=='hp_crosses_below' else None
        state,done=s.begin_event_branch(m,{},b['event'],m['id']+'/event',hp_ratio=actual_ratio,player_turn=10)
        assert done
        duplicate,done2=s.begin_event_branch(m,state,b['event'],m['id']+'/event',hp_ratio=actual_ratio)
        assert not done2 and state==duplicate
        duration=sum(x['turns'] for x in b['sequence'])
        for turn_index in range(10,10+duration):
            state,action=s.advance_event_branch(m,state,turn_index)
            unchanged,duplicate_action=s.advance_event_branch(m,state,turn_index)
            assert unchanged==state and duplicate_action is None
        assert action['terminal_after_action']==b['terminal'] and state['active_branch'] is None
        again,done3=s.begin_event_branch(m,state,b['event'],m['id']+'/event-again',hp_ratio=actual_ratio)
        assert not done3
        assert s.event_phase_at(m,i,duration+1)['phase']=='complete'
        assert s.event_phase_at(m,i,duration+10)['phase']=='complete'
check('生前周期与一次事件分支分开，重复事件不重新触发',True,{'event_branches':event_count,'boundary':'仅调度定义，未执行真实死亡/复生消费者'})

for m in M:
    for b in m.get('event_branches',[]):
        ratio=b.get('hp_ratio',0.5)-0.01
        if b['event']=='hp_crosses_below':
            _,triggered=s.begin_event_branch(m,{},b['event'],'equal-threshold',hp_ratio=b['hp_ratio'],player_turn=10)
            assert not triggered,m['id']
        state,triggered=s.begin_event_branch(m,{},b['event'],'warning-test',hp_ratio=ratio,player_turn=10)
        assert triggered
        state,first=s.advance_event_branch(m,state,10)
        warning_turns=0
        for x in b['sequence']:
            if x['phase']!='telegraph':break
            warning_turns+=x['turns']
        if warning_turns:assert first['phase']=='telegraph',m['id']
        cancelled,action=s.advance_event_branch(m,state,10,cancel_reason='corpse_or_caster_removed')
        assert cancelled['active_branch'] is None and action['phase']=='cancelled',m['id']
        assert cancelled['used_branch_indices']==state['used_branch_indices'],m['id']
check('严格血量阈值、完整事件预警与同轮取消保留一次账本',True,'等于阈值不触发；出生当次只预警；同轮重复推进不会屏蔽取消')
check('末只根怪死亡仍等待分裂/复生，终止后才可清波',not s.can_clear_wave([],['root/split']) and not s.can_clear_wave([],['root/revive']) and not s.can_clear_wave(['child'],[]) and s.can_clear_wave([],[]),'只测清波门；实际死亡、实体注册与事件账本须在运行时同一事务内更新')
check('复生射手切换声明的第二形态周期',s.phase_at(s.BY_ID['MON_N064'],1)['phase']=='move_melee' and s.phase_at(s.BY_ID['MON_N064'],1,revived=True)['phase']=='telegraph' and s.phase_at(s.BY_ID['MON_N064'],2,revived=True)['phase']=='execute','阶段选择参考；尚未运行投射物和角色重建')

assert s.growth(1)=={'hp':1.0,'attack':1.0}
assert s.growth(2)=={'hp':1.45,'attack':1.22}
for f in range(1,101):
    a=s.growth(f);assert all(math.isfinite(v) and v>0 for v in a.values())
    if f>1:assert a['hp']>s.growth(f-1)['hp'] and a['attack']>s.growth(f-1)['attack']
    for m in M:
        st=s.stats(m,f,3)
        assert st['hp']>=1 and all(type(st[k]) is int and st[k]>=0 for k in ['hp','attack','heal','fortify','action_damage_before_target_reduction'])
        if f>1:
            before=s.stats(m,f-1,3);assert all(st[k]>=before[k] for k in ['hp','attack','heal','fortify'])
check('1至100层有限且单调，F1/F2锚点不变',True,{f:s.growth(f) for f in [1,2,5,10,20,50,100]},'数值算术；不等于深层平衡')
check('同基型下层开场的生命/伤害倍率低于上层第6波',all(s.growth(f+1)['hp']*R['waves']['hp_factor'][0]<s.growth(f)['hp']*R['waves']['hp_factor'][-1] and s.growth(f+1)['attack']*R['waves']['attack_factor'][0]<s.growth(f)['attack']*R['waves']['attack_factor'][-1] for f in range(1,100)),'换怪种和房间后的真实压力仍需实测')
for bad in [0,-1,101,1.5,True]:
    try:s.growth(bad)
    except ValueError:pass
    else:raise AssertionError('unsupported floor accepted')
check('非法层数明确拒绝，未静默钳制',True)

for m in M:
    assert any(n['rank']=='normal' and (s.has_tag(m,'frontline') or s.has_tag(n,'frontline')) and s.compatible([m],n,11) for n in M),m['id']
check('全部100条在解锁后都有合法预算/占位配对',True,'至少有一个普通前排/第二成员配对；不证明实际空间安全')

N=200;floors=[1,2,3,5,8,12,20,50,100];observed=set();elite_total=0;encounters=0
for seed in range(N):
    for floor in floors:
        data=s.generate_floor(seed,floor,f'check-{seed}-{floor}');previous=False
        assert data['elite_waves']<=2
        for wave in data['waves']:
            encounters+=1;ids=[x['id'] for x in wave['members']];members=[s.BY_ID[i] for i in ids];observed.update(ids)
            assert len(ids)>=2 and len(set(ids))==len(ids)
            assert any(s.has_tag(m,'frontline') for m in members)
            assert wave['spent']<=wave['budget']+1e-8 and wave['reserved_actor_slots']<=6
            assert not (previous and wave['elite_present']);previous=wave['elite_present'];elite_total+=previous
            built=[]
            for m in members:
                assert m['unlock_floor']<=floor and m['min_wave']<=wave['wave']
                assert s.compatible(built,m,wave['budget']);built.append(m)
            if wave['wave']==1:assert all(m['family_id']=='F01' and m['rank']=='normal' for m in members)
            assert abs(sum(x['reward_weight'] for x in wave['members'])-1)<1e-12
            rewards=s.allocate_rewards(137,89,wave)
            assert rewards['clear_gold']+sum(x['gold'] for x in rewards['members'])==137
            assert sum(x['xp'] for x in rewards['members'])==89
            assert len({x['reward_event_id'] for x in rewards['members']})==len(members)
check('多层编队符合预算、实体预留、数量、精英与禁配限制',True,{'seeds':N,'floors':floors,'encounters':encounters,'observed_definitions':len(observed),'unobserved_ids':sorted(expected-observed)})
check('波奖励按初始成员分摊守恒，后代无独立奖励',True,'137金币/89经验固定边界输入；实际波总额由原经济模块提供')
a=s.generate_floor(42,20,'same');noise=s.RNG(13)
for _ in range(1000):noise.u32()
b=s.generate_floor(42,20,'same');assert a==b
r=s.RNG(1);vectors=[r.u32() for _ in range(5)];assert vectors==[270369,67634689,2647435461,307599695,2398689233]
state=r.state;assert r.u32()==s.RNG(state).u32()
check('确定性随机重放与保存恢复一致',True,'FNV-1a UTF-8 + xorshift32，独立domain，不读取玩家战力')
check('强固按0.5分担而非全额护盾',s.fortify_split(30,20)=={'hp_loss':15.0,'fortify_after':5.0} and s.fortify_split(30,10)=={'hp_loss':20,'fortify_after':0} and s.fortify_split(30,20,False)=={'hp_loss':30,'fortify_after':20},'数学参考；实际消费者缺键初始化仍待接入')
with (ROOT/'怪物100种_完整表.csv').open(encoding='utf-8-sig',newline='') as f:csv_rows=list(csv.DictReader(f))
check('CSV完整保留100条、稳定ID及一次事件分支',len(csv_rows)==100 and {x['编号'] for x in csv_rows}==expected and all(json.loads(row['一次事件分支JSON'])==s.BY_ID[row['编号']].get('event_branches',[]) and row['数值取舍']==s.BY_ID[row['编号']]['stat_rationale'] for row in csv_rows))

report={'date':'2026-10-29','status':'offline_design_checks_passed','checks':checks,'checks_passed':len(checks),
        'encounters_checked':encounters,'elite_waves_observed':elite_total,'definitions_observed':len(observed),
        'not_validated':['real combat ability execution','real collision and safe trajectories','native persistent save crash recovery','100 independent art assets','player fun and deep-floor balance'],
        'data_sha256':hashlib.sha256((ROOT/'怪物100种_数据.json').read_bytes()).hexdigest()}
(ROOT/'离线检查结果.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'checks_passed':len(checks),'encounters_checked':encounters,'definitions_observed':len(observed),'runtime':'not_tested'},ensure_ascii=False))
