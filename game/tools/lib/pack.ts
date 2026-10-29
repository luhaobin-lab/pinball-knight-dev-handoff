import type { Rect } from './image.ts';

/**
 * Pure helpers of the review pack (tools/review.mjs): times, the deterministic clip schedule, the
 * clip crop and numeric frame order.
 */

/** Rate of the debug router's fixed step (src/debug/router.ts: STEP = 1 / 60). */
export const STEP_HZ = 60;

/** "1,1.38,2.5" → seconds (each a finite number >= 0). */
export function parseTimes(text: string): number[] {
  const times = text.split(',').map(s => s.trim()).filter(Boolean).map(Number);
  if (!times.length || times.some(t => !Number.isFinite(t) || t < 0)) throw new Error(`times are comma-separated seconds >= 0, got "${text}"`);
  return times;
}

/**
 * Router steps to advance before each frame of a clip of `seconds` at `fps` that starts at `from`
 * (the first entry is 0: the page opens at ?t=from). Times are rounded to whole steps cumulatively,
 * so the clip never drifts; fps that do not divide 60 get uneven steps.
 */
export function clipSteps(from: number, seconds: number, fps: number): number[] {
  const frames = Math.max(1, Math.round(seconds * fps));
  const at = (i: number): number => Math.round((from + i / fps) * STEP_HZ);
  return Array.from({ length: frames }, (_, i) => (i === 0 ? 0 : at(i) - at(i - 1)));
}

/**
 * The clip's crop (default: the whole viewport) snapped to the internal pixel grid: the origin down to
 * a multiple of `block`, the size to whole blocks and even (H.264 4:2:0), so the video's chroma
 * blocks and the GIF's nearest-neighbour samples line up with whole internal pixels.
 */
export function clipCrop(crop: Rect | null, width: number, height: number, block: number): Rect {
  const axis = (a0: number, a1: number, limit: number): [number, number] => {
    const start = Math.floor(a0 / block) * block;
    let size = Math.floor((Math.min(a1, limit) - start) / block) * block;
    while (size % 2 && size > 0) size -= block;
    if (size <= 0) throw new Error(`the crop is smaller than two internal pixels (block ${block})`);
    return [start, start + size];
  };
  const [x0, x1] = axis(crop?.x0 ?? 0, crop?.x1 ?? width, width);
  const [y0, y1] = axis(crop?.y0 ?? 0, crop?.y1 ?? height, height);
  return { x0, y0, x1, y1 };
}

/** Sorts frame file names by the last number in each name: play-2 < play-10 < play-100. */
export function sortFrames(names: readonly string[]): string[] {
  const number = (name: string): number => Number(name.match(/(\d+)(?!.*\d)/)?.[1] ?? -1);
  return [...names].sort((a, b) => number(a) - number(b) || a.localeCompare(b));
}
