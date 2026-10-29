import type { PixelRenderer } from '../render/api';
import { createCombatHud, type CombatHud, type EnemyMark } from '../ui';
import { ScreenLayer } from '../ui/core/screen-layer';
import { PixelFont } from '../ui/text/font';
import { rect } from '../ui/core/surface';
import { PageStack, type Page, type UiPointer } from '../ui/kit';
import { createAudio, type Audio } from '../audio';
import { createVfx, SpawnPerUnit, type TrailHandle, type Vfx } from '../vfx';
import type { Command, CommandSpec, Game, GameView, PresentEvent, Screen, SkillPreview } from './api';

type GameLegal = readonly CommandSpec[];
import { createPolicy, Stopper, type Policy } from './autoplay';
import { combatFlags, heroState, itemCards, questLine, unlockedRows } from './bind/hud';
import { inventoryExpanded, inventoryTip } from './bind/inventory';
import { BACKPACK_SHIFT, BackpackPanel } from '../ui/pages/backpack/panel';
import { TooltipPage } from '../ui/pages/tooltip/page';
import { frameTop } from '../ui/hud/layout';
import { stashHit } from '../ui/pages/stash/page';
import { bindingFor } from './bind/pages';
import type { LivePage, PageBinding, PageModel } from './bind/page-model';
import { GameClock } from './clock';
import { Cues, type CueTarget } from './cues';
import { actorAt, InputMapper, interactable, type Intent, type PointerSample } from './input';
import { addPixelOverlay } from './overlay';
import { ShellPage } from './pages/shell-page';
import { PlayModal } from './pages/play-modal';
import { PLAY_CX } from './play-area';
import { ItemMenuPage } from '../ui/pages/item-menu/page';
import type { ItemMenuModel } from '../ui/pages/item-menu/model';
import { clientToInternal, internalToFloor } from './pointer';
import { AimPreview } from './room/aim';
import type { ScreenController, ScreenDeps } from './screens/controller';
import { heroScreen } from './screens/hero';
import { mapScreen } from './screens/map';
import { roomScreen } from './screens/room';
import { runEndScreen } from './screens/run-end';
import { titleScreen } from './screens/title';

/**
 * The frame loop (ARCHITECTURE §8.1): input → `send`; real dt → game dt (`clock.ts`) → `advance`; `drainEvents` →
 * handlers (dilations, the room's reactions, HUD popups, cues); the screen controller; the page of the current
 * screen or modal; the HUD. The shell keeps no rules: it reads `game.view` and `game.legal()` and sends Commands.
 */
export interface ShellOptions {
  renderer: PixelRenderer;
  game: Game;
  seed: number;
  /** `?bot=` policy, `?speed=`, `?stop=` (a screen or a modal kind where the bot stops). */
  bot?: string | null;
  /** Same per-run salt used by the headless bot; default is the first run. */
  botRunIndex?: number;
  speed?: number;
  stop?: string | null;
  /** Listen to the pointer and keys (false for tool runs that only watch the bot). */
  input?: boolean;
  /** Source save callbacks and QuitGame only; never save the live simulation every frame. */
  onSave?():void;
}

export interface ShellStats {
  screen: Screen;
  modal: string | null;
  page: string | null;
  sent: number;
  rejected: number;
  lastReject: string | null;
  stopped: boolean;
  unknownCues: Record<string, number>;
}

/** Seconds of real time between two bot commands at speed 1 (so the browser run can be watched). */
const BOT_PACE = 0.5;

