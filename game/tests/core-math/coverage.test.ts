import { describe, expect, it } from 'vitest';
import { VECTORS } from './vectors.ts';

/**
 * Every CORE-M-TV vector is either tested in tests/core-math/ or belongs to the card that owns the Demo function
 * (WAVE_A §5 / ARCHITECTURE Appendix B). Delegated vectors are listed here so nothing is silently dropped.
 */
const DELEGATED: Record<string, string> = {
  'CORE-M-TV-011': 'core-inventory (sys/text: 科学数字缩写)',
  'CORE-M-TV-012': 'core-inventory (sys/text: 科学数字缩写 QUIRKs)',
  'CORE-M-TV-013': 'core-inventory (sys/text: 数字缩写)',
  'CORE-M-TV-014': 'core-inventory (sys/text: AsPercent_Float)',
  'CORE-M-TV-026': 'core-inventory (sys/text: 根据参数生成文本)',
  'CORE-M-TV-027': 'core-inventory (sys/text: 根据参数生成文本)',
  'CORE-M-TV-028': 'core-inventory (sys/text: 更新技能描述 formatting)',
  'CORE-M-TV-029': 'core-inventory (sys/text: 根据参数生成文本, 纯数值文本)',
  'CORE-M-TV-030': 'core-inventory (sys/text: item tooltips)',
  'CORE-M-TV-031': 'core-inventory (sys/text + 处理词条)',
  'CORE-M-TV-032': 'core-inventory (sys/text: lvlQ)',
  'CORE-M-TV-033': 'core-inventory (sys/text: % stats)',
  'CORE-M-TV-034': 'core-inventory (sys/text: Y / y prefixes)',
  'CORE-M-TV-035': 'core-inventory (sys/text: 生成能力描述参数 preview)',
  'CORE-M-TV-036': 'core-ability (蓝图_能力.更新技能描述 args) with core-inventory (text)',
  'CORE-M-TV-037': 'core-inventory (sys/text: 词条说明参数)',
  'CORE-M-TV-043': 'core-damage (BP_ManeActor.会心判断; the PRD it calls is tested here)',
  'CORE-M-TV-057': 'core-turn (投掷骰子, a phase switch; dead per ARCHITECTURE Appendix B)',
};

const sources = import.meta.glob<string>('./*.test.ts', { query: '?raw', import: 'default', eager: true });

describe('CORE-M-TV coverage', () => {
  it('has the 57 vectors of the draft', () => {
    expect(VECTORS.map(v => v.id)).toEqual(Array.from({ length: 57 }, (_, i) => `CORE-M-TV-${String(i + 1).padStart(3, '0')}`));
  });
  it('tests every vector it does not delegate', () => {
    const text = Object.entries(sources).filter(([f]) => !f.endsWith('coverage.test.ts')).map(([, s]) => s).join('\n');
    for (const { id } of VECTORS) {
      if (DELEGATED[id]) expect(text.includes(`'${id}'`), `${id} is delegated but also tested`).toBe(false);
      else expect(text.includes(`'${id}'`), `${id} untested`).toBe(true);
    }
  });
});
