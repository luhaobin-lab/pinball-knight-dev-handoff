// Card path globs (`**`, `*`, `?`, `{a,b}`) as regular expressions over repo-relative paths with forward slashes.
export function globRegExp(glob) {
  let re = '';
  let depth = 0;
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      const dir = glob[i + 2] === '/';
      re += dir ? '(?:.*/)?' : '.*';
      i += dir ? 2 : 1;
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else if (c === '{') {
      depth++;
      re += '(?:';
    } else if (c === '}' && depth > 0) {
      depth--;
      re += ')';
    } else if (c === ',' && depth > 0) re += '|';
    else re += c.replace(/[.+^$()|[\]{}\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}
