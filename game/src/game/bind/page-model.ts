import type { Rect } from '../../ui/core/surface';
import type { Page } from '../../ui/kit';
import type { TextFont } from '../../ui/text/font';
import type { Command, CommandSpec, CommandType, GameView } from '../api';

/**
 * The shell's page model: what a page binding hands the page view (`src/game/pages/shell-page.ts`). Bindings map a
 * screen or a modal of `GameView` to it; every button carries the Command it sends.
 * SPEC-GAP: until the ui-kit (`wa/ui-kit`) and ui-pages pages merge, bindings fill this generic model (Ink & Bone
 * panel, title, lines, buttons) instead of the pages' own view models; the Demo's layouts come with those pages.
 */
export interface PageButton {
  readonly label: string;
  /** null = shown but inert (a locked hero, an unreachable map cell). */
  readonly cmd: Command | null;
  /** Map cells: column and row of a grid layout. */
  readonly cell?: { readonly col: number; readonly row: number };
  readonly note?: string;
}

export interface PageModel {
  readonly id: string;
  readonly title: string;
  readonly lines: readonly string[];
  readonly buttons: readonly PageButton[];
  /**
   * `menu`: a centred column of buttons; `grid`: map cells by `cell`; `modal`: a dimmed dialog over the play area;
   * `screen`: a dialog centred on a near-black full screen (the run end, where the HUD is gone).
   */
  readonly layout: 'menu' | 'grid' | 'modal' | 'screen';
}

/** What a binding's live page may use: the pixel font and the way back to the game. */
export interface PageHost {
  readonly font: TextFont;
  send(cmd: Command): void;
  /** The page stack's design frame on the layer (where a page's (0, 0) lands). */
  frame(): Rect;
  /** Core world uu -> this page's local design pixels, using the live room camera and room origin. */
  projectWorld?(point: { x: number; y: number; z: number }): { x: number; y: number } | null;
  /** Current HUD equipment-column shift when the second backpack column is open. */
  sideOffset?(): number;
}

/** A ui-kit / ui-pages page kept in sync with the view: `update` maps the view to the page's own model. */
export interface LivePage {
  readonly page: Page;
  update(view: GameView, legal: readonly CommandSpec[]): void;
}

/**
 * Maps a screen or a modal to a page: `live` builds the Demo-layout page of the UI cards (preferred); `model` fills
 * the shell's generic page (`pages/shell-page.ts`) where no such page exists yet.
 */
export interface PageBinding {
  readonly id: string;
  /** Modal bindings are tried before screen bindings. */
  readonly modal: boolean;
  match(view: GameView): boolean;
  model?(view: GameView, legal: readonly CommandSpec[]): PageModel;
  live?(host: PageHost): LivePage;
  /**
   * Modal live pages: the design-px x their layout centres on when it is not the play-area centre (`PLAY_CX`), so the
   * shell moves them onto it (`pages/play-modal.ts`). Omitted: the page already sits on the Demo's play anchor.
   */
  readonly centreX?: number;
}

export const isLegal = (legal: readonly CommandSpec[], type: CommandType): boolean => legal.some(s => s.type === type);

/** The values `legal()` accepts for a parameter of `type` (empty when the spec lists none). */
export function legalValues(legal: readonly CommandSpec[], type: CommandType, param: string): readonly (string | number)[] {
  return legal.find(s => s.type === type)?.params?.[param] ?? [];
}

/** A button that is live only when the command is legal now. */
export function button(legal: readonly CommandSpec[], label: string, cmd: Command, extra: Partial<PageButton> = {}): PageButton {
  return { label, cmd: isLegal(legal, cmd.type) ? cmd : null, ...extra };
}

/** A live page whose model is plain data: `setModel` runs only when the mapped model changed. */
export function synced<M>(page: Page & { setModel(m: M): void }, model: (view: GameView, legal: readonly CommandSpec[]) => M): LivePage {
  let key = '';
  return {
    page,
    update(view, legal) {
      const m = model(view, legal);
      const k = JSON.stringify(m);
      if (k === key) return;
      key = k;
      page.setModel(m);
    },
  };
}
