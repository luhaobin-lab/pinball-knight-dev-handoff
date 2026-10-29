"""Monster design reference: scaling, content scheduling and budget generation only.
No game physics, real ability execution, path safety, persistent saves or player balance proof.
"""
from pathlib import Path
from copy import deepcopy
import json, math

ROOT = Path(__file__).resolve().parent
DATA = json.loads((ROOT/'怪物100种_数据.json').read_text())
RULES = json.loads((ROOT/'怪物层级与生成规则.json').read_text())
MONSTERS = DATA['monsters']
BY_ID = {m['id']:m for m in MONSTERS}

def rounded(value):
    return math.floor(value + 0.5)

def validate_location(floor, wave=3):
    if type(floor) is not int or not 1 <= floor <= RULES['growth']['reference_floor_limit']:
        raise ValueError('offline reference supports integer floors 1..100; not a gameplay depth cap')
    if type(wave) is not int or not 1 <= wave <= RULES['waves']['count']:
        raise ValueError('wave must be an integer in 1..6; Boss is separate')

def growth(floor):
    validate_location(floor)
    c = RULES['growth']
    if floor == 1:
        return {'hp': c['floor1_hp'], 'attack': c['floor1_attack']}
    depth = (floor-2)/c['floors_per_growth_step']
    return {'hp': c['floor2_hp']*c['hp_growth_per_step']**depth,
            'attack': c['floor2_attack']*c['attack_growth_per_step']**depth}

def cost(monster):
    return monster['base_budget_cost']*(RULES['elite']['cost_factor'] if monster['rank']=='elite' else 1)

def slot_cost(monster):
    return 1 + monster['reserved_entity_slots']

def stats(monster, floor, wave=3):
    validate_location(floor, wave)
    c = growth(floor); b = monster['base_stats']; elite = monster['rank']=='elite'
    hp = rounded(b['hp']*c['hp']*RULES['waves']['hp_factor'][wave-1]*(RULES['elite']['hp_factor'] if elite else 1))
    attack = rounded(b['attack']*c['attack']*RULES['waves']['attack_factor'][wave-1]*(RULES['elite']['attack_factor'] if elite else 1))
    return {'hp':hp, 'attack':attack, 'action_damage_before_target_reduction':rounded(attack*monster['behavior']['damage_ratio']),
            'heal':rounded(b['heal']*c['hp']), 'fortify':rounded(b['fortify']*c['hp']),
            'budget_cost':cost(monster), 'slot_reservation':slot_cost(monster),
            'eligible_by_unlock':floor>=monster['unlock_floor'] and wave>=monster['min_wave']}

def fnv1a(value):
    h=2166136261
    for byte in value.encode('utf-8'):h=((h^byte)*16777619)&0xffffffff
    return h

class RNG:
    def __init__(self, seed):self.state=seed or 0x6d2b79f5
    def u32(self):
        x=self.state;x^=(x<<13)&0xffffffff;x^=x>>17;x^=(x<<5)&0xffffffff
        self.state=x&0xffffffff;return self.state
    def unit(self):return self.u32()/4294967296
    def integer(self,n):
        if type(n) is not int or not 0<n<=4294967296:raise ValueError('invalid integer domain')
        bound=4294967296-(4294967296%n)
        while True:
            value=self.u32()
            if value<bound:return value%n
    def weighted(self,values,weights):
        if not values or len(values)!=len(weights) or any(not math.isfinite(w) or w<0 for w in weights) or sum(weights)<=0:
            raise ValueError('invalid weighted choice')
        target=self.unit()*sum(weights);acc=0
        for item,weight in zip(values,weights):
            acc+=weight
            if target<acc:return item
        return values[-1]

def stream(seed, run_id, floor, wave, domain, index=0):
    if type(seed) is not int or not 0<=seed<=0xffffffff:raise ValueError('seed must be uint32')
    if not isinstance(run_id,str) or not run_id or '|' in run_id:raise ValueError('invalid runId')
    validate_location(floor,wave)
    return RNG(fnv1a('|'.join(map(str,[RULES['version'],seed,run_id,floor,wave,domain,index]))))

def has_tag(monster,tag):
    return tag in monster['generation_tags']

