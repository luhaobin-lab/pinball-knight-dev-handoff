"""Offline checks for the GDD model. Does not claim combat, browser or fun validation."""
from pathlib import Path
from copy import deepcopy
import json, math, statistics, hashlib
import systems_reference as s

R=s.ROOT; checks=[]
def check(name, ok, detail=''):
    checks.append({'name':name,'pass':bool(ok),'detail':detail})
    if not ok: raise AssertionError(name+': '+str(detail))

N=1500
elite_waves=0;special_count=0;rooms=set();enemy_types=set();floor_stats={1:[],2:[]}
for seed in range(N):
    for floor in [1,2]:
        run=s.example_run(seed,floor,f'run-{seed}-{floor}')
        previous_elite=False;ec=0;last_room=None
        hp_sums=[]
        for w in run['waves']:
            e=w['encounter'];members=e['members'];room=w['room'];wave=w['wave']
            assert len(members)<=s.B['waves']['enemy_count_max'] and len(members)>=2
            assert e['spent']<=e['budget']+1e-8
            assert sum(m['role']=='ranged' for m in members)<=s.B['waves']['ranged_max']
            assert sum(m['role']=='healer' for m in members)<=s.B['waves']['healer_max']
            assert not (previous_elite and e['elite'])
            assert sum(m['elite'] for m in members)<=1
            assert any(m['role'] in ['melee','fast','guard','brute'] for m in members)
            ec+=e['elite'];previous_elite=e['elite'];elite_waves+=e['elite']
            assert room['id']!=last_room;last_room=room['id'];rooms.add(room['id'])
            assert wave!=1 or room['id']=='ROOM_OPEN'
            assert wave!=1 or all(m['role'] in ['melee','fast'] for m in members)
            assert len(s.reachable(room))==room['width']*room['height']-len(room['blocked'])
            assert len({tuple(m['position']) for m in members})==len(members)
            assert all(tuple(m['position']) in s.reachable(room) and math.dist(m['position'],room['hero_spawn'])>=2 for m in members)
            assert sum(m['kill_gold'] for m in members)+e['clear_gold']==e['rewards']['gold']
            assert sum(m['kill_xp'] for m in members)==e['rewards']['xp']
            assert len({m['instance_id'] for m in members})==len(members)
            assert all(m['instance_id'].startswith(run['run_id']+'/') for m in members)
            for m in members:enemy_types.add(m['id'])
            offers=w['chest']['offers'];assert len({x['definition'] for x in offers})==3
            assert w['chest']['low_streak_after']<=3
            if wave==1:assert any(next(i for i in s.ITEMS if i['id']==o['definition'])['category']=='weapon' for o in offers)
            shelf=w['shop'];assert len(shelf)==6 and len({x['definition'] for x in shelf})==6
            categories=[next(i for i in s.ITEMS if i['id']==o['definition'])['category'] for o in shelf]
            assert 'weapon' in categories and 'defense' in categories and categories.count('consumable')==2
            special_count+=bool(w['special']['kind']);assert w['special']['misses']<=2
            hp_sums.append(sum(m['hp'] for m in members))
        assert ec<=2
        floor_stats[floor].append(hp_sums)
check('3000 complete six-wave plans: room, composition, budget, reward conservation and shop constraints',True,f'{N*2*6} encounters')
check('all six templates and six enemy roles reached',len(rooms)==6 and len(enemy_types)==6)

for seed in range(500):
    a=s.example_run(seed,1,'tutorial',True)
    assert a['waves'][1]['special']['kind']=='forge'
    assert a['waves'][3]['special']['kind']=='enchant'
    for f in [1,2]:
        chest=s.chest(s.RNG(seed),f,4,3)
        assert max(x['tier'] for x in chest['offers'])>=2
        boss=s.chest(s.RNG(seed),f,6,0,boss=True)
        assert max(x['tier'] for x in boss['offers'])>=2 and boss['picks']==2
