import { interpTo, sample, widgetAnim } from '../../core/motion';

/**
 * UI_首领状态条 (BP/UI/UI_首领状态条.txt): the boss's bar at the bottom of the play area. 蓝图_效果_首领_守门人 creates it
 * when the boss enters (not in phase 13), puts it in UI_主界面.首领状态框 and plays 显示; BP_Actor_Other plays 关闭 when
 * the boss dies. Every Tick each bar slides toward its value with 浮点滑动(…, 2.0) on the world's delta seconds.
 */

export interface BossBarModel {
  /** 所在对象.显示名 (set by 激活状态条). */
  readonly name: string;
  readonly hp: number;
  readonly hpMax: number;
  /** 当前护甲值. */
  readonly armor: number;
  /** 剩余持续性伤害: the HP the damage over time will take. */
  readonly dotPending: number;
  /** 溢出的治疗量: healing that cancels part of the pending damage over time. */
  readonly overflowHeal: number;
}

/** The three visible fills, as fractions of 当前最大生命 (Get_生命值_Percent, Get_持续伤害生命值_Percent, Get_护甲值_Percent). */
export interface BossBarFill {
  readonly hp: number;
  /** HP left after the pending damage over time: (当前生命 − max(剩余持续性伤害 − 溢出的治疗量, 0)) / 当前最大生命. */
  readonly safe: number;
  readonly armor: number;
}

export function bossBarTarget(m: BossBarModel): BossBarFill {
  const max = m.hpMax > 0 ? m.hpMax : 1;
  const pending = Math.max(m.dotPending - m.overflowHeal, 0);
  return { hp: m.hp / max, safe: (m.hp - pending) / max, armor: m.armor / max };
}

/** 浮点滑动 speed of the three bars (Get_*_Percent). */
export const BOSS_BAR_SPEED = 2;

/** UI_首领状态条.显示 on SizeBox_2: RenderOpacity 0 → 1 by 0.606 s, WidthOverride 250 → 600 from 0.316 s to 2.49 s. */
export const BOSS_SHOW = widgetAnim(0, 149986, {
  opacity: [[0, 0, 'cubic', 2.7021179e-5, 2.7021179e-5], [36383, 1, 'cubic', 0, 0]],
  width: [[18951, 250, 'cubic', 0.005444234, 0.005444234], [149550, 600, 'cubic', 0, 0]],
});

/** UI_首领状态条.关闭 on SizeBox_2: RenderOpacity 1 → 0 from 0.002 s to 0.508 s. */
export const BOSS_HIDE = widgetAnim(0, 120226, {
  opacity: [[136, 1, 'cubic', 0, 0], [30460, 0, 'cubic', 2.7021179e-5, 2.7021179e-5]],
});

/** Width of SizeBox_2 at rest (its WidthOverride) and once 显示 has played. */
export const BOSS_BAR_WIDTH = { rest: 250, shown: 600 } as const;

/**
 * The bar's animated state: the slid fills and the show/hide animation clock. Pure (tested in node); the page draws it.
 */
export class BossBarState {
  fill: BossBarFill = { hp: 0, safe: 0, armor: 0 };
  /** Seconds since 显示 (or 关闭) started. */
  private clock = 0;
  private closing = false;
  /** 关闭 does not key the width: it keeps what 显示 had reached (UMG KeepState). */
  private closingWidth: number = BOSS_BAR_WIDTH.shown;

  constructor(public model: BossBarModel) {}

  /** 关闭 (the boss died). */
  close(): void {
    if (this.closing) return;
    this.closingWidth = this.width;
    this.closing = true;
    this.clock = 0;
  }

  get closed(): boolean {
    return this.closing && this.clock >= 0.508;
  }

  update(dt: number): void {
    this.clock += dt;
    const t = bossBarTarget(this.model);
    this.fill = {
      hp: interpTo(this.fill.hp, t.hp, dt, BOSS_BAR_SPEED),
      safe: interpTo(this.fill.safe, t.safe, dt, BOSS_BAR_SPEED),
      armor: interpTo(this.fill.armor, t.armor, dt, BOSS_BAR_SPEED),
    };
  }

  /** SizeBox_2's WidthOverride in design units (250 before 显示's width key starts). */
  get width(): number {
    return this.closing ? this.closingWidth : sample(BOSS_SHOW, 'width', this.clock);
  }

  get opacity(): number {
    return this.closing ? sample(BOSS_HIDE, 'opacity', this.clock) : sample(BOSS_SHOW, 'opacity', this.clock);
  }
}
