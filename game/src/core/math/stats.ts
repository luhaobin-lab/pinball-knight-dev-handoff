import { fromData, 科学数加减, 科学数乘除, 科学数零, type 科学数 } from './sci.ts';
import type { 结构_科学映射词条 } from '../../content/demo/types.ts';

/**
 * 科学词条 stat maps (core-math §6, 函数库_科学数 L484–L664). The source key "" holds the base value.
 * JS Map insertion order stands in for UE TMap order (TMap may refill a removed slot; only rounding can differ).
 */
// SPEC-GAP: TMap hole reuse after a removal is not reproduced; the iteration order only changes rounding (CORE-M-050).
export type 计算类型 = '加算' | '乘算';
export interface 科学映射词条 { 计算类型: 计算类型; 来源映射: Map<string, 科学数> }
export type 词条映射 = Map<string, 科学映射词条>;

const 一: 科学数 = { 系数: 1, 指数: 0 };

/** Deep copy of a data row's 科学词条 (values as stored, CORE-M-065). */
export function 词条映射From(row: Readonly<Record<string, 结构_科学映射词条>>): 词条映射 {
  const m: 词条映射 = new Map();
  for (const [name, entry] of Object.entries(row)) {
    const src = new Map<string, 科学数>();
    for (const [k, v] of Object.entries(entry.来源映射)) src.set(k, fromData(v));
    m.set(name, { 计算类型: entry.计算类型, 来源映射: src });
  }
  return m;
}

/** Deep copy of a runtime map. */
export function 复制词条映射(m: 词条映射): 词条映射 {
  const out: 词条映射 = new Map();
  for (const [name, e] of m) out.set(name, { 计算类型: e.计算类型, 来源映射: new Map(e.来源映射) });
  return out;
}

/**
 * CORE-M-051…053 (L588–L664). 加算: Σ values (`acc = v + acc`); 乘算: `1 − Π(1 − v)` with `acc = (1 − v) × acc`.
 * Not found → {0,0}, false.
 */
export function 获取科学映射词条(m: 词条映射, 词条名: string): { 输出值: 科学数; found: boolean } {
  const e = m.get(词条名);
  if (!e) return { 输出值: 科学数零, found: false };
  if (e.计算类型 === '加算') {
    let acc = 科学数零;
    for (const v of e.来源映射.values()) acc = 科学数加减(v, acc, false);
    return { 输出值: acc, found: true };
  }
  if (e.计算类型 === '乘算') {
    let acc = 一;
    for (const v of e.来源映射.values()) acc = 科学数乘除(科学数加减(一, v, true), acc, false);
    return { 输出值: 科学数加减(一, acc, true), found: true };
  }
  return { 输出值: 科学数零, found: false };
}

/**
 * CORE-M-054 (L499–L516). 累加 = the Demo's `覆盖/修改` (false overwrites, true adds to the existing source value).
 * QUIRK (L639): a stat that is not in the map is silently ignored.
 */
export function 添加科学映射值(m: 词条映射, 词条名: string, 来源: string, 值: 科学数, 累加: boolean): void {
  const e = m.get(词条名);
  if (!e) return;
  const src = new Map(e.来源映射);
  src.set(来源, 累加 ? 科学数加减(src.get(来源) ?? 科学数零, 值, false) : 值);
  m.set(词条名, { 计算类型: e.计算类型, 来源映射: src });
}

/**
 * CORE-M-055 (L484–L496). Returns whether 来源 was removed.
 * QUIRK: a missing stat is written back as the Map_Find default {加算, {}}, so an empty 加算 stat is created.
 */
export function 移除科学映射值(m: 词条映射, 词条名: string, 来源: string): boolean {
  const e = m.get(词条名);
  const src = new Map(e?.来源映射 ?? []);
  const removed = src.delete(来源);
  m.set(词条名, { 计算类型: e?.计算类型 ?? '加算', 来源映射: src });
  return removed;
}

/**
 * CORE-M-056 (L519–L571): the base source "" alone, or with 补充永久 the base + "永久保留" + every "…/附魔" source.
 * (The Demo's second output `浮点` is 科学数变普通 of the result.)
 */
export function 科学映射原始值(m: 词条映射, 词条名: string, 补充永久: boolean): 科学数 {
  const src = m.get(词条名)?.来源映射;
  const base = src?.get('') ?? 科学数零;
  if (!补充永久) return base;
  let ench = 科学数零;
  if (src) for (const [k, v] of src) if (k.slice(-3) === '/附魔') ench = 科学数加减(v, ench, false);
  return 科学数加减(科学数加减(base, src?.get('永久保留') ?? 科学数零, false), ench, false);
}
