// Types for reach.mjs (used by tests/content-bpkit).
export interface CodeGraph {
  skill: string[];
  skillSet: Set<string>;
  lines: Map<string, number>;
  parent: Map<string, string>;
  refs: Map<string, Set<string>>;
}
export interface Reach {
  graph: CodeGraph;
  live: string[];
  scoped: string[];
  onlyBp: string[];
  rowRefs: Map<string, Set<string>>;
  rootRows: number;
  followedRows: number;
}
export function computeReach(dumpDir: string): Reach;
