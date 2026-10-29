import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ChannelKey, WidgetAnim } from '../../src/ui/core/motion';
import { CHARGE_DOWN, CHARGE_UP, CURVES, DAMAGE_POP, HEAL_POP, INTENT_BOB, PICKUP_DOWN, RANK_UPDATE, ROW_FLASH, STATS_APPEAR, STATS_END, VALUE_BUMP } from '../../src/ui/hud/anims';

// Every key of the HUD's widget animations equals the Demo dump: tick, value, interp, tangents (per tick) and the
// weights of weighted keys, plus each animation's playback range. Read straight from the widget JSON.

const UI = 'D:/TAPTAPGAME_codex/reference/dump/widgets/CatapultHero/BP/UI';
const CURVE_TABLE = 'D:/TAPTAPGAME_codex/reference/dump/curves/CatapultHero/BP/曲线表.json';
const haveDump = existsSync(UI) && existsSync(CURVE_TABLE);

interface DumpKey {
  Value: number;
  Tangent: { ArriveTangent: number; LeaveTangent: number; ArriveTangentWeight: number; LeaveTangentWeight: number; TangentWeightMode: number };
  InterpMode: number;
}
interface DumpChannel {
  Times: { Value: number }[];
  Values: DumpKey[];
}
interface DumpAnim {
  name: string;
  playback_range: { Value: { LowerBound: { Value: { Value: number } }; UpperBound: { Value: { Value: number } } } };
  bindings: { widget: string; tracks: { class: string; sections: { properties: Record<string, unknown> }[] }[] }[];
}

const files = new Map<string, DumpAnim[]>();
function anim(file: string, name: string): DumpAnim {
  if (!files.has(file)) files.set(file, (JSON.parse(readFileSync(`${UI}/${file}.json`, 'utf8')) as { animations: DumpAnim[] }).animations);
  const a = files.get(file)!.find(x => x.name === `${name}_INST`);
  if (!a) throw new Error(`no ${name} in ${file}`);
  return a;
}

/** Every keyed channel of a dumped animation: "widget/property" → channel. */
function channels(a: DumpAnim): Map<string, DumpChannel> {
  const out = new Map<string, DumpChannel>();
  for (const b of a.bindings)
    for (const t of b.tracks)
      for (const s of t.sections)
        for (const [prop, v] of Object.entries(s.properties)) {
          const c = v as Partial<DumpChannel>;
          if (c && typeof c === 'object' && Array.isArray(c.Times) && c.Times.length) out.set(`${b.widget}/${prop}`, c as DumpChannel);
        }
  return out;
}

const INTERP = ['linear', 'constant', 'cubic'] as const;
const WEIGHT = [undefined, 'arrive', 'leave', 'both'] as const;

/** A dumped channel in our key format (weights only for weighted keys). */
function asKeys(c: DumpChannel): ChannelKey[] {
  return c.Times.map((t, i) => {
    const v = c.Values[i];
    const tg = v.Tangent;
    const base = [t.Value, v.Value, INTERP[v.InterpMode], tg.ArriveTangent, tg.LeaveTangent] as const;
    return tg.TangentWeightMode ? [...base, WEIGHT[tg.TangentWeightMode]!, tg.ArriveTangentWeight, tg.LeaveTangentWeight] : [...base];
  });
}

/** A channel whose keys never move the widget (one value throughout). */
const still = (c: DumpChannel): boolean => c.Values.every(v => v.Value === c.Values[0].Value);

interface Check {
  anim: WidgetAnim<string>;
  file: string;
  name: string;
  /** Our channel → the dumped channels it stands for ("widget/property"; several when X and Y are keyed alike). */
  map: Record<string, string[]>;
  /** Dumped channels deliberately left out. */
  skip?: string[];
  /** Compare the keys only (a shared table, e.g. 数值更新 of UI_治疗提示 with its longer range). */
  keysOnly?: boolean;
}

