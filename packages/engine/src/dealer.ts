import type { SeatView } from "./hand.ts";

export type DealerLevel = "easy" | "sharp";

export type Decision = { action: "hit" } | { action: "freeze" } | { action: "burn"; playerId: string } | null;

/** How often, in seconds of game clock, the dealer looks at its hand. */
export const DEALER_CHECK_SECONDS = 15;

/**
 * The house dealer's published rule (MISSION.md Q6, PRD D6). No randomness: the same
 * hand at the same moment always gets the same move, and players can read it.
 */
export const DEALER_RULES: Record<DealerLevel, { hitBelow: number; freezeFrom: number; freezeWithin: number }> = {
  easy: { hitBelow: 15, freezeFrom: 17, freezeWithin: 180 },
  sharp: { hitBelow: 16, freezeFrom: 17, freezeWithin: 120 },
};

/**
 * When the dealer starts freezing: its own window, or its last look before the table's
 * lockout if the lockout comes first. The dealer is bound by the lockout like everyone.
 */
export function freezeWindow(level: DealerLevel, lockout: number): number {
  const { freezeWithin } = DEALER_RULES[level];
  return lockout > 0 ? Math.max(freezeWithin, lockout + DEALER_CHECK_SECONDS) : freezeWithin;
}

/** The rule in one sentence, for the table and rules screens. */
export function dealerRuleText(level: DealerLevel, lockout: number): string {
  const { hitBelow, freezeFrom } = DEALER_RULES[level];
  const window = freezeWindow(level, lockout);
  const clock = `${Math.floor(window / 60)}:${String(window % 60).padStart(2, "0")}`;
  return `Hits under ${hitBelow}. Freezes at ${freezeFrom}–21 with ${clock} or less left. Otherwise rides. Looks every ${DEALER_CHECK_SECONDS} seconds of game clock.`;
}

/**
 * The dealer's move. It sees only a SeatView: its own cards and the clock (MISSION.md
 * invariant 6). A Jev-backed dealer would implement the same signature.
 */
export function decide(view: SeatView, level: DealerLevel): Decision {
  if (!view.canAct) return null;
  const rule = DEALER_RULES[level];
  if (view.total < rule.hitBelow) return { action: "hit" };
  if (view.total >= rule.freezeFrom && view.total <= 21 && view.clock <= freezeWindow(level, view.lockout)) return { action: "freeze" };
  return null;
}