check('tutorial services and forced rare/Boss chest',True,'500 seeds, both floors for chests')
ordinary=s.example_run(25,1,'zero-enchant-proof',False)
ordinary_kinds=[w['special']['kind'] for w in ordinary['waves']]
check('ordinary floor can contain zero enchant services',ordinary_kinds.count('enchant')==0 and ordinary_kinds.count('forge')>0,{'seed':25,'run_id':'zero-enchant-proof','special_kinds':ordinary_kinds})

# Exact reproducibility and stream isolation, not screenshots.
a=s.example_run(99,2,'same')
for _ in range(150):s.stream(99,'same',2,1,'shop',_).u32()
b=s.example_run(99,2,'same')
check('same seed/input/version produces identical plans after unrelated shop random draws',a==b)
ra=s.RNG(1);known=[ra.u32() for _ in range(5)]
check('xorshift32 public reference vector seed=1',known==[270369,67634689,2647435461,307599695,2398689233],known)
saved=ra.state;nextval=ra.u32();check('RNG save/restore repeats next result exactly',s.RNG(saved).u32()==nextval)

# Check configurable parameters actually drive behavior; restore after each isolated test.
orig=deepcopy(s.B)
s.B['special']['base_probability']=0
check('special probability zero yields no ordinary random service',all(s.special_node(s.RNG(k+1),1,0)['kind'] is None for k in range(100)))
s.B['special']['base_probability']=1
check('special probability one yields a service',all(s.special_node(s.RNG(k+1),1,0)['kind'] for k in range(100)))
s.B=deepcopy(orig);s.B['progression']['xp_threshold_base']=10;s.B['progression']['points_each_level']=2
check('XP threshold and skill points are configurable',s.gain_xp(1,0,0,10)==(2,0,2))
s.B=deepcopy(orig);s.B['forge']['attempts_per_visit']=1
check('forge attempt cap is configurable',not s.forge(s.RNG(1),0,100,1)['ok'])
s.B=deepcopy(orig)
s.B['loot']['normal_choices']=4;s.B['loot']['normal_picks']=2
adjusted_chest=s.chest(s.RNG(17),1,1)
check('chest count and pick limit read configuration',len(adjusted_chest['offers'])==4 and adjusted_chest['picks']==2)
s.B=deepcopy(orig);s.B['shop']['equipment_offers']=5
check('shop shelf count reads configuration',len(s.shop(s.RNG(17),1,3))==7)
s.B=deepcopy(orig)

for item in s.ITEMS:
    for q in range(item['tier_min'],item['tier_max']+1):
        assert s.sale_price(item,q)<s.buy_price(item,q,s.B['shop']['discount_cap'])
        if q<item['tier_max']:
            assert s.sale_price(item,q+1)<2*s.buy_price(item,q,0.2)+10*q
        if item['charges_max']:
            assert s.sale_price(item,q,0)==0
check('all configured buy/sell/merge loops have negative direct gold return',True,'This does not simulate every source item effect; money-producing items excluded')

for seed in range(1000):
    for rank in range(3):
        out=s.forge(s.RNG(seed),rank,1000,0)
        assert out['gold']==1000-s.B['forge']['cost'][rank]
        assert out['rank'] in [max(0,rank-1),rank+1] and out['attempts']==1
    assert not s.forge(s.RNG(seed),0,0,0)['ok']
    assert not s.forge(s.RNG(seed),3,1000,0)['ok']
    assert not s.forge(s.RNG(seed),0,1000,3)['ok']
check('forge 3000 result transitions and failure boundaries',True)

forge_samples=[]
for seed in range(10000):
    rng=s.RNG(seed+12345);rank=0;spent=0
    while rank<3:
        cost=s.B['forge']['cost'][rank];spent+=cost
        rank=rank+1 if rng.unit()<s.B['forge']['success_chance'][rank] else max(0,rank-1)
    forge_samples.append(spent)
forge_samples.sort()

