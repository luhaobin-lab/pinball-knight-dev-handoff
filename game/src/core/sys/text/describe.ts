/**
 * Ability description text (draft core-math §8, CORE-M-080…086): 函数库_工具.根据参数生成文本 (L1922–L1984),
 * 生成能力描述参数 (L1987–L2041), 词条说明参数 (L50–L86), 提示简化处理 (L19–L47) and the Format step of
 * 蓝图_能力.更新技能描述 (L98–L205). Structural inputs so the module needs no generated class.
 */
import type { 参数 } from '../../ability/params.ts';
import { FTrunc, Log } from '../../math/kismet.ts';
import { sciOf, 科学数ABS, 科学数乘除, 科学数变普通, type 科学数 } from '../../math/sci.ts';
import { 获取科学映射词条, 科学映射原始值, type 词条映射 } from '../../math/stats.ts';
import { asPercent, 数字缩写, 科学数字缩写 } from './numfmt.ts';

/** What 根据参数生成文本 reads from a 蓝图_能力: its owner's stats (null = no valid owner) and its parameters. */
export interface DescribeSource {
  readonly 参数: readonly 参数[];
  readonly 等级: number;
  /** `能力.拥有者.词条`, or null when `IsValid(能力.拥有者)` is false. */
  readonly 拥有者词条: 词条映射 | null;
}

/**
 * 根据参数生成文本(参数, 能力, 等级) → { text, 纯数值文本 } (CORE-M-081…083). text = `" <天赋>" + value + "</> "`.
 * An ability without a valid owner prints the debug text "没有拥有者" in the Demo and returns "" (L3072).
 */
export function 根据参数生成文本(p: 参数, 拥有者词条: 词条映射 | null, 等级: number): { text: string; 纯数值文本: string } {
  if (!拥有者词条) return { text: '', 纯数值文本: '' };
  const w = p.词条;
  const lvlQ = FTrunc(Log(等级, 2)) + 1;
  const v = p.提升值 * (p.品质倍率 ? lvlQ : 等级) + p.初始值;
  const absV = Math.abs(v);
  const stat = 获取科学映射词条(拥有者词条, w).输出值;
  const y0 = w.startsWith('Y');
  const y1 = w.slice(0, 1).toUpperCase() === 'Y';
  const raw = 科学映射原始值(拥有者词条, w.slice(1), y0);
  const noCalc = p.不预算 || w === '';
  const vSci: 科学数 = sciOf(v, 0);
  const p1 = 科学数ABS(科学数乘除(stat, vSci, false));
  const p2 = 科学数ABS(科学数乘除(raw, vSci, false));
  let value: string;
  if (p.整数) value = y1 ? 科学数字缩写(p2, 2).text : 数字缩写(absV).text;
  else if (noCalc) value = asPercent(absV, 3);
  else if (y1) value = asPercent(科学数变普通(p2), 3);
  else if (w.includes('%')) value = asPercent(科学数变普通(p1), 3);
  else value = 科学数字缩写(p1, 2).text;
  const 纯数值文本 = noCalc || y1 ? value : asPercent(absV, 3);
  return { text: ` <天赋>${value}</> `, 纯数值文本 };
}

/**
 * 生成能力描述参数(能力, 预览等级, 预览下N级？, N) (CORE-M-084): one text per parameter; the preview joins the two
 * levels with "→" unless 提升值 is 0.
 */
export function 生成能力描述参数(src: DescribeSource, 预览等级: number, 预览下N级: boolean, N: number): string[] {
  return src.参数.map(p => {
    const now = 根据参数生成文本(p, src.拥有者词条, 预览等级).text;
    if (!预览下N级 || p.提升值 === 0) return now;
    return `${now}→${根据参数生成文本(p, src.拥有者词条, 预览等级 + N).text}`;
  });
}

/**
 * FText::Format with named arguments "0"…: `{n}` with a matching argument is replaced, other placeholders stay.
 * SPEC-GAP: UE's escaping (`` ` ``) and argument modifiers are not reproduced (no Demo description uses them).
 */
export function formatText(template: string, args: Readonly<Record<string, string>>): string {
  return template.replace(/\{([^{}]+)\}/g, (all, name: string) => (Object.hasOwn(args, name) ? args[name] as string : all));
}

/**
 * The text step of 蓝图_能力.更新技能描述 (CORE-M-080): `{0}`…`{3}` from 描述中参数 (missing → ""), `{4}` always "";
 * 额外描述 uses AddUnique, so equal lines collapse (QUIRK L170).
 */
export function 格式化技能描述(原始描述: string, 额外原始描述: readonly string[], 描述中参数: readonly string[]): { 描述: string; 额外描述: string[] } {
  const args = { '0': 描述中参数[0] ?? '', '1': 描述中参数[1] ?? '', '2': 描述中参数[2] ?? '', '3': 描述中参数[3] ?? '', '4': '' };
  const 额外描述: string[] = [];
  for (const t of 额外原始描述) {
    const line = formatText(t, args);
    if (!额外描述.includes(line)) 额外描述.push(line);
  }
  return { 描述: formatText(原始描述, args), 额外描述 };
}

/**
 * 词条说明参数(原始文本, 游戏模式) (CORE-M-086): `{0}` = the hero's 格挡减伤%, `{1}` = 强固减伤% (AsPercent ≤ 1 decimal),
 * `{2}` = "".
 */
export function 词条说明参数(原始文本: string, 玩家词条: 词条映射): string {
  const pct = (name: string) => asPercent(科学数变普通(获取科学映射词条(玩家词条, name).输出值), 1);
  return formatText(原始文本, { '0': pct('格挡减伤%'), '1': pct('强固减伤%'), '2': '' });
}

/**
 * 提示简化处理(来源映射, 生成来源, 单次更新值) (L19–L47): if a live damage or heal popup for this source exists, add the
 * value to it and report true. Popups are presentation, so the map holds accumulators keyed by the source's name.
 */
export function 提示简化处理(来源映射: ReadonlyMap<string, { 添加数值(v: 科学数): void }>, 生成来源名: string, 单次更新值: 科学数): boolean {
  const popup = 来源映射.get(生成来源名);
  if (!popup) return false;
  popup.添加数值(单次更新值);
  return true;
}
