"""Deterministic design reference. No rendering, physics, damage simulation or game save adapter."""
from pathlib import Path
from copy import deepcopy
import json, math, hashlib

ROOT=Path(__file__).resolve().parents[1]
def read(name): return json.loads((ROOT/'03_数值与配置'/name).read_text())
B=read('balance.json'); MONSTERS=read('monsters.json'); ITEMS=read('items.json'); ROOMS=read('rooms.json')
ENCHANT_CATALOG=read(B['enchant']['catalog_file'])
ENCHANTS={e['id']:e for e in ENCHANT_CATALOG['enchants']}
ENCHANT_CATALOG_SHA256=hashlib.sha256((ROOT/'03_数值与配置'/B['enchant']['catalog_file']).read_bytes()).hexdigest()

def rounded(x): return math.floor(x+0.5)  # nonnegative values, matches JS Math.round
def fnv1a(text):
    h=2166136261
    for b in text.encode('utf-8'): h=((h^b)*16777619)&0xffffffff
    return h

class RNG:
    def __init__(self, seed): self.state=seed or 0x6d2b79f5
    def u32(self):
        x=self.state
        x^=(x<<13)&0xffffffff; x^=x>>17; x^=(x<<5)&0xffffffff
        self.state=x&0xffffffff
        return self.state
    def unit(self): return self.u32()/4294967296
    def integer(self,n):
        if n<1: raise ValueError('empty random domain')
        limit=4294967296-(4294967296%n)
        while True:
            x=self.u32()
            if x<limit: return x%n
    def choice(self,xs): return xs[self.integer(len(xs))]
    def weighted(self,xs,weights):
        if not xs or len(xs)!=len(weights) or min(weights)<0 or sum(weights)<=0: raise ValueError('invalid weighted pool')
        target=self.unit()*sum(weights); acc=0
        for x,w in zip(xs,weights):
            acc+=w
            if target<acc: return x
        return xs[-1]
    def shuffle(self, xs):
        out=list(xs)
        for i in range(len(out)-1,0,-1):
            j=self.integer(i+1); out[i],out[j]=out[j],out[i]
        return out

def stream(seed,run_id,floor,wave,domain,index=0):
    # All components UTF-8 strings, decimal integers, one pipe separator, no Python hash().
    return RNG(fnv1a('|'.join(map(str,[B['version'],seed,run_id,floor,wave,domain,index]))))

def floor_scale(floor):
    if not isinstance(floor,int) or floor<1 or floor>100: raise ValueError('reference supports floors 1..100; prototype uses 1..2')
    return {'hp':B['floors']['hp_growth']**(floor-1),'atk':B['floors']['attack_growth']**(floor-1),'reward':B['floors']['reward_growth']**(floor-1)}

def reachable(room):
    blocked={tuple(p) for p in room['blocked']}; start=tuple(room['hero_spawn']); seen={start}; q=[start]
    while q:
        x,y=q.pop()
        for p in [(x+1,y),(x-1,y),(x,y+1),(x,y-1)]:
            if 0<=p[0]<room['width'] and 0<=p[1]<room['height'] and p not in blocked and p not in seen: seen.add(p);q.append(p)
    return seen

def room_for(rng,previous=None,wave=None):
    choices=[r for r in ROOMS if (r['id']=='ROOM_OPEN' if wave==1 else r['id']!=previous)]
    room=deepcopy(rng.choice(choices))
    if rng.integer(2):
        room['blocked']=[[room['width']-1-x,y] for x,y in room['blocked']]
        room['enemy_slots']=[[room['width']-1-x,y] for x,y in room['enemy_slots']]
        room['mirrored']=True
    else: room['mirrored']=False
    reach=reachable(room)
    assert len(reach)==room['width']*room['height']-len(room['blocked'])
    assert tuple(room['exit']) in reach
    return room

def wave_rewards(floor,wave,elite=False):
    scale=floor_scale(floor)['reward']*(B['floors']['elite_reward'] if elite else 1)
    return {'gold':rounded(B['waves']['gold'][wave-1]*scale),'xp':rounded(B['waves']['xp'][wave-1]*scale)}

