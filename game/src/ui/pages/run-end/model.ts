import { findRow, 数据表_词条_统计 } from '../../../content/demo';

/**
 * UI_冒险结束统计页 + UI_冒险统计词条 (BP/UI/*.txt): the run-end page (phase 13), opened by the camp option after the
 * last floor (完成探险) or after a defeat or 放弃探险 (探险失败). Everything here is the widget's own logic; the binder
 * passes the run's 轮回战斗统计 and the save's 探索等级进度['总值'] as they were when the page opened.
 */

/** 轮回得分统计 (the widget's map default): points per occurrence, in the Demo's map order (lines follow it). */
export const SCORE_PER: Readonly<Record<string, number>> = {
  反弹: 1,
  获得SSS: 20,
  获取物品: 5,
  分解物品: 5,
  英雄升级: 30,
  获取天赋: 10,
  进行附魔: 5,
  挑战成功: 50,
  击败首领: 50,
  探险失败: -100,
  完成探险: 1000,
  接受指引: 500,
  自我放弃: -100,
};

/** 结构_分数 (save 探索等级进度['总值']). */
export interface ExplorationScore {
  readonly 当前解锁分: number;
  readonly 每级所需分: number;
  readonly 当前解锁等级: number;
  readonly 最高解锁等级: number;
}

export interface RunEndModel {
  /** 完成冒险？: the camp option after the last floor (true), a defeat or 放弃探险 (false). */
  readonly completed: boolean;
  /**
   * 游戏模式.轮回战斗统计 BEFORE the page adds its own 完成探险 / 探险失败 (L414 更新轮回战斗统计(…, 1)); the model adds it.
   */
  readonly counts: Readonly<Record<string, number>>;
  /** 探索等级进度['总值'] before this run (更新前分数). */
  readonly before: ExplorationScore;
  /**
   * 是DEMO？ ∧ 通过关卡数 == Demo关卡数 ∧ ¬新手关中？ (L5641): after 返回营地 the loading page shows DEMO_COMPLETE_TEXT and
   * waits for a click.
   */
  readonly demoComplete: boolean;
  /**
   * 新手关中？ ∧ 新手关过？ (a replayed prologue, L1686): the page skips the score and returns to camp after 1 s.
   * SPEC-GAP: the Delay's resume point (Linkage 129) is read as the 返回营地 call at the top of the ubergraph.
   */
  readonly replayedPrologue: boolean;
}

/** The loading-page text of L5641. */
export const DEMO_COMPLETE_TEXT = '太棒了！你完成了Demo版本的挑战。\n更多内容将在正式版展现。\n欢迎加入愿望单！';

/** One UI_冒险统计词条: 文本 (统计名's 游戏中名), "×", 次数, 得分; red when 得分 < 0. */
export interface RunEndLine {
  readonly stat: string;
  readonly label: string;
  readonly count: number;
  readonly score: string;
  readonly negative: boolean;
}

/** UI_冒险统计词条's design-time texts, kept when 统计名 has no 数据表_词条_统计 row (激活词条 pops before setting them). */
const LINE_DEFAULTS = { label: '获得SSS数', score: '200' } as const;

/** The stat whose 游戏中名 is the page's 标题. */
export const endStat = (completed: boolean): '完成探险' | '探险失败' => (completed ? '完成探险' : '探险失败');

/** The counts the page lists: the run's, plus its own 完成探险 / 探险失败. */
export function withEndStat(m: Pick<RunEndModel, 'completed' | 'counts'>): Record<string, number> {
  const stat = endStat(m.completed);
  return { ...m.counts, [stat]: (m.counts[stat] ?? 0) + 1 };
}

/** The page's lines (L2609): every 轮回得分统计 key with a count > 0, in map order. */
export function runEndLines(m: Pick<RunEndModel, 'completed' | 'counts'>): RunEndLine[] {
  const counts = withEndStat(m);
  const lines: RunEndLine[] = [];
  for (const [stat, per] of Object.entries(SCORE_PER)) {
    const count = counts[stat] ?? 0;
    if (!(count > 0)) continue;
    const row = findRow(数据表_词条_统计, stat);
    const total = Math.trunc(count * 1.0 * per);
    // QUIRK (UI_冒险统计词条 L1126): 英雄升级 has no 数据表_词条_统计 row (the row is 玩家升级), so 激活词条 returns before
    // it sets 文本 and 得分 and the line keeps the design-time "获得SSS数" / "200". Nothing counts 英雄升级 in the Demo.
    lines.push(
      row
        ? { stat, label: row.游戏中名.zh, count, score: String(total), negative: total < 0 }
        : { stat, label: LINE_DEFAULTS.label, count, score: LINE_DEFAULTS.score, negative: false },
    );
  }
  return lines;
}

/** 本次增加分数: Σ per × count over the listed stats. */
export function runScore(m: Pick<RunEndModel, 'completed' | 'counts'>): number {
  const counts = withEndStat(m);
  let sum = 0;
  for (const [stat, per] of Object.entries(SCORE_PER)) if ((counts[stat] ?? 0) > 0) sum += per * counts[stat];
  return sum;
}