# In-memory settlement invariants. Real persistence is explicitly not covered.
p={'gold':123,'level':3,'xp':11,'skill_points':2,'talents':{'力量':2},'stash':[{'id':'safe'}],'camp_items':[],'enchanted_rows':{},'unlocked_floor':1,'applied_commands':[],'first_clear_claimed':[]}
r={'floor':1,'items':[{'id':'risk'}],'enchanted_rows':{'0':'E001'},'hero':{'battle_temporary_state':{'shield':10,'charge_progress':2}},'settled':False}
for outcome in ['death','abandon','victory']:
    r['victory_locked']=r['boss_chest_resolved']=(outcome=='victory')
    p1,r1,applied=s.finish_adventure(p,r,outcome,'finish/1')
    assert applied and not r1['items'] and not r1['enchanted_rows']
    assert p1['enchanted_rows']==(r['enchanted_rows'] if outcome=='victory' else {})
    assert not r1['hero']['battle_temporary_state'] and 'hero' not in p1
    for key in ['level','xp','skill_points','talents','stash']:assert p1[key]==p[key]
    assert p1['gold']==p['gold']+(s.B['boss_rewards']['first_clear_bonus_gold'] if outcome=='victory' else 0)
    assert len(p1['camp_items'])==(1 if outcome=='victory' else 0)
    p2,r2,applied2=s.finish_adventure(p1,r1,outcome,'finish/1');assert not applied2 and p2==p1 and r2==r1
    p3,r3,applied3=s.finish_adventure(p1,r1,outcome,'finish/other');assert not applied3 and p3==p1 and r3==r1
check('death/abandon/victory settlement retention and duplicate protection in reference aggregate',True,'No real disk crash test performed')
check('rune lifecycle configuration preserves victory and clears death/abandon',s.B['confirmed']['enchant_lifetime']==s.B['enchant']['lifetime']=='until_death_or_abandon' and s.B['enchant']['outcome_rules']=={'victory':'preserve_rows','death':'clear_rows','abandon':'clear_rows'})

# A victorious board returns to camp, then starts another adventure with the same row bindings.
# No equipped items are required, and transient combat values never enter the Profile.
victory_run=deepcopy(r);victory_run['victory_locked']=victory_run['boss_chest_resolved']=True
p_camp,r_done,_=s.finish_adventure(p,victory_run,'victory','lifecycle/victory')
fresh={'floor':2,'items':[],'enchanted_rows':{},'hero':{'battle_temporary_state':{'shield':99}},'settled':False}
p_next,r_next,started=s.start_adventure(p_camp,fresh,'lifecycle/start')
assert started and not p_next['enchanted_rows'] and r_next['enchanted_rows']==victory_run['enchanted_rows']
assert not r_next['items'] and not r_next['hero']['battle_temporary_state']
assert p_camp['enchanted_rows']==victory_run['enchanted_rows'] and not fresh['enchanted_rows']
assert p_camp['enchanted_rows'] is not r_next['enchanted_rows']
for command in ['lifecycle/start','lifecycle/start-again']:
    pp,rr,applied=s.start_adventure(p_next,r_next,command)
    assert not applied and pp==p_next and rr==r_next
for outcome in ['death','abandon']:
    p_loss,r_loss,applied=s.finish_adventure(p_next,r_next,outcome,'lifecycle/'+outcome)
    assert applied and not p_loss['enchanted_rows'] and not r_loss['enchanted_rows']
    for command in ['lifecycle/'+outcome,'lifecycle/loss-again']:
        pp,rr,applied=s.finish_adventure(p_loss,r_loss,outcome,command)
        assert not applied and pp==p_loss and rr==r_loss
    pp,rr,applied=s.finish_adventure(p_loss,r_done,'victory','lifecycle/old-victory')
    assert not applied and pp==p_loss and rr==r_done  # An old settlement cannot resurrect cleared runes.
    pp,rr,started=s.start_adventure(p_loss,fresh,'lifecycle/after-'+outcome)
    assert started and not pp['enchanted_rows'] and not rr['enchanted_rows']