def compatible(members, candidate, budget):
    g=RULES['generation'];xs=members+[candidate]
    if sum(cost(m) for m in xs)>budget+1e-8:return False
    if sum(slot_cost(m) for m in xs)>g['actor_slots_max']:return False
    if sum(m['id']==candidate['id'] for m in xs)>g['same_definition_per_wave_max']:return False
    if sum(m['family_id']==candidate['family_id'] for m in xs)>g['same_family_per_wave_max']:return False
    if sum(m['rank']=='elite' for m in xs)>RULES['elite']['per_wave_max']:return False
    if sum(has_tag(m,'ranged_damage') for m in xs)>g['ranged_damage_sources_max']:return False
    if sum(has_tag(m,'heavy') for m in xs)>g['heavy_max']:return False
    if sum(has_tag(m,'controller') for m in xs)>g['controller_max']:return False
    for group in g['combined_family_caps']:
        if sum(m['family_id'] in group['families'] for m in xs)>group['max']:return False
    families={m['family_id'] for m in xs}
    if any(set(pair)<=families for pair in g['forbidden_family_pairs']):return False
    for i,a in enumerate(xs):
        for b in xs[i+1:]:
            if b['family_id'] in a.get('forbidden_with_families',[]) or a['family_id'] in b.get('forbidden_with_families',[]):return False
    return True

