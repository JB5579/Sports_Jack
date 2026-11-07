import { describe, expect, it } from "vitest";
import { decide, Hand, seededRandom, type DealerLevel } from "../src/index.ts";
import { realGame } from "./game.ts";

/** Play every quarter of a real game with the dealer deciding every ~20 seconds of game clock. */
function season(level: DealerLevel, gameId: string, seeds: number) {
  const { events, deck } = realGame(gameId);
  const finishes: number[] = [];
  for (let seed = 1; seed <= seeds; seed++) {
    for (const qtr of [1, 2, 3, 4]) {
      const hand = new Hand({ gameId, qtr, periodStart: 900, lockout: 60, ante: 25, mode: "dealer",
        deck, seats: ["you", "dealer"], dealerSeat: "dealer", seed: seed * 10 + qtr });
      const random = seededRandom(seed);
      let next = 900;
      for (const e of events) {
        while (e.clock.qtr === qtr && e.clock.quarterSecondsRemaining <= next && next > 0) {
          hand.advanceClock(next);
          const d = decide(hand.view("dealer"), level, random);
          if (d?.action === "hit") hand.hit("dealer");
          if (d?.action === "freeze") hand.freeze("dealer");
          if (d?.action === "burn") hand.burn("dealer", d.playerId);
          next -= 20;
        }
        hand.apply(e);
      }
      finishes.push(hand.total("dealer"));
    }
  }
  return finishes;
}

describe("the rule-based AI dealer on real games", () => {
  it("never acts once actions are locked or after it freezes", () => {
    const { deck } = realGame("2025_22_SEA_NE");
    const hand = new Hand({ gameId: "2025_22_SEA_NE", qtr: 1, periodStart: 900, lockout: 120, ante: 25,
      mode: "dealer", deck, seats: ["you", "dealer"], dealerSeat: "dealer", seed: 1 });
    hand.advanceClock(100);
    expect(decide(hand.view("dealer"), "sharp", seededRandom(1))).toBeNull();
    expect(decide(hand.view("dealer"), "easy", seededRandom(1))).toBeNull();
  });

  it("plays to 17–21 more often at Sharp than at Easy", () => {
    const inBand = (xs: number[]) => xs.filter((x) => x >= 17 && x <= 21).length / xs.length;
    const sharp = season("sharp", "2025_21_LA_SEA", 15);
    const easy = season("easy", "2025_21_LA_SEA", 15);
    expect(sharp).toHaveLength(60);
    expect(inBand(sharp)).toBeGreaterThan(inBand(easy));
    expect(inBand(sharp)).toBeGreaterThan(0.4);
  });
});
