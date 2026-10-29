// Types for batches.mjs (used by tests/content-bpkit).
import type { Reach } from '../data/reach.mjs';
export interface Owners {
  owner: Record<string, string>;
  cards: Record<string, string[]>;
  lines: Record<string, number>;
}
export function assignOwners(reach: Reach): Owners;
export function compareOwners(ours: Record<string, string>, theirs: Record<string, string>): [string, string | null, string | null][];