check('victory to next adventure preserves row runes; later death/abandon clears them without replay resurrection',True,'Empty equipment, independent aggregates, transient reset and start/finish idempotency')
r_unresolved=deepcopy(r);r_unresolved['boss_chest_resolved']=False
try:s.finish_adventure(p,r_unresolved,'victory','too-soon');raise AssertionError('early settlement must fail')
except ValueError:pass
p_repeat=deepcopy(p);p_repeat['first_clear_claimed']=[1]
p_repeat,r_repeat,_=s.finish_adventure(p_repeat,r,'victory','repeat-clear')
check('Boss chest resolves before transfer and first-clear reward cannot repeat',p_repeat['gold']==p['gold'])

sword=next(i for i in s.ITEMS if i['id']=='I022')
stub_compatibility=lambda rune,item:rune['id']=='E001' and item['id']=='I022'
assert s.rune_for(sword,0,{'1':'E001'},stub_compatibility) is None
assert s.rune_for(sword,0,{'0':'E001'},stub_compatibility)['id']=='E001'
glove=next(i for i in s.ITEMS if i['id']=='I115')
assert s.rune_for(glove,0,{'0':'E001'},stub_compatibility) is None
try:s.rune_for(sword,0,{'0':'E001'});raise AssertionError('missing combat adapter must fail explicitly')
except ValueError:pass
check('rune top anchor and explicit external compatibility adapter boundary',True,'Stub checks definition selection only; none of the 50 combat effects is implemented here')

# Enchant service reference: full design catalog, saved offers and atomic transactions, not effect simulation.
assert set(s.ENCHANTS)=={f'E{i:03d}' for i in range(1,51)}
assert [sum(e['tier']==tier for e in s.ENCHANTS.values()) for tier in range(1,6)]==[18,14,9,6,3]
assert all(e['design_enabled'] and e['runtime_status']=='not_yet_verified' and all(e[key] for key in ['effect','target','limits','risk','implementation_gap']) for e in s.ENCHANTS.values())
source_offer=s.ENCHANT_CATALOG['offer_config']
for source_key,config_key in [('offer_count','offered_choices'),('selection_price','price'),('free_choices_per_visit','claims_per_visit'),('reroll_limit','refresh_limit'),('reroll_costs','refresh_costs'),('rarity_base_weights','tier_base_weights'),('floor_factor_growth','floor_factor_growth'),('same_id_allowed_across_rows','duplicate_ids_across_rows'),('legendary_unique_limit','cross_row_rarity_limit'),('reroll_after_claim','refresh_after_claim'),('cancel_replacement_consumes_claim','cancel_replacement_consumes_claim'),('paid_rerolls_refundable','paid_refreshes_refundable')]:
    assert source_offer[source_key]==s.B['enchant'][config_key]
check('all 50 self-contained enchants enabled in design with effects and unresolved adapter information',True,'18/14/9/6/3; not a runtime readiness claim')
assert s.enchant_tier_weights(1)==[9000,900,90,9,1]
previous=None;probability_examples={}
for floor in range(1,101):
    weights=s.enchant_tier_weights(floor);probs=[w/sum(weights) for w in weights]
    assert all(0<p<1 for p in probs) and math.isclose(sum(probs),1)
    if previous is not None:assert all(sum(probs[i:])>=sum(previous[i:]) for i in range(1,5))
    if floor in [1,2,5,10]:probability_examples[floor]=[p*100 for p in probs]
    previous=probs
check('all tiers have nonzero floor1 probability and higher-tier tail probability grows by floor',True,probability_examples)

class TierFixture:
    def __init__(self,tiers):self.tiers=iter(tiers)
    def weighted(self,tiers,weights):
        chosen=next(self.tiers);assert chosen in tiers and all(w>0 for w in weights);return chosen
    def choice(self,entries):return entries[0]
