import type { SeatView } from "./hand.ts";

export type DealerLevel = "easy" | "sharp";

export type Decision = { action: "hit" } | { action: "freeze" } | { action: "burn"; playerId: string } | null;

/**
 * The rule-based dealer. It sees only a SeatView: its own cards, public projections and
 * the clock (MISSION.md invariant 6). A Jev-backed dealer implements the same signature.
 */
export function decide(view: SeatView, level: DealerLevel, random: () => number): Decision {
  if (!view.canAct) return null;
  const { total } = view;
  const nearClose = view.timeLeft < 0.06;
  if (level === "easy") {
    if (total < 15 && random() < 0.65) return { action: "hit" };
    if (total >= 18 && total <= 21 && (nearClose || random() < 0.25)) return { action: "freeze" };
    return null;
  }
  // Sharp: expect each card to keep scoring at its projected rate for the time left.
  const drift = view.cards.reduce((sum, c) => sum + view.liveWeight * c.projection * view.timeLeft, 0);
  const nextCard = view.deckAverage.face + view.liveWeight * view.deckAverage.projection * view.timeLeft;
  if (total > 21 && !view.burned && view.cards.length > 0) {
    const worst = view.cards.reduce((a, b) => (a.value >= b.value ? a : b));
    return { action: "burn", playerId: worst.playerId };
  }
  if (total + drift + nextCard <= 20.5) return { action: "hit" };
  if (total >= 17 && total <= 21 && (total + drift > 20.5 || nearClose)) return { action: "freeze" };
  return null;
}
