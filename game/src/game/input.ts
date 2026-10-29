import type { Command, CommandSpec, ItemPlace } from './api';

/**
 * Pointer and keys → Commands (ARCHITECTURE §8.1), pure so node tests drive it:
 * - aim: while the core takes the aim (phase 2 and 玩家可与环境交互？) the floor point under the pointer, snapped to
 *   the 4-uu grid is the absolute aim (CTL 目标位置缓存). The core derives the direction from the hero;
 * - launch: a left press over the play area only records, the **release** sends `aim.release` (TURN-042, FEEL-001);
 * - interact: a release over a clickable field actor (a chest, a harvestable, any `neutral` the core accepts
 *   `interact` for, TURN-042 step 4 / TURN-046) sends `interact` for it instead of the launch;
 * - items: a press on a card held for DRAG_HOLD seconds picks it up, the release over a cell sends `item.move`;
 *   a right-click on a card opens its item menu (UI_物品交互菜单, the shell's own state);
 * - keys 1–4 → `skill.press` slots 0–3; Escape → `menu.open` (or `menu.close` while the menu's warning is open).
 */

/** The 0.35 s hold that turns a press on a card into a drag. */
export const DRAG_HOLD = 0.35;
/** 设置指引点向量 snaps the pointer's floor point to this grid (uu). */
export const AIM_SNAP = 4;

export interface PointerSample {
  /** Floor point under the pointer in room uu (x east, y = z south), null off the floor or over the HUD. */
  readonly floor: { readonly x: number; readonly y: number } | null;
  /** HUD target under the pointer (`item:<id>`, `skill:<i>` …), null over the play area. */
  readonly hud: string | null;
  /** The grid cell under the pointer while dragging a card (null when the pointer is not over a cell). */
  readonly place?: ItemPlace | null;
  /** The field actor under the pointer (`actorAt`), null over none. */
  readonly actor?: number | null;
}

export interface InputState {
  readonly selectedSkill?: boolean;
  /** The core takes an aim now (phase 2 and inputOpen, no modal). */
  readonly aimable: boolean;
  /** Hero centre in room uu. */
  readonly hero: { readonly x: number; readonly y: number } | null;
  /** A warning (the pause menu) is open. */
  readonly menuOpen: boolean;
  /** Any modal is open: the play area takes no aim. */
  readonly modal: boolean;
  /** The actors `interact` is legal for now (empty when it is not). */
  readonly interactable?: readonly number[];
}

/** A field actor as the hit-test sees it: centre and radius in room uu. */
export interface HitActor {
  readonly id: number;
  readonly position: { readonly x: number; readonly y: number };
  readonly radius: number;
}

/** The actor whose footprint circle holds the floor point (the nearest centre wins), else null. */
export function actorAt(floor: { x: number; y: number } | null, actors: readonly HitActor[]): number | null {
  if (!floor) return null;
  let best: { id: number; d: number } | null = null;
  for (const a of actors) {
    const d = Math.hypot(floor.x - a.position.x, floor.y - a.position.y);
    if (d <= a.radius && (!best || d < best.d)) best = { id: a.id, d };
  }
  return best?.id ?? null;
}

/**
 * The actors a click may `interact` with: the ids `legal()` lists for `interact`, or every living `neutral` field actor
 * when the spec lists none.
 */
export function interactable(
  view: { readonly field: readonly { readonly id: number; readonly kind: string; readonly hidden: boolean }[] },
  legal: readonly CommandSpec[],
): number[] {
  const spec = legal.find(s => s.type === 'interact');
  if (!spec) return [];
  const ids = spec.params?.actor;
  if (ids && ids.length > 0) return ids.map(Number);
  return view.field.filter(a => a.kind === 'neutral' && !a.hidden).map(a => a.id);
}

export type Intent = { kind: 'command'; cmd: Command } | { kind: 'itemMenu'; item: number } | { kind: 'click'; hud: string };

const itemOf = (target: string | null): number | null => {
  const m = target?.match(/^item:(\d+)$/);
  return m ? Number(m[1]) : null;
};

