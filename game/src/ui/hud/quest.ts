import type { Rect, Surface } from '../core/surface';
import type { TextFont } from '../text/font';
import { parseRich } from '../text/layout';
import { BONE, INK } from '../style/palette';
import { QUEST, SCREEN } from './layout';
import type { QuestLine } from './state';

/**
 * UI_任务列表 (bottom-left of 区域判断, padding 12/15) holding one UI_任务条目: the quest name
 * (任务名描述, 思源黑体 24 pt = a 16-px line, indented 15 units) over the objective row (the 33-unit
 * bullet image 营地格_Sprite_25 and the rich text 目标描述文本). Rows are 16 px (32 units) tall.
 */
export function drawQuest(s: Surface, font: TextFont, q: QuestLine, area: Rect): void {
  const left = area.x + Math.round(QUEST.pad[0] * SCREEN.scale);
  const bottom = area.y + area.h - Math.round(QUEST.pad[3] * SCREEN.scale);
  const row = font.line;
  const lineTop = bottom - row;
  const titleTop = lineTop - row;
  const ink = { outline: INK.deep };
  font.draw(s, q.title, left + Math.round(QUEST.titleIndent * SCREEN.scale), titleTop, { color: BONE.dim, ...ink });
  // the bullet: a 4-px bone square centred in the 33-unit image
  const bulletW = Math.round(QUEST.bullet * SCREEN.scale);
  const bx = left + Math.floor(bulletW / 2) - 2;
  const by = lineTop + Math.floor(row / 2) - 1;
  s.fill(bx - 1, by - 1, 6, 6, INK.deep);
  s.fill(bx, by, 4, 4, BONE.dim);
  // the Demo styles the whole objective alike (ss2: "Reach Floor 3/36"), so the markup is only stripped
  const text = parseRich(q.line)
    .map(r => r.text)
    .join('');
  font.draw(s, text, left + bulletW, lineTop, { color: BONE.base, ...ink });
}