def encounter(rng,elite_rng,floor,wave,room,elite_count=0,previous_elite=False,run_id='reference'):
    budget=B['waves']['budget'][wave-1]
    elite=(wave>=3 and elite_count<B['waves']['elite_per_floor_max'] and (not previous_elite or B['waves']['elite_consecutive']) and elite_rng.unit()<B['waves']['elite_probability'][wave-1])
    elite_cost=B['floors']['elite_cost']
    choices=[m for m in MONSTERS if m['min_wave']<=wave]
    members=[]; remaining=budget
    # The elite is purchased FIRST, with its full cost, rather than inflating a finished pack.
    if elite:
        reserve=min(m['budget_cost'] for m in choices if m['role'] in ['melee','fast'])
        pool=[m for m in choices if m['role'] not in ['healer'] and m['budget_cost']*elite_cost<=remaining-reserve]
        m=deepcopy(rng.choice(pool));m['elite']=True; members.append(m);remaining-=m['budget_cost']*elite_cost
    while len(members)<B['waves']['enemy_count_max']:
        pool=[m for m in choices if m['budget_cost']<=remaining+1e-9 and (m['role']!='ranged' or sum(x['role']=='ranged' for x in members)<B['waves']['ranged_max']) and (m['role']!='healer' or sum(x['role']=='healer' for x in members)<B['waves']['healer_max'])]
        if not pool: break
        if not any(m['role'] in ['melee','fast','guard','brute'] for m in members):
            pool=[m for m in pool if m['role'] in ['melee','fast','guard','brute']]
        m=deepcopy(rng.choice(pool));m['elite']=False;members.append(m);remaining-=m['budget_cost']
    if not any(m['role'] in ['melee','fast','guard','brute'] for m in members): raise AssertionError('must have frontliner')
    scale=floor_scale(floor)
    positions=rng.shuffle([p for p in room['enemy_slots'] if math.dist(p,room['hero_spawn'])>=2])
    if len(positions)<len(members): raise AssertionError('room needs safe fallback')
    for i,m in enumerate(members):
        m['instance_id']=f'{run_id}/F{floor}W{wave}E{i}'
        m['hp']=max(1,rounded(m['base_hp']*scale['hp']*B['waves']['hp_factor'][wave-1]*(B['floors']['elite_hp'] if m['elite'] else 1)))
        m['attack']=max(1,rounded(m['base_attack']*scale['atk']*B['waves']['attack_factor'][wave-1]*(B['floors']['elite_attack'] if m['elite'] else 1)))
        m['heal']=rounded(m['heal']*scale['hp'])
        m['position']=positions[i]
    rewards=wave_rewards(floor,wave,elite)
    # Fixed encounter pot: replacing enemies or summons cannot create extra gold/XP.
    gold_kill=rewards['gold']//2
    for field,total in [('kill_gold',gold_kill),('kill_xp',rewards['xp'])]:
        shares=split_integer(total,[m['budget_cost']*(elite_cost if m['elite'] else 1) for m in members])
        for m,n in zip(members,shares):m[field]=n
    return {'budget':budget,'spent':budget-remaining,'elite':elite,'members':members,'rewards':rewards,'clear_gold':rewards['gold']-gold_kill}

def split_integer(total, weights):
    raw=[total*w/sum(weights) for w in weights]; out=[math.floor(x) for x in raw]
    for i in sorted(range(len(raw)),key=lambda i:(-(raw[i]-out[i]),i))[:total-sum(out)]:out[i]+=1
    return out

def eligible_items(floor,wave,consumables=True):
    return [i for i in ITEMS if i.get('enabled',False) and i['floor_min']<=floor and i['wave_min']<=wave and (consumables or i['category']!='consumable')]

