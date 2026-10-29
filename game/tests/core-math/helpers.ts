import { expect } from 'vitest';
import { VECTORS, type Vector } from './vectors.ts';
import type { 科学数 } from '../../src/core/math/sci.ts';

export function vec(id: string): Vector {
  const v = VECTORS.find(x => x.id === id);
  if (!v) throw new Error(`no vector ${id}`);
  return v;
}

export const toSci = (x: { c: number; e: number }): 科学数 => ({ 系数: x.c, 指数: x.e });

export function expectClose(actual: number, want: number, tol?: number): void {
  if (tol === undefined) expect(actual).toBe(want);
  else expect(Math.abs(actual - want), `${actual} vs ${want}`).toBeLessThanOrEqual(tol * Math.max(1, Math.abs(want)));
}

/** Exact unless `tol` (relative tolerance on the coefficient, the drafts' rule for pow/log). */
export function expectSci(actual: 科学数, want: { c: number; e: number }, tol?: number): void {
  expect(actual.指数, `指数 of ${JSON.stringify(actual)}`).toBe(want.e);
  expectClose(actual.系数, want.c, tol);
}