export class InputMapper {
  /** The current absolute aim point (uu), null while there is none. */
  aim: { x: number; y: number } | null = null;
  /** The card being dragged (after the hold). */
  dragging: number | null = null;
  private state: InputState = { aimable: false, hero: null, menuOpen: false, modal: false };
  private pressed = false;
  /** The clickable actor the left press went down on. */
  private pressedActor: number | null = null;
  private hold: { item: number; seconds: number } | null = null;
  private last: PointerSample = { floor: null, hud: null };

  setState(state: InputState): void {
    this.state = state;
    if (!state.aimable && this.pressedActor === null) this.pressed = false;
    this.reaim();
  }

  move(p: PointerSample): void {
    this.last = p;
    this.reaim();
  }

  /** Advances the drag hold. */
  update(dt: number): void {
    if (!this.hold) return;
    this.hold.seconds += dt;
    if (this.hold.seconds >= DRAG_HOLD) {
      this.dragging = this.hold.item;
      this.hold = null;
    }
  }

  down(button: number, p: PointerSample): Intent[] {
    this.move(p);
    const item = itemOf(p.hud);
    if ((button === 1 || button === 2) && this.state.selectedSkill) return [{ kind: 'command', cmd: { type: 'skill.cancel' } }];
    if (button === 2) return item !== null ? [{ kind: 'itemMenu', item }] : [];
    if (button !== 0) return [];
    if (item !== null) {
      this.hold = { item, seconds: 0 };
      return [];
    }
    const free = p.hud === null && !this.state.modal;
    this.pressedActor = free ? this.clickable(p) : null;
    this.pressed = free && (this.state.aimable || this.pressedActor !== null);
    return [];
  }

  up(button: number, p: PointerSample): Intent[] {
    this.move(p);
    if (button !== 0) return [];
    if (this.dragging !== null) {
      const item = this.dragging;
      this.dragging = null;
      return p.place ? [{ kind: 'command', cmd: { type: 'item.move', item, to: p.place } }] : [];
    }
    if (this.hold) {
      this.hold = null;
      return p.hud ? [{ kind: 'click', hud: p.hud }] : [];
    }
    if (p.hud !== null && !this.pressed) return [{ kind: 'click', hud: p.hud }];
    const actor = this.pressed ? this.clickable(p) : null;
    const pressedOn = this.pressedActor;
    this.pressedActor = null;
    if (actor !== null && actor === pressedOn) {
      this.pressed = false;
      return [{ kind: 'command', cmd: { type: 'interact', actor } }];
    }
    const launch = this.pressed && this.state.aimable && this.aim !== null;
    this.pressed = false;
    return launch ? [{ kind: 'command', cmd: this.state.selectedSkill ? { type: 'skill.target', at: { ...this.aim! } } : { type: 'aim.release', aim: { ...this.aim! } } }] : [];
  }

  key(code: string): Intent[] {
    const digit = /^(?:Digit|Numpad)([1-4])$/.exec(code);
    if (digit) return [{ kind: 'command', cmd: { type: 'skill.press', slot: Number(digit[1]) } }];
    if (code === 'Escape') return [{ kind: 'command', cmd: this.state.menuOpen ? { type: 'menu.close' } : { type: 'menu.open' } }];
    return [];
  }

  /** The actor under the pointer when `interact` is legal for it. */
  private clickable(p: PointerSample): number | null {
    const a = p.actor ?? null;
    return a !== null && !this.state.modal && (this.state.interactable ?? []).includes(a) ? a : null;
  }

  private reaim(): void {
    const { hero, aimable } = this.state;
    const f = this.last.floor;
    if (!aimable || !hero || !f) return;
    const snap = (v: number): number => Math.round(v / AIM_SNAP) * AIM_SNAP;
    const aim = { x: snap(f.x), y: snap(f.y) };
    if (Math.hypot(aim.x - hero.x, aim.y - hero.y) >= 1) this.aim = aim;
  }
}
