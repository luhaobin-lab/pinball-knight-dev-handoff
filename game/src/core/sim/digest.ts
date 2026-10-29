/**
 * `game.digest()` (ARCHITECTURE §4.12): a hash of the full simulation state. Objects are walked in id order; a
 * reference to another world object is written as its id, so the digest depends on state, not on allocation.
 */

/** 64-bit FNV-1a over UTF-16 code units, as two 32-bit halves (no BigInt on the hot path). */
export class Hasher {
  private h1 = 0x811c9dc5;
  private h2 = 0xcbf29ce4;
  update(s: string): this {
    let h1 = this.h1, h2 = this.h2;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 0x01000193);
      h2 = Math.imul(h2 ^ c ^ (h1 >>> 16), 0x01000193);
    }
    this.h1 = h1;
    this.h2 = h2;
    return this;
  }
  hex(): string {
    return (this.h1 >>> 0).toString(16).padStart(8, '0') + (this.h2 >>> 0).toString(16).padStart(8, '0');
  }
}

/** Fields that are wiring, not state. */
const SKIP = new Set(['world', 'def', 'fx']);

export interface DigestRefs {
  /** Id of a world object, or undefined for plain data. */
  idOf(v: object): number | undefined;
}

/**
 * Deterministic text form of a value. World objects other than `root` become `#id`; Maps, Sets and arrays keep their
 * order (insertion order is semantics, §4.2); objects with `toArray()` (TagSet) are written as that array.
 */
export function serialize(value: unknown, refs: DigestRefs, root?: object): string {
  const out: string[] = [];
  const seen = new Set<object>();
  const walk = (v: unknown): void => {
    switch (typeof v) {
      case 'number': out.push(Object.is(v, -0) ? '-0' : String(v)); return;
      case 'string': out.push(JSON.stringify(v)); return;
      case 'boolean': out.push(v ? 't' : 'f'); return;
      case 'undefined': out.push('u'); return;
      case 'bigint': out.push(`${v}n`); return;
      case 'function': case 'symbol': return;
    }
    if (v === null) { out.push('n'); return; }
    const o = v as object;
    if (o !== root) {
      const id = refs.idOf(o);
      if (id !== undefined) { out.push(`#${id}`); return; }
    }
    if (seen.has(o)) { out.push('^'); return; }
    seen.add(o);
    if (Array.isArray(o)) {
      out.push('[');
      for (const x of o) { walk(x); out.push(','); }
      out.push(']');
    } else if (o instanceof Map) {
      out.push('M{');
      for (const [k, x] of o) { walk(k); out.push(':'); walk(x); out.push(','); }
      out.push('}');
    } else if (o instanceof Set) {
      out.push('S[');
      for (const x of o) { walk(x); out.push(','); }
      out.push(']');
    } else if (typeof (o as { toArray?: unknown }).toArray === 'function') {
      out.push('T');
      walk((o as { toArray(): unknown }).toArray());
    } else {
      out.push('{');
      for (const k of Object.keys(o)) {
        if (SKIP.has(k)) continue;
        const x = (o as Record<string, unknown>)[k];
        if (typeof x === 'function') continue;
        out.push(k, ':');
        walk(x);
        out.push(',');
      }
      out.push('}');
    }
    seen.delete(o);
  };
  walk(value);
  return out.join('');
}
