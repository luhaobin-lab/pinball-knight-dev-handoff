"""Build the proposed configuration from audited source IDs, never edit source data."""
from pathlib import Path
import json, hashlib

ROOT = Path(__file__).resolve().parents[1]
WORKSPACE = ROOT.parent
AUDIT = ROOT / '01_研究与依据/data_inventory.json'
if not AUDIT.exists():
    AUDIT = WORKSPACE / 'outputs/新循环设计/GDD_v0.2_研究/data_inventory.json'
data = json.loads(AUDIT.read_text())['selected']
ENCHANT_CATALOG = ROOT / '03_数值与配置/enchants.json'
enchant_catalog = json.loads(ENCHANT_CATALOG.read_text())
enchant_offer = enchant_catalog['offer_config']
assert {e['id'] for e in enchant_catalog['enchants']} == {f'E{i:03d}' for i in range(1,51)}
assert len(enchant_catalog['enchants']) == 50 and all(e['design_enabled'] for e in enchant_catalog['enchants'])

def save(name, obj):
    path = ROOT / '03_数值与配置' / name
    text = json.dumps(obj, ensure_ascii=False, indent=2)+'\n'
    if not path.exists() or path.read_text() != text:path.write_text(text)

balance = {
 'version':'0.2.0-discussion', 'date':'2026-10-29',
 'status':'新设计初始测试值；不代表Dungeonbound隐藏公式或实战平衡已验证',
 'confirmed':{'death_loses':'all_carried_items', 'retains':['gold','xp','level','skill_points','talents','stash','unlocked_floors'], 'enchant_lifetime':'until_death_or_abandon','forge_failure':'minus_one_honing_level_min_zero'},
 'hero':{'source_row':'幽冥骑士','hp':180,'attack':30,'stamina':100,'corruption':0,'gold':0,'level':1,'skill_points':0,'equipment_rows':8,'bag_rows':12,'stash_rows':40,'base_cell_width':2,'base_bounce_limit':4,'base_bounce_distance':500},
 'recovery':{'after_wave_hp_fraction':0.08,'after_wave_stamina':30,'before_boss_hp_fraction':0.15,'camp_full_restore':True,'turn_stamina_cost':5,'fatigue_at_zero_corruption':2,'corruption_limit':100,'corruption_limit_outcome':'death'},
 'waves':{'count':6,'budget':[4,5,6,7.5,9,11],'hp_factor':[0.8,0.9,1,1.10,1.20,1.32],'attack_factor':[0.8,0.85,0.92,1,1.08,1.16],'gold':[12,15,18,21,25,29],'xp':[25,30,35,45,55,70],'enemy_count_max':6,'ranged_max':2,'healer_max':1,'elite_probability':[0,0,0.10,0.20,0.25,0.30],'elite_per_floor_max':2,'elite_consecutive':False},
 'floors':{'prototype_count':2,'hp_growth':1.45,'attack_growth':1.22,'reward_growth':1.35,'enemy_budget_growth':1,'elite_hp':1.6,'elite_attack':1.2,'elite_cost':1.6,'elite_reward':1.5},
 'bosses':[{'id':'B01','source_visual_row':'守门人','name':'守门人·试炼形态','floor':1,'hp':450,'light_attack':10,'heavy_attack':22,'phase2_hp_fraction':0.5,'adds_cap':2}, {'id':'B02','source_visual_row':'结晶骑士','name':'结晶骑士·试炼形态','floor':2,'hp':680,'light_attack':13,'heavy_attack':28,'phase2_hp_fraction':0.5,'adds_cap':2}],
 'boss_rewards':{'gold':100,'xp':150,'chest_choices':3,'chest_picks':2,'min_tier':2,'first_clear_bonus_gold':40},
 'progression':{'level_cap':12,'xp_threshold_base':60,'xp_threshold_growth':1.5,'points_each_level':1,'level_up_heals':False,'level_up_stat_gain':False,'talent_unlock_points':1,'talent_unlock_rank':1,'rank_upgrade_gold':[30,50,80,120,170,230,300],'respec':'camp_only_free_full_refund'},
 'loot':{'normal_choices':3,'normal_picks':1,'elite_choices':3,'elite_picks':2,'tier_weights_floor1':[[86,13,1],[83,15.5,1.5],[80,18,2],[77,20.5,2.5],[74,23,3],[71,25.5,3.5]],'tier_weights_floor2':[[64,31,5],[61,33,6],[58,35,7],[55,37,8],[52,39,9],[49,41,10]],'pity_low_chests':3,'pity_min_tier':2,'first_chest_guaranteed_weapon':True,'category_weights':{'weapon':40,'defense':25,'support':20,'consumable':15},'luck_cap':0.5,'choice_identity_unique':True,'tier_scalar':[1,1.22,1.48]},
 'shop':{'equipment_offers':4,'consumable_offers':2,'refresh_limit':2,'refresh_cost':[8,14],'tier_price_factor':[1,1.7,2.8],'sale_fraction':0.3,'discount_cap':0.2,'sells_to_camp':True,'refresh_excludes_consumables':True,'heal_service_price':10,'heal_service_fraction':0.25,'heal_service_limit':1,'free_refresh':False,'buyback':False},
 'forge':{'max_honing':3,'success_chance':[0.85,0.65,0.45],'cost':[12,24,40],'magnitude_per_rank':0.15,'failure_rank_delta':-1,'failure_floor':0,'attempts_per_visit':3,'sale_bonus':0,'pity':False},
 'merge':{'enabled':True,'requires':'same_definition_and_tier','tier_cap':3,'cost_per_input_tier':10,'result_honing':'max_of_inputs','reset_charge_progress':True,'consumables_allowed':False},
 'special':{'base_probability':0.5,'maximum_misses':2,'kind_weights':{'forge':1,'enchant':1},'repeated_kind_limit':2,'service_choice':False,'w6_is_eligible':True},
 'enchant':{
  'rule_revision':'enchant50-v1','catalog_file':'enchants.json','enabled_count':50,
  'status':'全部50种设计启用；战斗效果均待适配与运行验证，参考算法只覆盖抽选和交易',
  'slot_unit':'whole_row','activation':'item_top_anchor_row_only',
  'offered_choices':enchant_offer['offer_count'],'price':enchant_offer['selection_price'],
  'claims_per_visit':enchant_offer['free_choices_per_visit'],'refresh_limit':enchant_offer['reroll_limit'],'refresh_costs':enchant_offer['reroll_costs'],
  'refresh_cost_status':'首轮可调测试值；每次翻倍；每节点独立计数',
  'tier_base_weights':enchant_offer['rarity_base_weights'],'floor_factor_growth':enchant_offer['floor_factor_growth'],
  'tier_weight_rule':'base_weight * floor_factor ** tier_index',
  'tier_weight_status':'首轮可调测试公式；按层，不叠波次、幸运、战力；第三层后不代表游戏平衡已验证',
  'draw_rule':'each_choice_draws_tier_then_uniform_remaining_id','same_roll_unique_ids':enchant_offer['same_offer_unique_ids'],
  'cross_roll_repeats':enchant_offer['repeat_across_rerolls'],'cross_node_repeats':enchant_offer['repeat_across_nodes'],
  'rarity_pity':enchant_offer['rarity_modifiers']['pity'],'loadout_filter':False,
  'enchanted_rows_max':enchant_offer['enchanted_rows_max_including_inherited'],'replace_allowed':True,
  'replace_requires_confirmation':enchant_offer['replacement_requires_confirmation'],
  'duplicate_ids_across_rows':enchant_offer['same_id_allowed_across_rows'],'cross_row_rarity_limit':enchant_offer['legendary_unique_limit'],
  'refresh_after_claim':enchant_offer['reroll_after_claim'],
  'cancel_replacement_consumes_claim':enchant_offer['cancel_replacement_consumes_claim'],
  'paid_refreshes_refundable':enchant_offer['paid_rerolls_refundable'],
  'lifetime':'until_death_or_abandon','outcome_rules':{'victory':'preserve_rows','death':'clear_rows','abandon':'clear_rows'},
  'legacy_rune_id_policy':'旧R_*无对应迁移表时拒绝解释，不猜测映射为E001-E050',
 },
 'rng':{'algorithm':'xorshift32','seed_hash':'FNV-1a UTF-8','domains':['layout','encounter','elite','loot','shop','special','forge','combat','enchant_offer'],'save_states':True,'restore_never_rerolls':True,'content_version_in_seed':True},
 'endless':{'enabled_in_prototype':False,'formula_extension_tested_to_floor':100,'theme_cycle':2,'boss_wave':7,'tier_cap_in_prototype':3,'growth_problem':'有限装备和天赋上限下不能保证任意深度可通关；无尽指持续生成，不指难度已平衡'},
}
save('balance.json',balance)