export interface ExplorationGain {
  /** 本次增加等级. */
  readonly levels: number;
  /** 未消耗分数 after the loop (may be negative). */
  readonly unspent: number;
  /** 临时分数 after the loop: the old 当前解锁分 while no level was gained, else 0. */
  readonly kept: number;
  /** The saved 探索等级进度['总值'] (L4638). */
  readonly after: ExplorationScore;
}

/**
 * The level loop of L3994–L4638: while 未消耗分数 + 临时分数 ≥ 每级所需分 × (等级 + 1), subtract the full requirement from
 * 未消耗分数 and drop 临时分数 to 0.
 * QUIRK (L4057): the requirement is taken from this run's points alone once the old 当前解锁分 is dropped, so the old
 * points are lost on a level-up (1582 + 1000 at level 3 → level 4 with max(1000 − 2000, 0) = 0 points), and a loss
 * never lowers the level. 最高解锁等级 is written as 35 and never checked.
 */
export function explorationGain(before: ExplorationScore, gained: number): ExplorationGain {
  let unspent = gained;
  let kept = before.当前解锁分;
  let levels = 0;
  while (unspent + kept >= before.每级所需分 * (before.当前解锁等级 + levels + 1)) {
    unspent -= before.每级所需分 * (before.当前解锁等级 + levels + 1);
    kept = 0;
    levels++;
  }
  return {
    levels,
    unspent,
    kept,
    after: { 当前解锁分: Math.max(unspent + kept, 0), 每级所需分: 500, 当前解锁等级: before.当前解锁等级 + levels, 最高解锁等级: 35 },
  };
}

/**
 * 函数库_工具.整数滑动: FInterpTo on the integers; FTrunc while decreasing, FCeil while increasing; snaps to the target
 * once |current − target| < 1 (and reports 已抵达？).
 */
export function intSlide(current: number, target: number, dt: number, speed: number, decreasing: boolean): { value: number; arrived: boolean } {
  const arrived = Math.abs(current - target) < 1;
  if (arrived) return { value: target, arrived };
  const step = speed <= 0 ? target : current + (target - current) * Math.min(1, Math.max(0, dt * speed));
  return { value: decreasing ? Math.trunc(step) : Math.ceil(step), arrived };
}

/** 整数滑动's InterpSpeed on the exploration bar (Tick L6601). */
export const BAR_SPEED = 3;
/** Each line appears 序号 × 0.5 s after the page opens (UI_冒险统计词条.更新词条). */
export const LINE_DELAY = 0.5;
/** The bar starts sliding 1 s after the page opened (Delay 1.0 → 更新完毕？ = true); 返回营地 waits for it. */
export const BAR_START = 1;

/**
 * The page's moving state (the widget's Tick), pure for node tests: lines revealed over time, then the exploration
 * bar counting from the old points to the new ones, level by level (当前分数 slides to 最大分数, wraps to 0, 临时等级 + 1).
 */
export class RunEndState {
  readonly lines: readonly RunEndLine[];
  readonly gained: number;
  readonly gain: ExplorationGain;
  /** Seconds since 激活冒险统计页面. */
  time = 0;
  /** 当前分数 (the bar's numerator). */
  score: number;
  /** 临时等级: levels already counted up by the bar. */
  shownLevels = 0;

  constructor(readonly model: RunEndModel) {
    this.lines = model.replayedPrologue ? [] : runEndLines(model);
    this.gained = runScore(model);
    this.gain = explorationGain(model.before, this.gained);
    this.score = model.before.当前解锁分;
  }

  /** 更新完毕？: the bar runs and 返回营地 answers. */
  get ready(): boolean {
    return !this.model.replayedPrologue && this.time >= BAR_START;
  }

  /** Lines shown so far (序号 × 0.5 s). */
  get visibleLines(): number {
    return this.lines.filter((_, i) => this.time >= i * LINE_DELAY).length;
  }

  /** The level digit: 当前解锁等级 + 临时等级. */
  get level(): number {
    return this.model.before.当前解锁等级 + this.shownLevels;
  }

  /** 最大分数 = (临时等级 + 当前解锁等级 + 1) × 每级所需分. */
  get need(): number {
    return (this.level + 1) * this.model.before.每级所需分;
  }

  update(dt: number): void {
    const wasReady = this.ready;
    this.time += dt;
    if (!wasReady) return;
    const counting = this.shownLevels < this.gain.levels;
    const target = Math.max(counting ? this.need : this.gain.unspent + this.gain.kept, 0);
    this.score = intSlide(this.score, target, dt, BAR_SPEED, this.gained < 0).value;
    // The Tick calls 整数滑动 a second time from the new value: 已抵达？ is judged after the step.
    if (counting && intSlide(this.score, target, dt, BAR_SPEED, this.gained < 0).arrived) {
      this.score = 0;
      this.shownLevels++;
    }
  }
}

/** `continue` → `runEnd.continue` (返回营地, only once 更新完毕？); the Demo-complete text is the page's own last step. */
export type RunEndIntent = { readonly kind: 'continue' };

/** 标题: 数据表_词条_统计[完成探险 | 探险失败].游戏中名 (L1686). */
export function runEndTitle(completed: boolean): string {
  return findRow(数据表_词条_统计, endStat(completed))?.游戏中名.zh ?? endStat(completed);
}