export class Shell {
  readonly clock = new GameClock();
  readonly input = new InputMapper();
  readonly cues = new Cues();
  readonly stats: ShellStats;
  private controller: ScreenController;
  private hud: CombatHud | null = null;
  private pageLayer: ScreenLayer | null = null;
  private font: PixelFont | null = null;
  private readonly stack = new PageStack();
  /** One page per binding, kept so the stack's fades see the same page. */
  private readonly pages = new Map<string, ShellPage>();
  private readonly lives = new Map<string, LivePage>();
  private base: Page | null = null;
  private modalPage: Page | null = null;
  private pagesEmpty = false;
  private closing: Page | null = null;
  /** The card whose item menu is open (right-click), or null. */
  private itemMenu: { item: number; at: { x: number; y: number } } | null = null;
  private menuPage: ItemMenuPage | null = null;
  private menuKey = '';
  private readonly backpack = new BackpackPanel();
  private backpackOpen = false;
  private backpackOverride: boolean | null = null;
  private inventoryPhase = '';
  private inventoryHover: string | null = null;
  private inventoryPress = false;
  private inventoryTooltip: TooltipPage | null = null;
  /** The last pointer position on the page layer's design frame (the item menu opens there). */
  private pointerAt = { x: 0, y: 0 };
  private readonly aim = new AimPreview();
  private skillAim: SkillPreview | null = null;
  private readonly policy: Policy | null;
  private readonly stopper: Stopper;
  private botWait = 0;
  private readonly vfx: Vfx;
  /** 粒子_轨迹 of the launch being played. */
  private trail: TrailHandle | null = null;
  private readonly dust = new SpawnPerUnit();
  private audioTime = 0;
  private windOn = false;
  private readonly audio: Audio;
  private readonly deps: ScreenDeps;
  private disposers: (() => void)[] = [];

  private constructor(private readonly o: ShellOptions) {
    this.deps = { renderer: o.renderer, seed: o.seed };
    this.clock.speed = o.speed ?? 1;
    this.clock.sync(o.game.view.time);
    this.policy = o.bot ? createPolicy(o.bot, o.seed, o.game, o.botRunIndex ?? 0) : null;
    this.stopper = new Stopper(o.stop ?? null);
    this.vfx = createVfx(o.renderer, { seed: o.seed });
    this.audio = createAudio({ seed: o.seed, now: () => this.audioTime });
    const v = o.game.view;
    this.stats = { screen: v.screen, modal: null, page: null, sent: 0, rejected: 0, lastReject: null, stopped: false, unknownCues: {} };
    this.controller = this.makeController(v);
    addPixelOverlay(o.renderer, (c, ctx) => {
      const stage = this.controller.stage; stage?.draw(c, ctx);
      const aim = this.skillAim;
      if (!stage || !aim) return;
      const point = (p: { x: number; y: number }) => { const q = stage.frame.toTiles(p.x, p.y); return ctx.project({ x: q.x, y: 0, z: q.z }); };
      const a = point(aim.origin), b = point(aim.end);
      c.line(a.x, a.y, b.x, b.y, '#ECEEE7');
      if (aim.indicatorType === 4) return; // Source type4 shows legal terrain cells through RoomStage.
      const points = Array.from({ length: 65 }, (_, i) => point({ x: aim.end.x + Math.cos(i * Math.PI / 32) * aim.radius, y: aim.end.y + Math.sin(i * Math.PI / 32) * aim.radius }));
      for (let i = 1; i < points.length; i++) c.line(points[i - 1]!.x, points[i - 1]!.y, points[i]!.x, points[i]!.y, '#ECEEE7');
    });
  }

  /** Creates the shell; resolves once the pixel font is loaded (the HUD and the pages need it). */
  static async create(o: ShellOptions): Promise<Shell> {
    const shell = new Shell(o);
    if (o.input !== false) shell.listen();
    shell.font = await PixelFont.load();
    shell.pageLayer = new ScreenLayer(o.renderer, document.body);
    shell.pageLayer.canvas.dataset.uiLayer = 'pages';
    shell.pageLayer.canvas.style.zIndex = '3';
    shell.hud = await createCombatHud({ renderer: o.renderer, onAction: t => shell.hudAction(t) });
    shell.frame(0);
    return shell;
  }

  get game(): Game {
    return this.o.game;
  }

  /** Sends a command and counts rejections (the bot and tests read `stats`). */
  send(cmd: Command): boolean {
    const r = this.o.game.send(cmd);
    if (r.ok) {
      this.stats.sent++;
      if (cmd.type === 'map.backpack') this.backpackOverride = Boolean(cmd.open);
    }
    else {
      this.stats.rejected++;
      this.stats.lastReject = `${cmd.type}: ${r.reason ?? ''}`;
    }
    return r.ok;
  }

