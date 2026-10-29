import { inside, type Rect, type Surface } from '../core/surface';

/** Pointer input in page coordinates (design px of the 960×540 frame). `button`: 0 left, 2 right. */
export interface UiPointer {
  readonly kind: 'move' | 'down' | 'up' | 'leave';
  readonly x: number;
  readonly y: number;
  readonly button?: number;
}

export interface UiKey {
  /** KeyboardEvent.key ('Escape', '1', …). */
  readonly key: string;
}

/**
 * A page (ARCHITECTURE §9): a plain view model in, intents out. Pages draw in the design frame (0..960 × 0..540; the
 * stack moves the origin onto the layer), take pointer and key input there, and never touch the core.
 */
export interface Page {
  /** Stable id (`map`, `loot`, …) for the stack and for tests. */
  readonly id: string;
  /** The frame the page lays out in (the design frame, or a larger layer). */
  layout(frame: Rect): void;
  draw(s: Surface, t: number): void;
  /** Whether the point is on the page's own content (a modal still swallows clicks elsewhere). */
  hit(x: number, y: number): boolean;
  /** Returns true when the page consumed the event. */
  pointer(e: UiPointer): boolean;
  key?(e: UiKey): boolean;
  /** Real seconds since the last frame (hover delays, flashes). */
  update?(dt: number): void;
}

/** A clickable region of a page; the topmost (last) wins. */
export interface Region<T> {
  readonly rect: Rect;
  readonly target: T;
}

/** Hit regions with hover tracking, rebuilt by a page whenever it lays out. */
export class Regions<T> {
  private list: Region<T>[] = [];
  hovered: T | null = null;
  pressed: T | null = null;

  set(list: readonly Region<T>[]): void {
    this.list = [...list];
    if (this.hovered !== null && !this.list.some(r => r.target === this.hovered)) this.hovered = null;
  }

  at(x: number, y: number): T | null {
    for (let i = this.list.length - 1; i >= 0; i--) if (inside(this.list[i].rect, x, y)) return this.list[i].target;
    return null;
  }

  rectOf(target: T): Rect | null {
    return this.list.find(r => r.target === target)?.rect ?? null;
  }

  /**
   * Routes one pointer event: tracks hover and press, and returns the target clicked (released over the region it was
   * pressed on, like a UMG Button with ClickMethod DownAndUp), else null.
   */
  route(e: UiPointer): T | null {
    if (e.kind === 'leave') {
      this.hovered = null;
      this.pressed = null;
      return null;
    }
    const t = this.at(e.x, e.y);
    this.hovered = t;
    if (e.kind === 'down') this.pressed = t;
    if (e.kind === 'up') {
      const clicked = this.pressed !== null && this.pressed === t ? t : null;
      this.pressed = null;
      return clicked;
    }
    return null;
  }
}
