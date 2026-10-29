/**
 * Doubles for the modules core-run talks to (WAVE_A §1.4): the turn machine's 新一层 / 创建任务, the map page (a chapter of
 * `floors` one-tile floors whose rooms complete by themselves after 2 s), the run statistics counter of `rating`, death
 * and corruption. Installed on a real createGame world right after creation (before the boot's first frame).
 */
import { createGame, type GameInternals } from '../../src/core/api/game.ts';
import type { Command, Game, GameOptions } from '../../src/core/api/types.ts';
import { registry } from '../../src/content/bp/index.ts';
import type { CommandHandlers } from '../../src/core/api/compose.ts';
import type { Systems } from '../../src/core/bp/systems.ts';
import { BpObject } from '../../src/core/sim/object.ts';
import type { 蓝图_动作游戏模式 } from '../../src/core/sim/mode.ts';
import type { BP_ManeActor } from '../../src/core/sim/actor.ts';
import type { World } from '../../src/core/sim/world.ts';
import { UI_冒险结束统计页 } from '../../src/core/bp/widgets.ts';

class MissionDouble extends BpObject {
  static override readonly path = 'tests/core-run/MissionDouble';
}

export interface Doubles {
  /** Floors per chapter in the map double (the Demo's 遗迹 has 12). */
  floors: number;
  /** Rooms entered (map.enter) — the double's tile count. */
  rooms: number;
  /** Map phase entered from the map double (保存英雄信息 calls). */
  snapshots: number;
  /** Bumped by 清理房间: a cleared room never completes. */
  generation: number;
  /** The current tile was cleared (当前所在格.已清理). */
  cleared: boolean;
}

export type TestGame = Game & GameInternals & { doubles: Doubles };

