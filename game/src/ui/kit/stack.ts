import { rect, Surface, type Rect } from '../core/surface';
import { INK } from '../style/palette';
import type { Page, UiKey, UiPointer } from './page';

export interface OpenOptions {
  /** Darken everything under the page (default true for modals). */
  dim?: boolean;
  /** Fade-in / fade-out seconds (default 0.15). SPEC-GAP: each Demo widget has its own 出现/消失 keys; one fade for all. */
  fade?: number;
}

interface Entry {
  page: Page;
  dim: boolean;
  fade: number;
  /** 0..1 open amount. */
  k: number;
  closing: boolean;
}

/** The dim behind a modal (the Demo darkens the room behind the loot window and the warning dialog). */
export const DIM = { color: INK.deep, opacity: 0.6 } as const;

/**
 * The page stack (ARCHITECTURE §9): one base page plus modals on top. The topmost open page takes the input; a modal
 * swallows every pointer event (clicks outside it never reach the pages below). Opening and closing fade the page;
 * a closing page takes no input and is dropped when its fade ends. Pages draw in the design frame: the stack moves
 * the surface origin to the frame's top-left and converts pointer coordinates.
 */
export class PageStack {
  private base: Page | null = null;
  private readonly modals: Entry[] = [];
  private frame: Rect = rect(0, 0, 960, 540);
  private scratch: Surface | null = null;

  /** The base page (map, room HUD …); replaces the previous one at once. */
  setBase(page: Page | null): void {
    this.base = page;
    page?.layout(this.local());
  }

  open(page: Page, opts: OpenOptions = {}): void {
    const existing = this.modals.find(e => e.page === page);
    if (existing) {
      existing.closing = false;
      return;
    }
    page.layout(this.local());
    this.modals.push({ page, dim: opts.dim ?? true, fade: opts.fade ?? 0.15, k: (opts.fade ?? 0.15) > 0 ? 0 : 1, closing: false });
  }

  close(page: Page): void {
    const e = this.modals.find(m => m.page === page);
    if (e) e.closing = true;
  }

  /** The page that takes the input (topmost open modal, else the base). */
  get top(): Page | null {
    for (let i = this.modals.length - 1; i >= 0; i--) if (!this.modals[i].closing) return this.modals[i].page;
    return this.base;
  }

  has(page: Page): boolean {
    return this.base === page || this.modals.some(e => e.page === page && !e.closing);
  }

  /** Open amount 0..1 of a modal (1 for the base), for tests and transitions. */
  openness(page: Page): number {
    if (page === this.base) return 1;
    return this.modals.find(e => e.page === page)?.k ?? 0;
  }

  /** The design frame on the layer (from `frameTop`-style centring by the caller). */
  layout(frame: Rect): void {
    this.frame = frame;
    this.base?.layout(this.local());
    for (const e of this.modals) e.page.layout(this.local());
  }

  update(dt: number): void {
    this.base?.update?.(dt);
    for (const e of this.modals) {
      e.page.update?.(dt);
      const step = e.fade > 0 ? dt / e.fade : 1;
      e.k = e.closing ? Math.max(0, e.k - step) : Math.min(1, e.k + step);
    }
    for (let i = this.modals.length - 1; i >= 0; i--) if (this.modals[i].closing && this.modals[i].k <= 0) this.modals.splice(i, 1);
  }

  draw(s: Surface, t: number): void {
    if (this.base) this.drawPage(s, this.base, 1, t);
    for (const e of this.modals) {
      if (e.dim) {
        s.origin(0, 0);
        s.fill(0, 0, s.w, s.h, DIM.color, DIM.opacity * e.k);
      }
      this.drawPage(s, e.page, e.k, t);
    }
    s.origin(0, 0);
  }

  /** Layer-pixel pointer event; returns true when a page consumed it. */
  pointer(e: UiPointer): boolean {
    const local: UiPointer = { ...e, x: e.x - this.frame.x, y: e.y - this.frame.y };
    const top = this.top;
    if (!top) return false;
    const modal = top !== this.base;
    return top.pointer(local) || modal;
  }

  key(e: UiKey): boolean {
    return this.top?.key?.(e) ?? false;
  }

  private local(): Rect {
    return rect(0, 0, this.frame.w, this.frame.h);
  }

  private drawPage(s: Surface, page: Page, k: number, t: number): void {
    if (k <= 0) return;
    if (k >= 1) {
      s.origin(this.frame.x, this.frame.y);
      page.draw(s, t);
      return;
    }
    if (!this.scratch || this.scratch.w !== s.w || this.scratch.h !== s.h) this.scratch = new Surface(s.w, s.h);
    const sc = this.scratch;
    sc.clear();
    sc.origin(this.frame.x, this.frame.y);
    page.draw(sc, t);
    sc.origin(0, 0);
    s.origin(0, 0);
    s.blit(sc, 0, 0, k);
  }
}
