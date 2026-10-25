import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";

export const FIXTURES = fileURLToPath(new URL("../../../fixtures/nflverse/", import.meta.url));
export const GAMES = ["2025_22_SEA_NE", "2025_21_LA_SEA", "2026_07_NE_CHI"] as const;

export const gamePath = (gameId: string) => `${FIXTURES}games/${gameId}.csv`;

/** nflverse's own per-player box score for the game, aggregated independently of our parser. */
export function boxscore(gameId: string): Record<string, string>[] {
  return parse(readFileSync(`${FIXTURES}boxscores/${gameId}.csv`, "utf8"), { columns: true }) as Record<string, string>[];
}
