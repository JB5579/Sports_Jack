import { describe, expect, it } from "vitest";
import { compareFinish, settleDealer, settlePlayers } from "../src/index.ts";

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
});
