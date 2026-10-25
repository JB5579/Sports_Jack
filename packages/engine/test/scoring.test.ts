import { describe, expect, it } from "vitest";
import { loadNflverseGame } from "@sportsjack/feed";
import { QuarterScorer, SPORTSJACK_V0, STANDARD_PPR } from "../src/index.ts";
import { boxscore, GAMES, gamePath } from "../../feed/test/fixtures.ts";

describe("fantasy scoring on real games", () => {
  for (const gameId of GAMES) {
    it(`standard PPR summed over quarters equals nflverse fantasy_points_ppr in ${gameId}`, () => {
      const scorer = new QuarterScorer(STANDARD_PPR);
      for (const event of loadNflverseGame(gamePath(gameId)).events) scorer.apply(event);
      for (const row of boxscore(gameId)) {
        const game = [1, 2, 3, 4, 5].reduce((sum, q) => sum + scorer.points(q, row.player_id!), 0);
        expect({ player: row.player_display_name, points: Math.round(game * 100) / 100 }).toEqual({
          player: row.player_display_name,
          points: Number(row.fantasy_points_ppr),
        });
      }
    });
  }

  it("keeps quarters separate: card values reset each hand", () => {
    const scorer = new QuarterScorer(SPORTSJACK_V0);
    const { events } = loadNflverseGame(gamePath("2025_22_SEA_NE"));
    const q4td = events.find((e) => e.kind === "play" && e.description.includes("88-A.Barner for 16 yards, TOUCHDOWN"))!;
    for (const event of events.slice(0, q4td.seq)) scorer.apply(event);
    const before = scorer.points(4, "00-0039793");
    scorer.apply(q4td);
    expect(scorer.points(4, "00-0039793") - before).toBeCloseTo(1 + 1.6 + 6);
    expect(scorer.quarter(1).size).toBeGreaterThan(0);
  });

  it("applies the sack penalty only in the SportsJack ruleset", () => {
    const { events } = loadNflverseGame(gamePath("2025_22_SEA_NE"));
    const sack = events.find((e) => e.kind === "play" && e.description.includes("D.Maye sacked at NE 37"))!;
    const v0 = new QuarterScorer(SPORTSJACK_V0);
    const ppr = new QuarterScorer(STANDARD_PPR);
    v0.apply(sack);
    ppr.apply(sack);
    expect(v0.points(3, "00-0039851")).toBe(-3); // −1 sack, −2 fumble lost
    expect(ppr.points(3, "00-0039851")).toBe(-2);
  });
});
