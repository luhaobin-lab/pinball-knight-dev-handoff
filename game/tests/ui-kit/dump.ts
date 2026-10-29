import { existsSync, readFileSync } from 'node:fs';

/** Read-only access to the Demo widget dump for the layout tests. */
export const WIDGET_DIR = 'D:/TAPTAPGAME_codex/reference/dump/widgets/CatapultHero/BP/UI/';
export const STRINGS = 'D:/TAPTAPGAME_codex/reference/text/strings.json';
export const HAVE_DUMP = existsSync(WIDGET_DIR);

interface Node {
  name: string;
  class: string;
  properties: Record<string, unknown>;
  slot?: { layout?: Record<string, unknown> };
  children?: Node[];
}

export function widget(name: string): { root: Node; cdo: Record<string, unknown> } {
  const j = JSON.parse(readFileSync(`${WIDGET_DIR}${name}.json`, 'utf8')) as { root: Node; cdo_properties: Record<string, unknown> };
  return { root: j.root, cdo: j.cdo_properties };
}

export function node(widgetName: string, nodeName: string): Node {
  const find = (n: Node): Node | null => {
    if (n.name === nodeName) return n;
    for (const c of n.children ?? []) {
      const f = find(c);
      if (f) return f;
    }
    return null;
  };
  const n = find(widget(widgetName).root);
  if (!n) throw new Error(`${widgetName} has no node ${nodeName}`);
  return n;
}

type V2 = { X: number; Y: number };
type M = { Left: number; Top: number; Right: number; Bottom: number };

/** A canvas slot's LayoutData as the kit's CanvasLayout. */
export function canvasLayout(widgetName: string, nodeName: string): { offsets: number[]; min: number[]; max: number[]; align: number[] } {
  const ld = node(widgetName, nodeName).slot?.layout?.LayoutData as { Offsets: M; Anchors: { Minimum: V2; Maximum: V2 }; Alignment: V2 };
  return {
    offsets: [ld.Offsets.Left, ld.Offsets.Top, ld.Offsets.Right, ld.Offsets.Bottom],
    min: [ld.Anchors.Minimum.X, ld.Anchors.Minimum.Y],
    max: [ld.Anchors.Maximum.X, ld.Anchors.Maximum.Y],
    align: [ld.Alignment.X, ld.Alignment.Y],
  };
}

export function padding(widgetName: string, nodeName: string): number[] {
  const p = node(widgetName, nodeName).slot?.layout?.Padding as M;
  return [p.Left, p.Top, p.Right, p.Bottom];
}

export function prop<T>(widgetName: string, nodeName: string, key: string): T {
  return node(widgetName, nodeName).properties[key] as T;
}

/** A `var name: Type = value` default of a widget blueprint's pseudo-code. */
export function pseudoVar(widgetName: string, varName: string): string {
  const src = readFileSync(`D:/TAPTAPGAME_codex/reference/dump/blueprints-pseudo/CatapultHero/BP/UI/${widgetName}.txt`, 'utf8');
  const m = new RegExp(`var ${varName}: [^=]+= (.+)`).exec(src);
  if (!m) throw new Error(`${widgetName} has no var ${varName}`);
  return m[1].trim();
}