  /** One frame of `dt` real seconds. */
  frame(dt: number): void {
    const game = this.o.game;
    this.audioTime += Math.max(0, dt); // FEEL clock contract: audio/concurrency stays undilated.
    this.input.update(dt);
    this.botStep(dt);
    let view = game.view;
    // Loot reveal / talent choices / result pages own latent settlement work in core. Their modal gate already
    // restricts commands; stopping the simulation also stops that work. Only the explicit pause warning freezes it.
    const paused = view.modal?.kind === 'warning' && view.launch === null;
    const gameDt = this.clock.step(dt, paused);
    if (gameDt > 0) game.advance(gameDt);
    // while a modal pauses the world, the room's presentation still settles on real time (the hero's pop-out back to
    // the idle pose, the trail's fade), so a page never freezes a launch beat
    const presentDt = paused ? Math.max(0, dt) * this.clock.speed : gameDt;
    view = game.view;
    if (view.screen !== this.controller.screen) {
      this.controller.exit();
      this.controller = this.makeController(view);
    }
    this.o.renderer.fx.shakeTime(dt > 0 ? presentDt / dt : 1);
    this.vfx.update(presentDt);
    this.controller.stage?.setPresentationHooks(at => {
      this.vfx.deathSplat(at.x, at.z);
      this.audio.play('death', at); // existing Mob die notify at game age .5, never an early generic hit
    });
    for (const e of game.drainEvents()) this.event(e);
    this.controller.update(view, presentDt);
    const hero = this.controller.stage?.heroView();
    if (this.trail && hero) this.trailPoint(hero.x, hero.z);
    if (hero) this.audio.setListener(hero.x, hero.z);
    if (Boolean(hero) !== this.windOn) { this.windOn = Boolean(hero); this.audio.loop('wind', this.windOn); }
    this.updateAim(view);
    this.updateInventory(view);
    this.updateHud(view, dt);
    this.updatePage(view, dt);
    this.stats.screen = view.screen;
    this.stats.modal = view.modal?.kind ?? null;
    this.stats.unknownCues = Object.fromEntries(this.cues.unknown);
  }

  private makeController(view: GameView): ScreenController {
    switch (view.screen) {
      case 'title':
        return titleScreen(this.deps);
      case 'heroSelect':
        return heroScreen(this.deps);
      case 'map':
        return mapScreen(this.deps);
      case 'room':
        return roomScreen(this.deps, view);
      case 'runEnd':
        return runEndScreen(this.deps);
    }
  }

  private event(e: PresentEvent): void {
    if(e.kind==='ui'&&(e.widget==='save.persist'||e.widget==='game'&&e.op==='close'))this.o.onSave?.();
    switch (e.kind) {
      case 'time.dilation':
        this.clock.dilate(e.curve, e.from);
        return;
      case 'launch.start':
        this.hud?.beginLaunch();
        this.audio.play('launch');
        if (this.trail) this.vfx.trailEnd(this.trail);
        this.trail = this.vfx.trailBegin();
        this.dust.reset();
        if (e.at && this.controller.stage) {
          const p = this.controller.stage.frame.toTiles(e.at.x, e.at.y); this.trailPoint(p.x, p.z);
        }
        break;
      case 'launch.contact': {
        const stage = this.controller.stage;
        if (e.at && stage) { const p = stage.frame.toTiles(e.at.x, e.at.y); this.trailPoint(p.x, p.z); }
        if (e.contact === 'enemy' && stage) {
          this.audio.play('swing', stage.heroView());
          this.vfx.whirlwind(() => { const h = stage.heroView(); return h ? { x: h.x, z: h.z } : { x: 0, z: 0 }; });
        }
        break;
      }
      case 'launch.end':
        if (e.at && this.controller.stage) {
          const p = this.controller.stage.frame.toTiles(e.at.x, e.at.y); this.trailPoint(p.x, p.z);
        }
        if (this.trail) this.vfx.trailEnd(this.trail);
        this.trail = null;
        this.dust.reset();
        break;
      case 'popup':
        this.popup(e);
        return;
      case 'vfx':
      case 'sound':
      case 'shake':
        this.cues.play(e, this.cueTarget());
        return;
      default:
        break;
    }
    this.controller.event(e);
  }

