// The naming rule D11 (studio/ARCHITECTURE.md §4.11): Demo identifiers are kept verbatim, except that a character
// that cannot appear in a JS identifier is dropped at the end of the name and replaced by `_` inside:
// 疲劳了？ -> 疲劳了, 增加金币/收入 -> 增加金币_收入, 科学数乘除*/ -> 科学数乘除, 日志//输出 -> 日志__输出.
// Used for class variables, struct fields and class names in the manifests and the skeleton tool.

const PART = /[\p{ID_Continue}$\u200c\u200d]/u;
const START = /[\p{ID_Start}$_]/u;

/** The JS identifier of a Demo name. A leading character that cannot start an identifier gets a `_` prefix. */
export function mangle(name) {
  const chars = [...name];
  let end = chars.length;
  while (end > 0 && !PART.test(chars[end - 1])) end--;
  let out = chars
    .slice(0, end)
    .map(c => (PART.test(c) ? c : '_'))
    .join('');
  if (out === '') throw new Error(`cannot mangle "${name}": no identifier characters`);
  if (!START.test(out[0])) out = `_${out}`;
  return out;
}

/** Mangles every name of `names`; throws when two of them collide (the rule must stay injective inside a class). */
export function mangleAll(names, where) {
  const seen = new Map();
  for (const n of names) {
    const m = mangle(n);
    if (seen.has(m) && seen.get(m) !== n) throw new Error(`${where}: "${seen.get(m)}" and "${n}" both mangle to "${m}"`);
    seen.set(m, n);
  }
  return names.map(mangle);
}
