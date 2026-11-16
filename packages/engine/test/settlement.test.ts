import { describe, expect, it } from "vitest";
import { afterSaferCut, compareFinish, settleDealer, settlePlayers } from "../src/index.ts";

describe("settlement rules (MISSION.md Q7)", () => {
  it("ranks any non-bust above any bust, closest to 21 first", () => {
    const order = [21, 20.5, 17, 3, 21.5, 24].sort(() => 0.5 - Math.random()).sort(compareFinish);
    expect(order).toEqual([21, 20.5, 17, 3, 21.5, 24]);
  });

  it("splits a tie and keeps the uneven remainder for the house", () => {
    const s = settlePlayers([{ seatId: "a", total: 20 }, { seatId: "b", total: 20 }, { seatId: "c", total: 18 }], 25, 0.1);
    expect(s.pot).toBe(75);
    expect(s.standings.filter((x) => x.rank === 1).map((x) => x.payout)).toEqual([33, 33]);
    expect(s.house).toBe(9);
  });

  it("gives the pot to the hand closest from above when everyone busts", () => {
    const s = settlePlayers([{ seatId: "a", total: 25 }, { seatId: "b", total: 22.5 }, { seatId: "c", total: 30 }], 100, 0.1);
    expect(s.standings[0]).toMatchObject({ seatId: "b", rank: 1, payout: 270, bust: true });
  });

  it("pays even money against the dealer, returns the ante on a tie, takes it on a loss", () => {
    const s = settleDealer([{ seatId: "w", total: 20 }, { seatId: "p", total: 19 }, { seatId: "l", total: 23 }],
      { seatId: "dealer", total: 19 }, 25);
    const payout = Object.fromEntries(s.standings.map((x) => [x.seatId, x.payout]));
    expect(payout).toEqual({ w: 50, p: 25, l: 0, dealer: 0 });
    expect(s.house).toBe(0);
  });

  it("cuts a winner's profit by 10% per safer card, rounded down, never below the stake", () => {
    expect(afterSaferCut(25, 50, 1, 0.1)).toBe(47); // 25 back + 22.5 → 22
    expect(afterSaferCut(100, 200, 3, 0.1)).toBe(170);
    expect(afterSaferCut(100, 200, 12, 0.1)).toBe(100);
    expect(afterSaferCut(25, 25, 2, 0.1)).toBe(25); // a push is not winnings
    const dealer = settleDealer([{ seatId: "a", total: 20, safer: 2 }, { seatId: "b", total: 20 }], { seatId: "dealer", total: 18 }, 100, 0.1);
    expect(Object.fromEntries(dealer.standings.map((x) => [x.seatId, x.payout]))).toEqual({ a: 180, b: 200, dealer: 0 });
    expect(dealer.house).toBe(-180);
    const table = settlePlayers([{ seatId: "a", total: 21, safer: 1 }, { seatId: "b", total: 19 }], 100, 0.1, 0.1);
    expect(table.standings[0]!.payout).toBe(172); // share 180: 100 back + 80 × 0.9
    expect(table.house).toBe(28);
  });
});
