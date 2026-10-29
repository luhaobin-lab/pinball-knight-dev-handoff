/**
 * Ordinary admission after producer-authorized 2026-10-27 recovery. The G2 symbol names remain API compatibility.
 * Source/content admission is independent from registration and from original-runtime parity evidence.
 * Keep the stage declaration separate from class-registration checks so a generic ability cannot silently admit
 * a wave-B shop/enemy, and an unimplemented required G2 class is reported rather than redefining this scope.
 */
export const G2_SCOPE = {
  source: 'studio/CODEX_WORKFLOW.md:2026-10-27; studio/WAVE_B.md:enemy/shop/craft/camp source batches',
  tiles: ['空', '营地', '第一层', '宝箱房', '属性房', '探索房', '简单战斗', '普通战斗', '首领战斗', '抉择房', '恢复点', '锻造房', '精英战斗', '传奇房'],
  // Reviewed enemy, elite, hazard and shop/craft dependencies are present at cf0cdcf. Ordinary source weighted
  // variants and their real hero/level/tag conditions continue to choose which of these rows are reachable.
  enemies: ['眼球', '大肠', '大肠血卵', '守门人', '结晶', '水母脑', '齐刘海', '眼球包', '眼球_融合', '大肠团', '结晶簇', '章鱼脑', '盗宝黏菌'],
  combatVariants: [0, 1, 2, 3, 4],
  boss: { row: '守门人', fixedSkills: ['肉弹战车', '首领_守门人_重锤', '首领_守门人_连环重锤', '首领_守门人_熔岩道', '首领_守门人二阶_撕咬搜寻', '首领_守门人二阶_目视', '首领_守门人'] },
  // All172 audited Demo item roots; source row tags/unlock/hero/recipe predicates still govern actual offers.
  items: ["烈焰匕首","风火权杖","火山药水","浴火长袍","追风短剑","焚天兜帽","风语草","璀璨结晶","雷神匕首","蕴育石像","雷云精灵","超载十字架","爆裂圆盾","熔岩坚果","秘银鳞片","震雷木","黑洞法杖","守护圣徽","蓄势战甲","振金护腕","固甲石","延时护符","血契战盾","导能护符","铸甲重锤","回旋盔甲","巨人盾斧","旋风杖","圣契果","寄生犄角","活体软甲","尖角头盔","魔力皮靴","寻宝锄","聚气果","护盾孢子","再生腰带","肢体袋","蓄能手斧","打磨器","防滑裹布","激素腰带","黏黏藤","鲜血教母","无尽水壶","瘟疫花","猩红壁垒","混沌大剑","汲取藤蔓","女妖长袍","花冠","淬毒利刃","增生触手","疫病虫巢","噬毒护符","月光蕨","底力面具","饮血宝石","蛛后毒囊","药丸蜗牛","利齿骨鞭","袖剑","分身短弓","血祭匕首","迷踪披风","血舞斗篷","凝神连弩","魅影长靴","双生长弓","凝血毒剂","幻影轻弩","灌能护腕","饕餮之刃","速效药剂","幸运护符","守护之戒","灵魂香菇","泣血指环","无限箭袋","投手之握","蝮蛇弓","炸弹弓","闪鸣弓","时空水晶","共鸣结晶","汲取拳套","虚空工具盒","传奇附魔A","传奇附魔B","传奇附魔C","传奇附魔D","传奇附魔E","传奇附魔F","伤害附魔A","伤害附魔B","治愈附魔A","治愈附魔B","护甲附魔A","护甲附魔B","充能附魔A","充能附魔B","英雄附魔A","英雄附魔B","英雄附魔C","破损的神像","祝福之灵","空附魔石","空瓶","无字书","鲜血","生命药剂","生命药剂_新手关","体力药剂","魔力药剂","绷带","旧绷带","精矿","未知种子","旧匕首","旧项链","旧剑","旧盾","旧皮衣","旧长袍","旧鞋","旧手套","旧盔甲","旧弓","旧法杖","骨刺","魔力石","淬炼宝石","远古兽肉","优质兽皮","黄色药丸","蓝色药丸","红色药丸","绿色药丸","紫色药丸","巨神兵大剑","不可撼动之甲","万里追风靴","蕨叶","灼热眼珠","粘稠体液","节肢","怪兽肉","眼球杖","黄金头盔","纳气石锤","毒囊","腥臭尖牙","增生肉瘤","酸性血液","异变种子","结晶碎片","有机核心","厚重石块","多彩宝石","女王石","超载神经","记忆珠","迷幻中枢","活脑","克隆触手","魂珠","亡者之息","寂静法杖","死灵布","晶核剑","晶核盾","贪婪手套"],
  generalTalents: ["完美主义","药剂师","博学","上肢力量","下肢力量","重力冲刺","人形军械","上肢耐力","下肢耐力","生命成长","快速愈合","溢疗充能","治愈专精","力量","强韧","体质","敏捷","绝地反击","临阵强固","轻装上阵","暗藏杀机","锋芒毕露","连锁反应","胜利果实","余震","弱点洞察","嗜血本能","蓄势待发","厚实表皮"],
  bossTalents: ["大型装甲","真视","新生之力","癫狂","爆裂火星","蓄力击","掠夺","暴食"],
  // Knight/Hunter and untagged talent roots have reviewed source batches; unavailable hero tags stay excluded.
  // The ordinary source talent filter still controls hero identity, level, prerequisites, price and slot limits.
  heroTalents: ["重伤","武器大师","浴血奋战","活力","野蛮冲撞","幻影斩","血祭之力","举盾","钩锁","狂战士","防御姿态","盾牌专精","怒火精炼","铠甲强化","绝命","铜墙铁壁","动能吸收","战斗怒吼","屠戮收割","利钢淬血","百磨之刃","甲之吐息","不屈之魂","鹰眼","猎头","激素愈合","撕裂技巧","弹跳连射","腾跃","打磨","专注","自然之力","回流","穿透射击","影分箭","短兵相接","血铸壁垒","稳固射击","追风","会心护体","灵敏","裂心一击","连锁打击","创口切割","敏锐直觉","多重射击","心流原力","神速力","守护恩泽","苦痛转化","毒性加速","生生不息","火上浇油","元气循环","雷厉风行","大地之心"],
} as const;

export function g2Tile(row: string): boolean { return (G2_SCOPE.tiles as readonly string[]).includes(row); }
export function g2Enemy(row: string): boolean { return (G2_SCOPE.enemies as readonly string[]).includes(row); }
export function g2Item(row: string): boolean { return (G2_SCOPE.items as readonly string[]).includes(row); }
export function g2Talent(row: string): boolean {
  return (G2_SCOPE.generalTalents as readonly string[]).includes(row) || (G2_SCOPE.bossTalents as readonly string[]).includes(row)
    || (G2_SCOPE.heroTalents as readonly string[]).includes(row);
}

/** The source row remains intact. The recovery admits only these seven reviewed boss skills, not other content. */
export function stageFixedSkills<T extends { readonly RowName: string }>(filter: 'ported' | 'all', actor: string, skills: readonly T[]): readonly T[] {
  return filter === 'ported' && actor === G2_SCOPE.boss.row
    ? skills.filter(h => (G2_SCOPE.boss.fixedSkills as readonly string[]).includes(h.RowName))
    : skills;
}