roles = [
 ('M_GRUNT','眼球','眼球虫','melee',2,45,6,0,1),
 ('M_FAST','大肠','血蛆','fast',1.5,30,5,0,1),
 ('M_RANGED','结晶','活体结晶','ranged',2.5,36,8,0,2),
 ('M_GUARD','重生傀儡','重生傀儡','guard',3,75,8,0,3),
 ('M_HEALER','水母脑','浮游脑','healer',3,42,4,10,3),
 ('M_BRUTE','结晶骑士','结晶骑士','brute',4.5,100,12,0,4),
]
enemy_source={r['源行名']:r for r in data['enemy_base']}
monsters=[]
for id,row,name,role,cost,hp,atk,heal,wave in roles:
    source=enemy_source[row]
    monsters.append({'id':id,'name':name,'source_row':row,'source_range':source['_range'],'source_workbook':'Ricochet_Abyss_Demo_R3_01数值与机制.xlsx','source_sheet':'敌人经验及基础配置','source_original_hp':source['基础生命词条'],'source_original_attack':source['基础伤害'],'prototype_is_boss':False,'inherits_source_boss_tags':False,'role':role,'budget_cost':cost,'base_hp':hp,'base_attack':atk,'heal':heal,'min_wave':wave,'floor_min':1,'status':'视觉与行名复用；数值和本GDD行为模板是新配置，不能同时加载旧成长与旧随机精英技能'})
