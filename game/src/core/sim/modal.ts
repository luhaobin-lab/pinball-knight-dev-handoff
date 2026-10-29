/**
 * The kernel modal service (ARCHITECTURE §6.3): one blocking view at a time, answered by modal commands. The
 * turn-start barrier (TURN-034/035): UI_主界面's multi-choice joins with `加入回合开始(玩家角色)` when it opens
 * (UIM ln 974) and leaves with `退出回合开始(玩家角色)` when it closes (UIM ln 723); `openBarrierModal` does both.
 */
import type { CommandSpec, ModalAnswer } from '../api/commands.ts';
import type { ModalView } from '../api/view.ts';
import type { ModalService, World } from './world.ts';

interface Open {
  readonly view: ModalView;
  readonly onAnswer: (a: ModalAnswer) => void;
  readonly onClose: (() => void) | undefined;
}

export class ModalStack implements ModalService {
  private entry: Open | null = null;

  get current(): ModalView | null { return this.entry?.view ?? null; }

  /** Opening replaces the open modal without closing hooks (the Demo's widgets overwrite each other the same way). */
  open(view: ModalView, onAnswer: (answer: ModalAnswer) => void, onClose?: () => void): void {
    this.entry = { view, onAnswer, onClose };
  }

  answer(answer: ModalAnswer): boolean {
    const e = this.entry;
    if (!e) return false;
    e.onAnswer(answer);
    return true;
  }

  close(): void {
    const e = this.entry;
    this.entry = null;
    e?.onClose?.();
  }
}

/** A modal that holds the turn start open while it is shown (the talent pick). `world.modal.close()` releases it. */
export function openBarrierModal(world: World, view: ModalView, onAnswer: (answer: ModalAnswer) => void): void {
  const mode = world.mode;
  mode.加入回合开始(mode.玩家角色);
  const modal = world.modal as ModalStack;
  modal.open(view, onAnswer, () => mode.退出回合开始(mode.玩家角色));
}

/** The answers the open modal accepts (added to `legal()` by createGame for the modal types no module lists). */
export function modalLegal(view: ModalView): CommandSpec[] {
  switch (view.kind) {
    case 'multiChoice':
      return [
        { type: 'modal.pick', params: { option: view.options.map((_, i) => i) } },
        ...(view.reroll ? [{ type: 'modal.reroll' } as const] : []),
        ...(view.canSkip ? [{ type: 'modal.skip' } as const] : []),
      ];
    case 'loot': {
      const open = view.cells.filter(c => !c.taken).map(c => c.item);
      return [
        ...(open.length > 0 ? [{ type: 'loot.take', params: { item: open } } as const] : []),
        ...(view.canTakeAll && open.length > 0 ? [{ type: 'loot.takeAll' } as const] : []),
        { type: 'loot.close' },
      ];
    }
    case 'panel':
      return [{ type: 'panel.continue' }, ...(view.canRetry ? [{ type: 'panel.retry' } as const] : [])];
    case 'runEnd':
      return [{ type: 'runEnd.continue' }];
    case 'warning':
      return [
        { type: 'warning.answer', params: { button: [0, 1] } },
        // Only the ordinary pause warning has a close action; resume requires a choice.
        ...(view.type === 0 ? [{ type: 'menu.close' } as const] : []),
      ];
    case 'enchantReplace':
      // Source has only existing-enchantment replacement buttons; the stone was already consumed on opening.
      return [{ type: 'modal.pick', params: { option: view.current.map((_, i) => i) } }];
  }
}