def choose_items(rng,pool,count,mandatory=()):
    pool=list(pool); out=[]
    for category in mandatory:
        sub=[i for i in pool if i['category']==category]
        if not sub: raise ValueError('missing mandatory category')
        item=rng.choice(sub);out.append(item);pool.remove(item)
    while len(out)<count:
        cats=sorted({i['category'] for i in pool})
        if not cats: raise ValueError('pool too small, must use defined fallback')
        cat=rng.weighted(cats,[B['loot']['category_weights'][c] for c in cats])
        sub=[i for i in pool if i['category']==cat]
        item=rng.weighted(sub,[i['base_weight'] for i in sub]);out.append(item);pool.remove(item)
    return out

def tier(rng,floor,wave,luck=0,minimum=1):
    # F3+ repeats floor2 quality table until an explicit endless economy is designed.
    weights=B['loot']['tier_weights_floor1' if floor==1 else 'tier_weights_floor2'][wave-1].copy()
    luck=max(0,min(B['loot']['luck_cap'],luck));weights[1]*=1+luck;weights[2]*=1+luck
    for i in range(minimum-1):weights[i]=0
    return rng.weighted([1,2,3],weights)

def chest(rng,floor,wave,low_streak=0,elite=False,boss=False,luck=0):
    pool=eligible_items(floor,wave)
    count=B['boss_rewards']['chest_choices'] if boss else B['loot']['elite_choices' if elite else 'normal_choices']
    picks=B['boss_rewards']['chest_picks'] if boss else B['loot']['elite_picks' if elite else 'normal_picks']
    # Guaranteed upgrade cannot land on a consumable, whose maximum tier is 1.
    minimum=B['boss_rewards']['min_tier'] if boss else B['loot']['pity_min_tier'] if low_streak>=B['loot']['pity_low_chests'] else 1
    if minimum>1:
        first=rng.choice([i for i in pool if i['category']=='weapon'])
        chosen=[first]+choose_items(rng,[i for i in pool if i['id']!=first['id']],count-1)
    else:chosen=choose_items(rng,pool,count,('weapon',) if wave==1 and B['loot']['first_chest_guaranteed_weapon'] else ())
    offers=[]
    for n,item in enumerate(chosen):
        q=1 if item['category']=='consumable' else tier(rng,floor,wave,luck,minimum if n==0 else 1)
        offers.append({'definition':item['id'],'tier':q,'honing':0,'charges':item['charges_max']})
    new_streak=low_streak+1 if max(x['tier'] for x in offers)==1 else 0
    return {'offers':offers,'picks':picks,'low_streak_after':new_streak}

def buy_price(item,q=1,discount=0):
    discount=max(0,min(discount,B['shop']['discount_cap']))
    return max(1,math.ceil(item['base_price']*B['shop']['tier_price_factor'][q-1]*(1-discount)))
def sale_price(item,q=1,charges=None):
    rate=1 if item['charges_max'] is None else max(0,min(charges if charges is not None else item['charges_max'],item['charges_max']))/item['charges_max']
    return math.floor(item['base_price']*B['shop']['tier_price_factor'][q-1]*B['shop']['sale_fraction']*rate)

def shop(rng,floor,wave,luck=0):
    chosen=choose_items(rng,eligible_items(floor,wave,False),B['shop']['equipment_offers'],('weapon','defense'))
    offers=[]
    for item in chosen:
        q=tier(rng,floor,wave,luck)
        offers.append({'definition':item['id'],'tier':q,'price':buy_price(item,q),'stock':1})
    consumables=[i for i in eligible_items(floor,wave) if i['category']=='consumable']
    if len(consumables)<B['shop']['consumable_offers']:raise ValueError('not enough configured consumables')
    for item in consumables[:B['shop']['consumable_offers']]:
        offers.append({'definition':item['id'],'tier':1,'price':buy_price(item),'stock':1})
    return offers

def special_node(rng,wave,misses,last_kind=None,same_kind_count=0,tutorial=False):
    if wave==B['waves']['count'] and not B['special']['w6_is_eligible']:
        return {'kind':None,'misses':misses,'last_kind':last_kind,'same_kind_count':same_kind_count}
    forced=('forge' if wave==2 else 'enchant' if wave==4 else None) if tutorial else None
    hit=forced is not None or misses>=B['special']['maximum_misses'] or rng.unit()<B['special']['base_probability']
    if not hit:return {'kind':None,'misses':misses+1,'last_kind':last_kind,'same_kind_count':same_kind_count}
    kinds=['forge','enchant']
    if same_kind_count>=B['special']['repeated_kind_limit']:kinds=[k for k in kinds if k!=last_kind]
    kind=forced or rng.weighted(kinds,[B['special']['kind_weights'][k] for k in kinds])
    return {'kind':kind,'misses':0,'last_kind':kind,'same_kind_count':same_kind_count+1 if kind==last_kind else 1}

