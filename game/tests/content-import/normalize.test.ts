import { describe, expect, it } from 'vitest';
import { assetPath, createNormalizer, normalizeRichCurve, parseType, safeKey, scientificValue } from '../../tools/data/normalize.mjs';

// The normalization rules of tools/data/normalize.mjs on hand-made dump values (shapes as in D:/TAPTAPGAME_ref/dump).

const enums = {
  枚举_词条映射类行: {
    asset: '/Game/CatapultHero/枚举/枚举_词条映射类行',
    name: '枚举_词条映射类行',
    cpp_form: 'Namespaced',
    values: [
      { name: 'NewEnumerator0', value: 0, display: '加算' },
      { name: 'NewEnumerator1', value: 1, display: '乘算' },
      { name: '枚举_MAX', value: 2, display: null },
    ],
  },
};
const struct = (name: string, fields: [string, string][]) => ({
  asset: `/Game/CatapultHero/结构/${name}`,
  name,
  guid: '',
  fields: fields.map(([n, type]) => ({ name: n, raw_name: `${n}_1_GUID`, type })),
  defaults: {},
});
const structs = {
  结构_科学数: struct('结构_科学数', [['系数', 'Double'], ['指数', 'Int']]),
  结构_科学映射词条: struct('结构_科学映射词条', [['计算类型', 'Byte<枚举_词条映射类行>'], ['来源映射', 'Map<Str, Struct<结构_科学数>>']]),
  结构_条件: struct('结构_条件', [['解锁材料', 'Map<Name, Int>'], ['前置标签', 'Map<Struct<GameplayTag>, Int>'], ['目标标签', 'Struct<GameplayTagContainer>']]),
};

function normalizer() {
  const notes: string[] = [];
  const n = createNormalizer({ structs, enums, note: (kind, where) => notes.push(`${kind} ${where}`) });
  return { n, notes, value: (v: unknown, type: string) => n.value(v, parseType(type), 'test') };
}

describe('科学数', () => {
  it('is 系数 × 10^指数 like 函数库_科学数.科学数变普通, with the raw pair kept', () => {
    expect(scientificValue(2, 1)).toBe(20);
    expect(scientificValue(1.5, 2)).toBe(150);
    expect(scientificValue(2.5, 1)).toBe(25);
    expect(scientificValue(1.5, -1)).toBe(1.5 * 0.1);
    expect(Object.is(scientificValue(-0, 3), 0)).toBe(true);
    expect(normalizer().value({ 系数: 1, 指数: 10 }, 'Struct<结构_科学数>')).toEqual({ 值: 1e10, 系数: 1, 指数: 10 });
  });

  it('keeps 科学词条 maps with their 计算类型', () => {
    const v = normalizer().value(
      { 基础伤害: { 计算类型: { $enum: '枚举_词条映射类行', name: 'NewEnumerator0', value: 0, display: '加算' }, 来源映射: { '': { 系数: 2, 指数: 1 } } } },
      'Map<Str, Struct<结构_科学映射词条>>',
    );
    expect(v).toEqual({ 基础伤害: { 计算类型: '加算', 来源映射: { '': { 值: 20, 系数: 2, 指数: 1 } } } });
  });
});

describe('FText', () => {
  it('becomes {zh, en}', () => {
    expect(normalizer().value({ text: '旧剑', en: 'Old Sword', ns: '数据表_修炼物品_通用', key: 'K' }, 'Text')).toEqual({ zh: '旧剑', en: 'Old Sword' });
  });

  it('repeats zh as en where the Demo has no translation, and notes it', () => {
    const { value, notes } = normalizer();
    expect(value({ text: '空地', ns: '', key: 'K' }, 'Text')).toEqual({ zh: '空地', en: '空地' });
    expect(notes).toEqual(['text-without-en test']);
  });

  it('serves culture-invariant and empty texts in both languages', () => {
    expect(normalizer().value({ invariant: '测试眼球' }, 'Text')).toEqual({ zh: '测试眼球', en: '测试眼球' });
    expect(normalizer().value({ invariant: null }, 'Text')).toEqual({ zh: '', en: '' });
  });
});

