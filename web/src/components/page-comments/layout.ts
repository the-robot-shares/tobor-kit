/**
 * Rail layout for `<noizu-page-comments>` — the Google-Docs side-comment
 * algorithm, as a pure function so the collision math is unit-testable
 * without a browser.
 *
 * Given cards in document order with the `idealTop` each anchor wants and the
 * card `height`, produce the final `top` per card:
 *
 * 1. The focused card is pinned at its idealTop (clamped into the viewport
 *    band when bounds are given).
 * 2. Cards above it are pushed upward, each keeping `gap` clear of the card
 *    below it and never drifting below its own idealTop.
 * 3. Cards below are pushed downward the same way.
 *
 * No two cards ever overlap; the focused card never moves for its neighbours.
 */

export interface RailCard {
  id: string;
  /** Viewport-relative top the anchor sits at. */
  idealTop: number;
  height: number;
}

export interface RailLayoutOptions {
  /** Minimum vertical gap between cards. Default 8. */
  gap?: number;
  /** Clamp band (viewport bounds). Default unclamped. */
  minTop?: number;
  maxTop?: number;
}

/** Returns `id → final top` for every card. */
export function computeRailLayout(
  cards: RailCard[],
  focusedId: string | null,
  options: RailLayoutOptions = {},
): Map<string, number> {
  const gap = options.gap ?? 8;
  const minTop = options.minTop ?? -Infinity;
  const maxTop = options.maxTop ?? Infinity;

  const tops = new Map<string, number>();
  const focused = cards.find((card) => card.id === focusedId) ?? null;
  const others = cards.filter((card) => card.id !== focusedId);

  let focusedTop = Number.NaN;
  let focusedBottom = Number.NaN;
  if (focused) {
    focusedTop = clamp(focused.idealTop, minTop, maxTop - focused.height);
    tops.set(focused.id, focusedTop);
    focusedBottom = focusedTop + focused.height;
  }

  // Above the focused card, nearest first: each card's bottom stays `gap`
  // above the one below it, and never lower than its own idealTop.
  // Without a focused card nothing stacks upward — everything is "below".
  const focusedIdeal = focused ? focused.idealTop : 0;
  const above = focused
    ? others.filter((card) => card.idealTop <= focusedIdeal).sort((a, b) => b.idealTop - a.idealTop)
    : [];
  let nextTop = focusedTop;
  for (const card of above) {
    const ceiling = Math.min(card.idealTop, nextTop - gap - card.height);
    const top = clamp(ceiling, minTop, maxTop - card.height);
    tops.set(card.id, top);
    nextTop = top;
  }

  // Below the focused card, nearest first: each top stays `gap` under the
  // previous bottom, and never above its own idealTop. With no focus this is
  // every card, stacked downward in document order.
  const below = focused
    ? others.filter((card) => card.idealTop > focusedIdeal).sort((a, b) => a.idealTop - b.idealTop)
    : [...others].sort((a, b) => a.idealTop - b.idealTop);
  let prevBottom = focused ? focusedBottom : Number.NEGATIVE_INFINITY;
  for (const card of below) {
    const floor = Math.max(card.idealTop, prevBottom + gap);
    const top = clamp(floor, minTop, maxTop - card.height);
    tops.set(card.id, top);
    prevBottom = top + card.height;
  }

  return tops;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
