/**
 * TagSet: a GameplayTagContainer with UE matching (ARCHITECTURE Appendix A.5). Insertion order is kept (the Demo
 * iterates containers in order). `has` is HasMatchingGameplayTag: an owned tag equals the query or is a child of it.
 */
import type { Tag } from './types.ts';

/** True when `owned` equals `query` or is a child of it ("a.b.c" matches "a.b"). */
export function tagMatches(owned: Tag, query: Tag): boolean {
  return owned === query || (owned.length > query.length && owned.startsWith(query) && owned[query.length] === '.');
}

export class TagSet {
  private readonly tags: Tag[] = [];

  constructor(initial: Iterable<Tag> = []) {
    for (const t of initial) this.add(t);
  }

  get size(): number { return this.tags.length; }
  /** Owned == query or a child of query (HasMatchingGameplayTag / HasTag). */
  has(query: Tag): boolean { return query !== '' && this.tags.some(t => tagMatches(t, query)); }
  hasExact(t: Tag): boolean { return this.tags.includes(t); }
  /** HasAny: an empty query matches nothing. */
  hasAny(q: readonly Tag[]): boolean { return q.some(t => this.has(t)); }
  /** HasAll: an empty query matches everything. */
  hasAll(q: readonly Tag[]): boolean { return q.every(t => this.has(t)); }
  add(t: Tag): void { if (t !== '' && !this.tags.includes(t)) this.tags.push(t); }
  remove(t: Tag): void { const i = this.tags.indexOf(t); if (i >= 0) this.tags.splice(i, 1); }
  toArray(): Tag[] { return [...this.tags]; }
  clone(): TagSet { return new TagSet(this.tags); }
}