describe('object references', () => {
  it('become asset paths (package path minus /Game/)', () => {
    expect(assetPath("SoundWave'/Game/CatapultHero/声音/原素材/拾取/PickUpBag.PickUpBag'")).toBe('CatapultHero/声音/原素材/拾取/PickUpBag');
    expect(assetPath("BlueprintGeneratedClass'/Game/CatapultHero/BP/Skill/Ability/蓝图_能力_闪现.蓝图_能力_闪现_C'")).toBe('CatapultHero/BP/Skill/Ability/蓝图_能力_闪现');
    expect(assetPath("Texture2D'/Bridge/MSPresets/M_MS_Glass_Material/Textures/White.White'")).toBe('/Bridge/MSPresets/M_MS_Glass_Material/Textures/White');
    expect(assetPath("PaperSprite'/Game/CatapultHero/精灵片/Sheet.Other'")).toBe('CatapultHero/精灵片/Sheet.Other');
    expect(assetPath(null)).toBeNull();
    expect(() => assetPath('not a reference')).toThrow();
  });

  it('inside row handles', () => {
    const handle = { DataTable: "DataTable'/Game/CatapultHero/数据表/技能/数据表_技能_默认.数据表_技能_默认'", RowName: '自愈' };
    expect(normalizer().value(handle, 'Struct<DataTableRowHandle>')).toEqual({ DataTable: 'CatapultHero/数据表/技能/数据表_技能_默认', RowName: '自愈' });
  });
});

describe('enums, maps and structs', () => {
  it('enums become their display name and must match the enum definition', () => {
    const { value } = normalizer();
    expect(value({ $enum: '枚举_词条映射类行', name: 'NewEnumerator1', value: 1, display: '乘算' }, 'Byte<枚举_词条映射类行>')).toBe('乘算');
    expect(() => value({ $enum: '枚举_词条映射类行', name: 'NewEnumerator1', value: 0, display: '乘算' }, 'Byte<枚举_词条映射类行>')).toThrow();
  });

  it('maps become objects: [] when empty, [{key, value}] when keyed by a struct', () => {
    const v = normalizer().value({ 解锁材料: [], 前置标签: [{ key: { TagName: '可交互.修炼牌.火系' }, value: 0 }], 目标标签: ['能力.类型.治疗'] }, 'Struct<结构_条件>');
    expect(v).toEqual({ 解锁材料: {}, 前置标签: { '可交互.修炼牌.火系': 0 }, 目标标签: ['能力.类型.治疗'] });
  });

  it('a struct must carry exactly its fields', () => {
    expect(() => normalizer().value({ 系数: 1 }, 'Struct<结构_科学数>')).toThrow();
    expect(() => normalizer().value({ 解锁材料: [], 前置标签: [], 目标标签: [], 多余: 1 }, 'Struct<结构_条件>')).toThrow();
  });

  it('refuses keys a JS object would reorder', () => {
    expect(() => safeKey('12')).toThrow();
    expect(() => safeKey('__proto__')).toThrow();
    expect(safeKey('NewRow_0')).toBe('NewRow_0');
  });
});

describe('curves', () => {
  it('fill the FRichCurve defaults the cooked asset omits', () => {
    const key = { InterpMode: 'RCIM_Linear', TangentMode: 'RCTM_Auto', TangentWeightMode: 'RCTWM_WeightedNone', Time: 1, Value: 1, ArriveTangent: 0, ArriveTangentWeight: 0, LeaveTangent: 0, LeaveTangentWeight: 0 };
    expect(normalizeRichCurve({ Keys: [key] }, 'test')).toEqual({ Keys: [key], DefaultValue: 3.4028235e38, PreInfinityExtrap: 'RCCE_Constant', PostInfinityExtrap: 'RCCE_Constant' });
    expect(normalizeRichCurve({ PreInfinityExtrap: 'ERichCurveExtrapolation::RCCE_Linear' }, 'test')).toMatchObject({ Keys: [], PreInfinityExtrap: 'RCCE_Linear' });
  });
});