def forge(rng,rank,gold,attempts):
    if rank not in range(B['forge']['max_honing']) or attempts>=B['forge']['attempts_per_visit']:return {'ok':False,'reason':'cap','rank':rank,'gold':gold,'attempts':attempts}
    cost=B['forge']['cost'][rank]
    if gold<cost:return {'ok':False,'reason':'gold','rank':rank,'gold':gold,'attempts':attempts}
    success=rng.unit()<B['forge']['success_chance'][rank]
    return {'ok':True,'success':success,'rank':rank+1 if success else max(B['forge']['failure_floor'],rank+B['forge']['failure_rank_delta']),'gold':gold-cost,'attempts':attempts+1}

def gain_xp(level,xp,points,amount):
    xp+=amount
    while level<B['progression']['level_cap']:
        need=math.ceil(B['progression']['xp_threshold_base']*B['progression']['xp_threshold_growth']**(level-1))
        if xp<need:break
        xp-=need;level+=1;points+=B['progression']['points_each_level']
    if level==B['progression']['level_cap']:xp=0
    return level,xp,points

def enchant_tier_weights(floor):
    """Raw weights only. No wave, luck, build, streak or rarity-pity adjustment."""
    if type(floor) is not int or not 1<=floor<=100:raise ValueError('enchant floor must be an integer in 1..100')
    factor=1+B['enchant']['floor_factor_growth']*(floor-1)
    weights=[base*factor**i for i,base in enumerate(B['enchant']['tier_base_weights'])]
    if len(weights)!=5 or any(not math.isfinite(w) or w<=0 for w in weights):raise ValueError('invalid enchant tier weights')
    return weights

def draw_enchant_offers(rng,floor):
    """Every candidate draws a tier, then an equally weighted remaining ID in that tier."""
    weights=enchant_tier_weights(floor);remaining=sorted((e for e in ENCHANTS.values() if e['design_enabled']),key=lambda e:e['id'])
    offers=[]
    for _ in range(B['enchant']['offered_choices']):
        tiers=[i for i in range(1,6) if any(e['tier']==i for e in remaining)]
        chosen_tier=rng.weighted(tiers,[weights[i-1] for i in tiers])
        entry=rng.choice([e for e in remaining if e['tier']==chosen_tier])
        offers.append(entry['id']);remaining.remove(entry)
    return offers

def _enchant_context(run,node_id):
    if not isinstance(node_id,str) or not node_id or '|' in node_id:raise ValueError('invalid node ID')
    if run.get('settled') or run.get('state')!='SPECIAL' or run.get('special_kind')!='enchant' or run.get('active_special_node_id')!=node_id:raise ValueError('enchant service is not active')
    if not isinstance(run.get('run_id'),str) or not run['run_id'] or '|' in run['run_id']:raise ValueError('invalid run ID')
    if type(run.get('seed')) is not int or not 0<=run['seed']<=0xffffffff:raise ValueError('invalid run seed')
    enchant_tier_weights(run.get('floor'))
    if type(run.get('wave')) is not int or not 1<=run['wave']<=B['waves']['count']:raise ValueError('invalid wave')

