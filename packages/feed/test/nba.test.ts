import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse/sync";
import { describe, expect, it } from "vitest";
import { loadNbaGame, loadNbaRoster, periodStart, type StatDelta } from "../src/index.ts";

const NBA = fileURLToPath(new URL("../../../fixtures/nba/", import.meta.url));
export const NBA_GAMES = ["401859967", "401873197", "401909294"] as const;
const box = (gameId: string) => parse(readFileSync(`${NBA}boxscores/${gameId}.csv`, "utf8"), { columns: true }) as Record<string, string>[];

function totals(gameId: string) {
  const out = new Map<string, Required<Pick<StatDelta, "pts" | "fg3m" | "reb" | "ast" | "stl" | "blk" | "tov">>>();
  for (const e of loadNbaGame(`${NBA}games/${gameId}.csv`).events) {
    if (e.kind !== "play") continue;
    for (const d of e.deltas) {
      const t = out.get(d.playerId) ?? { pts: 0, fg3m: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0 };
      for (const k of Object.keys(t) as (keyof typeof t)[]) t[k] += d.stats[k] ?? 0;
      out.set(d.playerId, t);
    }
  }
  return out;
}

describe("NBA replay source on real games", () => {
  it("reads the 2026 Finals game in order with four quarters and the real final score", () => {
    const { game, events } = loadNbaGame(`${NBA}games/401859967.csv`);
    expect(game).toMatchObject({ sport: "nba", home: "SA", away: "NY", playoffs: true, date: "2026-06-13" });
    expect(events.filter((e) => e.kind === "quarter_end").map((e) => e.clock.qtr)).toEqual([1, 2, 3, 4]);
    // ESPN logged two corrections after the final whistle; the game_end event carries the final score.
    expect(events.find((e) => e.kind === "game_end")).toMatchObject({ score: { home: 90, away: 94 } });
    expect(events.find((e) => e.kind === "play")!.clock.quarterSecondsRemaining).toBe(720);
  });

  it("plays both overtimes of the double-overtime game as their own five-minute periods", () => {
    const { game, events } = loadNbaGame(`${NBA}games/401873197.csv`);
    expect(events.filter((e) => e.kind === "quarter_end").map((e) => e.clock.qtr)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(periodStart(game, 4)).toBe(720);
    expect(periodStart(game, 6)).toBe(300);
    const ot = events.filter((e) => e.kind === "play" && e.clock.qtr === 6);
    expect(Math.max(...ot.map((e) => e.clock.quarterSecondsRemaining))).toBeLessThanOrEqual(300);
    expect(events.at(-1)!.score).toEqual({ home: 115, away: 122 });
  });

  for (const gameId of NBA_GAMES) {
    it(`matches ESPN's box score for every player in ${gameId}`, () => {
      const ours = totals(gameId);
      const rows = box(gameId).filter((r) => r.did_not_play !== "True");
      expect(rows.length).toBeGreaterThan(15);
      for (const r of rows) {
        const t = ours.get(r.athlete_id!) ?? { pts: 0, fg3m: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0 };
        expect({ player: r.athlete_display_name, ...t }).toEqual({
          player: r.athlete_display_name, pts: Number(r.points), fg3m: Number(r.three_point_field_goals_made),
          reb: Number(r.rebounds), ast: Number(r.assists), stl: Number(r.steals), blk: Number(r.blocks), tov: Number(r.turnovers),
        });
      }
    });

    it(`deals every player who records a stat in ${gameId} from its dressed roster`, () => {
      const deck = new Set(loadNbaRoster(`${NBA}rosters/${gameId}.csv`).map((p) => p.playerId));
      expect(deck.size).toBeGreaterThan(20);
      expect([...totals(gameId).keys()].filter((p) => !deck.has(p))).toEqual([]);
    });
  }
});