export function makeGame(o: Partial<GameOptions> & { floors?: number } = {}): TestGame {
  const game = createGame({ seed: 3, content: registry, debug: { skipPrologue: true }, ...o }) as TestGame;
  const d: Doubles = { floors: o.floors ?? 2, rooms: 0, snapshots: 0, generation: 0, cleared: true };
  game.doubles = d;
  const w = game.world;
  const sys = w.sys as unknown as Record<keyof Systems, Record<string, unknown>>;

  /** 修炼系统.切换地图页(false, 是读档) (L8231): phase 9; a fresh opening also saves the hero (L8360). */
  const openMap = (world: World, 是读档 = false): void => {
    const m = world.mode;
    m.当前环节 = '选择地图';
    if (是读档) return;
    d.snapshots++;
    m.玩家角色?.保存英雄信息();
  };

  sys.rating = {
    ...sys.rating,
    蓝图_动作游戏模式: {
      更新轮回战斗统计: (self: 蓝图_动作游戏模式, name: string, v: number) => self.轮回战斗统计.set(name, (self.轮回战斗统计.get(name) ?? 0) + v),
    },
  };
  sys.turn = {
    ...sys.turn,
    蓝图_动作游戏模式: {
      新一层: (self: 蓝图_动作游戏模式) => { self.当前环节 = self.当前层地图格配置表.RowName === '营地' ? '进入营地' : '回合开始'; },
      重建房间: (self: 蓝图_动作游戏模式) => { self.当前环节 = '回合开始'; roomDone(self); },
      创建任务: (self: 蓝图_动作游戏模式) => ({ 实例: self.world.spawn(MissionDouble) }),
      激活任务: () => {},
      清理房间: () => { d.generation++; },
      重置牌库和墓地: () => {},
    },
  };
  sys.stamina = {
    ...sys.stamina,
    蓝图_动作游戏模式: {
      增加腐化: (self: 蓝图_动作游戏模式, v: number) => { self.当前腐化 += v; return { 满了: false, 触发死亡: false }; },
    },
  };
  sys.damage = {
    ...sys.damage,
    BP_ManeActor: {
      // The death path: Failure panel → (panel.continue) → run end 探险失败; the double goes straight to the run end.
      检查死亡: (self: BP_ManeActor) => {
        self.死掉了 = true;
        self.world.mode.当前环节 = '战斗统计';
        self.delay('double death', 1.0, () => UI_冒险结束统计页.激活冒险统计页面(self, false));
      },
    },
  };

  const roomDone = (m: 蓝图_动作游戏模式): void => {
    const gen = d.generation;
    m.delay(`double room ${gen}`, 2.0, () => {
      if (gen !== d.generation) return;
      d.cleared = true;
      if (m.当前关卡层数 >= d.floors) m.通过关卡数 += 1;
      m.轮回战斗统计.set('反弹', (m.轮回战斗统计.get('反弹') ?? 0) + 10);
      openMap(m.world);
    });
  };

  const mapCommands: CommandHandlers = {
    'map.enter': world => {
      const m = world.mode;
      m.当前关卡层数 += 1;
      m.当前总层数 += 1;
      // Phase 8 (创建房间) takes the room-start snapshot, as the turn machine does.
      m.当前环节 = '创建房间';
      m.玩家角色?.保存英雄信息();
      m.当前环节 = '回合开始';
      d.rooms++;
      d.cleared = false;
      roomDone(m);
      return { ok: true };
    },
    'map.option': (world, cmd) => {
      if (cmd.option !== '营地') return { ok: false, reason: 'double: only 营地' };
      UI_冒险结束统计页.激活冒险统计页面(world.mode, true);
      return { ok: true };
    },
  };
  sys.map = {
    ...sys.map,
    commands: mapCommands,
    legal: (world: World) => {
      const m = world.mode;
      if (m.当前环节 !== '选择地图' || world.modal.current) return [];
      return m.当前关卡层数 >= d.floors || m.通过关卡数 > 0
        ? [{ type: 'map.option', params: { option: ['营地'] } }]
        : [{ type: 'map.enter', params: { cell: ['r1c1'] } }];
    },
    UI_关卡地图页面: { 重置地图页: () => {}, 重置关卡页: () => {} },
    修炼系统: { 切换地图页: (self: BpObject, 关闭: boolean, 是读档: boolean) => { if (!关闭) openMap(self.world, 是读档); } },
    当前所在格: () => ({ 已清理: d.cleared, 地图格配置表: '简单战斗', 层配置: null }),
  };
  return game;
}

/** send + runUntilInput; throws on a refused command so scripts fail where they break. */
export function step(game: Game, cmd: Command, seconds = 30): string {
  // Real source tips now overlay the run double. Dismiss through the real command, preserving the flow assertions.
  while(game.view.tutorial){const tip=game.send({type:'tutorial.continue'});if(!tip.ok)throw new Error('tutorial dismissal rejected');game.runUntilInput(seconds);}
  const r = game.send(cmd);
  if (!r.ok) throw new Error(`${cmd.type}: ${r.reason} (screen ${game.view.screen}, legal ${game.legal().map(s => s.type).join(',')})`);
  let state=game.runUntilInput(seconds);
  while(game.view.tutorial){const tip=game.send({type:'tutorial.continue'});if(!tip.ok)throw new Error('tutorial dismissal rejected');state=game.runUntilInput(seconds);}
  return state;
}

/** One full run with the doubles: title → hero select → map → rooms → 营地 → run end → title. */
export function playRun(game: TestGame, hero = '幽冥骑士'): void {
  step(game, { type: 'title.newRun' });
  if (game.view.heroSelect?.picked !== hero) step(game, { type: 'hero.pick', hero });
  step(game, { type: 'hero.start' });
  while (game.view.screen === 'map' && game.legal().some(s => s.type === 'map.enter')) {
    step(game, { type: 'map.enter', cell: 'r1c1' });
  }
  step(game, { type: 'map.option', option: '营地' });
  step(game, { type: 'runEnd.continue' });
}
