import { describe, expect, it } from 'vitest';
import { actorAt, DRAG_HOLD, InputMapper, interactable, type Intent } from '../../src/game/input';

const AIMING = { aimable: true, hero: { x: 100, y: 100 }, menuOpen: false, modal: false };
const floor = (x: number, y: number) => ({ floor: { x, y }, hud: null });
const cmds = (xs: Intent[]) => xs.flatMap(i => (i.kind === 'command' ? [i.cmd] : []));

describe('input → commands', () => {
  it('a left press only records; release preserves the snapped absolute cursor point with a nonzero hero (CTL 目标位置缓存 / TURN-042)', () => {
    const m = new InputMapper();
    m.setState(AIMING);
    m.move(floor(301, 99));
    expect(cmds(m.down(0, floor(301, 99)))).toEqual([]);
    const up = cmds(m.up(0, floor(301, 99)));
    expect(m.aim).toEqual({ x: 300, y: 100 });
    expect(up).toEqual([{ type: 'aim.release', aim: { x: 300, y: 100 } }]);
  });

  it('no launch without a press over the play area, nor outside the aim', () => {
    const m = new InputMapper();
    m.setState(AIMING);
    expect(cmds(m.up(0, floor(300, 100)))).toEqual([]);
    m.down(0, floor(300, 100));
    m.setState({ ...AIMING, aimable: false });
    expect(cmds(m.up(0, floor(300, 100)))).toEqual([]);
    m.setState({ ...AIMING, modal: true });
    m.down(0, floor(300, 100));
    expect(cmds(m.up(0, floor(300, 100)))).toEqual([]);
  });

  it('a press on a HUD target never launches; a click reports the target', () => {
    const m = new InputMapper();
    m.setState(AIMING);
    m.down(0, { floor: null, hud: 'skill:0' });
    expect(m.up(0, { floor: null, hud: 'skill:0' })).toEqual([{ kind: 'click', hud: 'skill:0' }]);
  });

  it('drag and drop: hold a card 0.35 s, release on a cell → item.move', () => {
    const m = new InputMapper();
    m.setState(AIMING);
    m.down(0, { floor: null, hud: 'item:7' });
    m.update(DRAG_HOLD / 2);
    expect(m.dragging).toBeNull();
    m.update(DRAG_HOLD / 2 + 1e-6);
    expect(m.dragging).toBe(7);
    const to = { grid: 'backpack' as const, row: 2, col: 1 };
    expect(cmds(m.up(0, { floor: null, hud: 'item:9', place: to }))).toEqual([{ type: 'item.move', item: 7, to }]);
    expect(m.dragging).toBeNull();
  });

  it('a short press on a card is a click, not a move', () => {
    const m = new InputMapper();
    m.setState(AIMING);
    m.down(0, { floor: null, hud: 'item:7' });
    m.update(0.1);
    expect(m.up(0, { floor: null, hud: 'item:7', place: { grid: 'equip', row: 0, col: 0 } })).toEqual([{ kind: 'click', hud: 'item:7' }]);
  });

  it('right-click on a card opens its item menu', () => {
    const m = new InputMapper();
    expect(m.down(2, { floor: null, hud: 'item:3' })).toEqual([{ kind: 'itemMenu', item: 3 }]);
  });

  it('keys: 1–4 press skill slots 0–3, Escape opens the pause dialog or closes it', () => {
    const m = new InputMapper();
    m.setState(AIMING);
    expect(cmds(m.key('Digit1'))).toEqual([{ type: 'skill.press', slot: 1 }]);
    expect(cmds(m.key('Digit4'))).toEqual([{ type: 'skill.press', slot: 4 }]);
    expect(cmds(m.key('Escape'))).toEqual([{ type: 'menu.open' }]);
    m.setState({ ...AIMING, menuOpen: true, modal: true });
    expect(cmds(m.key('Escape'))).toEqual([{ type: 'menu.close' }]);
    expect(m.key('KeyQ')).toEqual([]);
  });
});

describe('input → interact (TURN-042 step 4, TURN-046)', () => {
  const chest = { id: 5, position: { x: 448, y: 220 }, radius: 40 };
  const onChest = { floor: { x: 450, y: 230 }, hud: null, actor: actorAt({ x: 450, y: 230 }, [chest]) };

  it('the hit-test finds the actor whose footprint holds the floor point, the nearest centre first', () => {
    expect(actorAt({ x: 450, y: 230 }, [chest])).toBe(5);
    expect(actorAt({ x: 448, y: 300 }, [chest])).toBeNull();
    expect(actorAt({ x: 460, y: 220 }, [chest, { id: 6, position: { x: 470, y: 220 }, radius: 40 }])).toBe(6);
    expect(actorAt(null, [chest])).toBeNull();
  });

  it('a click on an actor interact is legal for sends interact instead of aim.release', () => {
    const m = new InputMapper();
    m.setState({ ...AIMING, interactable: [5] });
    m.move(onChest);
    m.down(0, onChest);
    expect(cmds(m.up(0, onChest))).toEqual([{ type: 'interact', actor: 5 }]);
  });

  it('works outside the aim phase too, and never while a modal is open or interact is not legal', () => {
    const m = new InputMapper();
    m.setState({ ...AIMING, aimable: false, interactable: [5] });
    m.down(0, onChest);
    expect(cmds(m.up(0, onChest))).toEqual([{ type: 'interact', actor: 5 }]);
    m.setState({ ...AIMING, aimable: false, modal: true, interactable: [5] });
    m.down(0, onChest);
    expect(cmds(m.up(0, onChest))).toEqual([]);
    m.setState({ ...AIMING, interactable: [] });
    m.move(onChest);
    m.down(0, onChest);
    expect(cmds(m.up(0, onChest))).toEqual([{ type: 'aim.release', aim: { x: 452, y: 232 } }]);
  });

  it('interactable: the ids legal() lists, else every visible neutral, nothing without the spec', () => {
    const field = [
      { id: 1, kind: 'hero', hidden: false },
      { id: 5, kind: 'neutral', hidden: false },
      { id: 6, kind: 'neutral', hidden: true },
      { id: 7, kind: 'enemy', hidden: false },
    ];
    expect(interactable({ field }, [{ type: 'interact' }])).toEqual([5]);
    expect(interactable({ field }, [{ type: 'interact', params: { actor: [7] } }])).toEqual([7]);
    expect(interactable({ field }, [{ type: 'aim.release' }])).toEqual([]);
  });
});