save('monsters.json',monsters)

room_defs=[('ROOM_OPEN','开阔场',[],['all']),('ROOM_TWIN','双柱场',[[1,3],[3,3]],['all']),('ROOM_LEFT','偏左掩体',[[0,2],[1,2]],['all']),('ROOM_RIGHT','偏右掩体',[[3,2],[4,2]],['all']),('ROOM_EDGE','侧边石柱',[[0,3],[4,3]],['all']),('ROOM_HIGH','前排掩体',[[1,1],[3,1]],['all'])]
save('rooms.json',[{'id':id,'name':name,'width':5,'height':7,'tile_size':256,'hero_spawn':[2,5],'exit':[2,0],'blocked':obs,'enemy_slots':[[x,y] for y in range(4) for x in range(5) if [x,y] not in obs],'rotation_allowed':False,'mirror_x_allowed':True,'min_spawn_distance_tiles':2,'min_actor_clearance_uu':128,'stage':'提案模板；实际碰撞体、投射轨迹与镜头仍须实机验收'} for id,name,obs,_ in room_defs])

category={'旧剑':'weapon','旧匕首':'weapon','旧弓':'weapon','蓄能手斧':'weapon','旧盾':'defense','旧鞋':'defense','旧皮衣':'defense','固甲石':'defense','旧项链':'support','旧手套':'support','魔力皮靴':'support','打磨器':'support','生命药剂':'consumable','体力药剂':'consumable'}
price={'旧剑':18,'旧匕首':12,'旧弓':16,'蓄能手斧':26,'旧盾':18,'旧鞋':16,'旧皮衣':18,'固甲石':22,'旧项链':14,'旧手套':14,'魔力皮靴':24,'打磨器':22,'生命药剂':12,'体力药剂':8}
equipment={r['原始RowName']:r for r in data['prototype_equipment']}
video={r['中文名称']:r for r in data['prototype_equipment_video']}
size={r['物品原行名']:r for r in data['prototype_candidate_pool']}
items=[]
for row,cat in category.items():
    src=equipment[row]; vid=video[row]
    tags=[cat]
    if row=='旧匕首': tags.append('bleed') # New semantic adapter tag, not a claim about source tags.
    if vid['每次反弹充能'] is not None: tags.append('charged')
    if row in ['旧项链','生命药剂']: tags.append('healing')
    if row in ['旧盾','旧鞋','旧皮衣','固甲石','魔力皮靴']: tags.append('defense')
    items.append({'id':vid['编号'],'name':row,'source_row_id':src['记录ID'],'source_row':row,'source_table':src['原表'],'source_workbook':'Ricochet_Abyss_Demo_R3_01数值与机制.xlsx','source_sheet':'装备物品总表','source_range':src['_range'],'video_workbook':'视频内容研究总表.xlsx','video_sheet':'装备物品','video_range':vid['_range'],'video_description':vid['说明原文'],'source_template':src['固定技能及原描述模板'],'source_charge_per_bounce':vid['每次反弹充能'],'height_rows':size[row]['高格数'],'width_base_cells':2,'source_width':size[row]['宽格数'],'category':cat,'tags':list(dict.fromkeys(tags)),'tag_policy':'tags是新运行适配标签；旧匕首bleed由实际流血效果推导，不声称原表自带标签','base_price':price[row],'base_weight':100,'floor_min':1,'wave_min':3 if row in ['蓄能手斧','魔力皮靴','打磨器','固甲石'] else 1,'tier_min':1,'tier_max':1 if cat=='consumable' else 3,'honing_allowed':cat!='consumable','effect_policy':'沿用来源能力链；强化只乘白名单强度，不乘触发次数或范围；动态值不得硬抄视频快照','charges_max':3 if cat=='consumable' else None})
