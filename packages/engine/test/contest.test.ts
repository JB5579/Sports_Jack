import { describe, expect, it } from "vitest";
import { contestProblem, entryAmount, poolPayouts, type ContestRules } from "../src/index.ts";

const pool: ContestRules = {
  name: "Free quarter contest", entry: { kind: "free" }, deal: "shared", seats: null, fillWithBots: 0,
  prize: { kind: "pool", amounts: [500, 250, 100], sponsor: "sponsor:sportsjack", sponsorName: "SportsJack" },
};
const f = (seatId: string, total: number) => ({ seatId, total });

describe("pool prizes", () => {
  it("pays places in order, closest to 21 first", () => {
    const p = poolPayouts([f("a", 18), f("b", 21), f("c", 20), f("d", 12)], [500, 250, 100]);
    expect(Object.fromEntries(p)).toEqual({ b: 500, c: 250, a: 100, d: 0 });
  });

  it("never pays a bust, even when places go unclaimed", () => {
    const p = poolPayouts([f("a", 22), f("b", 19), f("c", 30)], [500, 250, 100]);
    expect(Object.fromEntries(p)).toEqual({ a: 0, b: 500, c: 0 });
  });

  it("splits the places a tie covers, rounding down", () => {
    const p = poolPayouts([f("a", 20), f("b", 20), f("c", 20), f("d", 19)], [500, 250, 100]);
    expect(Object.fromEntries(p)).toEqual({ a: 283, b: 283, c: 283, d: 0 });
    const q = poolPayouts([f("a", 21), f("b", 20), f("c", 20)], [500, 250, 100]);
    expect(Object.fromEntries(q)).toEqual({ a: 500, b: 175, c: 175 });
  });

  it("pays a lone player first place", () => {
    expect(Object.fromEntries(poolPayouts([f("a", 9)], [500, 250]))).toEqual({ a: 500 });
  });
});

describe("contest settings", () => {
  it("accepts the four kinds of contest the app runs", () => {
    expect(contestProblem(pool)).toBeNull();
    expect(contestProblem({ ...pool, name: "Dealer", entry: { kind: "chips", amount: 25 }, prize: { kind: "table" }, deal: "own" })).toBeNull();
    expect(contestProblem({ ...pool, name: "Players", entry: { kind: "chips", amount: 25 }, prize: { kind: "table" }, deal: "own", seats: 4, fillWithBots: 4 })).toBeNull();
    expect(contestProblem({ ...pool, name: "Practice", prize: { kind: "none" }, deal: "own" })).toBeNull();
  });

  it("refuses settings that mix models or make no sense", () => {
    expect(contestProblem({ ...pool, entry: { kind: "chips", amount: 25 } })).toMatch(/free to enter/);
    expect(contestProblem({ ...pool, prize: { kind: "table" } })).toMatch(/cannot be free/);
    expect(contestProblem({ ...pool, entry: { kind: "chips", amount: 2.5 }, prize: { kind: "table" } })).toMatch(/whole number/);
    expect(contestProblem({ ...pool, prize: { ...pool.prize, amounts: [] } as ContestRules["prize"] })).toMatch(/at least one/);
    expect(contestProblem({ ...pool, prize: { kind: "pool", amounts: [10], sponsor: "house:table", sponsorName: "x" } })).toMatch(/sponsor:/);
    expect(contestProblem({ ...pool, seats: 0 })).toMatch(/seats/);
  });

  it("reads the entry cost", () => {
    expect(entryAmount(pool)).toBe(0);
    expect(entryAmount({ ...pool, entry: { kind: "chips", amount: 100 } })).toBe(100);
  });
});