same_tier=s.draw_enchant_offers(TierFixture([5,5]),1)
mixed_tier=s.draw_enchant_offers(TierFixture([1,5]),1)
assert len(set(same_tier))==2 and [s.ENCHANTS[e]['tier'] for e in mixed_tier]==[1,5]
observed=set()
for seed in range(2000):
    offers=s.draw_enchant_offers(s.RNG(seed+12345),10)
    assert len(offers)==2 and len(set(offers))==2
    observed.update(offers)
check('each choice draws a tier then a distinct within-roll ID; all 50 IDs observed',observed==set(s.ENCHANTS),'2000 offer pairs at floor10 plus controlled same-tier/mixed-tier fixtures')

def service_run(seed=1,node_id='F1W4/enchant'):
    return {'run_id':'service-check','seed':seed,'floor':1,'wave':4,'state':'SPECIAL','special_kind':'enchant',
            'active_special_node_id':node_id,'items':[],'enchanted_rows':{},'settled':False}
wallet={'gold':70,'applied_commands':[]};node_id='F1W4/enchant'
service,created=s.open_enchant_node(service_run(),node_id);assert created
restored=json.loads(json.dumps(service));reopened,created=s.open_enchant_node(restored,node_id)
assert not created and reopened==restored
once_p,once_r,_=s.refresh_enchant(wallet,service,node_id,'restore/first',0)
saved_p,saved_r=json.loads(json.dumps([once_p,once_r]))
assert s.refresh_enchant(once_p,once_r,node_id,'restore/second',1)==s.refresh_enchant(saved_p,saved_r,node_id,'restore/second',1)
poor=deepcopy(wallet);poor['gold']=0
pp,rr,result=s.refresh_enchant(poor,service,node_id,'poor/roll',0)
assert not result['ok'] and result['reason']=='gold' and pp==poor and rr==service
p_roll=deepcopy(wallet);r_roll=deepcopy(service)
for count,cost in enumerate([10,20,40]):
    before=deepcopy((p_roll,r_roll))
    p_roll,r_roll,result=s.refresh_enchant(p_roll,r_roll,node_id,'paid/'+str(count),count)
    assert result['ok'] and result['cost']==cost and p_roll['gold']==before[0]['gold']-cost
    assert r_roll['enchant_nodes'][node_id]['refresh_count']==count+1 and not r_roll['enchanted_rows']
    pp,rr,result=s.refresh_enchant(p_roll,r_roll,node_id,'paid/'+str(count),count)
    assert result['reason']=='duplicate' and pp==p_roll and rr==r_roll
assert p_roll['gold']==0
pp,rr,result=s.refresh_enchant(p_roll,r_roll,node_id,'fourth/roll',3)
assert result['reason']=='refresh_limit' and pp==p_roll and rr==r_roll
next_node='F1W5/enchant';next_run=deepcopy(r_roll);next_run['wave']=5;next_run['active_special_node_id']=next_node
next_run,created=s.open_enchant_node(next_run,next_node)
assert created and next_run['enchant_nodes'][next_node]['refresh_count']==0 and next_run['enchant_nodes'][node_id]['refresh_count']==3
check('saved offers reopen without reroll; paid rerolls are atomic, cost 10/20/40 and reset per node',True,'Insufficient gold and fourth reroll preserve wallet, offers, count and RNG; duplicates charge once')

# An ordinary service may stay common after all three rolls; repeats across rolls are allowed.
found_repeat=False;found_all_common=False
for seed in range(100):
    sr,_=s.open_enchant_node(service_run(seed),node_id);sp=deepcopy(wallet)
    history=[sr['enchant_nodes'][node_id]['offers']]
    for count in range(3):
        sp,sr,_=s.refresh_enchant(sp,sr,node_id,f'repeat/{seed}/{count}',count)
        history.append(sr['enchant_nodes'][node_id]['offers'])
    found_repeat|=any(set(history[i])&set(history[i+1]) for i in range(3))
    found_all_common|=all(s.ENCHANTS[e]['tier']==1 for pair in history for e in pair)
assert not s.B['enchant']['rarity_pity'] and s.B['enchant']['cross_roll_repeats'] and not s.B['enchant']['loadout_filter']
check('no rare pity or loadout filtering; cross-roll IDs can repeat',found_repeat and found_all_common,'100 empty-equipment service sequences; initial draw plus three paid rolls')