  private cueTarget(): CueTarget {
    const stage = this.controller.stage;
    return {
      shake: k => this.o.renderer.fx.cameraShake(k),
      sound: (cue, at) => this.audio.play(cue, at ?? undefined),
      spark: at => this.vfx.hitSpark(at.x, at.z, 0, 1),
      spores: (at, n) => this.vfx.spores(at.x, at.z, n.x, n.z),
      deathSplat: at => this.vfx.deathSplat(at.x, at.z),
      normal: e => e.kind === 'vfx' && e.normal && stage ? stage.direction(e.normal.x, e.normal.y) : { x: 0, z: 0 },
      place: e => {
        if (!stage) return null;
        // A KeepWorld attached hit effect carries its exact impact point; attach-only effects follow the actor.
        if (e.at) return stage.frame.toTiles(e.at.x, e.at.y);
        if (e.kind === 'vfx' && e.attach !== null) {
          const a = stage.actor(e.attach);
          if (a) return { x: a.x, z: a.z };
        }
        return null;
      },
    };
  }

  private trailPoint(x: number, z: number): void {
    if (!this.trail) return;
    this.vfx.trailPoint(this.trail, x, z);
    for (let i = 0, n = this.dust.step(x, z); i < n; i++) {
      this.vfx.dust(x, z);
      this.audio.play('step', { x, z });
    }
  }

  private popup(e: Extract<PresentEvent, { kind: 'popup' }>): void {
    const hud = this.hud;
    const stage = this.controller.stage;
    if (!hud || !stage) return;
    const actor = e.target !== null ? stage.actor(e.target) : undefined;
    const at = actor ? { x: actor.x, y: actor.top * 0.5, z: actor.z } : e.at ? { ...stage.frame.toTiles(e.at.x, e.at.y), y: 0.8 } : null;
    if (!at || typeof e.value !== 'number') return;
    if (e.popup === 'damage') hud.popup({ kind: e.crit ? 'crit' : 'damage', value: e.value, at: { world: at }, owner: e.target !== null ? String(e.target) : undefined, angle: 0, height: 55 });
    else if (e.popup === 'exp') hud.popup({ kind: 'exp', value: e.value, at: { world: at } });
    else if (e.popup === 'heal') hud.popup({ kind: 'heal', hero: actor?.kind === 'hero', value: e.value, at: { world: at } });
  }

  private updateAim(view: GameView): void {
    const stage = this.controller.stage;
    const aimable = combatFlags(view).aiming && view.launch === null;
    const selectedSkill = !!view.hero?.selectedSkill;
    this.input.setState({ aimable, selectedSkill, hero: stage?.heroPosition ?? null, menuOpen: view.modal?.kind === 'warning', modal: view.modal !== null, interactable: selectedSkill ? [] : interactable(view, this.o.game.legal()) });
    const aim = this.input.aim ?? this.restingAim(view);
    this.skillAim = aimable && selectedSkill && aim ? this.o.game.previewSkill?.(aim) ?? null : null;
    stage?.setSkillPreview(this.skillAim);
    stage?.setPreview(this.aim.get(this.o.game, aim, aimable && !selectedSkill && stage !== null));
  }

  /** Without a pointer aim (the bot, tools) the preview shows the aim at the nearest living enemy. */
  private restingAim(view: GameView): { x: number; y: number } | null {
    const h = view.hero;
    if (!h) return null;
    const foes = view.field.filter(f => (f.kind === 'enemy' || f.kind === 'boss') && f.hp > 0);
    if (foes.length === 0) return null;
    const d = (f: (typeof foes)[number]): number => Math.hypot(f.position.x - h.position.x, f.position.y - h.position.y);
    const f = foes.reduce((a, b) => (d(b) < d(a) ? b : a));
    return { x: f.position.x, y: f.position.y };
  }

