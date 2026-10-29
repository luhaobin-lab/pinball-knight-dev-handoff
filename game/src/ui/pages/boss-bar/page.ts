import { rect, Surface, type Rect } from '../../core/surface';
import { toGrid, type Box } from '../../kit/umg';
import type { Page } from '../../kit/page';
import { label } from '../../kit/rich';
import { TEXT } from '../../kit/style';
import { fillWidth } from '../../style/draw';
import { BONE, DANGER, INK } from '../../style/palette';
import type { TextFont } from '../../text/font';
import { BossBarState, type BossBarModel } from './model';

/**
 * Where UI_首领状态条 sits: UI_主界面.首领状态框父级 (anchor 0.5, 1; offset 288, 0; 1200 × 93; alignment 0.5, 1), its
 * HorizontalBox centred, the bar's slot set to HAlign/VAlign Center by 蓝图_效果_首领_守门人; the bar is 93 units tall
 * (the cap images 各种UI_Sprite / _2, 120 × 93) and SizeBox_2's WidthOverride wide.
 * SPEC-GAP: ss4/ss5 (boss_gatekeeper.json) show the plate centred near x 1146 and 528 wide; the dump's anchor puts the
 * centre at 1248 (the centre of 区域判断) and 显示 ends at 600. The dump wins.
 */
export const BOSS_BAR_SLOT = { centreX: 960 + 288, bottom: 1080, height: 93 } as const;

/** The bars inside the plate: SizeBox_0 padding 51, 51, 51, 21, then Overlay_1 padding 3. */
const BARS_PAD = { side: 51 + 3, top: 51 + 3, bottom: 21 + 3 } as const;

export function bossBarRects(width: number): { plate: Rect; bars: Rect; name: Rect } {
  const plate: Box = { x: BOSS_BAR_SLOT.centreX - width / 2, y: BOSS_BAR_SLOT.bottom - BOSS_BAR_SLOT.height, w: width, h: BOSS_BAR_SLOT.height };
  const bars: Box = { x: plate.x + BARS_PAD.side, y: plate.y + BARS_PAD.top, w: width - 2 * BARS_PAD.side, h: plate.h - BARS_PAD.top - BARS_PAD.bottom };
  // 名字: OverlaySlot padding top 3, HAlign Center; one line of the pixel font.
  const name: Box = { x: plate.x, y: plate.y + 3, w: width, h: 40 };
  return { plate: toGrid(plate), bars: toGrid(bars), name: toGrid(name) };
}

/**
 * The boss bar page (HitTestInvisible like the widget: it never takes input). Fills: HP in danger red, the HP the
 * damage over time will take in its deep red, 强固 as a bone line over the top half (BossArom).
 */
export class BossBarPage implements Page {
  readonly id = 'boss-bar';
  readonly state: BossBarState;
  private scratch: Surface | null = null;

  constructor(
    private readonly font: TextFont,
    model: BossBarModel,
  ) {
    this.state = new BossBarState(model);
  }

  setModel(model: BossBarModel): void {
    this.state.model = model;
  }

  close(): void {
    this.state.close();
  }

  layout(): void {}

  update(dt: number): void {
    this.state.update(dt);
  }

  draw(s: Surface): void {
    const k = this.state.opacity;
    if (k <= 0) return;
    const { bars, name } = bossBarRects(this.state.width);
    // Fading (显示 / 关闭): draw on a scratch layer and composite it at the widget's RenderOpacity.
    if (k < 1 && (this.scratch?.w !== s.w || this.scratch?.h !== s.h)) this.scratch = new Surface(s.w, s.h);
    const layer = k < 1 && this.scratch ? this.scratch : s;
    if (layer !== s) layer.clear();
    // The plate, closed tight around the bars: an ink-deep face, a 1-px faint outline, a 1-px gap before the fills.
    const outline = rect(bars.x - 2, bars.y - 2, bars.w + 4, bars.h + 4);
    layer.fillRect(outline, INK.deep);
    layer.frame(outline, BONE.faint);
    const inner = bars;
    const f = this.state.fill;
    layer.fill(inner.x, inner.y, fillWidth(inner.w, f.hp), inner.h, DANGER.deep);
    layer.fill(inner.x, inner.y, fillWidth(inner.w, Math.min(f.safe, f.hp)), inner.h, DANGER.base);
    // 强固: a bone band over the top half, with an ink line under it so it separates from the red at 960×540.
    if (f.armor > 0) {
      const w = fillWidth(inner.w, f.armor);
      const h = Math.max(1, Math.floor(inner.h / 2));
      layer.fill(inner.x, inner.y, w, h, BONE.base);
      if (h < inner.h) layer.fill(inner.x, inner.y + h, w, 1, INK.deep);
    }
    label(layer, this.font, this.state.model.name, rect(name.x, name.y, name.w, this.font.line), TEXT.body, 'center');
    if (layer !== s) s.blit(layer, 0, 0, k);
  }

  hit(): boolean {
    return false;
  }

  pointer(): boolean {
    return false;
  }
}
