/**
 * Player commands (ARCHITECTURE Appendix A.8 with WAVE_A §3.2). Every player input is a Command; `legal()` lists the
 * CommandSpecs the current state accepts. Contract file of core-contracts.
 */

export type ItemPlace = { grid: 'equip' | 'backpack' | 'stash'; row: number; col: number };

/** Pages wave B fills, opened from the HUD or the menu (`page.open`). */
export type PageName = 'craft' | 'materials' | 'stash' | 'codex' | 'talents' | 'settings';

export type Command =
  | {type:'tutorial.continue'} | {type:'tutorial.close'}
  // title (the camp main menu, UI_营地主菜单; 继续冒险 is always hidden)
  | { type: 'title.prologue' } | { type: 'title.newRun' } | { type: 'title.settings' } | { type: 'title.quit' }
  // hero select (abyss levels are collapsed)
  | { type: 'hero.pick'; hero: string } | { type: 'hero.start' } | { type: 'hero.back' }
  // chapter map
  | { type: 'map.enter'; cell: string } | { type: 'map.option'; option: string } | { type: 'map.backpack'; open: boolean }
  | { type: 'camp.statue' }
  | { type: 'camp.travel'; option:string }
  // room
  | { type: 'aim.release'; aim: { x: number; y: number } }
  | { type: 'skill.press'; slot: number } | { type: 'skill.target'; at: { x: number; y: number } } | { type: 'skill.cancel' }
  | { type: 'interact'; actor: number }
  // items (craft / enchant / extract handlers in wave B)
  | { type: 'item.move'; item: number; to: ItemPlace } | { type: 'item.use'; item: number } | { type: 'item.dismantle'; item: number }
  | { type: 'item.combine'; item: number; with: number } | { type: 'item.enchant'; stone: number; target: number; replace?: number }
  | { type: 'item.craft'; recipe: string; count: number } | { type: 'item.extract'; item: number }
  | { type: 'item.modify'; item: number } | { type: 'craft.select'; recipe: string }
  | { type: 'craft.quality'; delta: -1 | 1 } | { type: 'craft.put'; item: number } | { type: 'craft.take'; item: number }
  // modals
  | { type: 'modal.pick'; option: number } | { type: 'modal.reroll' } | { type: 'modal.skip' }
  | { type: 'loot.take'; item: number; to?: ItemPlace } | { type: 'loot.takeAll' } | { type: 'loot.close' }
  | { type: 'panel.continue' } | { type: 'panel.retry' }
  | { type: 'warning.answer'; button: 0 | 1 }
  // pause dialog (UI_警告提示 type 0) and pages
  | { type: 'menu.open' } | { type: 'menu.resetRoom' } | { type: 'menu.abandon' } | { type: 'menu.saveQuit' } | { type: 'menu.close' }
  | { type: 'page.open'; page: PageName } | { type: 'page.close' }
  | { type: 'runEnd.continue' };

export type CommandType = Command['type'];
export type CommandOf<K extends CommandType> = Extract<Command, { type: K }>;

/** What the current state accepts: the type, and for parametrised commands the accepted values per parameter. */
export type CommandSpec = { type: CommandType; params?: Readonly<Record<string, readonly (string | number)[]>> };
export interface CommandResult { ok: boolean; reason?: string }

/** The commands a blocking modal answers (routed by the kernel modal service). */
export type ModalAnswer = CommandOf<
  'modal.pick' | 'modal.reroll' | 'modal.skip' | 'loot.take' | 'loot.takeAll' | 'loot.close' | 'panel.continue' | 'panel.retry' |
  'warning.answer' | 'menu.close' | 'runEnd.continue'
>;