  private updateHud(view: GameView, dt: number): void {
    const hud = this.hud;
    if (!hud) return;
    const show = this.controller.hud && (view.run !== null || view.hero !== null);
    hud.canvas.style.display = show ? '' : 'none';
    if (!show) return;
    hud.setSideOffset(this.backpackOpen ? BACKPACK_SHIFT : 0);
    hud.setHero(heroState(view));
    const slots = view.hero?.skills.filter(s => s.slot >= 1 && s.slot <= 4) ?? [];
    hud.setSkills(Array.from({ length: 4 }, (_, i) => {
      const skill = slots.find(s => s.slot === i + 1);
      return skill ? { icon: skill.row === '举盾' ? 'shield' : 'sword', type: 'weapon', cooldown: Math.max(0, skill.cooldown), disabled: !skill.usable } : null;
    }));
    hud.setCombat(combatFlags(view));
    hud.setQuest(questLine(view));
    const items = itemCards(view.inventory.equip);
    const key = JSON.stringify([items, view.inventory.lockedRows]);
    if (key !== this.itemsKey) {
      this.itemsKey = key;
      hud.setItems(items);
      hud.setUnlockedRows(unlockedRows(view));
      hud.setLockedRows(view.inventory.lockedRows);
    }
    const stage = this.controller.stage;
    const hidden = !combatFlags(view).aiming;
    const marks: EnemyMark[] = (stage?.marks(view) ?? []).map(m => ({
      id: String(m.id),
      at: m.at,
      head: m.head,
      hp: m.hp,
      hpMax: m.hpMax,
      intent: m.intent !== null ? { kind: 'attack', value: m.intent } : undefined,
      hidden,
    }));
    hud.setEnemies(marks);
    hud.update(dt);
  }

  private itemsKey = '';

  private updateInventory(view: GameView): void {
    const phase = `${view.screen}:${view.phase}`;
    const expanded = inventoryExpanded(view, this.o.game.legal());
    if (phase !== this.inventoryPhase || !expanded) this.backpackOverride = null;
    this.inventoryPhase = phase;
    const open = expanded && this.backpackOverride !== false;
    if (open !== this.backpackOpen) this.inventoryHover = null;
    this.backpackOpen = open;
    this.backpack.setItems(itemCards(view.inventory.backpack));
    this.backpack.hover = this.inventoryHover;
  }

  private updatePage(view: GameView, dt: number): void {
    const layer = this.pageLayer;
    const font = this.font;
    if (!layer || !font) return;
    layer.sync();
    const legal = this.o.game.legal();
    if (view.modal || view.tutorial || view.screen === 'title' || view.screen === 'heroSelect') this.itemMenu = null;
    // the base page always follows the screen (as if no modal were open); a modal page goes over it
    const baseBinding = bindingFor({ ...view, modal: null, tutorial:null });
    const modalBinding = view.modal || view.tutorial ? bindingFor(view) : null;
    const base = baseBinding && !baseBinding.modal ? this.bound(baseBinding, font, view, legal) : null;
    const menu = this.itemMenuPage(font, legal);
    const modal = menu ?? (modalBinding?.modal ? this.bound(modalBinding, font, view, legal) : null);
    if (modal !== this.modalPage) {
      if (this.modalPage) {
        this.stack.close(this.modalPage);
        this.closing = this.modalPage;
      }
      this.modalPage = modal;
      // PlayModal draws its own (deeper) dim; the item menu opens undimmed
      if (modal) this.stack.open(modal, { dim: menu === null && !(modal instanceof PlayModal) });
    }
    if (base !== this.base) {
      this.base = base;
      this.stack.setBase(base);
    }
    const page = modal ?? base;
    this.stats.page = page?.id ?? null;
    const s = layer.surface;
    const pageFrame = rect(Math.floor((s.w - 960) / 2), Math.floor((s.h - 540) / 2), 960, 540);
    // Page open/model changes already lay out their regions. Rebuilding them every frame loses a held pointer's
    // target identity before its release, notably on loot cards and map tiles.
    if (pageFrame.x !== this.pageFrame.x || pageFrame.y !== this.pageFrame.y) {
      this.pageFrame = pageFrame;
      this.stack.layout(this.pageFrame);
    }
    this.stack.update(dt);
    // an empty stack (the room without a modal) is cleared once, not every frame
    const tip = !view.modal && !this.itemMenu && this.input.dragging === null ? inventoryTip(view, this.inventoryHover, this.backpackOpen ? BACKPACK_SHIFT : 0, frameTop(s.h)) : null;
    const empty = !this.backpackOpen && !tip && this.stack.top === null && (!this.closing || this.stack.openness(this.closing) === 0);
    if (empty && this.pagesEmpty) return;
    this.pagesEmpty = empty;
    s.clear();
    if (this.backpackOpen) {
      s.origin(0, frameTop(s.h));
      this.backpack.draw(s, font);
      s.origin(0, 0);
    }
    this.stack.draw(s, this.clock.time);
    if (!this.inventoryTooltip) this.inventoryTooltip = new TooltipPage(font, tip);
    else this.inventoryTooltip.setModel(tip);
    this.inventoryTooltip.layout(rect(0, 0, s.w, s.h));
    s.origin(0, 0);
    this.inventoryTooltip.draw(s);
    layer.present();
  }

