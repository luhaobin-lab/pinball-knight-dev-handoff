import type { DeterminismResult } from '../../src/bot/runner.ts';

export function failedJobResult(
  job: { kind: 'determinism'; options: { seed: number } },
  kind: 'timeout' | 'crash',
  message: string,
): DeterminismResult;
