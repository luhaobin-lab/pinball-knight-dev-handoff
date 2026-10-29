// The registered gameplay tags and redirects of the Demo (dump/config/CatapultHero/Config/DefaultGameplayTags.ini).
import fs from 'node:fs';
import path from 'node:path';

const LIST = /^\+GameplayTagList=\(Tag="([^"]*)",DevComment="([^"]*)"\)\s*$/;
const REDIRECT = /^\+GameplayTagRedirects=\(OldTagName="([^"]*)",NewTagName="([^"]*)"\)\s*$/;

/** { tags: [{tag, comment}] in ini order, redirects: {old: new} }. */
export function readTags(dumpDir) {
  const file = path.join(dumpDir, 'config', 'CatapultHero', 'Config', 'DefaultGameplayTags.ini');
  const tags = [];
  const redirects = {};
  for (const line of fs.readFileSync(file, 'utf8').replace(/^\ufeff/, '').split(/\r?\n/)) {
    let m = LIST.exec(line);
    if (m) tags.push({ tag: m[1], comment: m[2] });
    else if ((m = REDIRECT.exec(line))) redirects[m[1]] = m[2];
    else if (line.startsWith('+GameplayTag')) throw new Error(`DefaultGameplayTags.ini: unparsed line ${line}`);
  }
  return { tags, redirects };
}

/** Follows the redirects (UE applies them when a tag name is loaded). */
export const redirector = redirects => tag => {
  const seen = new Set();
  while (Object.hasOwn(redirects, tag) && !seen.has(tag)) {
    seen.add(tag);
    tag = redirects[tag];
  }
  return tag;
};
