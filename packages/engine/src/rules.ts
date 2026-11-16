import type { Sport } from "@sportsjack/feed";
import { NBA_V1, NBA_V2, SPORTSJACK_V1, type ScoringRules } from "./scoring.ts";

/** Everything a hand's outcome depends on, shown to players on the rules screen. */
export interface GameRules {
  id: string;
  scoring: ScoringRules;
  /** A card's live quarter points count at this weight on top of its face value (MISSION.md Q1). */
  liveWeight: number;
  faceMin: number;
  faceMax: number;
  /** Face value added per projected point per quarter. */
  facePerProjectedPoint: number;
  /** Share of a player-table pot the house keeps. */
  rake: number;
  /**
   * Safer cards (variation B, docs/analysis/safer-cards.md): a safer card's live points count
   * at `liveFactor` of the live weight, and each safer card in a winning hand cuts the
   * winnings by `cutPerCard`. Absent: no safer cards.
   */
  safer?: { liveFactor: number; cutPerCard: number };
}

/** Set by the 2025 NFL and 2025-26 NBA simulations: half the movement, 10% of the winnings per card. */
export const SAFER_CARDS = { liveFactor: 0.5, cutPerCard: 0.1 } as const;

/** The NFL rules before safer cards. Kept so hands played under them replay as scored (MISSION.md invariant 4). */
export const ALPHA_RULES_1: GameRules = {
  id: "alpha-1",
  scoring: SPORTSJACK_V1,
  liveWeight: 0.5,
  faceMin: 2,
  faceMax: 10,
  facePerProjectedPoint: 2,
  rake: 0.1,
};

/** The current NFL rules: alpha-1 plus safer cards. */
export const ALPHA_RULES: GameRules = { ...ALPHA_RULES_1, id: "alpha-2", safer: SAFER_CARDS };

/**
 * NBA: basketball scores constantly, so faces scale less and live points weigh less
 * (docs/analysis/NBA-tuning.md). `alpha-nba-1` scored under nba-v1; kept so hands played
 * under it can still be replayed and audited (MISSION.md invariant 4).
 */
export const NBA_ALPHA_RULES_1: GameRules = {
  id: "alpha-nba-1",
  scoring: NBA_V1,
  liveWeight: 0.2,
  faceMin: 2,
  faceMax: 10,
  facePerProjectedPoint: 0.25,
  rake: 0.1,
};

/** nba-v2 scoring (turnover −1.5), same face scale and live weight, retuned 2026-11-16. Kept, like alpha-nba-1. */
export const NBA_ALPHA_RULES_2: GameRules = {
  id: "alpha-nba-2",
  scoring: NBA_V2,
  liveWeight: 0.2,
  faceMin: 2,
  faceMax: 10,
  facePerProjectedPoint: 0.25,
  rake: 0.1,
};

/** The current NBA rules: alpha-nba-2 plus safer cards. */
export const NBA_ALPHA_RULES: GameRules = { ...NBA_ALPHA_RULES_2, id: "alpha-nba-3", safer: SAFER_CARDS };

export const rulesFor = (sport: Sport): GameRules => (sport === "nba" ? NBA_ALPHA_RULES : ALPHA_RULES);

/** Face value at the deal: faceMin + scale × projected quarter points, capped (NFL: 2 + 2 × points, 2–10). */
export function faceValue(projectedQuarterPoints: number, rules: GameRules = ALPHA_RULES): number {
  const face = rules.faceMin + Math.round(rules.facePerProjectedPoint * projectedQuarterPoints);
  return Math.min(rules.faceMax, Math.max(rules.faceMin, face));
}

/** Card values move in steps of 0.005; keep totals exact enough to compare. */
export function roundValue(value: number): number {
  return Math.round(value * 1000) / 1000;
}
