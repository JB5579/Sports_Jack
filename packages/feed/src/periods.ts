import type { GameInfo } from "./types.ts";

/**
 * Seconds on the clock when a period starts. NFL: 15-minute quarters, 10-minute
 * regular-season overtime, 15-minute playoff overtime. NBA: 12-minute quarters and
 * 5-minute overtimes.
 */
export function periodStart(game: GameInfo, qtr: number): number {
  if (game.sport === "nba") return qtr <= 4 ? 720 : 300;
  return qtr <= 4 || game.playoffs ? 900 : 600;
}
