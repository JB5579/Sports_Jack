import { describe, expect, it } from "vitest";
import { FULL_GAME_BONUS, MILESTONES, REFERRAL_BONUS, referralCode } from "../src/perks.ts";
import { Store } from "../src/store.ts";
import { parseVariants } from "../src/variants.ts";

/** Play one settled hand at a dealer table for these accounts: each antes 25 and gets `payout`. */
function play(store: Store, ids: string[], opts: { table?: string; qtr?: number; payout?: number; n?: number } = {}) {
  const id = `${opts.table ?? "t1"}-q${opts.qtr ?? 1}-${opts.n ?? Math.random().toString(36).slice(2)}`;
  for (const a of ids) store.debit(a, 25, "ante", id);
  return store.recordHand({
    id, tableId: opts.table ?? "t1", gameId: "2025_22_SEA_NE", qtr: opts.qtr ?? 1, seed: 1, commitment: "c", ruleset: "alpha-1", settlement: {}, log: [],
    seats: ids.map((accountId) => ({ accountId, cards: [], total: 18, ante: 25, payout: opts.payout ?? 0 })),
  });
}

describe("referrals", () => {
  it("pays both players once the friend settles a first real hand, and only once", () => {
    const store = new Store(":memory:");
    const inviter = store.account("device-token-inviter-0001").id;
    const code = store.perks(inviter).referral.code;
    expect(code).toBe(referralCode(inviter));
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
    const friend = store.account("device-token-friend-00001", code.toLowerCase()).id;
    expect(store.perks(inviter).referral).toMatchObject({ joined: 1, played: 0 });
    expect(store.balance(friend)).toBe(1000);

    const first = play(store, [friend]);
    expect(first[friend]!.map((r) => r.kind)).toEqual(["referral", "milestone"]);
    expect(store.balance(friend)).toBe(1000 - 25 + REFERRAL_BONUS + MILESTONES[0]!.chips);
    expect(store.balance(inviter)).toBe(1000 + REFERRAL_BONUS);
    expect(store.perks(inviter).referral).toMatchObject({ joined: 1, played: 1 });

    play(store, [friend]);
    expect(store.balance(inviter)).toBe(1000 + REFERRAL_BONUS);
    expect(store.audit()).toMatchObject({ ok: true, totals: { chips: 0 } });
    expect(store.testSummary()).toMatchObject({ referrals: { joined: 1, played: 1 }, promotionsPaid: 2 * REFERRAL_BONUS + MILESTONES[0]!.chips });
  });

  it("ignores a code on an existing account, an unknown code and the player's own code", () => {
    const store = new Store(":memory:");
    const a = store.account("device-token-aaaaaaaaaaaa").id;
    store.account("device-token-aaaaaaaaaaaa", referralCode("someone-else"));
    store.account("device-token-bbbbbbbbbbbb", "NOPE99");
    expect(store.testSummary().referrals.joined).toBe(0);
    // A new account can't be referred by itself: its own code is made in the same step.
    const own = referralCode(store.account("device-token-cccccccccccc").id);
    expect(own).not.toBe(store.perks(a).referral.code);
    expect(store.testSummary().referrals.joined).toBe(0);
  });

  it("lets the owner make creator codes and counts who came through them", () => {
    const store = new Store(":memory:");
    expect(store.createCreatorCode("gianni", "Gianni")).toBe("GIANNI");
    expect(() => store.createCreatorCode("GIANNI", "Someone")).toThrow(/taken/);
    expect(() => store.createCreatorCode("a!", "Someone")).toThrow(/3 to 20/);
    const friend = store.account("device-token-ffffffffffff", "Gianni").id;
    play(store, [friend]);
    expect(store.balance(friend)).toBe(1000 - 25 + REFERRAL_BONUS + MILESTONES[0]!.chips);
    expect(store.creatorCodes()).toEqual([{ code: "GIANNI", creator: "Gianni", joined: 1, played: 1 }]);
    expect(store.audit().ok).toBe(true);
  });
});

describe("the rewards track", () => {
  it("pays each milestone once as hands are played", () => {
    const store = new Store(":memory:");
    const a = store.account("device-token-aaaaaaaaaaaa").id;
    const earned: number[] = [];
    for (let i = 0; i < 10; i++) for (const r of play(store, [a])[a]!) earned.push(r.chips);
    expect(earned).toEqual([100, 250, 500]);
    expect(store.balance(a)).toBe(1000 - 250 + 850);
    expect(store.perks(a).rewards).toMatchObject({ handsPlayed: 10, next: { hands: 25, chips: 1000 } });
  });

  it("pays the full-game bonus for all four quarters at one table", () => {
    const store = new Store(":memory:");
    const a = store.account("device-token-aaaaaaaaaaaa").id;
    for (const qtr of [1, 2, 3]) play(store, [a], { table: "m7", qtr });
    expect(play(store, [a], { table: "m7", qtr: 4 })[a]!.find((r) => r.kind === "full_game")?.chips).toBe(FULL_GAME_BONUS);
    // A fourth quarter somewhere else, without the first three there, earns nothing extra.
    expect(play(store, [a], { table: "t9", qtr: 4 })[a]!.some((r) => r.kind === "full_game")).toBe(false);
    expect(store.audit().ok).toBe(true);
  });

  it("is off for players on rewards=off, who still get referral bonuses", () => {
    const store = new Store(":memory:", parseVariants("rewards=off"));
    const inviter = store.account("device-token-inviter-0001").id;
    const friend = store.account("device-token-friend-00001", store.perks(inviter).referral.code).id;
    expect(store.perks(friend).rewards).toBeNull();
    expect(play(store, [friend])[friend]!.map((r) => r.kind)).toEqual(["referral"]);
  });
});
