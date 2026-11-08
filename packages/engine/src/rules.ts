import type { Sport } from "@sportsjack/feed";
import { NBA_V1, SPORTSJACK_V1, type ScoringRules } from "./scoring.ts";

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
}

export const ALPHA_RULES: GameRules = {
  id: "alpha-1",
  scoring: SPORTSJACK_V1,
  liveWeight: 0.5,
  faceMin: 2,
  faceMax: 10,
  facePerProjectedPoint: 2,
  rake: 0.1,
};

/** NBA: basketball scores constantly, so faces scale less and live points weigh less (docs/analysis/NBA-tuning.md). */
export const NBA_ALPHA_RULES: GameRules = {
  id: "alpha-nba-1",
  scoring: NBA_V1,
  liveWeight: 0.2,
  faceMin: 2,
  faceMax: 10,
  facePerProjectedPoint: 0.25,
  rake: 0.1,
};

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
