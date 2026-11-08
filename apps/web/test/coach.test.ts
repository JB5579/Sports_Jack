import { describe, expect, it } from "vitest";
import { advance, coachText, following } from "../src/coach.ts";

const hand = (over: Partial<{ cards: { points: number }[]; burned: boolean; frozen: boolean; canAct: boolean }> = {}) =>
  ({ cards: [{ points: 0 }, { points: 0 }], burned: false, frozen: false, canAct: true, ...over });

describe("practice-hand coach", () => {
  it("moves on when the player does each thing", () => {
    expect(advance("live", hand({ cards: [{ points: 1.5 }, { points: 0 }] }), 2)).toBe("hit");
    expect(advance("hit", hand({ cards: [{ points: 0 }, { points: 0 }, { points: 0 }] }), 2)).toBe("burn");
    expect(advance("burn", hand({ burned: true }), 2)).toBe("freeze");
    expect(advance("freeze", hand({ frozen: true, canAct: false }), 2)).toBe("whistle");
  });

  it("waits on a step until it happens, and Next or Skip moves on", () => {
    expect(advance("hit", hand(), 2)).toBe("hit");
    expect(following("hit")).toBe("burn");
    expect(following("whistle")).toBe("done");
    expect(following("done")).toBe("done");
  });

  it("speaks the sport being played", () => {
    expect(coachText("cards", "nfl", "half").body).toContain("plus half of the fantasy points");
    expect(coachText("cards", "nba", "a fifth").body).toContain("plus a fifth of the fantasy points");
    expect(coachText("whistle", "nfl", "half").body).toContain("a sack or a fumble");
    expect(coachText("whistle", "nba", "a fifth").body).toContain("a turnover");
    expect(coachText("hit", "nba", "a fifth").title).toBe("Tap Hit to draw a player");
  });

  it("jumps to the whistle once moves are locked", () => {
    expect(advance("burn", hand({ canAct: false }), 2)).toBe("whistle");
  });
});