const CHECKS: Check[] = [
  { anim: DAMAGE_POP, file: 'UI_伤害提示', name: '弹出V2', map: { dy: ['背景/Translation[1]'], scale: ['背景/Scale', '背景/Scale[1]'], opacity: ['背景/FloatCurve'] } },
  { anim: VALUE_BUMP, file: 'UI_伤害提示', name: '数值更新', map: { scale: ['HorizontalBox_0/Scale', 'HorizontalBox_0/Scale[1]'] } },
  { anim: VALUE_BUMP, file: 'UI_治疗提示', name: '数值更新', map: { scale: ['HorizontalBox_0/Scale', 'HorizontalBox_0/Scale[1]'] }, keysOnly: true },
  { anim: HEAL_POP, file: 'UI_治疗提示', name: '弹出', map: { dy: ['背景/Translation[1]'], scale: ['背景/Scale', '背景/Scale[1]'], opacity: ['背景/FloatCurve'] } },
  { anim: CHARGE_UP, file: 'UI_充能提示', name: '向上弹出', map: { dy: ['背景/Translation[1]'], scale: ['背景/Scale', '背景/Scale[1]'], opacity: ['背景/FloatCurve'] } },
  { anim: CHARGE_DOWN, file: 'UI_充能提示', name: '向下弹出', map: { dy: ['背景/Translation[1]'], scale: ['背景/Scale', '背景/Scale[1]'], opacity: ['背景/FloatCurve'] } },
  { anim: PICKUP_DOWN, file: 'UI_拾取提示', name: '向下弹出', map: { dy: ['背景/Translation[1]'], scale: ['背景/Scale', '背景/Scale[1]'], opacity: ['背景/FloatCurve'] } },
  { anim: STATS_APPEAR, file: 'UI_主界面', name: '回合统计出现', map: { opacity: ['回合统计/FloatCurve'], scaleX: ['回合统计/Scale'], scaleY: ['回合统计/Scale[1]'] } },
  { anim: STATS_END, file: 'UI_主界面', name: '回合统计结束', map: { opacity: ['回合统计/FloatCurve'] } },
  {
    anim: RANK_UPDATE,
    file: 'UI_主界面',
    name: '评级更新',
    map: { rankDy: ['评级图片切换/Translation[1]'], rankScale: ['评级图片切换/Scale', '评级图片切换/Scale[1]'], ruleScaleX: ['Image/Scale', 'Image_84/Scale'] },
    // 评级文本 is Collapsed in UI_主界面
    skip: ['评级文本/Translation[1]', '评级文本/Scale', '评级文本/Scale[1]'],
  },
  { anim: ROW_FLASH, file: 'UI_回合统计词条', name: '更新闪烁', map: { barScaleX: ['Image_30/Scale'], barAlpha: ['Image_30/AlphaCurve'], rowScaleY: ['HorizontalBox/Scale[1]'] } },
  { anim: INTENT_BOB, file: 'UI_意图提示', name: '浮动', map: { dy: ['Overlay_1/Translation[1]'] } },
];

describe.skipIf(!haveDump)(`widget animations against ${UI}`, () => {
  for (const c of CHECKS) {
    it(`${c.file}.${c.name}: every key, the playback range, no moving channel left out`, () => {
      const a = anim(c.file, c.name);
      const dumped = channels(a);
      for (const [ours, theirs] of Object.entries(c.map)) {
        for (const t of theirs) {
          const ch = dumped.get(t);
          expect(ch, `${t} in the dump`).toBeDefined();
          expect(c.anim.keys[ours], `${c.name} ${ours} vs ${t}`).toEqual(asKeys(ch!));
        }
      }
      if (c.keysOnly) return;
      const range = a.playback_range.Value;
      expect([c.anim.from, c.anim.to]).toEqual([range.LowerBound.Value.Value, range.UpperBound.Value.Value]);
      const covered = new Set([...Object.values(c.map).flat(), ...(c.skip ?? [])]);
      const missing = [...dumped].filter(([name, ch]) => !covered.has(name) && !still(ch)).map(([name]) => name);
      expect(missing).toEqual([]);
    });
  }

  it('曲线表 rows: 伤害提示曲线, 恢复提示曲线, 血条显示曲线', () => {
    const rows = (JSON.parse(readFileSync(CURVE_TABLE, 'utf8')) as { curves: { rows: Record<string, { Keys: { Time: number; Value: number; ArriveTangent: number; LeaveTangent: number; InterpMode: string; TangentWeightMode: string }[] }> }[] }).curves[0].rows;
    const pairs = [
      ['伤害提示曲线', CURVES.damagePath],
      ['恢复提示曲线', CURVES.recoverPath],
      ['血条显示曲线', CURVES.barShow],
    ] as const;
    for (const [name, curve] of pairs) {
      const keys = rows[name].Keys;
      expect(keys.every(k => k.InterpMode === 'RCIM_Cubic' && k.TangentWeightMode === 'RCTWM_WeightedNone')).toBe(true);
      expect(curve.keys.map(k => [k.time, k.value, k.arriveTangent, k.leaveTangent])).toEqual(keys.map(k => [k.Time, k.Value === 0 ? 0 : k.Value, k.ArriveTangent, k.LeaveTangent]));
    }
  });
});
