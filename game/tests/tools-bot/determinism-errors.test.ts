import { describe, expect, it } from 'vitest';
import { failedJobResult } from '../../tools/bot/pool.mjs';
import { buildReport, compareReports } from '../../src/bot/metrics.ts';
import type { DeterminismResult } from '../../src/bot/runner.ts';

const complete: DeterminismResult = { seed: 1, equal: true, completed: true, digests: ['abc', 'abc', 'abc'], firstDivergence: -1, mode: 'none', commandLog: [] };
const meta = { seed: 1, policy: 'scripted' };

describe('determinism execution failures are not evidence of a digest mismatch', () => {
  it.each(['timeout', 'crash'] as const)('retains the actual worker %s reason and excludes it from completed/equal', kind => {
    const message = kind === 'timeout' ? 'wall-clock limit of 45 s' : 'worker died: out of memory';
    const result = failedJobResult({ kind: 'determinism', options: { seed: 6 } }, kind, message);
    expect(result).toMatchObject({ completed: false, equal: false, mode: 'incomplete', failure: { kind, message } });
    const report = buildReport([], meta, [complete, result]);
    expect(report.determinism).toEqual({ seeds: 2, completed: 1, incomplete: 1, equal: 1 });
    expect(report.errors).toEqual([{ seed: 6, runIndex: -1, kind, message, commandLog: [] }]);
    expect(kind === 'timeout' ? report.timeouts : report.crashes).toBe(1);
    const alarms = compareReports(buildReport([], meta, [complete]), report);
    expect(alarms.some(a => a.metric === 'determinism.incomplete')).toBe(true);
    expect(alarms.some(a => a.note === 'determinism mismatch')).toBe(false);
  });

  it('keeps real completed mismatches and historical nonempty-digest fixtures distinct from unavailable results', () => {
    const { completed: _oldMissing, ...legacy } = complete;
    const mismatch: DeterminismResult = { ...complete, seed: 3, equal: false, mode: 'frames', digests: ['abc', 'abc', 'xyz'], firstDivergence: 27 };
    const lost: DeterminismResult = { ...legacy, seed: 4, equal: true, mode: 'rerun', digests: ['', '', ''] };
    const report = buildReport([], meta, [legacy, mismatch, lost]);
    expect(report.determinism).toEqual({ seeds: 3, equal: 1, completed: 2, incomplete: 1 });
    expect(report.errors[0]).toMatchObject({ seed: 3, kind: 'determinism', message: 'digest mismatch (frames) abc / abc / xyz, first divergence after command 27' });
    expect(report.errors[1]?.message).toMatch(/incomplete/);
    expect(report.errors[1]?.message).not.toMatch(/digest mismatch/);
  });
});