def _enchant_node(run,node_id):
    _enchant_context(run,node_id)
    node=run.get('enchant_nodes',{}).get(node_id)
    if not isinstance(node,dict):raise ValueError('enchant node must be generated and saved before use')
    if node.get('rule_revision')!=B['enchant']['rule_revision'] or node.get('catalog_sha256')!=ENCHANT_CATALOG_SHA256:raise ValueError('saved enchant rules require explicit migration')
    if node.get('floor')!=run['floor'] or node.get('wave')!=run['wave']:raise ValueError('node location mismatch')
    offers=node.get('offers')
    if not isinstance(offers,list) or len(offers)!=B['enchant']['offered_choices'] or any(not isinstance(e,str) or e not in ENCHANTS for e in offers) or len(set(offers))!=len(offers):raise ValueError('invalid saved offers')
    count=node.get('refresh_count')
    if type(count) is not int or not 0<=count<=B['enchant']['refresh_limit'] or type(node.get('offer_revision')) is not int or node['offer_revision']!=count:raise ValueError('invalid saved refresh count')
    if type(node.get('claimed')) is not bool or type(node.get('rng_state')) is not int or not 1<=node['rng_state']<=0xffffffff:raise ValueError('invalid saved node state')
    return node

def open_enchant_node(run,node_id):
    """Create once before display; reopening a serialized node never consumes random state."""
    _enchant_context(run,node_id);r=deepcopy(run)
    nodes=r.setdefault('enchant_nodes',{})
    if node_id in nodes:
        _enchant_node(r,node_id)
        return r,False
    revision=B['enchant']['rule_revision']
    rng=stream(r['seed'],r['run_id'],r['floor'],r['wave'],'enchant_offer',revision+'/'+node_id)
    offers=draw_enchant_offers(rng,r['floor'])
    nodes[node_id]={'floor':r['floor'],'wave':r['wave'],'rule_revision':revision,'catalog_sha256':ENCHANT_CATALOG_SHA256,
                    'offers':offers,'refresh_count':0,'offer_revision':0,'claimed':False,'rng_state':rng.state}
    return r,True

def _enchant_command(profile,command_id):
    if not isinstance(command_id,str) or not command_id:raise ValueError('invalid command ID')
    if not isinstance(profile.get('applied_commands'),list):raise ValueError('missing command ledger')
    if type(profile.get('gold')) is not int or profile['gold']<0:raise ValueError('invalid wallet')

def _enchant_offer_revision(node,expected_offer_revision):
    if type(expected_offer_revision) is not int or expected_offer_revision!=node['offer_revision']:raise ValueError('stale or invalid offer revision')

def refresh_enchant(profile,run,node_id,command_id,expected_offer_revision):
    """Copy-on-write transaction example; persistence must commit wallet, offers, RNG and command together."""
    _enchant_command(profile,command_id);p=deepcopy(profile);r=deepcopy(run)
    if command_id in p['applied_commands']:return p,r,{'ok':False,'reason':'duplicate'}
    node=_enchant_node(r,node_id);_enchant_offer_revision(node,expected_offer_revision)
    if node['claimed']:return p,r,{'ok':False,'reason':'already_claimed'}
    if node['refresh_count']>=B['enchant']['refresh_limit']:return p,r,{'ok':False,'reason':'refresh_limit'}
    cost=B['enchant']['refresh_costs'][node['refresh_count']]
    if type(cost) is not int or cost<0:raise ValueError('invalid refresh cost')
    if p['gold']<cost:return p,r,{'ok':False,'reason':'gold'}
    rng=RNG(node['rng_state']);offers=draw_enchant_offers(rng,node['floor'])
    p['gold']-=cost;node['offers']=offers;node['rng_state']=rng.state
    node['refresh_count']+=1;node['offer_revision']+=1
    p['applied_commands'].append(command_id)
    return p,r,{'ok':True,'cost':cost,'offers':deepcopy(offers)}

