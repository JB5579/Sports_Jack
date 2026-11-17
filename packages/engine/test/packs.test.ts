import { describe, expect, it } from "vitest";
import { PACKS, packFor, packValue, seededRandom, tierFor, TIERS } from "../src/index.ts";

describe("hit for a pack (variation C)", () => {
  it("earns a better pack the closer a run stops to 21, and nothing outside 16–21", () => {
    expect(packFor(15.9)).toBeNull();
    expect(packFor(16)!.id).toBe("bronze");
    expect(packFor(17.95)!.id).toBe("bronze");
    expect(packFor(18)!.id).toBe("silver");
    expect(packFor(20)!.id).toBe("gold");
    expect(packFor(21)!.id).toBe("gold");
    expect(packFor(21.05)).toBeNull();
  });

  it("has odds that sum to 1 and get better with each pack", () => {
    for (const p of PACKS) expect(p.odds.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    expect(packValue("bronze")).toBeCloseTo(7.62, 2);
    expect(packValue("silver")).toBeCloseTo(16.41, 2);
    expect(packValue("gold")).toBeCloseTo(34.95, 2);
  });

  it("draws tiers at the published odds", () => {
    const rand = seededRandom(7);
    const counts = new Map<string, number>();
    for (let i = 0; i < 200_000; i++) { const t = tierFor("silver", rand()).id; counts.set(t, (counts.get(t) ?? 0) + 1); }
    expect(counts.get("common")! / 200_000).toBeCloseTo(0.62, 2);
    expect(counts.get("uncommon")! / 200_000).toBeCloseTo(0.3, 2);
    expect(TIERS.map((t) => t.chips)).toEqual([1, 5, 20, 50, 100, 1000]);
  });
});
