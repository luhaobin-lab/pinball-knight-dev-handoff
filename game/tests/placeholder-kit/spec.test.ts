import { describe, expect, it } from 'vitest';
import { 数据表_敌人_普通 } from '../../src/content/demo/index.ts';
import { ENEMY_ROWS, FAMILIES, figureSpec, FIGURE_HEIGHT_PER_UU, type FamilyId } from '../../src/procgen/placeholder/spec';

describe('figureSpec', () => {
  it('covers every row of 数据表_敌人_普通 with a family, a form and a tier', () => {
    expect(ENEMY_ROWS.length).toBe(Object.keys(数据表_敌人_普通.rows).length);
    for (const row of ENEMY_ROWS) {
      const s = figureSpec(row);
      expect(FAMILIES[s.family], row).toBeDefined();
      expect(s.form, row).toBeTruthy();
    }
  });

  it('groups rows by the Demo sprite sheet they wear', () => {
    const family = (row: string): FamilyId => figureSpec(row).family;
    expect(['眼球', '眼球_融合', '眼球包', '眼球包_0', '新手关眼球包', '新手关眼球包2'].map(family)).toEqual(Array(6).fill('eyeball'));
    expect(['大肠', '大肠血卵', '大肠血卵_坏卵', '大肠团', '火球精'].map(family)).toEqual(Array(5).fill('intestine'));
    expect(['结晶', '结晶簇'].map(family)).toEqual(['crystal', 'crystal']);
    expect(['水母脑', '章鱼脑'].map(family)).toEqual(['brain', 'brain']);
    expect(['盗宝黏菌', '齐刘海', '西瓜猪'].map(family)).toEqual(['slime', 'wraith', 'beast']);
    expect(['守门人', '结晶骑士', '弑神幼虫', '重生傀儡', '幽焰龙'].map(family)).toEqual(['golem', 'knight', 'larva', 'puppet', 'dragon']);
    expect(['宝箱', '新手关宝箱', '石墙', 'NewRow', 'NewRow_0'].map(family)).toEqual(['chest', 'chest', 'wall', 'dummy', 'dummy']);
  });

  it('reads the tier from the AI tags: five bosses, the 噩梦 rows forced elites, the rest normal', () => {
    const bosses = ENEMY_ROWS.filter(r => figureSpec(r).tier === 'boss');
    expect(bosses.sort()).toEqual(['守门人', '幽焰龙', '弑神幼虫', '结晶骑士', '重生傀儡'].sort());
    for (const row of ['眼球包', '大肠团', '结晶簇', '章鱼脑', '新手关眼球包']) {
      const s = figureSpec(row);
      expect(s.tier, row).toBe('nightmare');
      expect(s.elite, row).toBe(true);
    }
    expect(figureSpec('眼球').elite).toBe(false);
    expect(figureSpec('眼球', { elite: true }).elite).toBe(true);
    // neutral rows never wear the elite mark
    expect(figureSpec('宝箱', { elite: true }).elite).toBe(false);
  });

  it('sizes every figure from its row: 宽度 / 64 tiles of footprint, 3 × 高度 / 64 tiles of height', () => {
    for (const row of ENEMY_ROWS) {
      const a = 数据表_敌人_普通.rows[row].属性;
      const s = figureSpec(row);
      if (a.宽度 > 0) expect(s.radius, row).toBeCloseTo(a.宽度 / 64, 9);
      if (FAMILIES[s.family].group === 'enemy') expect(s.height, row).toBeCloseTo((FIGURE_HEIGHT_PER_UU * a.高度) / 64, 9);
    }
    // the knight's own proportion: 56 uu → 2.625 tiles, as KNIGHT_BOX's 168 uu
    expect(FIGURE_HEIGHT_PER_UU * 56).toBe(168);
    // rows with no size: the wall fills its cell, the 玩家-type test rows take the hero's 56 uu
    expect(figureSpec('石墙').radius).toBe(0.5);
    expect(figureSpec('NewRow').radius).toBe(56 / 64);
  });

  it('marks the rows that share a sheet but play differently', () => {
    expect(figureSpec('眼球_融合').variant).toBe('fused');
    expect(figureSpec('大肠血卵_坏卵').variant).toBe('bad');
    expect(figureSpec('火球精').variant).toBe('fire');
    expect(figureSpec('大肠血卵').variant).toBe('plain');
    expect(figureSpec('大肠血卵').immobile).toBe(true);
  });

  it('gives every enemy family its own wrong detail, and neutral rows none', () => {
    const enemy = Object.values(FAMILIES).filter(f => f.group === 'enemy');
    const details = enemy.map(f => f.detail);
    expect(details.every(d => d !== null)).toBe(true);
    expect(new Set(details).size).toBe(enemy.length);
    for (const f of Object.values(FAMILIES)) if (f.group === 'neutral') expect(f.detail, f.id).toBeNull();
  });

  it('is deterministic', () => {
    for (const row of ENEMY_ROWS) expect(figureSpec(row)).toEqual(figureSpec(row));
  });
});