for item in items:
    item['enabled']=True
    item['runtime_validation']='not_yet_verified; design-enabled is not runtime proof'
save('items.json',items)

talent_meta=[('力量',8,'base_attack_flat',3,[],1),('体质',8,'max_hp_fraction',0.05,[],1),('敏捷',4,'bounce_distance_flat',25,[],1),('强韧',4,'damage_reduction',0.025,['体质'],2),('博学',4,'xp_fraction',0.05,[],1),('锋芒毕露',4,'weapon_crit_chance',0.025,['力量'],2),('临阵强固',4,'turn_start_armor_hp_fraction',0.005,['体质'],3),('活力',4,'turn_start_heal_hp_fraction',0.005,['体质'],3),('防御姿态',4,'armor_item_charge_fraction',0.075,['体质'],3),('猎头',4,'elite_boss_damage_fraction',0.05,['力量'],3),('撕裂技巧',4,'bleed_item_charge_fraction',0.075,['力量'],3)]
talents=[]
for name,cap,effect,step,parents,minlevel in talent_meta:
    src=next(r for r in data['prototype_talents'] if r['原始RowName']==name)
    vid=next(r for r in data['prototype_talents_video'] if r['中文名称']==name)
    talents.append({'id':vid['编号'],'name':name,'source_row_id':src['记录ID'],'source_table':src['原表'],'source_workbook':'Ricochet_Abyss_Demo_R3_01数值与机制.xlsx','source_sheet':'天赋总表','source_range':src['_range'],'source_template':src['原描述模板'],'video_workbook':'视频内容研究总表.xlsx','video_sheet':'天赋','video_range':vid['_range'],'video_description':vid['说明原文'],'rank_cap':cap,'effect':effect,'per_rank':step,'prerequisites':parents,'hero_level_min':minlevel,'unlock_cost_skill_points':1,'unlock_grants_rank':1,'upgrade_costs':balance['progression']['rank_upgrade_gold'][:cap-1],'value_policy':'本GDD覆盖值；不把源参数标量直接当最终输出'})
save('talents.json',talents)

contract={'audit_sha256':hashlib.sha256(AUDIT.read_bytes()).hexdigest(),'audit_file':'../01_研究与依据/data_inventory.json','source_workbooks_relative_to_workspace':['outputs/视频内容研究资料/视频内容研究总表.xlsx','outputs/视频内容研究资料/原始仓库表格/Ricochet_Abyss_Demo_R3_01数值与机制.xlsx','outputs/视频内容研究资料/原始仓库表格/Ricochet_Abyss_Demo_R3_02原始字段与证据.xlsx','outputs/视频内容研究资料/原始仓库表格/R3补充B_技能与天赋消费者.xlsx'],'selected_item_count':len(items),'selected_talent_count':len(talents),'source_item_count_is_not_implemented_count':True,'precedence':['用户确认规则','balance.json与模块规则','原始数据适配清单','旧源码参考'],'excluded':['测试/忽略/派生物未指定入口','胜利果实精核货币','任意两件融合','局内随机天赋选择','原物品附魔石逻辑','旧永久神像仓库门槛']}
contract['local_source_copies']=['../01_研究与依据/原始表格/'+Path(p).name for p in contract['source_workbooks_relative_to_workspace']]
contract['enchant_catalog']='enchants.json'
contract['enchant_catalog_sha256']=hashlib.sha256(ENCHANT_CATALOG.read_bytes()).hexdigest()
contract['selected_enchant_count']=len(enchant_catalog['enchants'])
contract['enchant_runtime_validation']='all_50_design_enabled; adapters_and_combat_validation_required'
save('source_contract.json',contract)
print('Built balance, 6 monsters, 6 rooms,',len(items),'items,',len(talents),'talents; retained',len(enchant_catalog['enchants']),'self-contained enchant definitions')
