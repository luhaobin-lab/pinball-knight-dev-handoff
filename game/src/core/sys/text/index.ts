/**
 * Module `text` (WAVE_A Appendix W2, card core-inventory): the Demo's number and description text functions
 * (函数库_工具 根据参数生成文本, 生成能力描述参数, 词条说明参数, 数字缩写, 提示简化处理; 函数库_科学数 科学数字缩写).
 * Texts are culture-invariant here (numbers and rich-text tags), so zh and en carry the same string; templates with
 * words (词条说明参数) are formatted per language.
 */
import { 参数From } from '../../ability/params.ts';
import type { Systems } from '../../bp/systems.ts';
import type { FText } from '../../../content/demo/types.ts';
import { asPercent, 数字缩写, 科学数字缩写 } from './numfmt.ts';
import { 提示简化处理, 根据参数生成文本, 生成能力描述参数, formatText } from './describe.ts';
import { 获取科学映射词条 } from '../../math/stats.ts';
import { 科学数变普通 } from '../../math/sci.ts';

const same = (s: string): FText => ({ zh: s, en: s });

export const text: Systems['text'] = {
  函数库_工具: {
    提示简化处理(_ctx, 来源映射, 生成来源, 单次更新值) {
      const name = 生成来源 ? `${生成来源.def.name}_${生成来源.id}` : '';
      const m = new Map<string, { 添加数值(v: typeof 单次更新值): void }>();
      for (const [k, w] of 来源映射) if (w && typeof (w as { 添加数值?: unknown }).添加数值 === 'function') m.set(k, w as { 添加数值(v: typeof 单次更新值): void });
      return { 有存在: 提示简化处理(m, name, 单次更新值) };
    },
    词条说明参数(_ctx, 原始文本, 游戏模式) {
      const hero = 游戏模式?.玩家角色;
      if (!hero) return { Result: 原始文本 };
      const pct = (n: string) => asPercent(科学数变普通(获取科学映射词条(hero.词条, n).输出值), 1);
      const args = { '0': pct('格挡减伤%'), '1': pct('强固减伤%'), '2': '' };
      return { Result: { zh: formatText(原始文本.zh, args), en: formatText(原始文本.en, args) } };
    },
    数字缩写(_ctx, 输入) {
      const r = 数字缩写(输入);
      return { 值: same(r.值), 单位: same(r.单位), ReturnValue: same(r.text) };
    },
    根据参数生成文本(ctx, 参数, 能力, 等级) {
      const owner = 能力 && ctx.world.isValid(能力.拥有者) ? 能力.拥有者.词条 : null;
      const r = 根据参数生成文本(参数From(参数), owner, 等级);
      return { 纯数值文本: same(r.纯数值文本), ReturnValue: r.text };
    },
    生成能力描述参数(ctx, 能力, 预览等级, 预览下N级, 预览N值) {
      if (!能力) return { 描述中参数: [] };
      const owner = ctx.world.isValid(能力.拥有者) ? 能力.拥有者.词条 : null;
      const out = 生成能力描述参数({ 参数: 能力.参数.map(参数From), 等级: 能力.等级, 拥有者词条: owner }, 预览等级, 预览下N级, 预览N值);
      return { 描述中参数: out.map(same) };
    },
  },
  函数库_科学数: {
    科学数字缩写(_ctx, x, 小数位) {
      const r = 科学数字缩写(x, 小数位);
      return { 值: same(r.值), 单位: same(r.单位), ReturnValue: same(r.text) };
    },
  },
};
