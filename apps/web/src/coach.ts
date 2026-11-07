/** The practice hand's guided tour (PRD §8.1). Steps advance when the player does the thing. */
export type CoachStep = "cards" | "live" | "hit" | "burn" | "freeze" | "whistle" | "done";

export interface CoachHand {
  cards: { points: number }[];
  burned: boolean;
  frozen: boolean;
  canAct: boolean;
}

export const COACH_TEXT: Record<Exclude<CoachStep, "done">, { title: string; body: string; action: "next" | "skip" | "got" }> = {
  cards: { title: "These are your cards", body: "Each one is a real player in this game. A card is worth its face value plus half the fantasy points he scores this quarter.", action: "next" },
  live: { title: "Values move on real plays", body: "Watch the ticker. When a play involves one of your players, his card moves and flashes.", action: "next" },
  hit: { title: "Tap Hit to draw a player", body: "Hitting is free and there's no limit, but every card adds to your total. You want to finish close to 21 without going over.", action: "skip" },
  burn: { title: "Burn swaps one card", body: "Once per hand, tap Burn and then a card to trade it for a new draw. Try it on your weakest card.", action: "skip" },
  freeze: { title: "Freeze locks your total", body: "Freeze when you like your number. Or don't, and let the hand ride live until the whistle.", action: "skip" },
  whistle: { title: "Closest to 21 wins at the whistle", body: "Busting isn't final until then: a sack or a fumble can pull you back under. Beat the dealer's total to win.", action: "got" },
};

const ORDER: CoachStep[] = ["cards", "live", "hit", "burn", "freeze", "whistle", "done"];

/** The step to show, given where the tour was and what the hand looks like now. */
export function advance(step: CoachStep, hand: CoachHand, dealtCards: number): CoachStep {
  if (step === "done") return "done";
  if (!hand.canAct && step !== "whistle") return "whistle";
  if (step === "live" && hand.cards.some((c) => c.points !== 0)) return "hit";
  if (step === "hit" && hand.cards.length > dealtCards) return "burn";
  if (step === "burn" && hand.burned) return "freeze";
  if (step === "freeze" && hand.frozen) return "whistle";
  return step;
}

/** The step after the player taps Next, Skip or Got it. */
export const following = (step: CoachStep): CoachStep => ORDER[Math.min(ORDER.indexOf(step) + 1, ORDER.length - 1)]!;