  /** The page of a binding: its live ui page, else the shell's generic page. */
  private bound(binding: PageBinding, font: PixelFont, view: GameView, legal: GameLegal): Page | null {
    if (binding.live) return this.livePage(binding, font, view, legal);
    return binding.model ? this.pageFor(binding.model(view, legal), font) : null;
  }

  private livePage(binding: PageBinding, font: PixelFont, view: GameView, legal: GameLegal): Page {
    let live = this.lives.get(binding.id);
    if (!live) {
      live = binding.live!({ font, send: cmd => this.send(cmd), frame: () => this.pageFrame,
        projectWorld: point => {
          const stage = this.controller.stage;
          if (!stage) return null;
          const tile = stage.frame.toTiles(point.x, point.y);
          const p = this.o.renderer.project({ x: tile.x, y: point.z / 64, z: tile.z });
          const layer = this.pageLayer?.fromInternal(p) ?? p;
          return { x: layer.x - this.pageFrame.x, y: layer.y - this.pageFrame.y };
        },
        sideOffset: () => this.backpackOpen ? BACKPACK_SHIFT : 0,
      });
      this.lives.set(binding.id, live);
    }
    live.update(view, legal);
    if (!binding.modal) return live.page;
    let wrapped = this.modals.get(binding.id);
    if (!wrapped) {
      wrapped = new PlayModal(live.page, binding.centreX === undefined ? 0 : Math.round(PLAY_CX - binding.centreX), () => this.pageFrame);
      this.modals.set(binding.id, wrapped);
    }
    return wrapped;
  }

  /** Modal live pages on the play-area rule (centre and dim), by binding id. */
  private readonly modals = new Map<string, PlayModal>();
  /** The stack's design frame on the page layer. */
  private pageFrame = rect(0, 0, 960, 540);

  private pageFor(model: PageModel, font: PixelFont): ShellPage {
    let p = this.pages.get(model.id);
    if (!p) {
      p = new ShellPage(font, model, cmd => this.send(cmd));
      this.pages.set(model.id, p);
    } else p.setModel(model);
    return p;
  }

  private botStep(dt: number): void {
    const policy = this.policy;
    if (!policy || this.stats.stopped) return;
    const game = this.o.game;
    const view = game.view;
    if (this.stopper.reached(view)) {
      this.stats.stopped = true;
      return;
    }
    if (view.launch) return;
    this.botWait -= dt * this.clock.speed;
    if (this.botWait > 0) return;
    const legal = game.legal();
    // Ambient HUD commands do not mean the core is waiting for a decision (same contract as Game.runUntilInput).
    // In particular do not consume policy RNG or open Settings while the title/room is still loading.
    const ambient = new Set(['menu.open', 'page.open', 'page.close', 'title.settings', 'title.quit', 'map.backpack', 'item.move', 'item.use']);
    if (!legal.some(s => !ambient.has(s.type))) return;
    const cmd = this.stopper.lead(view, legal) ?? policy.next(view, legal);
    if (cmd) {
      if (!this.send(cmd)) policy.rejected?.(view, cmd);
      this.botWait = BOT_PACE;
    }
  }

