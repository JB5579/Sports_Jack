import { describe, expect, it } from "vitest";
import { bucket, parseVariants, switchDef, tableValue } from "../src/variants.ts";
import { Store } from "../src/store.ts";

const variation = switchDef("variation")!;
const ids = Array.from({ length: 2000 }, (_, i) => `acct-${i}`);

describe("variant switches", () => {
  it("reads the owner's weights and refuses typos", () => {
    expect(parseVariants("variation=A:50,B:50; free_contest_deal=own")).toEqual({ variation: { A: 50, B: 50 }, free_contest_deal: { own: 1 } });
    expect(parseVariants("")).toEqual({});
    expect(() => parseVariants("variaton=A")).toThrow(/unknown switch/);
    expect(() => parseVariants("variation=D:10")).toThrow(/bad value/);
    expect(() => parseVariants("variation=A:0")).toThrow(/above 0/);
  });

  it("gives everyone the default when no weights are set", () => {
    expect(new Set(ids.map((id) => bucket(id, variation, {})))).toEqual(new Set(["A"]));
    expect(tableValue("free_contest_deal", {})).toBe("shared");
    expect(tableValue("free_contest_deal", parseVariants("free_contest_deal=own"))).toBe("own");
  });

  it("splits players by the weights, the same way every time", () => {
    const weights = parseVariants("variation=A:50,B:25,C:25");
    const counts = { A: 0, B: 0, C: 0 } as Record<string, number>;
    for (const id of ids) counts[bucket(id, variation, weights)]!++;
    expect(counts.A! / ids.length).toBeCloseTo(0.5, 1);
    expect(counts.B! / ids.length).toBeCloseTo(0.25, 1);
    expect(ids.slice(0, 50).map((id) => bucket(id, variation, weights))).toEqual(ids.slice(0, 50).map((id) => bucket(id, variation, weights)));
    expect(new Set(ids.map((id) => bucket(id, variation, parseVariants("variation=B"))))).toEqual(new Set(["B"]));
  });

  it("keeps a player's assignment when the weights change, and lets the owner move one player", () => {
    const store = new Store(":memory:", parseVariants("variation=B"));
    const { id } = store.account("device-token-cccccccccccc");
    expect(store.variants(id)).toEqual({ variation: "B", rewards: "on" });
    store.close();
    const later = new Store(":memory:", parseVariants("variation=C"));
    const { id: same } = later.account("device-token-cccccccccccc");
    expect(later.variants(same)).toEqual({ variation: "C", rewards: "on" }); // a fresh database is a fresh assignment
    later.setVariant(same, "variation", "A");
    expect(later.variants(same)).toEqual({ variation: "A", rewards: "on" });
    expect(() => later.setVariant(same, "variation", "Z")).toThrow(/no value/);
    expect(() => later.setVariant(same, "free_contest_deal", "own")).toThrow(/unknown player switch/);
    expect(later.variantCounts()).toEqual({ variation: { A: 1, B: 0, C: 0 }, rewards: { on: 1, off: 0 } });
  });

  it("records a player's switches on every usage event", () => {
    const store = new Store(":memory:", parseVariants("variation=C"));
    const { id } = store.account("device-token-dddddddddddd");
    store.addEvents(id, [{ name: "open_app", props: { screen: "lobby" } }]);
    const [row] = store.eventRows();
    expect(JSON.parse(String(row!.props))).toEqual({ screen: "lobby", variants: { variation: "C", rewards: "on" } });
  });
});