def claim_enchant(profile,run,node_id,command_id,expected_offer_revision,enchant_id,row,confirm_replace=False,expected_old_id=None):
    """Free row installation only; does not implement or validate any combat effect adapter."""
    _enchant_command(profile,command_id);p=deepcopy(profile);r=deepcopy(run)
    if command_id in p['applied_commands']:return p,r,{'ok':False,'reason':'duplicate'}
    node=_enchant_node(r,node_id);_enchant_offer_revision(node,expected_offer_revision)
    if node['claimed']:return p,r,{'ok':False,'reason':'already_claimed'}
    if type(row) is not int or not 0<=row<B['hero']['equipment_rows']:raise ValueError('invalid equipment row')
    if not isinstance(enchant_id,str) or enchant_id not in node['offers']:raise ValueError('ID is not an offered choice')
    if type(confirm_replace) is not bool:raise ValueError('confirmation must be boolean')
    rows=r.setdefault('enchanted_rows',{})
    if not isinstance(rows,dict) or len(rows)>B['enchant']['enchanted_rows_max']:raise ValueError('invalid saved enchanted rows')
    for key,value in rows.items():
        if key not in [str(i) for i in range(B['hero']['equipment_rows'])] or not isinstance(value,str) or value not in ENCHANTS:raise ValueError('invalid or unmigrated saved rune')
    old=rows.get(str(row))
    if old is not None:
        if not confirm_replace:return p,r,{'ok':False,'reason':'confirmation_required','old_id':old,'new_id':enchant_id,'row':row}
        if expected_old_id!=old:raise ValueError('replacement target changed')
    elif expected_old_id is not None:raise ValueError('replacement target changed')
    elif len(rows)>=B['enchant']['enchanted_rows_max']:return p,r,{'ok':False,'reason':'row_limit'}
    rows[str(row)]=enchant_id  # Same ID may exist on another row; a row never holds multiple effects.
    node['claimed']=True;node['claimed_id']=enchant_id;node['claimed_row']=row
    p['applied_commands'].append(command_id)
    return p,r,{'ok':True,'cost':0,'row':row,'enchant_id':enchant_id,'replaced_id':old}

def rune_for(item,anchor,runes,can_apply=None):
    """Resolve the row definition only. A verified external adapter must decide target compatibility."""
    rune_id=runes.get(str(anchor))
    if rune_id is None:return None
    if rune_id not in ENCHANTS:raise ValueError('unknown rune ID; explicit save migration required')
    if can_apply is None:raise ValueError('combat compatibility adapter is not implemented by this reference')
    rune=ENCHANTS[rune_id]
    return rune if can_apply(rune,item) else None

def start_adventure(profile,run,command_id):
    """Rune ownership example. Caller prepares a fresh Run and transfers items in the same real transaction."""
    p=deepcopy(profile);r=deepcopy(run)
    if command_id in p['applied_commands'] or r.get('started'):return p,r,False
    if r.get('settled') or r.get('enchanted_rows'):raise ValueError('start requires a fresh unsettled Run')
    # Rows belong to the equipment board, even when no item occupies them.
    r['enchanted_rows']=deepcopy(p.get('enchanted_rows',{}));p['enchanted_rows']={}
    if 'hero' in r:r['hero']['battle_temporary_state']={}
    r['started']=True
    p['applied_commands'].append(command_id)
    return p,r,True

def finish_adventure(profile,run,outcome,command_id):
    """Aggregate example: victory ONLY after locked victory and resolved Boss chest. Needs real DB transaction."""
    p=deepcopy(profile);r=deepcopy(run)
    if command_id in p['applied_commands'] or r['settled']:return p,r,False
    if outcome not in ['death','victory','abandon']:raise ValueError('invalid outcome')
    # Gold/XP were banked per kill/clear event. They are never added a second time here.
    if outcome=='victory':
        if not r.get('victory_locked') or not r.get('boss_chest_resolved'):raise ValueError('Boss chest not resolved')
        p['camp_items']+=r['items'];p['unlocked_floor']=max(p['unlocked_floor'],r['floor']+1)
        if r['floor'] not in p['first_clear_claimed']:
            p['gold']+=B['boss_rewards']['first_clear_bonus_gold'];p['first_clear_claimed'].append(r['floor'])
    elif r.get('victory_locked'):raise ValueError('locked victory cannot become death/abandon')
    rune_rule=B['enchant']['outcome_rules'][outcome]
    if rune_rule not in ['preserve_rows','clear_rows']:raise ValueError('invalid rune outcome rule')
    p['enchanted_rows']=deepcopy(r.get('enchanted_rows',{})) if rune_rule=='preserve_rows' else {}
    if 'hero' in r:r['hero']['battle_temporary_state']={}
    r['items']=[];r['enchanted_rows']={};r['settled']=True;r['outcome']=outcome
    p['applied_commands'].append(command_id)
    return p,r,True