  private hudAction(target: string): void {
    // UI_背包栏_3d.Button_27 opens the pause dialog (warning type 0)
    if (target === 'settings') this.send({ type: 'menu.open' });
    else if (target.startsWith('skill:')) this.send({ type: 'skill.press', slot: Number(target.slice(6)) + 1 });
  }

  private intents(list: readonly Intent[]): void {
    for (const i of list) {
      if (i.kind === 'command') this.send(i.cmd);
      else if (i.kind === 'itemMenu') this.itemMenu = { item: i.item, at: { ...this.pointerAt } };
    }
  }

  /**
   * UI_物品交互菜单 (ui-kit `ItemMenuPage`) for a right-clicked card, opened at the pointer: 使用 and 分解, enabled
   * when legal; a click outside or Escape closes it. SPEC-GAP: the menu opens at the pointer, not flush with the
   * card's right edge (the HUD exposes no card rects yet).
   */
  private itemMenuPage(font: PixelFont, legal: GameLegal): Page | null {
    const m = this.itemMenu;
    if (!m) return null;
    const can = (t: CommandSpec['type']): boolean => legal.some(s => s.type === t && (!s.params?.item || s.params.item.includes(m.item)));
    const model: ItemMenuModel = {
      anchor: m.at,
      rows: [
        { id: 'use', label: '使用', enabled: can('item.use') },
        { id: 'modify', label: '改造', enabled: can('item.modify') },
        ...(can('craft.put')?[{ id: 'put', label: '置入', enabled: true }]:[]),
        { id: 'dismantle', label: '分解', enabled: can('item.dismantle') },
        ...([...this.o.game.view.inventory.equip,...this.o.game.view.inventory.backpack].find(c=>c.id===m.item)?.extractCost ? [{id:'extract',label:'萃取',enabled:can('item.extract'),cost:[...this.o.game.view.inventory.equip,...this.o.game.view.inventory.backpack].find(c=>c.id===m.item)!.extractCost!}] : []),
      ],
    };
    if (!this.menuPage) {
      this.menuPage = new ItemMenuPage(font, model, i => {
        const item = this.itemMenu?.item;
        this.itemMenu = null;
        if (i.kind === 'pick' && item !== undefined) this.send(i.id === 'use' ? { type: 'item.use', item } : i.id==='modify'?{type:'item.modify',item}:i.id==='put'?{type:'craft.put',item}:i.id==='extract'?{type:'item.extract',item}:{ type: 'item.dismantle', item });
      });
    } else if (this.menuKey !== JSON.stringify(model)) this.menuPage.setModel(model);
    this.menuKey = JSON.stringify(model);
    return this.menuPage;
  }

  /** The pointer as the input mapper sees it: the page or HUD target, else the floor point in room uu. */
  private sample(ev: PointerEvent): PointerSample {
    const r = this.o.renderer;
    const hud = this.hud;
    let target: string | null = null;
    const stash=this.o.game.view.stash;
    if(stash&&this.pageLayer){const p=this.pageLayer.toLayer(ev.clientX,ev.clientY),s=this.pageLayer.surface;target=stashHit(stash,p.x-Math.floor((s.w-960)/2),p.y-Math.floor((s.h-540)/2));}
    if (hud && hud.canvas.style.display !== 'none') {
      const b = hud.canvas.getBoundingClientRect();
      const x = Math.floor(((ev.clientX - b.left) / Math.max(1, b.width)) * hud.canvas.width);
      const y = Math.floor(((ev.clientY - b.top) / Math.max(1, b.height)) * hud.canvas.height);
      target ??= (this.backpackOpen ? this.backpack.hitTest(x, y - frameTop(hud.canvas.height)) : null) ?? hud.hitTest(x, y);
    }
    const stage = this.controller.stage;
    if (target !== null || !stage) return { floor: null, hud: target, place: this.placeOf(target) };
    const internal = clientToInternal(ev.clientX, ev.clientY, r.canvas.getBoundingClientRect(), r.internal);
    const f = internalToFloor(internal, r.internal, { target: stage.target, ppt: stage.ppt });
    const floor = stage.frame.toUu(f.x, f.z);
    return { floor, hud: null, actor: actorAt(floor, this.o.game.view.field.filter(a => !a.hidden && a.kind !== 'hero')) };
  }

