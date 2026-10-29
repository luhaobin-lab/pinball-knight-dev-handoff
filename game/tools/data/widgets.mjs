// The widget manifest (src/content/demo/widgets.ts): every live Demo widget (dump/widgets/CatapultHero/BP/UI, 过期
// excluded) as a flat list of its nodes with resolved slot rects at the 1920×1080 design size and at our 960×540
// grid. The root is placed at 0,0 with the design size, so full-screen pages resolve exactly; for a sub-widget the
// rects are relative to a full-screen root (the raw `canvas` data is kept to re-resolve inside another parent).
// Canvas slots resolve from anchors, offsets and alignment; overlay, border, size-box, switcher, scale-box, button
// and named slots fill their parent minus padding; box, wrap, grid and scroll children depend on desired sizes
// (text and image measurement), so their rect is null.
import fs from 'node:fs';
import path from 'node:path';
import { assetPath } from './normalize.mjs';

export const DESIGN = { w: 1920, h: 1080 };
const FILL_SLOTS = new Set(['OverlaySlot', 'BorderSlot', 'SizeBoxSlot', 'WidgetSwitcherSlot', 'ScaleBoxSlot', 'ButtonSlot', 'BackgroundBlurSlot', 'NamedSlotSlot']);
const REF = /^([A-Za-z0-9_]+)'(\/[^']+)'$/;
const byCodePoint = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const round = v => Math.round(v * 1000) / 1000;

export function readWidgets(dumpDir) {
  const dir = path.join(dumpDir, 'widgets', 'CatapultHero', 'BP', 'UI');
  return fs
    .readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .sort(byCodePoint)
    .map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
}

function canvasRect(slot, p) {
  const c = slot.canvas;
  const off = slot.layout?.LayoutData?.Offsets ?? { Left: 0, Top: 0, Right: 0, Bottom: 0 };
  const axis = (i, start, size, offStart, offEnd) => {
    const a0 = c.anchor_min[i];
    const a1 = c.anchor_max[i];
    if (a0 === a1) {
      const s = c.size[i];
      return [start + a0 * size + c.position[i] - c.alignment[i] * s, s];
    }
    const lo = start + a0 * size + offStart;
    return [lo, start + a1 * size - offEnd - lo];
  };
  const [x, w] = axis(0, p[0], p[2], off.Left ?? 0, off.Right ?? 0);
  const [y, h] = axis(1, p[1], p[3], off.Top ?? 0, off.Bottom ?? 0);
  return [x, y, w, h];
}

function inset(p, pad) {
  if (!p) return null;
  if (!pad) return p;
  const l = pad.Left ?? 0, t = pad.Top ?? 0, r = pad.Right ?? 0, b = pad.Bottom ?? 0;
  return [p[0] + l, p[1] + t, p[2] - l - r, p[3] - t - b];
}

function text(v) {
  if (!v || typeof v !== 'object') return undefined;
  if ('invariant' in v) return { zh: v.invariant ?? '', en: v.invariant ?? '' };
  if (typeof v.text === 'string') return { zh: v.text, en: v.en ?? v.text };
  return undefined;
}

function brush(b) {
  if (!b || typeof b !== 'object') return undefined;
  const out = {};
  if (b.ImageSize) out.size = [b.ImageSize.X, b.ImageSize.Y];
  if (typeof b.ResourceObject === 'string' && REF.test(b.ResourceObject)) out.resource = assetPath(b.ResourceObject);
  return Object.keys(out).length ? out : undefined;
}

/** widget name -> { asset, parent, nodes: [...] } */
export function buildWidgets(widgets) {
  const out = {};
  for (const w of widgets) {
    if (!w.root) continue;
    const nodes = [];
    const visit = (n, parent, parentRect, depth) => {
      const slot = n.slot;
      let rect;
      if (!parent) rect = [0, 0, DESIGN.w, DESIGN.h];
      else if (!parentRect || !slot) rect = null;
      else if (slot.type === 'CanvasPanelSlot') rect = canvasRect(slot, parentRect);
      else if (FILL_SLOTS.has(slot.type)) rect = inset(parentRect, slot.layout?.Padding);
      else rect = null;
      const p = n.properties ?? {};
      const own = n.class === 'Border' ? inset(rect, p.Padding) : rect;
      const node = {
        name: n.name,
        class: n.class,
        parent: parent?.name ?? null,
        depth,
        slot: slot?.type ?? null,
        rect: rect && rect.map(round),
        px: rect && rect.map(v => round(v / 2)),
        ...(slot?.canvas ? { canvas: { anchorMin: slot.canvas.anchor_min, anchorMax: slot.canvas.anchor_max, alignment: slot.canvas.alignment, position: slot.canvas.position, size: slot.canvas.size, autoSize: slot.canvas.auto_size, z: slot.canvas.z_order } } : {}),
        ...(slot?.layout?.Padding ? { padding: slot.layout.Padding } : {}),
        ...(p.Visibility ? { visibility: p.Visibility.replace('ESlateVisibility::', '') } : {}),
        ...(p.WidthOverride !== undefined && p.bOverride_WidthOverride ? { width: p.WidthOverride } : {}),
        ...(p.HeightOverride !== undefined && p.bOverride_HeightOverride ? { height: p.HeightOverride } : {}),
        ...(text(p.Text) ? { text: text(p.Text) } : {}),
        ...(brush(p.Brush) ? { brush: brush(p.Brush) } : {}),
        ...(n.user_widget ? { widget: n.class.replace(/_C$/, '') } : {}),
      };
      nodes.push(node);
      for (const c of n.children ?? []) if (c) visit(c, n, own, depth + 1);
    };
    visit(w.root, null, null, 0);
    const name = w.asset.slice(w.asset.lastIndexOf('/') + 1);
    out[name] = { asset: w.asset.replace(/^\/Game\//, ''), parent: w.parent ? assetPath(w.parent) : null, nodes };
  }
  return out;
}
