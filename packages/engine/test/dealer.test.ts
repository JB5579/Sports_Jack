import { describe, expect, it } from "vitest";
import { dealerRuleText, decide, freezeWindow, Hand, type SeatView } from "../src/index.ts";
import { realGame } from "./game.ts";

const view = (total: number, clock: number, over: Partial<SeatView> = {}): SeatView => ({
  cards: [], total, frozen: false, burned: false, canAct: true, timeLeft: clock / 900, clock, lockout: 0,
  deckAverage: { face: 4, projection: 1 }, liveWeight: 0.5, ...over,
});

describe("the published dealer rule", () => {
  it("hits under its number, whatever the clock", () => {
    expect(decide(view(14.9, 800), "easy")).toEqual({ action: "hit" });
    expect(decide(view(15, 800), "easy")).toBeNull();
    expect(decide(view(15.5, 30), "sharp")).toEqual({ action: "hit" });
    expect(decide(view(16, 30), "sharp")).toBeNull();
  });

  it("rides 17–21 until its freeze window, then freezes", () => {
    expect(decide(view(18, 181), "easy")).toBeNull();
    expect(decide(view(18, 180), "easy")).toEqual({ action: "freeze" });
    expect(decide(view(20, 121), "sharp")).toBeNull();
    expect(decide(view(20, 120), "sharp")).toEqual({ action: "freeze" });
  });

  it("rides a bust, since a negative play can pull it back under", () => {
    expect(decide(view(23, 60), "sharp")).toBeNull();
  });

  it("freezes before a lockout that comes earlier than its window", () => {
    expect(freezeWindow("sharp", 120)).toBe(135);
    expect(freezeWindow("easy", 120)).toBe(180);
    expect(decide(view(19, 135, { lockout: 120 }), "sharp")).toEqual({ action: "freeze" });
    expect(dealerRuleText("sharp", 120)).toBe("Hits under 16. Freezes at 17–21 with 2:15 or less left. Otherwise rides. Looks every 15 seconds of game clock.");
  });

  it("is deterministic and never acts once it can't", () => {
    expect(decide(view(12, 300), "easy")).toEqual(decide(view(12, 300), "easy"));
    expect(decide(view(12, 100, { canAct: false }), "easy")).toBeNull();
  });

  it("finishes most real quarters in 17–21 or close behind, never acting after the lockout", () => {
    const { events, deck } = realGame("2025_21_LA_SEA");
    const finals: number[] = [];
    for (let seed = 1; seed <= 15; seed++) {
      for (const qtr of [1, 2, 3, 4]) {
        const hand = new Hand({ gameId: "2025_21_LA_SEA", qtr, periodStart: 900, lockout: 60, ante: 25, mode: "dealer",
          deck, seats: ["you", "dealer"], dealerSeat: "dealer", seed: seed * 10 + qtr });
        let next = 885;
        for (const e of events) {
          while (e.clock.qtr === qtr && e.clock.quarterSecondsRemaining <= next && next > 0) {
            hand.advanceClock(next);
            const before = hand.cards("dealer").length;
            const d = decide(hand.view("dealer"), "easy");
            if (d?.action === "hit") hand.hit("dealer");
            if (d?.action === "freeze") hand.freeze("dealer");
            if (next <= 60) expect(hand.cards("dealer").length).toBe(before);
            next -= 15;
          }
          hand.apply(e);
        }
        finals.push(hand.total("dealer"));
      }
    }
    const inBand = finals.filter((t) => t >= 17 && t <= 21).length / finals.length;
    expect(inBand).toBeGreaterThan(0.3);
  });
});