  /** Both source grids use the same public ItemPlace contract; occupied cards override their empty cells. */
  private placeOf(target: string | null): PointerSample['place'] {
    const stash=target?.match(/^slot:stash:(\d+):(\d+)$/);if(stash)return{grid:'stash',row:Number(stash[1]),col:Number(stash[2])};
    const slot = target?.match(/^slot:(equip|backpack):(\d+)$/);
    if (slot) {
      const grid = slot[1] as 'equip' | 'backpack', row = Number(slot[2]);
      return row < 10 && (grid === 'backpack' || !this.o.game.view.inventory.lockedRows.includes(row)) ? { grid, row, col: 0 } : null;
    }
    const m = target?.match(/^item:(\d+)$/);
    if (!m) return null;
    const inv = this.o.game.view.inventory;
    const place = [...inv.equip, ...inv.backpack,...(inv.stash??[])].find(c => c.id === Number(m[1]))?.place;
    return place && place.grid !== 'side' ? { grid: place.grid, row: place.row, col: place.col } : null;
  }

  /** Routes a pointer event to the page stack (layer pixels); true when a page took it. */
  private toPages(ev: PointerEvent, kind: UiPointer['kind']): boolean {
    const layer = this.pageLayer;
    if (!layer) return false;
    const p = layer.toLayer(ev.clientX, ev.clientY);
    const s = layer.surface;
    this.pointerAt = { x: p.x - Math.floor((s.w - 960) / 2), y: p.y - Math.floor((s.h - 540) / 2) };
    if (!this.stack.top) return false;
    return this.stack.pointer({ kind, x: p.x, y: p.y, button: ev.button });
  }

  private listen(): void {
    const canvas = this.o.renderer.canvas;
    const on = <K extends keyof WindowEventMap>(type: K, fn: (e: WindowEventMap[K]) => void): void => {
      window.addEventListener(type, fn, true);
      this.disposers.push(() => window.removeEventListener(type, fn, true));
    };
    const unlock = (): void => void this.audio.unlock();
    on('pointermove', ev => {
      if (this.inventoryPress || !this.toPages(ev, 'move')) {
        const p = this.sample(ev);
        this.inventoryHover = p.hud;
        this.input.move(p);
      } else this.inventoryHover = null;
    });
    on('pointerdown', ev => {
      unlock();
      if (this.toPages(ev, 'down')) return;
      const p = this.sample(ev);
      if (ev.target !== canvas && !(this.o.game.view.stash&&p.hud?.startsWith('item:'))) return;
      this.inventoryPress = ev.button === 0 && !!p.hud?.startsWith('item:');
      this.intents(this.input.down(ev.button, p));
    });
    on('pointerup', ev => {
      // A drag started in a grid owns its release, including a rejected drop over the map or a locked cell.
      // Otherwise the base page can swallow the up-event and leave the mapper permanently holding a card.
      const held = this.inventoryPress;
      this.inventoryPress = false;
      if (!held && this.toPages(ev, 'up')) return;
      this.intents(this.input.up(ev.button, this.sample(ev)));
    });
    on('keydown', ev => {
      if (ev.code === 'Escape' && this.itemMenu) { this.itemMenu = null; return; }
      this.intents(this.input.key(ev.code));
    });
    on('contextmenu', ev => ev.preventDefault());
  }

  dispose(): void {
    for (const d of this.disposers) d();
    this.controller.exit();
    this.hud?.dispose();
    this.pageLayer?.dispose();
    this.vfx.dispose();
    this.audio.dispose();
  }
}