selected=r_roll['enchant_nodes'][node_id]['offers'][0]
claimed_p,claimed_r,result=s.claim_enchant(p_roll,r_roll,node_id,'claim/free',3,selected,0)
assert result['ok'] and result['cost']==0 and claimed_p['gold']==p_roll['gold']==0 and claimed_r['enchanted_rows']=={'0':selected}
for command in ['claim/free','claim/again']:
    pp,rr,result=s.claim_enchant(claimed_p,claimed_r,node_id,command,3,selected,1)
    assert not result['ok'] and pp==claimed_p and rr==claimed_r
pp,rr,result=s.refresh_enchant(claimed_p,claimed_r,node_id,'roll/after-claim',3)
assert result['reason']=='already_claimed' and pp==claimed_p and rr==claimed_r
full=deepcopy(r_roll);full['enchanted_rows']={'0':'E048','1':'E049','2':'E050'}
pp,rr,result=s.claim_enchant(p_roll,full,node_id,'full/add',3,selected,3)
assert result['reason']=='row_limit' and pp==p_roll and rr==full
pp,rr,result=s.claim_enchant(p_roll,full,node_id,'replace/preview',3,selected,0)
assert result['reason']=='confirmation_required' and pp==p_roll and rr==full and pp['gold']==0
pp,rr,result=s.claim_enchant(p_roll,full,node_id,'replace/confirm',3,selected,0,True,'E048')
assert result['ok'] and len(rr['enchanted_rows'])==3 and rr['enchanted_rows']['0']==selected and pp['gold']==0
duplicates=deepcopy(service);duplicates['enchanted_rows']={'1':service['enchant_nodes'][node_id]['offers'][0]}
duplicate_id=duplicates['enchanted_rows']['1']
pp,rr,result=s.claim_enchant(poor,duplicates,node_id,'duplicate-row/claim',0,duplicate_id,7)
assert result['ok'] and rr['enchanted_rows']=={'1':duplicate_id,'7':duplicate_id}
legendary=deepcopy(service);legendary['enchant_nodes'][node_id]['offers']=['E048','E049'];legendary['enchanted_rows']={'0':'E048','1':'E049'}
pp,rr,result=s.claim_enchant(poor,legendary,node_id,'legendary-third/claim',0,'E048',2)
assert result['ok'] and len(rr['enchanted_rows'])==3
check('free one-time claim, explicit overwrite confirmation, three-row cap and cross-row duplicates',True,'Cancel is unchanged, paid rolls are not refunded, full board may overwrite, three legendary rows allowed')

def rejects_unchanged(call,profile,run):
    before=deepcopy((profile,run))
    try:call();raise AssertionError('invalid input must be rejected')
    except ValueError:pass
    assert (profile,run)==before
for bad_row in [-1,8,True,1.5,'0']:
    rejects_unchanged(lambda:s.claim_enchant(poor,service,node_id,'bad-row',0,service['enchant_nodes'][node_id]['offers'][0],bad_row),poor,service)
rejects_unchanged(lambda:s.claim_enchant(poor,service,node_id,'bad-ID',0,'E999',0),poor,service)
not_offered=next(e for e in s.ENCHANTS if e not in service['enchant_nodes'][node_id]['offers'])
rejects_unchanged(lambda:s.claim_enchant(poor,service,node_id,'old-offer',0,not_offered,0),poor,service)
rejects_unchanged(lambda:s.claim_enchant(p_roll,r_roll,node_id,'stale-claim',2,selected,0),p_roll,r_roll)
rejects_unchanged(lambda:s.refresh_enchant(p_roll,r_roll,node_id,'stale-roll',2),p_roll,r_roll)
rejects_unchanged(lambda:s.claim_enchant(p_roll,full,node_id,'stale-replace',3,selected,0,True,'E001'),p_roll,full)
rejects_unchanged(lambda:s.claim_enchant(p_roll,full,node_id,'bad-confirm',3,selected,0,'yes','E048'),p_roll,full)
wrong_phase=deepcopy(service);wrong_phase['state']='COMBAT'
rejects_unchanged(lambda:s.refresh_enchant(wallet,wrong_phase,node_id,'wrong-phase',0),wallet,wrong_phase)
check('invalid rows, ID, stale offers/revisions, replacement and phase reject without mutation',True,'No wallet, node, RNG or command-ledger changes')