def theme_for(floor):
    validate_location(floor);g=RULES['generation']
    return g['theme_order'][((floor-1)//g['theme_block_floors'])%len(g['theme_order'])]

def choose(rng, candidates, theme, previous_ids=()):
    """Choose family first, then a definition; family size does not grant extra theme weight."""
    g=RULES['generation'];families=sorted({m['family_id'] for m in candidates})
    by_family={f:[m for m in candidates if m['family_id']==f] for f in families}
    def weight(m):
        return (g['theme_match_weight'] if m['theme']==theme else g['other_theme_weight'])*(g['repeat_previous_wave_id_weight'] if m['id'] in previous_ids else 1)
    family=rng.weighted(families,[g['family_base_weight']*sum(weight(m) for m in by_family[f])/len(by_family[f]) for f in families])
    return rng.weighted(by_family[family],[weight(m) for m in by_family[family]])

def eligible(floor,wave,rank):
    validate_location(floor,wave)
    pool=[m for m in MONSTERS if m['rank']==rank and m['unlock_floor']<=floor and m['min_wave']<=wave and m['design_enabled']]
    if wave==1:pool=[m for m in pool if m['family_id'] in RULES['generation']['first_wave_family_whitelist']]
    return pool

def encounter(seed,floor,wave,run_id='example',elite_count=0,previous_elite=False,previous_ids=()):
    validate_location(floor,wave)
    if type(elite_count) is not int or not 0<=elite_count<=RULES['elite']['per_floor_max'] or type(previous_elite) is not bool:
        raise ValueError('invalid saved elite history')
    r=stream(seed,run_id,floor,wave,'monster100_composition')
    er=stream(seed,run_id,floor,wave,'monster100_elite')
    budget=RULES['waves']['budget'][wave-1];theme=theme_for(floor)
    normal=eligible(floor,wave,'normal');members=[]
    request=elite_count<RULES['elite']['per_floor_max'] and not previous_elite and er.unit()<RULES['waves']['elite_probability'][wave-1]
    elite_reason=None
    if request:
        elite_candidates=[]
        for e in eligible(floor,wave,'elite'):
            if not compatible([],e,budget):continue
            if any((has_tag(e,'frontline') or has_tag(n,'frontline')) and compatible([e],n,budget) for n in normal):
                elite_candidates.append(e)
        if elite_candidates:members.append(choose(r,elite_candidates,theme,previous_ids))
        else:elite_reason='no_legal_elite_with_second_member'
    if members:
        second=[m for m in normal if (has_tag(members[0],'frontline') or has_tag(m,'frontline')) and compatible(members,m,budget)]
        members.append(choose(r,second,theme,previous_ids))
    else:
        front=[m for m in normal if has_tag(m,'frontline') and compatible([],m,budget) and any(compatible([m],n,budget) for n in normal)]
        if not front:raise ValueError('content configuration cannot form a valid two-member wave')
        members.append(choose(r,front,theme,previous_ids))
        second=[m for m in normal if compatible(members,m,budget)]
        members.append(choose(r,second,theme,previous_ids))
    while True:
        choices=[m for m in normal if compatible(members,m,budget)]
        if not choices:break
        members.append(choose(r,choices,theme,previous_ids))
    effective=[cost(m) for m in members];total=sum(effective)
    return {'seed':seed,'run_id':run_id,'floor':floor,'wave':wave,'theme':theme,'budget':budget,'spent':total,
            'reserved_actor_slots':sum(slot_cost(m) for m in members),'elite_requested':request,
            'elite_present':any(m['rank']=='elite' for m in members),'elite_request_skip_reason':elite_reason,
            'members':[{'id':m['id'],'instance_id':f'{run_id}/F{floor}/W{wave}/M{i}',
                        'stats':stats(m,floor,wave),'reward_weight':effective[i]/total,
                        'behavior_pattern':m['behavior']['pattern']} for i,m in enumerate(members)],
            'rng_states':{'composition':r.state,'elite':er.state},
            'validation_boundary':'composition only; no real collision or safe-trajectory test'}

def generate_floor(seed,floor,run_id='example'):
    waves=[];count=0;last=False;previous=[]
    for wave in range(1,RULES['waves']['count']+1):
        result=encounter(seed,floor,wave,run_id,count,last,previous);waves.append(result)
        last=result['elite_present'];count+=last;previous=[x['id'] for x in result['members']]
    return {'version':RULES['version'],'floor':floor,'theme':theme_for(floor),'elite_waves':count,'waves':waves,'boss':'use separate Boss module'}

def allocate_rewards(total_gold,total_xp,encounter_data):
    """Caller supplies existing wave totals; no invented per-species or descendant reward constants."""
    if any(type(x) is not int or x<0 for x in [total_gold,total_xp]):raise ValueError('reward totals must be nonnegative integers')
    members=encounter_data['members'];weights=[cost(BY_ID[x['id']]) for x in members]
    if not members:raise ValueError('no initial members')
    def split(total):
        raw=[total*w/sum(weights) for w in weights];out=[math.floor(x) for x in raw]
        order=sorted(range(len(weights)),key=lambda i:(-(raw[i]-out[i]),i))
        for i in order[:total-sum(out)]:out[i]+=1
        return out
    kill_gold=split(total_gold//2);xp=split(total_xp)
    return {'clear_gold':total_gold-total_gold//2,
            'members':[{'root_instance_id':m['instance_id'],'gold':kill_gold[i],'xp':xp[i],
                        'reward_event_id':m['instance_id']+'/root-death-reward',
                        'descendants_have_independent_reward':False} for i,m in enumerate(members)]}

def phase_at(monster, enemy_phase_index, revived=False):
    """Alive loop only. Death/threshold branches are separate and never modulo-looped."""
    if type(enemy_phase_index) is not int or enemy_phase_index<1:raise ValueError('phase index must be positive')
    if type(revived) is not bool:raise ValueError('revived must be the saved lifecycle flag')
    cycle=monster['behavior']['params'].get('post_revive_cycle',monster['cycle']) if revived else monster['cycle']
    period=sum(s['turns'] for s in cycle);index=(enemy_phase_index-1)%period
    for step_index,step in enumerate(cycle):
        if index<step['turns']:
            return {'step_index':step_index,'phase':step['phase'],'turn_in_step':index+1,'intent':step['intent'],
                    'pattern':monster['behavior']['pattern'],'requires_runtime_adapter':True}
        index-=step['turns']
    raise AssertionError('cycle not resolved')

def begin_event_branch(monster, ai_state, event, event_id, hp_ratio=None, player_turn=1):
    """Once-only scheduling example. Caller supplies real event evidence; no damage is simulated."""
    state=deepcopy(ai_state)
    if not isinstance(event_id,str) or not event_id:raise ValueError('event_id required')
    if type(player_turn) is not int or player_turn<1:raise ValueError('actual player turn index required')
    if event_id in state.get('applied_event_ids',[]):return state,False
    if state.get('active_branch') is not None:return state,False
    for index,branch in enumerate(monster.get('event_branches',[])):
        if branch['event']!=event:continue
        if index in state.get('used_branch_indices',[]):continue
        if event=='hp_crosses_below':
            if type(hp_ratio) not in (int,float) or not 0<=hp_ratio<=1:raise ValueError('actual hp ratio required')
            if hp_ratio>=branch['hp_ratio']:continue
        state.setdefault('used_branch_indices',[]).append(index)
        state.setdefault('applied_event_ids',[]).append(event_id)
        warning_turns=0
        for step in branch['sequence']:
            if step['phase']!='telegraph':break
            warning_turns+=step['turns']
        state['active_branch']={'index':index,'phase_index':1,'born_player_turn':player_turn,
                                'earliest_effect_enemy_turn':player_turn+warning_turns,'last_advanced_enemy_turn':None}
        return state,True
    return state,False

def event_phase_at(monster, branch_index, phase_index):
    if type(branch_index) is not int or not 0<=branch_index<len(monster.get('event_branches',[])):raise ValueError('invalid branch index')
    if type(phase_index) is not int or phase_index<1:raise ValueError('invalid branch phase')
    branch=monster['event_branches'][branch_index];index=phase_index-1
    for step_index,step in enumerate(branch['sequence']):
        if index<step['turns']:
            return {'step_index':step_index,'phase':step['phase'],'turn_in_step':index+1,'intent':step['intent'],'requires_runtime_adapter':True}
        index-=step['turns']
    return {'phase':'complete','terminal':branch['terminal'],'repeats':False}

def advance_event_branch(monster,ai_state,enemy_turn,cancel_reason=None):
    """One enemy phase per call. Complete/cancel clears active branch but keeps once/reward ledgers."""
    state=deepcopy(ai_state);active=state.get('active_branch')
    if active is None:return state,None
    if type(enemy_turn) is not int or enemy_turn<active['born_player_turn']:raise ValueError('invalid enemy turn index')
    if cancel_reason is not None:
        if not isinstance(cancel_reason,str) or not cancel_reason:raise ValueError('cancellation needs a concrete reason')
        state['active_branch']=None
        return state,{'phase':'cancelled','reason':cancel_reason,'used_branch_ledger_preserved':True}
    if active['last_advanced_enemy_turn'] is not None and enemy_turn<=active['last_advanced_enemy_turn']:return state,None
    action=event_phase_at(monster,active['index'],active['phase_index'])
    if action['phase'] in ['execute','spawn','support','relocate'] and enemy_turn<active['earliest_effect_enemy_turn']:
        return state,{'phase':'waiting_for_complete_player_turn','earliest_enemy_turn':active['earliest_effect_enemy_turn']}
    active['last_advanced_enemy_turn']=enemy_turn
    if action['phase']=='complete':state['active_branch']=None
    else:
        branch=monster['event_branches'][active['index']]
        duration=sum(step['turns'] for step in branch['sequence'])
        if active['phase_index']==duration:
            action['terminal_after_action']=branch['terminal']
            state['active_branch']=None
        else:active['phase_index']+=1
    return state,action

def fortify_split(damage, current_fortify, includes_armor=True):
    if any(type(v) not in (int,float) or not math.isfinite(v) or v<0 for v in [damage,current_fortify]):
        raise ValueError('invalid finite nonnegative damage or fortify')
    absorbed=min(current_fortify,damage*RULES['combat']['fortify_absorption_fraction']) if includes_armor else 0
    return {'hp_loss':damage-absorbed,'fortify_after':current_fortify-absorbed}

def can_clear_wave(live_hostile_ids, pending_spawn_or_revive_ids):
    """Gate only. Runtime must register pending outcomes atomically before removing a dying root."""
    for ids in [live_hostile_ids,pending_spawn_or_revive_ids]:
        if not isinstance(ids,(list,tuple,set)) or any(not isinstance(i,str) or not i for i in ids):
            raise ValueError('caller must supply live and pending stable instance/event IDs')
    return not live_hostile_ids and not pending_spawn_or_revive_ids

if __name__=='__main__':
    (ROOT/'种子42_编队样例.json').write_text(json.dumps([generate_floor(42,f,f'sample-{f}') for f in [1,2,5,10,20,50,100]],ensure_ascii=False,indent=2)+'\n')
    print('Wrote deterministic composition samples; no gameplay simulation was performed.')
