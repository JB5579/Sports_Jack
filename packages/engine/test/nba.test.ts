import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadNbaGame, loadNbaRoster, loadProjections, periodStart } from "@sportsjack/feed";
import { buildDeck, Hand, NBA_ALPHA_RULES } from "../src/index.ts";

const NBA = fileURLToPath(new URL("../../../fixtures/nba/", import.meta.url));
const WEMBY = "5104157";

function nbaHand(gameId: string, qtr: number, seed = 5) {
  const recorded = loadNbaGame(`${NBA}games/${gameId}.csv`);
  const deck = buildDeck(loadNbaRoster(`${NBA}rosters/${gameId}.csv`), loadProjections(`${NBA}projections/${gameId}.csv`), NBA_ALPHA_RULES);
  const hand = new Hand({ gameId, qtr, periodStart: periodStart(recorded.game, qtr), lockout: 0, ante: 25, mode: "dealer",
    deck, seats: ["you", "dealer"], dealerSeat: "dealer", seed, rules: NBA_ALPHA_RULES });
  return { hand, events: recorded.events, deck };
}

describe("NBA hands on real games", () => {
  it("deals from the dressed roster with NBA face values", () => {
    const { hand, deck } = nbaHand("401859967", 1);
    expect(deck.length).toBe(30);
    expect(deck.find((c) => c.playerId === WEMBY)!.face).toBe(5); // 2 + 0.25 × 12.68, rounded
    expect(Math.max(...deck.map((c) => c.face))).toBeLessThanOrEqual(10);
    expect(hand.cards("you")).toHaveLength(2);
  });

  it("moves Wembanyama's card by a fifth of his nba-v1 points through the Finals' first quarter", () => {
    const { hand, events } = nbaHand("401859967", 1);
    for (const e of events) hand.apply(e);
    expect(hand.over).toBe(true);
    expect(hand.points(WEMBY)).toBeGreaterThan(0);
    expect(hand.value(WEMBY)).toBeCloseTo(5 + 0.2 * hand.points(WEMBY), 6);
  });

  it("plays each overtime of the double-overtime game as its own five-minute bonus hand", () => {
    for (const qtr of [5, 6]) {
      const { hand, events } = nbaHand("401873197", qtr);
      expect(hand.clock).toBe(300);
      for (const e of events) hand.apply(e);
      expect(hand.over).toBe(true);
      expect(hand.clock).toBe(0);
      expect(hand.log.length).toBeGreaterThan(5);
    }
  });

  it("never deals the same player twice in an opening hand, across many seeds", () => {
    for (let seed = 1; seed <= 300; seed++) {
      const { hand } = nbaHand("401859967", 1, seed);
      for (const seat of ["you", "dealer"]) expect(new Set(hand.cards(seat)).size, `seed ${seed}`).toBe(2);
    }
  });
});