for floor in range(1,101):
    sc=s.floor_scale(floor);boss=s.boss_for(floor)
    assert all(math.isfinite(v) and v>0 for v in sc.values()) and boss['floor']==floor
    assert boss['extension_unbalanced']==(floor>2)
check('floor scaling and Boss cycling finite to floor100, with extension label',True,'No balance or numeric-runtime precision claim beyond floor2')
try:s.floor_scale(101);raise AssertionError('must reject')
except ValueError:pass
check('unsupported floor fails explicitly',True)

# Conservative novice ledger: only clear first 3 waves then die, no loot sales or combat simulation.
gold=0;level=1;xp=0;points=0;ranks={'力量':0,'体质':0};ledger=[]
for attempt in range(1,11):
    gold+=sum(s.B['waves']['gold'][:3]);level,xp,points=s.gain_xp(level,xp,points,sum(s.B['waves']['xp'][:3]))
    for name in ['力量','体质']:
        if ranks[name]==0 and points:points-=1;ranks[name]=1
    while True:
        candidates=[n for n in ['力量','体质'] if 0<ranks[n]<8]
        if not candidates:break
        name=min(candidates,key=lambda n:(ranks[n],0 if n=='体质' else 1))
        cost=s.B['progression']['rank_upgrade_gold'][ranks[name]-1]
        if gold<cost:break
        gold-=cost;ranks[name]+=1
    ledger.append({'attempt':attempt,'gold':gold,'level':level,'xp':xp,'skill_points':points,'power_rank':ranks['力量'],'vitality_rank':ranks['体质'],'attack':30+3*ranks['力量'],'hp':s.rounded(180*(1+0.05*ranks['体质']))})

ratio_hp=(s.B['waves']['budget'][0]*s.B['waves']['hp_factor'][0]*s.B['floors']['hp_growth'])/(s.B['waves']['budget'][-1]*s.B['waves']['hp_factor'][-1])
check('next-floor opening HP-budget proxy below previous last wave',ratio_hp<0.5,ratio_hp)

report={'date':'2026-10-29','status':'offline_design_checks_passed','checks':checks,'seed_count':N,'floors':2,'encounters_checked':N*2*6,'elite_waves':elite_waves,'special_observed_fraction':special_count/(N*2*6),'forge_plus3':{'samples':10000,'mean_gold':statistics.mean(forge_samples),'p50_gold':forge_samples[4999],'p90_gold':forge_samples[8999],'unlimited_future_visits_assumption':True},'novice_ledger':ledger,'opening_hp_budget_ratio':ratio_hp,'mean_total_enemy_hp_by_wave':{f:[statistics.mean(a[i] for a in rows) for i in range(6)] for f,rows in floor_stats.items()},'not_validated':['real combat damage/physics/AI','runtime item effect adapters','actual persistent save transactions/crash recovery','UI input/screenshots','blind player flow/fun','win rates or endless balance']}
(R/'05_验证与评审/最终离线检查.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
(R/'05_验证与评审/检查结果.txt').write_text('最终离线检查\n\n'+'\n'.join(('PASS ' if c['pass'] else 'FAIL ')+c['name']+' '+str(c['detail']) for c in checks)+'\n\n边界：'+ '；'.join(report['not_validated'])+'。\n')
print(json.dumps({'checks_passed':len(checks),'encounters':report['encounters_checked'],'forge_plus3':report['forge_plus3'],'last_novice_attempt':ledger[-1]},ensure_ascii=False))
