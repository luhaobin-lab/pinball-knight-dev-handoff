/**
 * BlueprintGameplayTagLibrary matching on plain tag arrays (the Demo's tables store containers as string arrays).
 * Non-exact matching: an owned tag matches a query when it equals it or is one of its children.
 */
export function tagMatches(owned: string, query: string): boolean {
  return owned === query || owned.startsWith(query + '.');
}

/** HasTag(container, tag, bExactMatch = false). */
export function hasTag(container: readonly string[], tag: string): boolean {
  return container.some(t => tagMatches(t, tag));
}

/** HasAnyTags(container, other, bExactMatch = false). An empty `other` matches nothing. */
export function hasAnyTags(container: readonly string[], other: readonly string[]): boolean {
  return other.some(q => hasTag(container, q));
}