def boss_for(floor):
    scale=floor_scale(floor)
    boss=deepcopy(B['bosses'][(floor-1)%len(B['bosses'])])
    base_floor=boss['floor'];boss['floor']=floor
    if floor>base_floor:
        boss['hp']=rounded(boss['hp']*B['floors']['hp_growth']**(floor-base_floor))
        for key in ['light_attack','heavy_attack']:boss[key]=rounded(boss[key]*B['floors']['attack_growth']**(floor-base_floor))
    boss['extension_unbalanced']=floor>B['floors']['prototype_count']
    return boss

def example_run(seed=42,floor=1,run_id='example',tutorial=False):
    waves=[];previous_room=None;elite_count=0;previous_elite=False;low=0;misses=0;last=None;repeats=0
    for wave in range(1,B['waves']['count']+1):
        room=room_for(stream(seed,run_id,floor,wave,'layout'),previous_room,wave);previous_room=room['id']
        enc=encounter(stream(seed,run_id,floor,wave,'encounter'),stream(seed,run_id,floor,wave,'elite'),floor,wave,room,elite_count,previous_elite,run_id)
        elite_count+=enc['elite'];previous_elite=enc['elite']
        loot=chest(stream(seed,run_id,floor,wave,'loot'),floor,wave,low,enc['elite']);low=loot['low_streak_after']
        special=special_node(stream(seed,run_id,floor,wave,'special'),wave,misses,last,repeats,tutorial)
        misses,last,repeats=special['misses'],special['last_kind'],special['same_kind_count']
        waves.append({'wave':wave,'room':room,'encounter':enc,'chest':loot,'shop':shop(stream(seed,run_id,floor,wave,'shop'),floor,wave),'special':special})
    return {'seed':seed,'run_id':run_id,'floor':floor,'version':B['version'],'tutorial':tutorial,'extension_unbalanced':floor>2,'waves':waves,'boss':boss_for(floor)}

def example_enchant_service(seed=42,floor=1):
    node_id=f'F{floor}W4/enchant';profile={'gold':70,'applied_commands':[]}
    run={'run_id':'enchant-example','seed':seed,'floor':floor,'wave':4,'state':'SPECIAL','special_kind':'enchant',
         'active_special_node_id':node_id,'items':[],'enchanted_rows':{},'settled':False}
    run,_=open_enchant_node(run,node_id)
    steps=[{'action':'open_once','gold':profile['gold'],'node':deepcopy(run['enchant_nodes'][node_id])}]
    for count in range(B['enchant']['refresh_limit']):
        profile,run,result=refresh_enchant(profile,run,node_id,f'example/roll/{count}',count)
        steps.append({'action':'paid_roll','result':result,'gold':profile['gold'],'node':deepcopy(run['enchant_nodes'][node_id])})
    node=run['enchant_nodes'][node_id]
    profile,run,result=claim_enchant(profile,run,node_id,'example/claim',node['offer_revision'],node['offers'][0],0)
    steps.append({'action':'free_claim','result':result,'gold':profile['gold'],'enchanted_rows':deepcopy(run['enchanted_rows']),'node':deepcopy(run['enchant_nodes'][node_id])})
    return {'seed':seed,'floor':floor,'rule_revision':B['enchant']['rule_revision'],'steps':steps,
            'boundary':'Offer and transaction reference only; this example does not make wave4 a guaranteed service or implement combat effects.'}

if __name__=='__main__':
    out=ROOT/'05_验证与评审'/'seed42_两层生成样例.json'
    out.write_text(json.dumps([example_run(42,f) for f in [1,2]],ensure_ascii=False,indent=2)+'\n')
    print(out)
    enchant_out=ROOT/'05_验证与评审'/'seed42_附魔节点样例.json'
    enchant_out.write_text(json.dumps([example_enchant_service(42,f) for f in [1,2]],ensure_ascii=False,indent=2)+'\n')
    print(enchant_out)
