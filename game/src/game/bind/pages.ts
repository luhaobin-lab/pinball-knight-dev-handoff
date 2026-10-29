import type { GameView } from '../api';
import type { PageBinding } from './page-model';

/**
 * Page bindings are discovered from `./pages/*.ts` (each default-exports a `PageBinding`), so wave B adds pages
 * without editing a shared index. Modal bindings win over screen bindings; among equals the file name orders them.
 */
const modules = import.meta.glob<{ default: PageBinding }>('./pages/*.ts', { eager: true });

export const PAGE_BINDINGS: readonly PageBinding[] = Object.keys(modules)
  .sort()
  .map(k => modules[k].default)
  .sort((a, b) => Number(b.modal) - Number(a.modal));

export function bindingFor(view: GameView): PageBinding | null {
  if(view.tutorial)return PAGE_BINDINGS.find(b=>b.id==='tutorial')??null;
  return PAGE_BINDINGS.find(b => b.match(view)) ?? null;
}
